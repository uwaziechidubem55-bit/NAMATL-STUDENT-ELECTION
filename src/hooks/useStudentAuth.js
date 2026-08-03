import { useState } from 'react';
import ALLOWED_MATRIC_NUMBER from '../config/students';
import { normalizeMatric, getFirst5Digits, isValidMatricFormat } from '../utils/matricHelpers';

/**
 * POST to a Vercel serverless function and return parsed JSON.
 * Throws an Error with .status so callers can branch on 404/409/etc.
 */
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON error body */ }

  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function useStudentAuth() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    console.log(`[useStudentAuth] Message: ${type} — ${text}`);
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 6000);
  };

  const isAllowedMatric = (matric) => {
    const found = ALLOWED_MATRIC_NUMBER.includes(matric);
    console.log('[useStudentAuth] isAllowedMatric:', matric, '→', found);
    return found;
  };

  const handleSignup = async (formData) => {
    const { name, matric, level } = formData;

    if (!name || !matric || !level) {
      showMessage('error', 'Please fill all fields');
      return { success: false };
    }

    const rawMatric = matric.trim().toUpperCase();
    if (!isValidMatricFormat(rawMatric)) {
      showMessage('error', 'Invalid matric number format. Use CMOS/XXXXX/XXXX or CMO/MTL/XXXXX/XXXX');
      return { success: false };
    }

    const normalizedMatric = normalizeMatric(rawMatric);
    if (!normalizedMatric) {
      showMessage('error', 'Could not normalize matric number. Check format.');
      return { success: false };
    }

    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      // Duplicate check, server-side: 200 = already registered, 404 = free to register.
      await apiPost('/api/student-login', { matric: normalizedMatric });

      showMessage('error', 'Matric Number already registered. Please Login.');
      setLoading(false);
      return { success: false, reason: 'already_registered' };
    } catch (e) {
      if (e.status === 404) {
        // Not registered yet — proceed to the 5-digit verification step.
        setLoading(false);
        return {
          success: true,
          phase: 'verify',
          tempStudent: { name, matric: normalizedMatric, level },
        };
      }
      console.error('[useStudentAuth] Signup server error:', e);
      setLoading(false);
      showMessage('error', e.status >= 500 ? 'Server error. Please try again.' : e.message);
      return { success: false };
    }
  };

  const completeSignup = async (tempStudent, fiveDigitCode) => {
    console.log('[useStudentAuth] completeSignup — matric:', tempStudent.matric, 'code entered:', fiveDigitCode);

    const correctCode = getFirst5Digits(tempStudent.matric);
    console.log('[useStudentAuth] correct code from matric:', correctCode);

    if (fiveDigitCode !== correctCode) {
      showMessage('error', 'Incorrect verification code');
      return { success: false };
    }

    setLoading(true);
    try {
      // Create the student record server-side (firebase-admin bypasses rules).
      const data = await apiPost('/api/student-register', {
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
      });

      console.log('[useStudentAuth] Firestore write successful (server-side)');

      localStorage.setItem('studentSession', JSON.stringify({
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
        hasVoted: false,
      }));
      console.log('[useStudentAuth] Session saved to localStorage');

      setLoading(false);
      return { success: true, phase: 'key', generatedKey: data.uniqueKey };
    } catch (e) {
      console.error('[useStudentAuth] completeSignup error:', e);
      setLoading(false);
      showMessage('error', e.message);
      return { success: false };
    }
  };

  const handleLogin = async (matric) => {
    console.log('[useStudentAuth] handleLogin called with matric:', JSON.stringify(matric));

    if (!matric) {
      showMessage('error', 'Please enter your Matric Number');
      return { success: false };
    }

    const rawMatric = matric.trim().toUpperCase();
    if (!isValidMatricFormat(rawMatric)) {
      showMessage('error', 'Invalid matric number format');
      return { success: false };
    }

    const normalizedMatric = normalizeMatric(rawMatric);
    if (!normalizedMatric) {
      showMessage('error', 'Could not normalize matric number');
      return { success: false };
    }

    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      const data = await apiPost('/api/student-login', { matric: normalizedMatric });
      console.log('[useStudentAuth] Found student:', data.student.name);

      setLoading(false);
      return { success: true, phase: 'key', tempStudent: data.student };
    } catch (e) {
      console.error('[useStudentAuth] Login server error:', e);
      setLoading(false);
      if (e.status === 404) {
        showMessage('error', 'Matric Number not registered. Please sign up first.');
        return { success: false, reason: 'not_registered' };
      }
      showMessage('error', e.message);
      return { success: false };
    }
  };

  const verifyKeyAccess = async (tempStudent, uniqueKeyInput) => {
    console.log('[useStudentAuth] verifyKeyAccess for matric:', tempStudent.matric);

    setLoading(true);
    try {
      // Key is compared against the server copy — the browser never sees stored keys.
      await apiPost('/api/student-verify-key', {
        matric: tempStudent.matric,
        uniqueKey: uniqueKeyInput,
      });

      localStorage.setItem('studentSession', JSON.stringify({
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
        hasVoted: !!tempStudent.hasVoted,
      }));
      console.log('[useStudentAuth] Key verified, session saved');

      setLoading(false);
      return { success: true };
    } catch (e) {
      console.error('[useStudentAuth] Key verification error:', e);
      setLoading(false);
      showMessage('error', e.message);
      return { success: false };
    }
  };

  return {
    loading,
    message,
    showMessage,
    handleSignup,
    completeSignup,
    handleLogin,
    verifyKeyAccess,
  };
}