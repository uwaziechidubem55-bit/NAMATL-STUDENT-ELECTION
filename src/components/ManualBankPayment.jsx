import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchManualSettings,
  uploadProofImage,
  submitManualPayment,
  checkManualPaymentStatus,
  parsePaymentDate,
  preflightChecks,
  todayIso,
  rememberManualPayment,
  loadRememberedManualPayments,
} from '../utils/manualPayment';

// ============================================================================
// NAMATLS Manual Bank Transfer panel.
// Used by BOTH the public /purchase-form page and the admin dashboard:
//   - student picks "Bank transfer" instead of the Flutterwave card popup
//   - sees the association's published bank account
//   - pays with their own bank app, then submits date / amount / names / screenshot
//   - gets a reference like MT-20261109-X8KQ2P
//   - comes back later and sees Pending review / Approved / Rejected + reason
// No money is ever added here: api/admin.js approveManualPayment() does that.
// ============================================================================

const STATUS_UI = {
  pending: { bg: '#fef3c7', border: '#fde68a', color: '#92400e', icon: '⏳', label: 'Pending review' },
  approving: { bg: '#e0e7ff', border: '#c7d2fe', color: '#3730a3', icon: '🔄', label: 'Being approved' },
  approved: { bg: '#dcfce7', border: '#bbf7d0', color: '#15803d', icon: '✅', label: 'Approved' },
  rejected: { bg: '#fee2e2', border: '#fecaca', color: '#b91c1c', icon: '⛔', label: 'Rejected' },
};

const emptyForm = {
  fullName: '',
  department: '',
  level: '',
  email: '',
  amount: '',
  paymentDate: '',
  senderBank: '',
  senderAccount: '',
  senderHidden: false,
  receiverName: '',
  transferReference: '',
};

export default function ManualBankPayment({
  position = '',
  expectedAmount = 0,
  candidateData = {},
  onApproved,       // called with the submission once admin-approved (string status polled by parent)
  onDone,           // closes the panel / returns to position list
  compact = false,
}) {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  const [form, setForm] = useState({ ...emptyForm, ...candidateData, receiverName: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);

  const [trackRef, setTrackRef] = useState('');
  const [trackAmount, setTrackAmount] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [tracked, setTracked] = useState(null);
  const [remembered, setRemembered] = useState([]);

  const pollTimer = useRef(null);

  // ---------- load published bank account + official price ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchManualSettings();
        if (!alive) return;
        const s = res;
        setSettings(s);
        if (s.bank?.accountName) setForm(f => ({ ...f, receiverName: f.receiverName || s.bank.accountName }));
      } catch (e) {
        if (alive) setSettingsError(e.message || 'Could not load the bank account. Check your connection.');
      } finally {
        if (alive) setLoadingSettings(false);
      }
    })();
    setRemembered(loadRememberedManualPayments());
    return () => { alive = false; if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  const bank = settings?.bank || {};
  const requiredAmount = Number(expectedAmount) || Number(settings?.manualFormAmount) || 0;
  const officialReceiver = bank.accountName || '';

  // Prefill the amount once, but never fight the student if they edit it.
  useEffect(() => {
    if (requiredAmount > 0) setForm(f => (f.amount ? f : { ...f, amount: String(requiredAmount) }));
  }, [requiredAmount]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [key]: value }));
    setError('');
  };

  const checks = useMemo(() => preflightChecks({
    amount: form.amount,
    paymentDate: form.paymentDate,
    senderAccount: form.senderHidden ? '0000000000' : form.senderAccount,
    receiverName: form.receiverName,
    receiptUrl,
  }, {
    expectedAmount: requiredAmount,
    expectedAccount: bank.accountNumber,
    expectedAccountName: officialReceiver,
  }), [form, receiptUrl, requiredAmount, bank.accountNumber, officialReceiver]);

  const blockingIssues = checks.filter(c => c.status === 'fail');

  // ---------- screenshot ----------
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (!/^image\//i.test(file.type)) { setError('Please choose an image (JPG, PNG or WEBP).'); return; }
    if (file.size > 6 * 1024 * 1024) { setError('That image is over 6 MB. Take a smaller screenshot.'); return; }

    setReceiptFile(file);
    setReceiptUrl('');
    try {
      setReceiptPreview(URL.createObjectURL(file));
    } catch (err) { setReceiptPreview(''); }

    setUploading(true);
    try {
      const url = await uploadProofImage(file);
      setReceiptUrl(url);
    } catch (err) {
      setError(err.message || 'Upload failed. Try again.');
      setReceiptFile(null);
    } finally {
      setUploading(false);
    }
  };

  // ---------- submit ----------
  const handleSubmit = async () => {
    setError('');
    if (!form.fullName.trim() || !form.department.trim() || !form.level.trim()) {
      setError('Fill in your full name, department and level.');
      return;
    }
    if (!position) {
      setError('Choose the position you are contesting for first.');
      return;
    }
    if (uploading) { setError('Wait for your screenshot to finish uploading.'); return; }
    if (!receiptUrl) { setError('Attach the screenshot of your bank alert.'); return; }
    if (!parsePaymentDate(form.paymentDate)) {
      setError('Enter the payment date as shown on your alert, e.g. 09/11/2026.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitManualPayment({
        purpose: 'form',
        position,
        fullName: form.fullName.trim(),
        department: form.department.trim(),
        level: form.level.trim(),
        email: form.email.trim(),
        amount: Number(form.amount) || 0,
        paymentDate: form.paymentDate,
        senderBank: form.senderBank.trim(),
        senderAccount: form.senderHidden ? '' : form.senderAccount.trim(),
        senderHidden: form.senderHidden,
        receiverName: form.receiverName.trim(),
        transferReference: form.transferReference.trim(),
        receiptUrl,
      });

      const sub = res.submission;
      setSubmitted(sub);
      rememberManualPayment({ reference: sub.reference, amount: sub.amount, position: sub.position, status: 'pending' });
      setRemembered(loadRememberedManualPayments());
      setTrackRef(sub.reference);
      setTrackAmount(String(sub.amount));
      startPolling(sub.reference, sub.amount);
    } catch (e) {
      setError(e.message || 'Could not submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- status tracking ----------
  const doLookup = async (reference, amount) => {
    setTrackError('');
    setTracking(true);
    try {
      const res = await checkManualPaymentStatus(reference, amount);
      setTracked(res.submission);
      if (res.submission.status === 'approved' && typeof onApproved === 'function') {
        onApproved(res.submission);
      }
      return res.submission;
    } catch (e) {
      setTrackError(e.message || 'Could not find that submission.');
      return null;
    } finally {
      setTracking(false);
    }
  };

  const startPolling = (reference, amount) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    // Gentle: every 20s for ~3 min, so "pending" becomes "approved" without a refresh.
    let tries = 0;
    pollTimer.current = setInterval(async () => {
      tries += 1;
      if (tries > 9) { clearInterval(pollTimer.current); pollTimer.current = null; return; }
      const sub = await doLookup(reference, amount);
      if (sub && sub.status !== 'pending' && sub.status !== 'approving') {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }, 20000);
  };

  const handleTrack = (e) => {
    e?.preventDefault?.();
    if (!trackRef.trim() || !trackAmount) { setTrackError('Enter your reference and the exact amount you paid.'); return; }
    doLookup(trackRef.trim(), Number(trackAmount));
  };

  const reset = () => {
    setSubmitted(null);
    setTracked(null);
    setForm({ ...emptyForm, receiverName: officialReceiver, amount: requiredAmount ? String(requiredAmount) : '' });
    setReceiptFile(null);
    setReceiptPreview('');
    setReceiptUrl('');
    setError('');
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  // ---------- styles ----------
  const card = { background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', marginBottom: '14px' };
  const input = { width: '100%', padding: '11px 14px', marginBottom: '10px', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
  const label = { display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
  const row = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', fontSize: '14px', color: '#334155', borderBottom: '1px dashed #e2e8f0' };
  const primaryBtn = (busy) => ({ width: '100%', padding: '14px', background: busy ? '#94a3b8' : 'linear-gradient(135deg,#0f766e,#047857)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '15px', cursor: busy ? 'not-allowed' : 'pointer' });
  const ghostBtn = { padding: '8px 14px', background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' };

  const statusChip = (status, note) => {
    const ui = STATUS_UI[status] || STATUS_UI.pending;
    return (
      <div style={{ background: ui.bg, border: '1px solid ' + ui.border, color: ui.color, borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
        <div style={{ fontWeight: '800', fontSize: '15px' }}>{ui.icon} {ui.label}</div>
        {note && <div style={{ fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>{note}</div>}
      </div>
    );
  };

  if (loadingSettings) {
    return <div style={{ ...card, textAlign: 'center', color: '#64748b', fontSize: '14px' }}>⏳ Loading bank details…</div>;
  }

  if (settingsError) {
    return (
      <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca' }}>
        <div style={{ color: '#b91c1c', fontSize: '14px', marginBottom: '8px' }}>⛔ {settingsError}</div>
        <button onClick={() => window.location.reload()} style={ghostBtn}>🔄 Retry</button>
      </div>
    );
  }

  // =========================== SUBMITTED — status screen ===========================
  if (submitted) {
    const live = tracked && tracked.reference === submitted.reference ? tracked : submitted;
    return (
      <div style={card}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#0f172a' }}>🏦 Bank transfer submitted</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>
          The Electoral Commission will check your payment against the bank alert. Keep this reference.
        </p>

        <div style={{ background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ ...label, marginBottom: '2px' }}>Your reference</div>
          <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '1px' }}>{submitted.reference}</div>
          <button
            type="button"
            onClick={() => { try { navigator.clipboard.writeText(submitted.reference); } catch (e) {} }}
            style={{ ...ghostBtn, marginTop: '8px', padding: '5px 10px', fontSize: '12px' }}
          >📋 Copy</button>
        </div>

        {statusChip(live.status, live.status === 'approved'
          ? 'Your payment was confirmed. Your nomination form is now registered — come back for the next step.'
          : live.status === 'rejected'
            ? (live.reviewNote || 'The Commission could not confirm this transfer. Submit again with a clear screenshot.')
            : 'Your payment is being reviewed. Come back later and check the status.')}

        <div style={{ ...row, borderBottom: 'none' }}>
          <span>Amount paid</span><strong>₦{Number(live.amount).toLocaleString()}</strong>
        </div>
        <div style={{ ...row, borderBottom: 'none' }}>
          <span>Position</span><strong>{live.position || position}</strong>
        </div>
        {live.paymentDate && (
          <div style={{ ...row, borderBottom: 'none' }}>
            <span>Payment date</span><strong>{live.paymentDate}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            onClick={() => doLookup(live.reference, live.amount)}
            disabled={tracking}
            style={{ ...ghostBtn, opacity: tracking ? 0.6 : 1 }}
          >{tracking ? '⏳ Checking…' : '🔎 Check status now'}</button>
          {live.status === 'rejected' && (
            <button onClick={reset} style={{ ...ghostBtn, borderColor: '#0f766e', color: '#0f766e' }}>↩️ Submit again</button>
          )}
          {typeof onDone === 'function' && live.status !== 'approved' && (
            <button onClick={onDone} style={ghostBtn}>← Back</button>
          )}
        </div>

        {live.status === 'pending' && (
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '12px 0 0 0' }}>
            This page checks automatically. You can close it and come back with your reference.
          </p>
        )}
      </div>
    );
  }

  // =========================== TRACKED — someone else's reference ===========================
  if (tracked) {
    return (
      <div style={card}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px' }}>📄 {tracked.reference}</h3>
        {statusChip(tracked.status, tracked.status === 'approved'
          ? 'Approved — your payment has been confirmed.'
          : tracked.status === 'rejected'
            ? (tracked.reviewNote || 'Rejected.')
            : 'Still waiting for the Electoral Commission to review your proof.')}
        <div style={{ ...row, borderBottom: 'none' }}><span>Name</span><strong>{tracked.fullName}</strong></div>
        <div style={{ ...row, borderBottom: 'none' }}><span>Amount</span><strong>₦{Number(tracked.amount).toLocaleString()}</strong></div>
        {tracked.position && <div style={{ ...row, borderBottom: 'none' }}><span>Position</span><strong>{tracked.position}</strong></div>}
        <div style={{ ...row, borderBottom: 'none' }}><span>Submitted</span><strong>{tracked.submittedAt ? new Date(tracked.submittedAt).toLocaleString() : '—'}</strong></div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button onClick={() => doLookup(tracked.reference, tracked.amount)} style={ghostBtn} disabled={tracking}>{tracking ? '⏳ Checking…' : '🔎 Refresh'}</button>
          <button onClick={() => setTracked(null)} style={ghostBtn}>← Back</button>
        </div>
      </div>
    );
  }

  // =========================== FORM ===========================
  return (
    <div>
      {/* ---- our bank account ---- */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#ecfdf5,#f0fdfa)', border: '1px solid #99f6e4' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
          🏦 Pay into this account
        </div>
        {settings?.enabled === false ? (
          <div style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}>
            ⚠️ Bank transfer has not been switched on yet. Use the card/USSD option instead.
          </div>
        ) : (
          <>
            <div style={{ ...row, borderBottom: '1px dashed #99f6e4' }}><span>Bank</span><strong>{bank.bankName || '—'}</strong></div>
            <div style={{ ...row, borderBottom: '1px dashed #99f6e4' }}>
              <span>Account number</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '17px', letterSpacing: '1px' }}>{bank.accountNumber || '—'}</strong>
            </div>
            <div style={{ ...row, borderBottom: 'none' }}><span>Account name</span><strong style={{ textAlign: 'right' }}>{bank.accountName || '—'}</strong></div>
            {requiredAmount > 0 && (
              <div style={{ ...row, borderBottom: 'none' }}>
                <span>Exact amount</span><strong>₦{requiredAmount.toLocaleString()}</strong>
              </div>
            )}
            {bank.extraNote && (
              <p style={{ fontSize: '12px', color: '#0f766e', margin: '10px 0 0 0', lineHeight: 1.5 }}>{bank.extraNote}</p>
            )}
            {settings?.instructions && (
              <p style={{ fontSize: '12px', color: '#475569', margin: '10px 0 0 0', lineHeight: 1.5 }}>{settings.instructions}</p>
            )}
            <p style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', borderRadius: '6px', padding: '8px 10px', margin: '12px 0 0 0', lineHeight: 1.5 }}>
              ⚠️ Pay the <strong>exact amount</strong> and keep the alert. A different account number or a different name means the payment will be rejected.
            </p>
          </>
        )}
      </div>

      {/* ---- details ---- */}
      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>✍️ Your details</div>

        <input placeholder="Full name" value={form.fullName} onChange={set('fullName')} style={input} disabled={submitting} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input placeholder="Department" value={form.department} onChange={set('department')} style={input} disabled={submitting} />
          <input placeholder="Level" value={form.level} onChange={set('level')} style={input} disabled={submitting} />
        </div>
        <input placeholder="Email (optional)" value={form.email} onChange={set('email')} style={input} disabled={submitting} />

        <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '6px 0 10px 0' }}>🧾 Details from your alert</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={label}>Amount paid ₦</label>
            <input type="number" inputMode="numeric" placeholder={requiredAmount ? String(requiredAmount) : '0'} value={form.amount} onChange={set('amount')} style={input} disabled={submitting} />
          </div>
          <div>
            <label style={label}>Date paid</label>
            <input type="text" placeholder="09/11/2026" value={form.paymentDate} onChange={set('paymentDate')} style={input} disabled={submitting} />
          </div>
        </div>
        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '-6px 0 12px 0' }}>Date format: day/month/year, e.g. 09/11/2026. Today is {todayIso()}.</p>

        <label style={label}>Your bank</label>
        <input placeholder="e.g. Opay, GTBank, UBA" value={form.senderBank} onChange={set('senderBank')} style={input} disabled={submitting} />

        <label style={label}>Account you paid from</label>
        <input inputMode="numeric" placeholder="10-digit account number" value={form.senderAccount} onChange={set('senderAccount')} style={input} disabled={submitting || form.senderHidden} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.senderHidden} onChange={set('senderHidden')} disabled={submitting} />
          My bank hid the sender account on the alert
        </label>

        <label style={label}>Receiver name on the alert</label>
        <input placeholder={officialReceiver || 'Name shown as the receiver'} value={form.receiverName} onChange={set('receiverName')} style={input} disabled={submitting} />

        <label style={label}>Bank reference / session ID (optional but helps)</label>
        <input placeholder="e.g. 0001234567890" value={form.transferReference} onChange={set('transferReference')} style={input} disabled={submitting} />

        <label style={label}>Screenshot of the bank alert *</label>
        <input type="file" accept="image/*" onChange={handleFile} disabled={submitting || uploading} style={{ ...input, padding: '9px 12px' }} />
        {uploading && <p style={{ fontSize: '13px', color: '#0f766e', margin: 0 }}>⏳ Uploading screenshot…</p>}
        {receiptUrl && <p style={{ fontSize: '13px', color: '#15803d', margin: 0 }}>✅ Screenshot attached</p>}
        {receiptPreview && (
          <img src={receiptPreview} alt="Proof preview" style={{ marginTop: '10px', width: '100%', maxWidth: '240px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
        )}
      </div>

      {/* ---- pre-flight checks ---- */}
      <div style={{ ...card, background: '#f8fafc' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>🔍 Before you submit</div>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', padding: '4px 0', color: c.status === 'fail' ? '#b91c1c' : c.status === 'warn' ? '#92400e' : '#334155' }}>
            <span>{c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'}</span>
            <span><strong>{c.label}</strong>{c.detail ? ' — ' + c.detail : ''}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '14px' }}>
          ⛔ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={submitting || uploading || settings?.enabled === false} style={primaryBtn(submitting || uploading || settings?.enabled === false)}>
        {submitting ? '⏳ Submitting…' : uploading ? '⏳ Uploading proof…' : '📤 Submit payment for review'}
      </button>

      {blockingIssues.length > 0 && (
        <p style={{ fontSize: '12px', color: '#b91c1c', margin: '10px 0 0 0', lineHeight: 1.5 }}>
          Fix the ❌ items above first — otherwise the Commission will reject this submission.
        </p>
      )}

      {typeof onDone === 'function' && (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={onDone} style={ghostBtn}>← Use card / USSD instead</button>
        </div>
      )}

      {/* ---- existing submissions ---- */}
      <div style={{ ...card, marginTop: '14px' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>📄 Check a previous payment</div>

        {remembered.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            {remembered.map(r => (
              <button
                key={r.reference}
                type="button"
                onClick={() => { setTrackRef(r.reference); setTrackAmount(String(r.amount)); doLookup(r.reference, r.amount); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                <strong style={{ fontFamily: 'monospace' }}>{r.reference}</strong>
                <span style={{ color: '#64748b' }}> — ₦{Number(r.amount).toLocaleString()} {r.position ? '· ' + r.position : ''}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleTrack}>
          <input placeholder="Reference (MT-…)" value={trackRef} onChange={e => setTrackRef(e.target.value)} style={{ ...input, fontFamily: 'monospace' }} />
          <input type="number" inputMode="numeric" placeholder="Exact amount you paid" value={trackAmount} onChange={e => setTrackAmount(e.target.value)} style={input} />
          <button type="submit" disabled={tracking} style={{ ...ghostBtn, width: '100%', padding: '11px' }}>{tracking ? '⏳ Checking…' : '🔎 Check status'}</button>
        </form>
        {trackError && <p style={{ fontSize: '13px', color: '#b91c1c', margin: '10px 0 0 0' }}>{trackError}</p>}
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', margin: '8px 0 0 0' }}>
        Bank transfers are checked by a human. <Link to="/support" style={{ color: '#0f766e' }}>Contact support</Link> if approval takes long.
      </p>
    </div>
  );
}
