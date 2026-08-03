// NAMATLS consolidated serverless router — 1 function for all endpoints.
// Static imports are required so Vercel bundles every handler correctly.

import adminLogin from './_handlers/admin-login.js';
import admin from './_handlers/admin.js';
import flutterwaveWebhook from './_handlers/flutterwave-webhook.js';
import studentLogin from './_handlers/student-login.js';
import studentRegister from './_handlers/student-register.js';
import studentVerifyKey from './_handlers/student-verify-key.js';
import support from './_handlers/support.js';
import verifyActivation from './_handlers/verify-activation.js';
import verifyFormPayment from './_handlers/verify-form-payment.js';
import vote from './_handlers/vote.js';
import withdraw from './_handlers/withdraw.js';
// ⚠️ If there were any OTHER files in api/ (e.g. candidates.js, results.js, etc.),
// add an import + route entry for each one, same pattern.

const routes = {
  'admin-login': adminLogin,
  'admin': admin,
  'flutterwave-webhook': flutterwaveWebhook,
  'student-login': studentLogin,
  'student-register': studentRegister,
  'student-verify-key': studentVerifyKey,
  'support': support,
  'verify-activation': verifyActivation,
  'verify-form-payment': verifyFormPayment,
  'vote': vote,
  'withdraw': withdraw,
};

export default async function handler(req, res) {
  const route = String(req.query.route || '').split('/')[0];
  const fn = routes[route];

  if (!fn) {
    return res.status(404).json({ success: false, message: `Unknown API route: ${route}` });
  }
  return fn(req, res);
}