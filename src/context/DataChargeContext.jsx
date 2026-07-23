// NAMTLS DataCharge v4.0 - Activation + Withdrawal + Form Purchase
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
      formPurchaseSettings: null, saveFormPurchaseSettings: async () => ({ success: false, message: 'Context not available' }),
      formPurchases: [], loadFormPurchases: async () => {},
      ADMIN_ID: 'Admin@Namatls128756BC',
      WITHDRAWAL_PIN: '1966',
      OPAY_ACCOUNT: '9167557038'
    };
  }
  return ctx;
}

async function sendFlutterwavePayout(amount, accountNumber, narration) {
  try {
    const response = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, accountNumber, narration: narration || 'NAMTLS E-Voting Withdrawal' })
    });
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return { success: false, message: `API returned non-JSON: ${text.substring(0, 300)}` };
    }
    return await response.json();
  } catch (e) {
    return { success: false, message: `Network error: ${e.message}` };
  }
}

export function DataChargeProvider({ children }) {
  const [totalCharged, setTotalCharged] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [withdrawalBalance, setWithdrawalBalance] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [formPurchaseSettings, setFormPurchaseSettings] = useState({
    positions: [], openingDate: '', openingTime: '', closingDate: '', closingTime: '', isActive: false
  });
  const [formPurchases, setFormPurchases] = useState([]);

  const loadBalance = async () => {
    try {
      const balanceDoc = await getDoc(doc(db, 'finances', 'withdrawalBalance'));
      if (balanceDoc.exists()) {
        setWithdrawalBalance(balanceDoc.data().balance || 0);
        setTotalCharged(balanceDoc.data().totalCharged || 0);
      } else {
        await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
          balance: 0, totalCharged: 0, totalReceived: 0, totalWithdrawn: 0, initializedAt: new Date().toISOString()
        });
        setWithdrawalBalance(0);
        setTotalCharged(0);
      }
    } catch (e) { console.log('Could not load balance:', e.message); }
  };

  const loadFormPurchaseSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'formPurchase'));
      if (settingsDoc.exists()) {
        setFormPurchaseSettings(settingsDoc.data());
      } else {
        const defaults = { positions: [], openingDate: '', openingTime: '', closingDate: '', closingTime: '', isActive: false, createdAt: new Date().toISOString() };
        await setDoc(doc(db, 'settings', 'formPurchase'), defaults);
        setFormPurchaseSettings(defaults);
      }
    } catch (e) { console.log('Could not load form purchase settings:', e.message); }
  };

  const loadFormPurchases = async () => {
    try {
      const purchasesSnap = await getDocs(collection(db, 'formPurchases'));
      const purchases = [];
      purchasesSnap.forEach(docSnap => { purchases.push({ id: docSnap.id, ...docSnap.data() }); });
      setFormPurchases(purchases);
    } catch (e) { console.log('Could not load form purchases:', e.message); }
  };

  useEffect(() => {
    loadBalance();
    loadFormPurchaseSettings();
    loadFormPurchases();
  }, []);

  const saveFormPurchaseSettings = async (settings) => {
    try {
      await setDoc(doc(db, 'settings', 'formPurchase'), settings, { merge: true });
      setFormPurchaseSettings(settings);
      return { success: true };
    } catch (e) { return { success: false, message: e.message }; }
  };

  const withdraw = async (adminId, pin, amount) => {
    if (adminId !== ADMIN_ID) return { success: false, message: 'Invalid Admin ID' };
    if (pin !== WITHDRAWAL_PIN) return { success: false, message: 'Invalid PIN' };
    if (amount <= 0) return { success: false, message: 'Invalid amount' };
    if (amount > withdrawalBalance) return { success: false, message: `Insufficient balance. Available: N${withdrawalBalance.toLocaleString()}` };

    const transferResult = await sendFlutterwavePayout(amount, OPAY_ACCOUNT, `NAMTLS withdrawal to Opay ${OPAY_ACCOUNT}`);
    if (!transferResult.success) return transferResult;
    if (transferResult.warning || transferResult.unverified) {
      return { success: false, message: transferResult.message, reference: transferResult.reference || '' };
    }

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
      return { success: true, message: 'Election activated FREE!' };
    }
    try {
      const txRef = `ACT-${academicYear.replace('/', '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const FlutterwaveCheckout = (await import('flutterwave-react-v3')).default;
      return new Promise((resolve) => {
        const config = {
          public_key: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY,
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

  // === NEW: Form Purchase Helper ===
  const purchaseForm = async (position, amount, candidateData) => {
    try {
      const txRef = `FORM-${position.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const FlutterwaveCheckout = (await import('flutterwave-react-v3')).default;
      return new Promise((resolve) => {
        const config = {
          public_key: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY,
          tx_ref: txRef,
          amount: amount,
          currency: 'NGN',
          payment_options: 'card,ussd,transfer,banktransfer',
          customer: { email: candidateData.email || 'candidate@namtls.edu.ng', name: candidateData.fullName },
          customizations: { title: 'NAMATL Form Purchase', description: `${position} candidacy form`, logo: 'https://namtls-election.vercel.app/logo.png' },
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
      totalCharged, sessionSeconds, sessionCost,
      withdrawalBalance, isCharging, setIsCharging,
      withdraw, checkActivationCost, processActivationPayment,
      purchaseForm, loadBalance,
      formPurchaseSettings, saveFormPurchaseSettings,
      formPurchases, loadFormPurchases,
      ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT
    }}>
      {children}
    </DataChargeContext.Provider>
  );
}