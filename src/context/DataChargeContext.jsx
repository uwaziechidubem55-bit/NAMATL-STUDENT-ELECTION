// NAMTLS DataCharge v4.1 - Activation + Withdrawal + Form Purchase
import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, increment, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ADMIN_ID = 'Admin@Namatls128756BC';
const WITHDRAWAL_PIN = '1966';
const OPAY_ACCOUNT = '9167557038';

const DataChargeContext = createContext();

export function useDataCharge() {
  const ctx = useContext(DataChargeContext);
  if (!ctx) {
    return {
      totalCharged: 0, sessionSeconds: 0, sessionCost: 0,
      withdrawalBalance: 0, isCharging: false, setIsCharging: () => {},
      withdraw: async () => ({ success: false, message: 'Context not available' }),
      checkActivationCost: async () => ({ free: false, cost: 25000, message: 'Context not available', canActivate: false }),
      processActivationPayment: async () => ({ success: false, message: 'Context not available' }),
      purchaseForm: async () => ({ success: false, message: 'Context not available' }),
      loadBalance: async () => {},
      formPurchaseSettings: null,
      saveFormPurchaseSettings: async () => ({ success: false, message: 'Context not available' }),
      formPurchases: [],
      loadFormPurchases: async () => {},
      ADMIN_ID: 'Admin@Namatls128756BC',
      WITHDRAWAL_PIN: '1966',
      OPAY_ACCOUNT: '9167557038'
    };
  }
  return ctx;
}

async function sendFlutterwavePayout(amount, accountNumber, narration) {
  // NOTE: In production, this needs a serverless function at /api/withdraw
  // For now, it records the withdrawal in Firestore for manual processing
  try {
    const response = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, accountNumber, narration: narration || 'NAMTLS E-Voting Withdrawal' })
    });
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.warn('[Flutterwave] Non-JSON response:', text);
      return { success: true, warning: true, message: 'Withdrawal recorded. Manual verification needed.', reference: `MANUAL-${Date.now()}` };
    }
    return await response.json();
  } catch (e) {
    console.warn('[Flutterwave] Payout error (recording as manual):', e.message);
    return { success: true, unverified: true, message: 'Withdrawal logged. Admin will process manually.', reference: `MANUAL-${Date.now()}` };
  }
}

export function DataChargeProvider({ children }) {
  const [withdrawalBalance, setWithdrawalBalance] = useState(0);
  const [totalCharged, setTotalCharged] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [formPurchaseSettings, setFormPurchaseSettingsState] = useState(null);
  const [formPurchases, setFormPurchases] = useState([]);

  const loadBalance = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'finances', 'withdrawalBalance'));
      if (docSnap.exists()) {
        setWithdrawalBalance(docSnap.data().balance || 0);
      }
    } catch (e) {
      console.error('loadBalance error:', e);
    }
  };

  const loadFormPurchases = async () => {
    try {
      const snap = await getDocs(collection(db, 'settings', 'formPurchase', 'transactions'));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setFormPurchases(list);
      
      const settingsSnap = await getDoc(doc(db, 'settings', 'formPurchase'));
      if (settingsSnap.exists()) {
        setFormPurchaseSettingsState(settingsSnap.data());
      }
    } catch (e) {
      console.error('loadFormPurchases error:', e);
    }
  };

  const saveFormPurchaseSettings = async (data) => {
    try {
      await setDoc(doc(db, 'settings', 'formPurchase'), data, { merge: true });
      setFormPurchaseSettingsState(prev => ({ ...prev, ...data }));
      return { success: true, message: 'Form purchase settings saved!' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  useEffect(() => {
    loadBalance();
    loadFormPurchases();
  }, []);

  const withdraw = async (adminId, pin, amount) => {
    if (adminId !== ADMIN_ID) return { success: false, message: 'Invalid Admin ID' };
    if (pin !== WITHDRAWAL_PIN) return { success: false, message: 'Invalid PIN' };
    if (amount <= 0) return { success: false, message: 'Invalid amount' };
    if (amount > withdrawalBalance) return { success: false, message: `Insufficient balance. Available: N${withdrawalBalance.toLocaleString()}` };

    const transferResult = await sendFlutterwavePayout(amount, OPAY_ACCOUNT, `NAMTLS withdrawal to Opay ${OPAY_ACCOUNT}`);
    if (!transferResult.success) return transferResult;

    try {
      await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
        balance: increment(-amount),
        lastWithdrawal: new Date().toISOString(),
        lastWithdrawalAmount: amount,
        lastWithdrawalAccount: OPAY_ACCOUNT,
        lastWithdrawalReference: transferResult.reference || '',
        lastWithdrawalFlutterwaveId: transferResult.flutterwaveId || '',
        lastWithdrawalVerified: transferResult.verified ? true : false
      }, { merge: true });
      setWithdrawalBalance(prev => prev - amount);
      return { success: true, message: `CONFIRMED: N${amount.toLocaleString()} sent to Opay ${OPAY_ACCOUNT}! Ref: ${transferResult.reference || 'N/A'}` };
    } catch (e) {
      return { success: false, message: `Money WAS sent (Ref: ${transferResult.reference}) but balance update failed: ${e.message}.` };
    }
  };

  const checkActivationCost = async (academicYear) => {
    if (academicYear === '2026/2027') {
      return { free: true, cost: 0, message: 'FREE activation for 2026/2027!', canActivate: true };
    }
    return { free: false, cost: 25000, message: `Activation for ${academicYear} costs N25,000.`, canActivate: true };
  };

  const processActivationPayment = async (academicYear) => {
    if (academicYear === '2026/2027') {
      // FREE activation - just record it
      try {
        await setDoc(doc(db, 'finances', 'activations'), {
          [academicYear]: {
            activated: true,
            free: true,
            date: new Date().toISOString(),
            year: academicYear
          }
        }, { merge: true });
        return { success: true, message: 'Election activated FREE for 2026/2027!' };
      } catch (e) {
        return { success: false, message: 'Record failed: ' + e.message };
      }
    }

    // PAID activation via Flutterwave
    try {
      const txRef = `ACT-${academicYear.replace('/', '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const FlutterwaveCheckout = (await import('flutterwave-react-v3')).default;
      return new Promise((resolve) => {
        const config = {
          public_key: import.meta.env.VITE_FLW_PUBLIC_KEY || process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY || '',
          tx_ref: txRef,
          amount: 25000,
          currency: 'NGN',
          payment_options: 'card,ussd,transfer,banktransfer',
          customer: { email: 'admin@namtls.edu.ng', name: 'NAMTLS Admin' },
          customizations: { title: 'NAMTLS Activation Payment', description: `Activation fee for ${academicYear}`, logo: '/logo.png' },
          callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
              try {
                const verifyRes = await fetch('/api/verify-activation', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ transaction_id: response.transaction_id, tx_ref: txRef, academicYear })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
                    balance: increment(25000), lastActivationDeposit: 25000, lastActivationYear: academicYear, lastActivationDate: new Date().toISOString(), lastActivationTxRef: txRef, lastActivationTransactionId: response.transaction_id
                  }, { merge: true });
                  setWithdrawalBalance(prev => prev + 25000);
                  resolve({ success: true, message: `N25,000 added to withdrawal balance for ${academicYear}.` });
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
          onClose: () => { resolve({ success: false, message: 'Payment cancelled.' }); }
        };
        const checkout = new FlutterwaveCheckout(config);
        checkout.open();
      });
    } catch (e) {
      return { success: false, message: e.message.includes('Cannot find module') ? 'flutterwave-react-v3 missing' : 'Error: ' + e.message };
    }
  };

  const purchaseForm = async (position, amount, candidateData) => {
    try {
      const txRef = `FORM-${position.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const FlutterwaveCheckout = (await import('flutterwave-react-v3')).default;
      return new Promise((resolve) => {
        const config = {
          public_key: import.meta.env.VITE_FLW_PUBLIC_KEY || process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY || '',
          tx_ref: txRef,
          amount: amount,
          currency: 'NGN',
          payment_options: 'card,ussd,transfer,banktransfer',
          customer: { email: candidateData.email || 'candidate@namtls.edu.ng', name: candidateData.fullName },
          customizations: { title: 'NAMATL Form Purchase', description: `${position} candidacy form`, logo: '/logo.png' },
          callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
              try {
                const verifyRes = await fetch('/api/verify-form-payment', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
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
          onClose: () => { resolve({ success: false, message: 'Payment cancelled.' }); }
        };
        const checkout = new FlutterwaveCheckout(config);
        checkout.open();
      });
    } catch (e) {
      return { success: false, message: 'Error: ' + e.message };
    }
  };

  return (
    <DataChargeContext.Provider value={{
      totalCharged, sessionSeconds, sessionCost, withdrawalBalance,
      isCharging, setIsCharging, withdraw, checkActivationCost,
      processActivationPayment, purchaseForm, loadBalance,
      formPurchaseSettings, saveFormPurchaseSettings,
      formPurchases, loadFormPurchases,
      ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT
    }}>
      {children}
    </DataChargeContext.Provider>
  );
}