// NAMATLS Support — public contact form write, server-side (bypasses rules via firebase-admin).
import { getAdminDb } from './_admin.js';
import { writeAudit } from './_audit.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};
  if (!name || !message || typeof name !== 'string' || typeof message !== 'string'
      || name.trim().length === 0 || message.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Name and message are required' });
  }

  const ref = await getAdminDb().collection('supportMessages').add({
    name: name.trim(),
    email: (email && email.trim()) ? email.trim() : 'Not provided',
    message: message.trim(),
    timestamp: FieldValue.serverTimestamp(),   // same type your admin dashboard already renders
    status: 'unread',
  });

  await writeAudit({ db: getAdminDb(), actor: name.trim(), action: 'SUPPORT_MESSAGE', details: { email: (email && email.trim()) ? email.trim() : 'Not provided' } });

  return res.status(200).json({ success: true, id: ref.id });
}