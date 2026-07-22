/**
 * NORMALIZE MATRIC NUMBER
 * 
 * Canonical form: uppercase, trimmed, 5-digit middle segment zero-padded.
 * 
 * Examples:
 *   "CMO/MTL/1709/2025"  → "CMO/MTL/01709/2025"
 *   "CMO/MTL/00361/2025" → "CMO/MTL/00361/2025" (unchanged)
 *   "CMOS/11639/2023"    → "CMOS/11639/2023" (unchanged)
 */
export function normalizeMatric(raw) {
  if (!raw || typeof raw !== 'string') return '';
  
  // Step 1: Trim, uppercase, collapse internal whitespace
  let cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  
  // Step 2: Split into segments by '/'
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    // Format: PREFIX/DIGITS/YEAR  (e.g. CMOS/11639/2023)
    // 4-digit middle → 5-digit with leading zero
    if (/^\d{4}$/.test(parts[1])) {
      parts[1] = '0' + parts[1];
    }
    return parts.join('/');
  }
  
  if (parts.length === 4) {
    // Format: PREFIX/ALPHA/DIGITS/YEAR  (e.g. CMO/MTL/00361/2025)
    // 4-digit third segment → 5-digit with leading zero
    if (/^\d{4}$/.test(parts[2])) {
      parts[2] = '0' + parts[2];
    }
    return parts.join('/');
  }
  
  // Unknown format — return cleaned as-is
  return cleaned;
}

/**
 * Extract the first 5 numeric digits for verification.
 * For CMO/MTL/00361/2025 → "00361"
 * For CMOS/11639/2023    → "11639"
 */
export function getFirst5Digits(matric) {
  if (!matric || typeof matric !== 'string') return '';
  const cleaned = matric.trim().toUpperCase();
  const numbers = cleaned.match(/\d+/g);
  if (!numbers || numbers.length === 0) return '';
  const combined = numbers.join('');
  return combined.substring(0, 5);
}

/**
 * Convert matric to a valid Firestore document ID.
 * All '/' replaced with '_'.
 * CMO/MTL/00361/2025 → "CMO_MTL_00361_2025"
 */
export function getDocId(matric) {
  if (!matric || typeof matric !== 'string') return '';
  return matric.replace(/\//g, '_');
}

/**
 * Validate basic matric format.
 * Accepts:
 *   CMOS/11639/2023       (3-part: prefix/digits/year)
 *   CMO/MTL/00361/2025    (4-part: prefix/alpha/digits/year)
 *   CMO/MTL/1709/2025     (4-digit middle — will be normalized later)
 */
export function isValidMatricFormat(matric) {
  if (!matric || typeof matric !== 'string') return false;
  const cleaned = matric.trim().toUpperCase().replace(/\s+/g, '');
  
  // Debug: log what we're testing
  console.log('[matricHelpers] isValidMatricFormat testing:', JSON.stringify(cleaned));
  
  // 3-part: CMOS/11639/2023
  // 4-part: CMO/MTL/00361/2025
  const regex = /^[A-Z]+(?:\/[A-Z]+)?\/\d{4,5}\/\d{4}$/;
  const result = regex.test(cleaned);
  console.log('[matricHelpers] isValidMatricFormat result:', result);
  return result;
}