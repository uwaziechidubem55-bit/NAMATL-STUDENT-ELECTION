import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ALLOWED_MATRIC_NUMBER from '../config/students';
import { normalizeMatric, getFirst5Digits, getDocId, isValidMatricFormat } from '../utils/matricHelpers';

/**
 * Generates a cryptographically secure unique key.
 */
function generateUniqueKey() {
  const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase();
  return `${randomPart}-NAMATLEC`;
}

export default function useStudentAuth() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const isAllowedMatric = (matric) => {
    return ALLOWED_MATRIC_NUMBER.includes(matric);
  };

  const handleSignup = async (formData) => {
    const { name, matric, level } = formData;
    
    if (!name || !matric || !level) {
      showMessage('error', 'Please fill all fields');
      return { success: false };
    }

    const rawMatric = matric.trim().toUpperCase();
    
    if (!isValidMatricFormat(rawMatric)) {
      showMessage('error', 'Invalid matric number format');
      return { success: false };
    }

    // Normalize: convert 4-digit middle to 5-digit with leading zero
    const normalizedMatric = normalizeMatric(rawMatric);

    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      const docId = getDocId(normalizedMatric);
      const studentRef = doc(db, 'students', docId);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        showMessage('error', 'Matric Number already registered. Please Login.');
        setLoading(false);
        return { success: false, reason: 'already_registered' };
      }

      // Return data needed for verification popup (no Firebase write yet)
      setLoading(false);
      return {
        success: true,
        phase: 'verify',
        tempStudent: { name, matric: normalizedMatric, level },
      };
    } catch (e) {
      showMessage('error', 'ERROR: ' + e.message);
      setLoading(false);
      return { success: false };
    }
  };

  const completeSignup = async (tempStudent, fiveDigitCode) => {
    const correctCode = getFirst5Digits(tempStudent.matric);
    
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
      await setDoc(doc(db, 'students', docId), newStudent);

      // Only store non-sensitive info in localStorage
      const sessionInfo = {
        name: newStudent.name,
        matric: newStudent.matric,
        level: newStudent.level,
        hasVoted: newStudent.hasVoted,
      };
      localStorage.setItem('studentSession', JSON.stringify(sessionInfo));

      setLoading(false);
      return { success: true, phase: 'key', generatedKey: key };
    } catch (e) {
      showMessage('error', 'ERROR: ' + e.message);
      setLoading(false);
      return { success: false };
    }
  };

  const handleLogin = async (matric) => {
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

    // Check if matric is even on the allowed list (quick reject)
    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      const docId = getDocId(normalizedMatric);
      const studentRef = doc(db, 'students', docId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        showMessage('error', 'Matric Number not registered. Please sign up first.');
        setLoading(false);
        return { success: false, reason: 'not_registered' };
      }

      const foundStudent = studentSnap.data();
      setLoading(false);
      return { success: true, phase: 'key', tempStudent: foundStudent };
    } catch (e) {
      showMessage('error', 'ERROR: ' + e.message);
      setLoading(false);
      return { success: false };
    }
  };

  const verifyKeyAccess = async (tempStudent, uniqueKeyInput) => {
    if (uniqueKeyInput.trim() === tempStudent.uniqueKey) {
      // Store session (without key for security)
      const sessionInfo = {
        name: tempStudent.name,
        matric: tempStudent.matric,
        level: tempStudent.level,
        hasVoted: tempStudent.hasVoted,
      };
      localStorage.setItem('studentSession', JSON.stringify(sessionInfo));
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