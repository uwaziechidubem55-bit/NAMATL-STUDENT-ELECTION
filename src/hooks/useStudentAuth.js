import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ALLOWED_MATRIC_NUMBER from '../config/students';
import { normalizeMatric, getFirst5Digits, getDocId, isValidMatricFormat } from '../utils/matricHelpers';

function generateUniqueKey() {
  const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase();
  return `${randomPart}-NAMATLEC`;
}

/**
 * Retry a Firebase operation up to `retries` times with delay.
 * Catches "offline" errors which Firestore throws when security rules deny access.
 */
async function firestoreRetry(fn, retries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const isOffline = msg.includes('offline') || msg.includes('unavailable') || msg.includes('permission-denied');
      
      if (attempt < retries && isOffline) {
        console.log(`[firestoreRetry] Attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err; // Last attempt or non-offline error — throw
    }
  }
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
      const docId = getDocId(normalizedMatric);
      console.log('[useStudentAuth] Checking Firestore docId:', docId);
      const studentRef = doc(db, 'students', docId);

      const studentSnap = await firestoreRetry(() => getDoc(studentRef));

      if (studentSnap.exists()) {
        showMessage('error', 'Matric Number already registered. Please Login.');
        setLoading(false);
        return { success: false, reason: 'already_registered' };
      }

      setLoading(false);
      return {
        success: true,
        phase: 'verify',
        tempStudent: { name, matric: normalizedMatric, level },
      };
    } catch (e) {
      console.error('[useStudentAuth] Signup Firestore error:', e);
      const msg = e.message || '';
      if (msg.includes('offline') || msg.includes('unavailable')) {
        showMessage('error', 'Cannot reach the database. Check your internet connection and make sure Firestore security rules allow reads (no auth required).');
      } else if (msg.includes('permission-denied')) {
        showMessage('error', 'Firestore rules are blocking reads. Update rules to allow read/write without authentication.');
      } else {
        showMessage('error', 'ERROR: ' + msg.substring(0, 120));
      }
      setLoading(false);
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
      const key = generateUniqueKey();
      const newStudent = {
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
        uniqueKey: key,
        hasVoted: false,
        createdAt: new Date().toISOString(),
      };

      const docId = getDocId(tempStudent.matric);
      console.log('[useStudentAuth] Writing to Firestore docId:', docId);

      await firestoreRetry(() => setDoc(doc(db, 'students', docId), newStudent));

      console.log('[useStudentAuth] Firestore write successful');

      const sessionInfo = {
        name: newStudent.name,
        matric: newStudent.matric,
        level: newStudent.level,
        hasVoted: newStudent.hasVoted,
      };
      localStorage.setItem('studentSession', JSON.stringify(sessionInfo));
      console.log('[useStudentAuth] Session saved to localStorage');

      setLoading(false);
      return { success: true, phase: 'key', generatedKey: key };
    } catch (e) {
      console.error('[useStudentAuth] completeSignup error:', e);
      const msg = e.message || '';
      if (msg.includes('offline') || msg.includes('unavailable')) {
        showMessage('error', 'Cannot reach the database. Check connection and Firestore security rules.');
      } else if (msg.includes('permission-denied')) {
        showMessage('error', 'Firestore rules blocking writes. Update rules to allow write without auth.');
      } else {
        showMessage('error', 'ERROR: ' + msg.substring(0, 120));
      }
      setLoading(false);
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
      const docId = getDocId(normalizedMatric);
      console.log('[useStudentAuth] Looking up Firestore docId:', docId);
      const studentRef = doc(db, 'students', docId);

      const studentSnap = await firestoreRetry(() => getDoc(studentRef));

      if (!studentSnap.exists()) {
        showMessage('error', 'Matric Number not registered. Please sign up first.');
        setLoading(false);
        return { success: false, reason: 'not_registered' };
      }

      const foundStudent = studentSnap.data();
      console.log('[useStudentAuth] Found student:', foundStudent.name);

      setLoading(false);
      return { success: true, phase: 'key', tempStudent: foundStudent };
    } catch (e) {
      console.error('[useStudentAuth] Login Firestore error:', e);
      const msg = e.message || '';
      if (msg.includes('offline') || msg.includes('unavailable')) {
        showMessage('error', 'Cannot reach the database. Check connection and Firestore rules.');
      } else if (msg.includes('permission-denied')) {
        showMessage('error', 'Firestore rules blocking reads. Update rules to allow read without auth.');
      } else {
        showMessage('error', 'ERROR: ' + msg.substring(0, 120));
      }
      setLoading(false);
      return { success: false };
    }
  };

  const verifyKeyAccess = async (tempStudent, uniqueKeyInput) => {
    console.log('[useStudentAuth] verifyKeyAccess for matric:', tempStudent.matric);

    if (uniqueKeyInput.trim() === tempStudent.uniqueKey) {
      const sessionInfo = {
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
        hasVoted: tempStudent.hasVoted,
      };
      localStorage.setItem('studentSession', JSON.stringify(sessionInfo));
      console.log('[useStudentAuth] Key verified, session saved');
      return { success: true };
    } else {
      showMessage('error', 'Incorrect Unique Code. Access Denied');
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