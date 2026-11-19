// api/upload.js
// Returns signed Cloudinary upload params.
//   ?purpose=candidate  -> ADMIN ONLY  (passport photographs)
//   ?purpose=proof      -> PUBLIC      (manual bank-transfer screenshots)
// CLOUDINARY_API_SECRET never leaves this serverless function.
import { createHash } from 'crypto';
import { clientIp, consumeRateLimit, waitText } from './_ratelimit.js';

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

// Public proof uploads are deliberately locked down so the endpoint can never
// be used as free image hosting: fixed folder, no transformations, images only.
const PROOF_FOLDER = 'namatl/payment-proofs';
const PROOF_MAX_BYTES = 6 * 1024 * 1024; // 6 MB
// How many upload permissions one visitor network (IP) may ask for.
const PROOF_UPLOAD_LIMITS = [{ limit: 20, windowSec: 3600 }, { limit: 80, windowSec: 86400 }];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const purpose = String(req.query?.purpose || 'candidate');

  if (purpose === 'proof') {
    if (Number(req.body?.size) > PROOF_MAX_BYTES) {
      return res.status(400).json({ success: false, message: 'That image is too large. Keep the screenshot under 6 MB.' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ success: false, message: 'Proof uploads are not configured yet. Contact the Electoral Commission.' });
    }

    // This endpoint is public, so cap how often one network can use it.
    // If the counter cannot be reached the upload is allowed (never blocks a real student).
    try {
      // Loaded only here, so candidate photo uploads never depend on it.
      const { getAdminDb } = await import('./_admin.js');
      const gate = await consumeRateLimit(getAdminDb(), { scope: 'mp-upload', who: clientIp(req), rules: PROOF_UPLOAD_LIMITS });
      if (!gate.ok) {
        return res.status(429).json({
          success: false,
          message: `Too many screenshot uploads from your network. Please wait ${waitText(gate.retryAfterSec)} and try again.`,
        });
      }
    } catch (e) {
      console.error('proof upload limiter skipped:', e.message);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = PROOF_FOLDER;
    const allowedFormats = 'jpg,jpeg,png,webp';
    // Cloudinary signs params alphabetically: key=value&key=value + api_secret
    const toSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');

    return res.json({ success: true, cloudName, apiKey, timestamp, folder, allowedFormats, signature });
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