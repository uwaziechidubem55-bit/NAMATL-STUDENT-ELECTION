/**
 * Normalize a matric number to the canonical 5-digit internal format.
 *
 * Accepts both 4-digit and 5-digit middle segments.
 * - CMOS/11639/2023  → already 5-digit, returned as-is (normalized)
 * - CMO/MTL/1709/2025 → 4-digit, prepend 0 → CMO/MTL/01709/2025
 *
 * Also strips leading/trailing whitespace and uppercases.
 */
export function normalizeMatric(raw) {
  if (!raw) return '';
  const cleaned = raw.trim().toUpperCase();
  
  // Replace a 4-digit number between slashes with its 5-digit zero-padded form
  // e.g., /1709/ → /01709/
  return cleaned.replace(/\/(\d{4})\//g, (match, digits) => {
    return `/0${digits}/`;
  });
}

/**
 * Extract first 5 digits from the numeric parts of a matric number.
 * Used as a lightweight verification step during registration.
 */
export function getFirst5Digits(matric) {
  const cleaned = matric.trim().toUpperCase();
  const numbers = cleaned.match(/\d+/g);
  if (!numbers) return '';
  return numbers.join('').substring(0, 5);
}

/**
 * Convert a matric number to a Firestore document ID.
 * All '/' replaced with '_'.
 */
export function getDocId(matric) {
  return matric.replace(/\//g, '_');
}

/**
 * Validate basic matric format.
 * Expected patterns like CMOS/11639/2023 or CMO/MTL/01709/2025
 */
export function isValidMatricFormat(matric) {
  const cleaned = matric.trim().toUpperCase();
  // Prefix followed by /, then 4-5 digits, optional / and more digits
  return /^[A-Z]+\/[A-Z]*\d{4,5}\/\d{4}$/.test(cleaned) ||
         /^[A-Z]+\/\d{4,5}\/\d{4}$/.test(cleaned);
}
