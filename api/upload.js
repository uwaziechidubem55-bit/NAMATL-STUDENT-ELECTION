// api/upload.js
// Returns signed Cloudinary upload params for the ADMIN ONLY.
// CLOUDINARY_API_SECRET never leaves this serverless function.
import { createHash } from 'crypto';

let verifyToken;
try {
  const sessionModule = await import('./_session.js');
  verifyToken = sessionModule.verifyToken;
} catch (e) {
  console.error('❌ Failed to import ./_session.js', e.message);
}

const SECRET = process.env.SERVER_SESSION_SECRET || '';

function isAdmin(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!verifyToken) return false;
    const session = verifyToken(token, SECRET);
    return !!session && session.role === 'admin';
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({ success: false, message: 'Cloudinary env vars not configured' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'namatl/candidates';        // all candidate photos in one folder
  const allowedFormats = 'jpg,jpeg';          // matches ALLOWED_PHOTO_TYPES in AdminDashboard

  // Cloudinary signs params alphabetically: key=value&key=value + api_secret
  const toSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');

  return res.json({
    success: true,
    cloudName,
    apiKey,
    timestamp,
    folder,
    allowedFormats,
    signature,
  });
}