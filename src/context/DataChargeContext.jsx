// NAMTLS DataCharge v3.1 - Flutterwave Activation Payment
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

const CHARGE_RATE = 50;
const CHARGE_INTERVAL = 5000;
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
      loadBalance: async () => {},
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
      body: JSON.stringify({
        amount,
        accountNumber,
        narration: narration || 'NAMTLS E-Voting Withdrawal'
      })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        message: `API returned non-JSON response: ${text.substring(0, 300)}. Check api/withdraw.js for errors.`
      };
    }

    const data = await response.json();
    return data;
  } catch (e) {
    return { success: false, message: `Network error: ${e.message}` };
  }
}

export function DataChargeProvider({ children }) {
  const [totalCharged, setTotalCharged] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [withdrawalBalance, setWithdrawalBalance] = useState(0);
  const [isCharging, setIsCharging] = useState(true);
  const intervalRef = useRef(null);
  const secondsRef = useRef(null);

  const loadBalance = async () => {
    try {
      const balanceDoc = await getDoc(doc(db, 'finances', 'withdrawalBalance'));
      if (balanceDoc.exists()) {
        setWithdrawalBalance(balanceDoc.data().balance || 0);
        setTotalCharged(balanceDoc.data().totalCharged || 0);
      }
    } catch (e) {
      console.log('Could not load balance:', e.message);
    }
  };

  const saveCharge = async (amount) => {
    try {
      await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
        balance: increment(amount),
        totalCharged: increment(amount),
        lastCharge: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.log('Could not save charge:', e.message);
    }
  };

  useEffect(() => {
    loadBalance();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (secondsRef.current) clearInterval(secondsRef.current);

    intervalRef.current = setInterval(() => {
      if (!isCharging) return;
      setTotalCharged(prev => prev + CHARGE_RATE);
      setSessionCost(prev => prev + CHARGE_RATE);
      setWithdrawalBalance(prev => prev + CHARGE_RATE);
      saveCharge(CHARGE_RATE);
    }, CHARGE_INTERVAL);

    secondsRef.current = setInterval(() => {
      setSessionSeconds(prev => prev + 5);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (secondsRef.current) clearInterval(secondsRef.current);
    };
  }, [isCharging]);

  const withdraw = async (adminId, pin, amount) => {
    if (adminId !== ADMIN_ID) return { success: false, message: 'Invalid Admin ID' };
    if (pin !== WITHDRAWAL_PIN) return { success: false, message: 'Invalid Withdrawal PIN' };
    if (amount <= 0) return { success: false, message: 'Invalid withdrawal amount' };
    if (amount > withdrawalBalance) return { success: false, message: `Insufficient balance. Available: N${withdrawalBalance.toLocaleString()}` };

    const transferResult = await sendFlutterwavePayout(
      amount,
      OPAY_ACCOUNT,
      `NAMTLS E-Voting withdrawal to Opay ${OPAY_ACCOUNT}`
    );

    if (!transferResult.success) {
      return transferResult;
    }

    if (transferResult.warning || transferResult.unverified) {
      return {
        success: false,
        message: transferResult.message,
        reference: transferResult.reference || ''
      };
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

      return {
        success: true,
        message: `CONFIRMED: N${amount.toLocaleString()} sent to Opay ${OPAY_ACCOUNT}! Flutterwave verified the transfer was successful. Ref: ${transferResult.reference || 'N/A'}`
      };
    } catch (e) {
      return {
        success: false,
        message: `Money WAS sent to Opay (Ref: ${transferResult.reference}) but failed to update balance in Firebase: ${e.message}. Contact admin to manually adjust balance.`
      };
    }
  };

  const checkActivationCost = async (academicYear) => {
    if (academicYear === '2026/2027') {
      return { 
        free: true, cost: 0, 
        message: 'FREE activation for 2026/2027!', 
        canActivate: true 
      };
    }
    return { 
      free: false, 
      cost: 25000, 
      message: `Activation for ${academicYear} costs N25,000. Pay via Flutterwave.`, 
      canActivate: true 
    };
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
          customer: {
            email: 'admin@namtls.edu.ng',
            name: 'NAMTLS Admin'
          },
          customizations: {
            title: 'NAMTLS Activation Payment',
            description: `Activation fee for ${academicYear}`,
            logo: 'https://namtls-election.vercel.app/logo.png'
          },
          callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
              try {
                const verifyRes = await fetch('/api/verify-activation', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    transaction_id: response.transaction_id,
                    tx_ref: txRef,
                    academicYear
                  })
                });

                const verifyData = await verifyRes.json();

                if (verifyData.success) {
                  await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
                    balance: increment(25000),
                    lastActivationDeposit: 25000,
                    lastActivationYear: academicYear,
                    lastActivationDate: new Date().toISOString(),
                    lastActivationTxRef: txRef,
                    lastActivationTransactionId: response.transaction_id
                  }, { merge: true });

                  setWithdrawalBalance(prev => prev + 25000);

                  resolve({
                    success: true,
                    message: `N25,000 added to withdrawal balance for ${academicYear}.`
                  });
                } else {
                  resolve({
                    success: false,
                    message: `Verification failed: ${verifyData.message}. Ref: ${txRef}`
                  });
                }
              } catch (verifyErr) {
                resolve({
                  success: false,
                  message: `Server error: ${verifyErr.message}. Ref: ${txRef}`
                });
              }
            } else {
              resolve({ success: false, message: 'Payment not completed.' });
            }
          },
          onClose: () => {
            resolve({ success: false, message: 'Payment cancelled.' });
          }
        };

        const checkout = new FlutterwaveCheckout(config);
        checkout.open();
      });

    } catch (e) {
      return {
        success: false,
        message: e.message.includes('Cannot find module') 
          ? 'Install flutterwave-react-v3 in package.json' 
          : 'Error: ' + e.message
      };
    }
  };

  return (
    <DataChargeContext.Provider value={{
      totalCharged, sessionSeconds, sessionCost, withdrawalBalance,
      isCharging, setIsCharging, withdraw, checkActivationCost,
      processActivationPayment, loadBalance,
      ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT
    }}>
      {children}
    </DataChargeContext.Provider>
  );
}