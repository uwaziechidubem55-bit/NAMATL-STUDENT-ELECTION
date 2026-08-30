// v4.3.2 - All privileged Firestore ops moved server-side via /api/admin (rules stay locked)
// NAMTLS DataCharge v4.3.5 - FIXED: loadBalance uses adminApi to read balance through locked Firestore rules
import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { adminApi } from '../utils/adminApi';

// ===== READ FROM ENVIRONMENT VARIABLES =====
const ADMIN_ID = import.meta.env.VITE_ADMIN_ID || '';
const OPAY_ACCOUNT = import.meta.env.VITE_OPAY_ACCOUNT || '';

const DataChargeContext = createContext();

export function useDataCharge() {
  const ctx = useContext(DataChargeContext);
  if (!ctx) {
    return {
      withdrawalBalance: 0,
      loadBalance: async () => {},
      withdraw: async () => ({ success: false, message: 'Context not available' }),
      checkActivationCost: async () => ({ free: false, cost: 25000, message: 'Context not available', canActivate: false }),
      processActivationPayment: async () => ({ success: false, message: 'Context not available' }),
      purchaseForm: async () => ({ success: false, message: 'Context not available' }),
      saveFormPurchaseSettings: async () => ({ success: false, message: 'Context not available' }),
      loadFormPurchases: async () => {},
      formPurchaseSettings: null,
      formPurchases: [],
      ADMIN_ID: import.meta.env.VITE_ADMIN_ID || '',
      OPAY_ACCOUNT: import.meta.env.VITE_OPAY_ACCOUNT || ''
    };
  }
  return ctx;
}

// ===== LOAD FLUTTERWAVE INLINE SCRIPT ONCE (CDN) =====
let flutterwavePromise = null;
function loadFlutterwaveInline() {
  if (!flutterwavePromise) {
    flutterwavePromise = new Promise((resolve, reject) => {
      if (window.FlutterwaveCheckout) {
        resolve(window.FlutterwaveCheckout);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.onload = () => {
        if (typeof window.FlutterwaveCheckout === 'function') {
          resolve(window.FlutterwaveCheckout);
        } else {
          reject(new Error('FlutterwaveCheckout not available after script load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Flutterwave Inline script. Check your internet.'));
      document.head.appendChild(script);
    });
  }
  return flutterwavePromise;
}

async function sendFlutterwavePayout(amount, accountNumber, narration, adminId, pin) {
  try {
    const response = await fetch('/api/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
      },
      body: JSON.stringify({
        amount,
        accountNumber,
        narration: narration || 'NAMTLS E-Voting',
        adminId,
        pin
      }),
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: 'Network error: ' + e.message };
  }
}

export function DataChargeProvider({ children }) {
  const [withdrawalBalance, setWithdrawalBalance] = useState(0);
  const [formPurchaseSettings, setFormPurchaseSettings] = useState(null);
  const [formPurchases, setFormPurchases] = useState([]);

  // ✅ FIXED: Reads balance securely via adminApi (bypasses locked client rules)
  const loadBalance = async () => {
    try {
      const res = await adminApi('getBalance');
      if (res && res.data) {
        setWithdrawalBalance(Number(res.data.balance || 0));
      }
    } catch (e) {
      console.log('Could not load balance:', e.message);
    }
  };

  const loadFormPurchaseSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'formPurchase'));
      if (snap.exists()) {
        setFormPurchaseSettings(snap.data());
      }
    } catch (e) {
      console.log('Could not load form purchase settings:', e.message);
    }
  };

  const saveFormPurchaseSettings = async (settings) => {
    try {
      await adminApi('saveFormPurchaseSettings', { data: settings });
      setFormPurchaseSettings(settings);
      return { success: true, message: 'Form purchase settings saved!' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  const loadFormPurchases = async () => {
    try {
      const res = await adminApi('listFormPurchases');
      setFormPurchases(res.items || []);
    } catch (e) {
      console.log('Could not load form purchases:', e.message);
    }
  };

  useEffect(() => {
    loadBalance();
    loadFormPurchaseSettings();
  }, []);

  // === WITHDRAW ===
  const withdraw = async (adminId, pin, amount) => {
    if (amount <= 0) return { success: false, message: 'Invalid withdrawal amount' };

    const transferResult = await sendFlutterwavePayout(
      amount,
      OPAY_ACCOUNT,
      `NAMTLS E-Voting withdrawal to Opay ${OPAY_ACCOUNT}`,
      adminId,
      pin
    );
    if (!transferResult.success) return transferResult;
    if (transferResult.warning || transferResult.unverified) {
      return { success: false, message: transferResult.message, reference: transferResult.reference || '' };
    }

    setWithdrawalBalance(prev => prev - amount);
    return {
      success: true,
      message: `CONFIRMED: ₦${amount.toLocaleString()} sent to Opay ${OPAY_ACCOUNT}! Ref: ${transferResult.reference || 'N/A'}`
    };
  };

  const checkActivationCost = async (academicYear) => {
    // Activation fee now comes from the Super Admin price book (Firestore:
    // settings/activationPricing). Falls back to the old fixed ₦25,000 if
    // the price book is unreachable or has not been set yet.
    try {
      const res = await adminApi('getActivationPricing');
      const p = res.pricing || {};
      if ((p.freeYears || []).includes(academicYear)) {
        return { free: true, cost: 0, message: `FREE activation for ${academicYear}!`, canActivate: true };
      }
      const total = Number(p.total) || 0;
      const breakdown = p.usingFallback
        ? ''
        : ` — Database Maintenance ₦${(p.maintenance || 0).toLocaleString()} + Site Update ₦${(p.siteUpdate || 0).toLocaleString()} + Database Upgrading ₦${(p.databaseUpgrading || 0).toLocaleString()}`;
      return { free: false, cost: total, breakdown: p, message: `Activation for ${academicYear} costs ₦${total.toLocaleString()}${breakdown}.`, canActivate: true };
    } catch (e) {
      // SAFETY: if the price book cannot be read, NEVER guess — block activation.
      // (Previously this fell back to "2026/2027 = free", which could silently
      // skip payment on a network error. Free must ALWAYS come from the price book.)
      return { free: false, cost: 0, canActivate: false, message: '⚠️ Could not read the activation price book. Check your connection (or log out and log back in) and try again.' };
    }
  };

  // === Activation Payment ===
  const processActivationPayment = async (academicYear) => {
    // Free/paid + the exact amount now come from the Super Admin price book.
    const costInfo = await checkActivationCost(academicYear);
    if (!costInfo.canActivate) {
      return { success: false, message: costInfo.message };
    }
    if (costInfo.free) {
      return { success: true, message: 'Election activated FREE!' };
    }
    try {
      const FlutterwaveCheckout = await loadFlutterwaveInline();
      const txRef = `ACT-${academicYear.replace('/', '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      return new Promise((resolve) => {
        FlutterwaveCheckout({
          public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
          tx_ref: txRef,
          amount: costInfo.cost, // from the Super Admin price book
          currency: 'NGN',
          payment_options: 'card,ussd,transfer,banktransfer',
          customer: { email: 'officialelectoralcommission@gmail.com', name: 'NAMTLS Admin' },
          customizations: {
            title: 'NAMTLS Activation Payment',
            description: `Activation fee for ${academicYear}`,
            logo: window.location.origin + '/logo.png'
          },
          callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
              try {
                const verifyRes = await fetch('/api/verify-activation', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
                  },
                  body: JSON.stringify({ transaction_id: response.transaction_id, tx_ref: txRef, academicYear })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  await loadBalance();
                  resolve({ success: true, message: verifyData.message });
                } else {
                  resolve({ success: false, message: `Verification failed: ${verifyData.message}. Ref: ${txRef}` });
                }
              } catch (verifyErr) {
                resolve({ success: false, message: `Server error: ${verifyErr.message}. Ref: ${txRef}` });
              }
            } else {
              resolve({ success: false, message: 'Payment not completed.' });
            }
          },
          onclose: () => { resolve({ success: false, message: 'Payment cancelled.' }); }
        });
      });
    } catch (e) {
      return { success: false, message: 'Error: ' + e.message };
    }
  };

  // === Form Purchase ===
  const purchaseForm = async (position, amount, candidateData) => {
    try {
      const FlutterwaveCheckout = await loadFlutterwaveInline();
      const txRef = `FORM-${position.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      return new Promise((resolve) => {
        FlutterwaveCheckout({
          public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
          tx_ref: txRef,
          amount: amount,
          currency: 'NGN',
          payment_options: 'card,ussd,transfer,banktransfer',
          customer: { email: candidateData.email || 'candidate@namtls.edu.ng', name: candidateData.fullName },
          customizations: {
            title: 'NAMTLS Form Purchase',
            description: `${position} candidacy form`,
            logo: window.location.origin + '/logo.png'
          },
          callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
              try {
                const verifyRes = await fetch('/api/verify-form-payment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
                  },
                  body: JSON.stringify({ transaction_id: response.transaction_id, position, amount, candidateData })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  await loadBalance();
                  await loadFormPurchases();
                  resolve({ success: true, message: verifyData.message });
                } else {
                  resolve({ success: false, message: `Verification failed: ${verifyData.message}` });
                }
              } catch (verifyErr) {
                resolve({ success: false, message: `Server error: ${verifyErr.message}` });
              }
            } else {
              resolve({ success: false, message: 'Payment not completed.' });
            }
          },
          onclose: () => { resolve({ success: false, message: 'Payment cancelled.' }); }
        });
      });
    } catch (e) {
      return { success: false, message: 'Error: ' + e.message };
    }
  };

  return (
    <DataChargeContext.Provider value={{
      withdrawalBalance,
      loadBalance,
      withdraw,
      checkActivationCost,
      processActivationPayment,
      purchaseForm,
      saveFormPurchaseSettings,
      loadFormPurchases,
      formPurchaseSettings,
      formPurchases,
      ADMIN_ID,
      OPAY_ACCOUNT
    }}>
      {children}
    </DataChargeContext.Provider>
  );
}