# Manual Bank Transfer Payments

Students who cannot use the Flutterwave card/USSD checkout can pay the **same
amount** into the association's published bank account, upload proof, and wait
for the Electoral Commission to approve it from the Admin Dashboard.

Nothing is credited automatically. Only an admin approval creates money, and it
goes through the **same atomic ledger** as Flutterwave, so the balance can never
be double-credited.

---

## 1. Turn it on (one time)

1. Log in to the **Admin Dashboard**
2. Open the sidebar item **🏦 Bank Transfers**
3. Fill in **Bank name / Account number / Account name**
4. Tick **Show bank transfer on the student purchase page**
5. Click **💾 Save bank details**

Bank details live in Firestore at `settings/manualPayment`. Students never read
Firestore directly — the public page gets them from
`POST /api/manual-payment/settings`, which returns only the account, the price
list and whether the option is open.

Optional extras on the same panel:

| Field | What it does |
|---|---|
| **Manual transfer price ₦** | Flat amount to charge instead of each position's price. Leave blank to use the position price. |
| **Note shown under the account** | Free text under the account (e.g. "use your full name as narration"). |
| **Extra instructions** | Longer guidance shown on the student page. |

---

## 2. What the student sees

`/purchase-form` → pick a position → **How do you want to pay?** → **🏦 Bank transfer**

1. The association's bank name, account number and account name
2. Their details (name, department, level, email)
3. Details from the alert: amount, date, their bank, account paid from, receiver name, bank reference
4. Screenshot upload of the bank alert
5. A live **🔍 Before you submit** checklist (✓ / ⚠ / ✕) so obvious mistakes are
   caught before submission
6. Submit → gets a reference like `MT-20261109-X8KQ2P`

They can close the page and come back any time to
**📄 Check a previous payment** with the reference + exact amount. Recent
references are remembered in that browser.

### Statuses the student sees

| Status | Message |
|---|---|
| `pending` | "Pending review — come back later" |
| `approving` | "Being approved" |
| `approved` | "Approved — your form is registered" |
| `rejected` | The admin's reason, plus a **Submit again** button |

---

## 3. What the checker verifies

`auditManualProof()` in `api/_manualpayment.js` runs on submit **and** again when
an admin opens the record (so the report is never stale). Each check is one of
✅ pass / ⚠️ warn / ❌ fail.

| # | Check | Fail condition |
|---|---|---|
| 1 | Receiving account matches ours | The alert shows a different account number |
| 2 | Receiver name is ours | Name doesn't match the published account name |
| 3 | Amount is correct | Paid less than the live fee (₦1 tolerance) |
| 4 | Payment date is valid | Future date, unreadable date, or over 7 days old |
| 5 | Your paying account is readable | Missing / malformed sender digits |
| 6 | Not a self-transfer | Sender account == receiving account |
| 7 | Your bank name is provided | Blank |
| 8 | Bank reference / session ID | Missing or very short |
| 9 | Screenshot of the alert attached | No image, or not an https URL |
| 10 | Not already submitted | Same bank reference, **or** same sender + amount + date |

Names are compared by significant tokens, because banks print them in any order
(`UWAZIE DANIEL CHIDUBEM` vs `Daniel Chidubem Uwazie` both pass).

### Verdict

| Verdict | Meaning |
|---|---|
| ✅ `clean` | Every check passed |
| ⚠️ `review` | No failures, but something needs a human eye |
| ⛔ `blocked` | At least one hard failure — the dashboard warns you loudly |

The queue list shows a `n ✕` / `n ⚠` badge per submission so you can triage
without opening anything.

> **Automated checks cannot detect a forged screenshot.** Always look at the
> uploaded image, and confirm the credit in your actual bank app before
> approving large amounts. The dashboard says this too.

---

## 4. Approving

Open a submission → review the claim vs the screenshot and the checker output →
**✅ Approve & credit balance** (or **⛔ Reject**, which requires a reason).

On approval (`approveManualPayment`):

1. The live price is re-read from Firestore — a price change after submission
   cannot be approved at the old amount
2. The record is atomically claimed (`pending` → `approving`) so two admins on
   two phones cannot both approve it
3. `creditPaymentOnce()` writes the receipt and increments
   `finances/withdrawalBalance` in **one Firestore transaction**, keyed on
   `MANUAL-<reference>` — a retry, a double-click or the webhook can never
   double-credit
4. Form purchases get a `formPurchases/{id}` doc, exactly like a Flutterwave
   form payment, so the Purchase List and candidate flow work unchanged
5. An `MANUAL_PAYMENT_APPROVED` audit entry is written

If the ledger refuses (e.g. the year was already activated) the submission is
put back to `pending` with the reason — nothing is silently lost.

---

## 5. API surface

Everything below respects the **Vercel Hobby 12-function limit**. No new
serverless function was created: the public routes are `vercel.json` rewrites
into the existing `api/student.js` and `api/upload.js`.

| Route | Rewrites to | Auth |
|---|---|---|
| `POST /api/manual-payment/settings` | `api/student?action=manualSettings` | public |
| `POST /api/manual-payment/submit` | `api/student?action=manualSubmit` | public |
| `POST /api/manual-payment/status` | `api/student?action=manualStatus` | public (reference + amount) |
| `POST /api/manual-payment/proof-upload` | `api/upload?purpose=proof` | public, size-capped |
| `POST /api/upload` | `api/upload?purpose=candidate` | admin only |

Admin actions on `POST /api/admin` (admin JWT required):

- `getManualPaymentSettings` / `saveManualPaymentSettings`
- `listManualPayments` (`status`: `pending` \| `approved` \| `rejected` \| `all`)
- `getManualPayment` (re-runs the checker against live settings)
- `approveManualPayment` / `rejectManualPayment`

### Firestore

| Path | Contents |
|---|---|
| `settings/manualPayment` | Bank account, on/off switch, optional flat price, notes |
| `manualPayments/{id}` | One row per submission: claim, checks, verdict, status, review |
| `paymentReceipts/MANUAL-<ref>` | The shared ledger receipt (same as Flutterwave) |
| `formPurchases/{id}` | Created on approval for `purpose: 'form'` |

---

## 6. Required environment variables

None are new. Proof uploads reuse the Cloudinary trio that candidate photos
already use:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Screenshots land in the Cloudinary folder `namatl/payment-proofs` (images only,
≤ 6 MB). If Cloudinary is not configured, the screenshot upload fails with a
clear message and the student can still use the card checkout.

---

## 7. Files

| File | Role |
|---|---|
| `api/_manualpayment.js` | **New.** Parsers, the checker, duplicate detection, approve/reject, settings |
| `api/student.js` | +3 public actions (`manualSettings`, `manualSubmit`, `manualStatus`) |
| `api/admin.js` | +6 admin actions |
| `api/upload.js` | Signed proof uploads (`?purpose=proof`) alongside candidate photos |
| `vercel.json` | 5 new rewrites |
| `src/components/ManualBankPayment.jsx` | **New.** Student panel + status tracking |
| `src/utils/manualPayment.js` | **New.** Client parsers, pre-flight checks, fetch helpers |
| `src/pages/PurchaseForm.jsx` | Payment-method chooser (Card/USSD vs Bank transfer) |
| `src/pages/AdminDashboard.jsx` | Bank details panel + review queue + detail drawer |
