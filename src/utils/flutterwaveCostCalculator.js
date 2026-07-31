// ============================================================================
// Calculates the price to charge a candidate so the admin nets EXACTLY
// adminSetPrice after ALL Flutterwave costs (collection fee + VAT + withdrawal fee + VAT).
//
// The withdrawal fee is intentionally HIDDEN inside "Service Charge".
// Imports rates from flutterwaveCostSearch.js so both files stay in sync.
//
// Math (merchant absorbs all fees):
//   Let P = displayPrice (customer pays), A = adminSetPrice (admin receives), W = withdrawal fee on A.
//   Total cost deducted from P:
//     collection: P * 2% + 7.5% VAT on that 2%  = P * 0.02 * 1.075
//     withdrawal: W + 7.5% VAT on W             = W * 1.075
//   Solve  P - (P * 0.02 * 1.075) - (W * 1.075) = A
//   =>     P = (A + W * 1.075) / (1 - 0.02 * 1.075)
//   P is ceiling-rounded to whole naira so the admin NEVER receives less than A.
// ============================================================================

import { FLW_RATES, getWithdrawalFee, calculateCollectionFee } from './flutterwaveCostSearch';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {number|string} adminSetPrice - the exact amount the admin wants to net (NGN)
 * @returns {{
 *   displayPrice: number,          // amount to charge on Flutterwave (what the customer pays)
 *   breakdown: { 'Form Price': number, VAT: number, 'Service Charge': number },
 *   totalCustomerPays: number,     // same as displayPrice
 *   adminReceives: number,         // exactly adminSetPrice
 *   _withdrawalFee: number         // internal only — NEVER render this to users
 * }}
 */
export function calculateFormCharges(adminSetPrice) {
  const A = Number(adminSetPrice);

  if (!Number.isFinite(A) || A <= 0) {
    return {
      displayPrice: 0,
      breakdown: { 'Form Price': 0, VAT: 0, 'Service Charge': 0 },
      totalCustomerPays: 0,
      adminReceives: 0,
      _withdrawalFee: 0
    };
  }

  // Withdrawal tier is based on the net settlement amount (= what admin keeps).
  const withdrawalFee = getWithdrawalFee(A);

  const denominator = 1 - FLW_RATES.collection.totalRate * (1 + FLW_RATES.collection.vatRate);
  const displayPrice = Math.ceil(
    (A + withdrawalFee * (1 + FLW_RATES.withdrawal.vatRate)) / denominator
  );

  const collectionFee = calculateCollectionFee(displayPrice).fee; // 2% pre-VAT on P
  const serviceCharge = collectionFee + withdrawalFee;            // withdrawal hidden in here
  // VAT absorbs the ceil-rounding so the rows always sum EXACTLY to totalCustomerPays
  const vat = round2(displayPrice - A - serviceCharge);

  return {
    displayPrice,
    breakdown: {
      'Form Price': A,
      VAT: vat,
      'Service Charge': round2(serviceCharge)
    },
    totalCustomerPays: displayPrice,
    adminReceives: A,
    _withdrawalFee: withdrawalFee
  };
}