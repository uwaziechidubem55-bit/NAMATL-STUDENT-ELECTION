// ============================================================================
// SINGLE SOURCE OF TRUTH — Flutterwave Nigeria (NGN) rates
// Source: https://flutterwave.com/ng/pricing (accessed 2026-07-31)
//         https://flutterwave.com/gb/support/pricing/value-added-tax-vat-for-flutterwave-merchants
// Local collection (all NGN methods): 2% = 1.4% transaction fee + 0.6% platform fee
// VAT: 7.5% charged on ALL Flutterwave fees (collections AND transfers)
// ============================================================================

export const FLW_RATES = {
  currency: 'NGN',

  collection: {
    transactionFeeRate: 0.014, // 1.4% transaction fee
    platformFeeRate: 0.006,    // 0.6% platform fee
    totalRate: 0.02,           // 1.4% + 0.6% = 2.0% (effective 11 Apr 2025)
    vatRate: 0.075,            // 7.5% VAT charged ON the fee
  },

  withdrawal: {
    vatRate: 0.075, // 7.5% VAT charged ON the transfer fee
    tiers: [
      { min: 0,        max: 5000,    fee: 10 }, // NGN 5,000 and below      -> NGN 10
      { min: 5001,     max: 50000,   fee: 25 }, // NGN 5,001 to NGN 50,000  -> NGN 25
      { min: 50001,    max: Infinity, fee: 50 } // above NGN 50,000          -> NGN 50
    ]
  }
};

/**
 * Flat withdrawal (bank transfer) fee for a given settlement amount.
 * @param {number|string} amount - amount Flutterwave transfers to the admin's bank (NGN)
 * @returns {number} flat fee in NGN (pre-VAT)
 */
export function getWithdrawalFee(amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return 0;
  const tier = FLW_RATES.withdrawal.tiers.find((t) => amt >= t.min && amt <= t.max);
  return tier ? tier.fee : FLW_RATES.withdrawal.tiers[FLW_RATES.withdrawal.tiers.length - 1].fee;
}

/**
 * Collection fee Flutterwave deducts on a customer payment.
 * @param {number|string} amount - the amount the customer pays (displayPrice) (NGN)
 * @returns {{ fee: number, vat: number, total: number }}
 *          fee   = 2% pre-VAT
 *          vat   = 7.5% VAT on the fee
 *          total = fee + vat
 */
export function calculateCollectionFee(amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return { fee: 0, vat: 0, total: 0 };
  const fee = amt * FLW_RATES.collection.totalRate;
  const vat = fee * FLW_RATES.collection.vatRate;
  return { fee, vat, total: fee + vat };
}