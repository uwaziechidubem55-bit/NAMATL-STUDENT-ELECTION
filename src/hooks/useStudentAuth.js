import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ALLOWED_MATRIC_NUMBER from '../config/students';
import { normalizeMatric, getFirst5Digits, getDocId, isValidMatricFormat } from '../utils/matricHelpers';

function generateUniqueKey() {
  const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 10).toUpperCase();
  return `${randomPart}-NAMATLEC`;
}

export default function useStudentAuth() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    console.log(`[useStudentAuth] Message: ${type} — ${text}`);
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const isAllowedMatric = (matric) => {
    console.log('[useStudentAuth] isAllowedMatric checking:', JSON.stringify(matric));
    // Debug: log first few entries to confirm format
    console.log('[useStudentAuth] First 5 allowed entries:', ALLOWED_MATRIC_NUMBER.slice(0, 5));
    const found = ALLOWED_MATRIC_NUMBER.includes(matric);
    console.log('[useStudentAuth] isAllowedMatric result:', found);
    return found;
  };

  const handleSignup = async (formData) => {
    const { name, matric, level } = formData;
    
    console.log('[useStudentAuth] handleSignup called with matric:', JSON.stringify(matric));
    
    if (!name || !matric || !level) {
      showMessage('error', 'Please fill all fields');
      return { success: false };
    }

    const rawMatric = matric.trim().toUpperCase();
    console.log('[useStudentAuth] rawMatric:', JSON.stringify(rawMatric));
    
    if (!isValidMatricFormat(rawMatric)) {
      showMessage('error', 'Invalid matric number format');
      return { success: false };
    }

    const normalizedMatric = normalizeMatric(rawMatric);
    console.log('[useStudentAuth] normalizedMatric:', JSON.stringify(normalizedMatric));

    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      const docId = getDocId(normalizedMatric);
      console.log('[useStudentAuth] Checking Firestore docId:', docId);
      const studentRef = doc(db, 'students', docId);
      const studentSnap = await getDoc(studentRef);

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
      showMessage('error', 'ERROR: ' + e.message);
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
      await setDoc(doc(db, 'students', docId), newStudent);
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
      showMessage('error', 'ERROR: ' + e.message);
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
    console.log('[useStudentAuth] rawMatric:', JSON.stringify(rawMatric));

    if (!isValidMatricFormat(rawMatric)) {
      showMessage('error', 'Invalid matric number format');
      return { success: false };
    }

    const normalizedMatric = normalizeMatric(rawMatric);
    console.log('[useStudentAuth] normalizedMatric:', JSON.stringify(normalizedMatric));

    if (!isAllowedMatric(normalizedMatric)) {
      showMessage('error', 'Access Denied. Matric Number not on voter list');
      return { success: false };
    }

    setLoading(true);
    try {
      const docId = getDocId(normalizedMatric);
      console.log('[useStudentAuth] Looking up Firestore docId:', docId);
      const studentRef = doc(db, 'students', docId);
      const studentSnap = await getDoc(studentRef);

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
      showMessage('error', 'ERROR: ' + e.message);
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