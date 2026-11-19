# Manual Bank Transfer Payments

Bank transfer is a **second way to pay on the existing Form Purchase page**. It
is not a separate feature with its own price or its own on/off switch:

- **One price.** It uses the price you set for each position in **Form Purchase**.
- **No switch.** Save the bank name, account number and account name once. From
  then on it shows next to the Flutterwave button **whenever Form Purchase is
  live**, and disappears when Form Purchase is closed.
- **Nothing else changed.** The Flutterwave button, its amount and its checkout
  work exactly as before.

Nothing is credited automatically. Only an admin approval creates money, and it
goes through the **same atomic ledger** as Flutterwave, so the balance can never
be double-credited.

---

## 1. Set it up (one time)

1. Log in to the **Admin Dashboard**
2. Open the sidebar item **🏦 Bank Transfers**
3. Fill in **Bank name / Account number (10 digits) / Account name**
4. Type **your admin password** in the 🔒 box (see section 5)
5. Click **💾 Save bank details**

That is all. The banner at the top of the panel tells you where you stand:

| Banner | Meaning |
|---|---|
| ⚪ **NOT SET UP YET** | The three bank fields are not all saved |
| 🔵 **SAVED AND READY** | Saved. It will appear by itself as soon as Form Purchase is live |
| 🟢 **LIVE** | Students see Bank transfer next to Card / USSD right now |
| ⏸ **PAUSED** | You ticked "Pause bank transfer" — students cannot see it |

"Form Purchase is live" follows the same rule the student page already uses: the
Form Purchase switch is on, and the time is between the opening and closing date
and time (read as Nigerian time).

Optional fields on the same panel:

| Field | What it does |
|---|---|
| **Note shown under the account** | Short text under the account (e.g. "use your full name as narration") |
| **Extra instructions** | Longer guidance shown on the student page |
| **Pause bank transfer** | Hides bank transfer without deleting the account. Leave unticked for normal use |

There is **no price field**. Change a price in Form Purchase and bank transfer
follows it immediately.

---

## 2. What the student sees

`/purchase-form` → pick a position → **Fill Your Details** (the same four boxes
as before: name, department, level, email) → **Choose how to pay**:

- **💳 Pay ₦5,121** — the existing Flutterwave button, unchanged
- **🏦 Pay ₦5,000 by bank transfer** — new

> The two amounts differ on purpose: card / USSD is the form price **plus** the
> Flutterwave VAT and service charge; bank transfer is the form price only. The
> page says so under the buttons.

Choosing bank transfer (the details must be filled first) opens:

1. The association's bank name, account number, account name and exact amount
2. Details from the alert: amount, date, their bank, account paid from, receiver
   name, bank reference
3. Screenshot upload of the bank alert (the existing proof-of-payment upload)
4. A live **Before you submit** checklist so obvious mistakes are caught early
5. Submit → a reference like `MT-20261109-X8KQ2PWM`

The student's details are **not asked a second time** — the bank panel uses what
they typed in the details form.

A **🏦 Paid by bank transfer? Check your payment status** link stays on the page
(even after Form Purchase closes) so they can look up a payment with the
reference + the exact amount. Recent references are remembered in that browser.

If the bank settings cannot be loaded for any reason, the page simply shows the
Flutterwave button alone, exactly as it did before.

### Statuses the student sees

| Status | Message |
|---|---|
| `pending` | "Pending review" |
| `approving` | "Being approved" |
| `approved` | "Approved" |
| `rejected` | The admin's reason, plus a **Submit again** button |

---

## 3. What the checker verifies

`auditManualProof()` in `api/_manualpayment.js` runs on submit **and** again when
an admin opens the record (so the report is never stale). Each check is one of
✅ pass / ⚠️ warn / ❌ fail.

| # | Check | Fails / warns when |
|---|---|---|
| 1 | Receiving account matches ours | The alert shows a different account number |
| 2 | Receiver name is ours | Name doesn't match the saved account name |
| 3 | Amount is correct | Less than the Form Purchase price (₦1 tolerance); far more is a warning |
| 4 | Payment date is valid | Future or unreadable date; over 7 days old is a warning |
| 5 | Your paying account is readable | Missing or malformed sender digits (warning) |
| 6 | Not a self-transfer to our account | Sender account is the receiving account |
| 7 | Your bank name is provided | Blank (warning) |
| 8 | Bank reference / session ID | Missing or very short (warning) |
| 9 | Transfer can be identified | Neither a bank reference nor a 10-digit sender account |
| 10 | Screenshot of the alert attached | No image, or an image that was **not uploaded through the portal** |
| 11 | Screenshot fingerprint recorded | The image file's fingerprint is stored so it cannot be reused |
| 12 | Not already submitted | Same bank reference, **or** same screenshot, **or** same sender + amount + date |

Names are compared by significant words, because banks print them in any order
(`UWAZIE DANIEL CHIDUBEM` vs `Daniel Chidubem Uwazie` both pass).

### Verdict

| Verdict | Meaning |
|---|---|
| ✅ `clean` | Every check passed |
| ⚠️ `review` | No failures, but something needs a human eye |
| ⛔ `blocked` | At least one hard failure — the dashboard warns you loudly |

> **Automated checks cannot detect a forged screenshot.** A screenshot proves
> nothing by itself. Always open your real bank app and find the money before
> approving. The approval step now makes you confirm this (section 4).

---

## 4. Approving

Open a submission → compare the claim, the screenshot and the checker report →

1. Tick **"I have opened my bank app and seen this money arrive in the account"**
2. Type the **amount you saw in your bank app**
3. If any check failed, tick the extra box to approve anyway (not recommended)
4. **✅ Approve & credit balance** — or **⛔ Reject**, which requires a reason

The server refuses the approval unless the tick is there, the amount you typed
matches what the student entered (₦1 tolerance) **and** it covers the current
Form Purchase price. The amount you typed is what is added to the balance.

On approval (`approveManualPayment`):

1. The live price is re-read — a price change after submission cannot be
   approved at the old amount
2. The record is atomically claimed (`pending` → `approving`) so two admins on
   two phones cannot both approve it
3. One-time locks are taken on the bank reference, the screenshot and the
   sender + amount + date, so the same transfer cannot be approved twice under
   two submissions
4. `creditPaymentOnce()` writes the receipt and increments
   `finances/withdrawalBalance` in **one Firestore transaction**, keyed on
   `MANUAL-<reference>` — a retry or a double-click can never double-credit
5. A `formPurchases/{id}` doc is written, exactly like a Flutterwave form
   payment, so the **Purchase List** and candidate flow work unchanged
6. A `MANUAL_PAYMENT_APPROVED` audit entry is written

If an approval is interrupted halfway (bad network), the record stays under
**Pending** and can be finished a minute later without crediting twice. If
the ledger refuses, the submission goes back to `pending` with the reason.
A payment whose money is already in the ledger cannot be rejected.

---

## 5. Security

| Protection | What it does |
|---|---|
| **Password to change the account** | Adding or changing the bank name, account number or account name needs the admin password (the existing `ADMIN_PASSWORD`). 5 wrong tries lock bank changes for 15 minutes. Notes and Pause do not ask for it. Every change is written to the audit log |
| **Bank-app confirmation** | Approval needs the "I saw it in my bank app" tick and the amount typed by the admin |
| **Portal-only proof** | The screenshot must be one uploaded through the portal's own upload button. A link to any other image is refused |
| **Screenshot fingerprint** | Each image is fingerprinted (SHA-256). The same screenshot cannot be used for a second payment. If an image could not be fingerprinted, the admin sees a warning on that submission |
| **Duplicate refusal** | Same bank reference, same screenshot, or same sender + amount + date is refused at submit, and locked at approval |
| **Traceable transfers only** | Every submission must carry a bank reference (6+ characters) or the 10-digit account it was paid from |
| **Server-side rules** | The server itself checks that Form Purchase is open (30-minute grace for uploading proof after closing time), the 5-per-position limit, no future dates, and that the amount is not above 10× the fee |
| **Rate limits per device/network** | Submissions: 10 per 10 minutes, 60 per day. Proof uploads: 20 per hour, 80 per day. Wrong status look-ups: 12 per 15 minutes |
| **Unguessable references** | References are random (`MT-YYYYMMDD-XXXXXXXX`) |
| **Minimal status reply** | The status look-up returns only the status and the reason. A wrong reference and a wrong amount get the same answer, and the screenshot link is never returned |

---

## 6. API surface

Everything below respects the **Vercel Hobby 12-function limit**. No new
serverless function was created: the public routes are `vercel.json` rewrites
into the existing `api/student.js` and `api/upload.js`.

| Route | Rewrites to | Auth |
|---|---|---|
| `POST /api/manual-payment/settings` | `api/student?action=manualSettings` | public |
| `POST /api/manual-payment/submit` | `api/student?action=manualSubmit` | public, rate-limited |
| `POST /api/manual-payment/status` | `api/student?action=manualStatus` | public (reference + amount), rate-limited |
| `POST /api/manual-payment/proof-upload` | `api/upload?purpose=proof` | public, size-capped, rate-limited |
| `POST /api/upload` | `api/upload?purpose=candidate` | admin only (unchanged) |

Admin actions on `POST /api/admin` (admin JWT required):

- `getManualPaymentSettings` / `saveManualPaymentSettings` (password for account changes)
- `listManualPayments` (`status`: `pending` \| `approved` \| `rejected` \| `all`)
- `getManualPayment` (re-runs the checker against live settings)
- `approveManualPayment` / `rejectManualPayment`

### Firestore

| Path | Contents |
|---|---|
| `settings/manualPayment` | Bank account, notes, pause tick. (No price, no on/off switch) |
| `settings/formPurchase` | **Existing.** Position prices and the live window — the single source of the price |
| `manualPayments/{reference}` | One row per submission: claim, checks, verdict, status, review |
| `manualPaymentLocks/{key}` | One-time locks taken at approval (bank reference / screenshot / sender+amount+date) |
| `manualPaymentSecurity/bankChange` | Wrong-password counter and lock for bank account changes |
| `rateLimits/{key}` | Short-lived request counters (the address is stored hashed) |
| `paymentReceipts/MANUAL-<ref>` | The shared ledger receipt (same as Flutterwave) |
| `formPurchases/{id}` | Created on approval, same shape as a Flutterwave form purchase |

All of these are written by the server (`firebase-admin`). Students never read
or write Firestore directly for bank transfers.

---

## 7. Required environment variables

None are new.

```
ADMIN_PASSWORD            # existing — also asked when the bank account is changed
CLOUDINARY_CLOUD_NAME     # existing — proof screenshots
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Screenshots land in the Cloudinary folder `namatl/payment-proofs` (images only,
≤ 6 MB). If Cloudinary is not configured, bank transfer cannot accept proof and
the student can still use the card checkout.

---

## 8. Files

| File | Role |
|---|---|
| `api/_manualpayment.js` | Availability rule, the checker, duplicate detection, submit / approve / reject / status |
| `api/_ratelimit.js` | Small request-counter helper (not a serverless function) |
| `api/student.js` | 3 public actions (`manualSettings`, `manualSubmit`, `manualStatus`) |
| `api/admin.js` | 6 admin actions + the password check for account changes |
| `api/upload.js` | Signed proof uploads (`?purpose=proof`) alongside candidate photos |
| `vercel.json` | The rewrites above (unchanged) |
| `src/components/ManualBankPayment.jsx` | Student bank panel + status look-up |
| `src/utils/manualPayment.js` | Client parsers, pre-flight checks, fetch helpers |
| `src/pages/PurchaseForm.jsx` | Second "pay by bank transfer" button under the existing Flutterwave button |
| `src/pages/AdminDashboard.jsx` | Bank details panel + review queue + approval step |
| `tests/manual-payment.test.mjs` | Automated tests for the server rules |

### Running the tests

```
node --import ./tests/helpers/register.mjs --test tests/manual-payment.test.mjs
```

The tests use an in-memory stand-in for Firestore, so they never touch the real
database.
