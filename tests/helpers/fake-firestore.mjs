// ============================================================================
// A small in-memory stand-in for Firestore (admin SDK surface only), used by the
// manual bank-transfer tests so the REAL api/*.js code can run without touching
// the real database. It implements just what the api/ code calls:
//   db.doc(path) / db.collection(name) / runTransaction
//   ref.get/set/update/delete/create, collection.add/doc/where/orderBy/limit/get/count
//   FieldValue.increment / serverTimestamp / delete
// Transactions run one at a time and apply their writes together, which is the
// guarantee the api/ code relies on.
// ============================================================================

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

class Sentinel {
  constructor(kind, operand) { this.kind = kind; this.operand = operand; }
}

export const FieldValue = {
  increment: (n) => new Sentinel('increment', n),
  serverTimestamp: () => new Sentinel('serverTimestamp'),
  delete: () => new Sentinel('delete'),
};

function applyWrite(existing, incoming, merge) {
  const base = merge && existing ? clone(existing) : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value instanceof Sentinel) {
      if (value.kind === 'increment') base[key] = (Number(base[key]) || 0) + value.operand;
      else if (value.kind === 'serverTimestamp') base[key] = new Date();
      else if (value.kind === 'delete') delete base[key];
    } else if (value !== undefined) {
      base[key] = clone(value);
    }
  }
  return base;
}

class DocSnap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._data = data; this.exists = data !== undefined; }
  data() { return clone(this._data); }
}

class QuerySnap {
  constructor(docs) { this.docs = docs; this.size = docs.length; this.empty = docs.length === 0; }
  forEach(fn) { this.docs.forEach(fn); }
}

class DocRef {
  constructor(db, path) {
    const parts = String(path).split('/');
    if (parts.length % 2 !== 0 || parts.some(p => !p)) throw new Error(`Invalid document path: ${path}`);
    this.db = db; this.path = path; this.id = parts[parts.length - 1];
  }
  async get() { this.db.reads += 1; return new DocSnap(this, this.db.store.get(this.path)); }
  async set(data, opts = {}) { this.db._write(this.path, applyWrite(this.db.store.get(this.path), data, !!opts.merge)); }
  async update(data) {
    if (!this.db.store.has(this.path)) throw Object.assign(new Error('5 NOT_FOUND: No document to update'), { code: 5 });
    this.db._write(this.path, applyWrite(this.db.store.get(this.path), data, true));
  }
  async create(data) {
    if (this.db.store.has(this.path)) throw Object.assign(new Error('6 ALREADY_EXISTS: Document already exists'), { code: 6 });
    this.db._write(this.path, applyWrite(undefined, data, false));
  }
  async delete() { this.db.writes += 1; this.db.store.delete(this.path); }
}

class Query {
  constructor(db, collectionPath, filters = [], order = null, max = Infinity) {
    this.db = db; this.collectionPath = collectionPath; this.filters = filters; this.order = order; this.max = max;
  }
  where(field, op, value) { return new Query(this.db, this.collectionPath, [...this.filters, { field, op, value }], this.order, this.max); }
  orderBy(field, dir = 'asc') { return new Query(this.db, this.collectionPath, this.filters, { field, dir }, this.max); }
  limit(n) { return new Query(this.db, this.collectionPath, this.filters, this.order, n); }

  _matches() {
    // Real Firestore needs a composite index for "filter on one field, order by
    // another". The switch lets a test prove the code survives a missing index.
    if (this.db.requireCompositeIndex && this.order && this.filters.some(f => f.field !== this.order.field)) {
      throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
    }
    const prefix = this.collectionPath + '/';
    let rows = [];
    for (const [path, data] of this.db.store) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
      rows.push({ path, data });
    }
    for (const f of this.filters) {
      rows = rows.filter(({ data }) => {
        const v = data[f.field];
        switch (f.op) {
          case '==': return v === f.value;
          case '!=': return v !== undefined && v !== f.value;
          case 'in': return Array.isArray(f.value) && f.value.includes(v);
          case '>': return v > f.value;
          case '>=': return v >= f.value;
          case '<': return v < f.value;
          case '<=': return v <= f.value;
          case 'array-contains': return Array.isArray(v) && v.includes(f.value);
          default: throw new Error(`Unsupported operator in fake Firestore: ${f.op}`);
        }
      });
    }
    if (this.order) {
      const { field, dir } = this.order;
      rows = rows.filter(({ data }) => data[field] !== undefined);
      rows.sort((a, b) => {
        const x = a.data[field]; const y = b.data[field];
        const cmp = x < y ? -1 : x > y ? 1 : 0;
        return dir === 'desc' ? -cmp : cmp;
      });
    }
    return rows;
  }
  async get() {
    const rows = this._matches().slice(0, this.max);
    this.db.reads += Math.max(rows.length, 1);
    return new QuerySnap(rows.map(({ path, data }) => new DocSnap(new DocRef(this.db, path), data)));
  }
  count() {
    return { get: async () => { const n = this._matches().length; this.db.reads += 1; return { data: () => ({ count: n }) }; } };
  }
}

class CollectionRef extends Query {
  constructor(db, path) { super(db, path); this.id = path.split('/').pop(); }
  doc(id) { return new DocRef(this.db, `${this.collectionPath}/${id === undefined ? this.db._autoId() : id}`); }
  async add(data) { const ref = this.doc(); await ref.set(data); return ref; }
}

class Transaction {
  constructor(db) { this.db = db; this.ops = []; this.wrote = false; }
  async get(target) {
    if (this.wrote) throw new Error('Firestore transactions require all reads to be executed before all writes.');
    return target.get();
  }
  set(ref, data, opts = {}) { this.wrote = true; this.ops.push(() => this.db._write(ref.path, applyWrite(this.db.store.get(ref.path), data, !!opts.merge))); return this; }
  update(ref, data) {
    this.wrote = true;
    this.ops.push(() => {
      if (!this.db.store.has(ref.path)) throw Object.assign(new Error('5 NOT_FOUND: No document to update'), { code: 5 });
      this.db._write(ref.path, applyWrite(this.db.store.get(ref.path), data, true));
    });
    return this;
  }
  create(ref, data) {
    this.wrote = true;
    this.ops.push(() => {
      if (this.db.store.has(ref.path)) throw Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 });
      this.db._write(ref.path, applyWrite(undefined, data, false));
    });
    return this;
  }
  delete(ref) { this.wrote = true; this.ops.push(() => { this.db.writes += 1; this.db.store.delete(ref.path); }); return this; }
}

export class FakeFirestore {
  constructor() { this.reset(); }
  reset() {
    this.store = new Map();
    this.reads = 0;
    this.writes = 0;
    this.requireCompositeIndex = false;
    this.failNextTransactions = 0;
    this._seq = 0;
    this._queue = Promise.resolve();
  }
  _autoId() { this._seq += 1; return `auto${String(this._seq).padStart(6, '0')}`; }
  _write(path, data) { this.writes += 1; this.store.set(path, data); }
  doc(path) { return new DocRef(this, path); }
  collection(path) { return new CollectionRef(this, path); }

  runTransaction(fn) {
    const run = async () => {
      if (this.failNextTransactions > 0) {
        this.failNextTransactions -= 1;
        throw Object.assign(new Error('14 UNAVAILABLE: simulated outage'), { code: 14 });
      }
      const tx = new Transaction(this);
      const result = await fn(tx);
      // All-or-nothing: validate against a copy first, then commit.
      const backup = new Map(this.store);
      try {
        for (const op of tx.ops) op();
      } catch (e) {
        this.store = backup;
        throw e;
      }
      return result;
    };
    const next = this._queue.then(run, run);
    this._queue = next.then(() => undefined, () => undefined);
    return next;
  }

  // ---- helpers for tests ----
  seed(path, data) { this.store.set(path, clone(data)); }
  read(path) { return clone(this.store.get(path)); }
  list(collectionPath) {
    const prefix = collectionPath + '/';
    return [...this.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map(([p, d]) => ({ id: p.slice(prefix.length), ...clone(d) }));
  }
}

export function getFakeFirestore() {
  if (!globalThis.__NAMATL_FAKE_FIRESTORE__) globalThis.__NAMATL_FAKE_FIRESTORE__ = new FakeFirestore();
  return globalThis.__NAMATL_FAKE_FIRESTORE__;
}
