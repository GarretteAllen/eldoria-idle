import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ITEMS, RECIPES, MONSTERS, WORLD_BOSSES, GEM_PACKS, addItemToSlots } from '@eldoria/shared';
import { storage } from './storage.js';
import { WORLD_NODES } from './world.js';
import { gameEngine } from './gameEngine.js';

import { Resend } from 'resend';

// Auto-load .env file from current directory or parent directories if present
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', '.env'),
];

for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    try {
      const envContent = fs.readFileSync(p, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[key] || process.env[key] === '') {
            process.env[key] = val;
          }
        }
      }
      console.log(`[Config] Loaded environment variables from: ${p}`);
      break;
    } catch (e) {
      console.error(`[Config] Error reading env from ${p}:`, e);
    }
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// --- Email System (Resend) ---
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Eldoria Idle <noreply@eldoriaidle.site>';
const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendEldoriaEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!resendClient) {
    console.warn(`[Email] RESEND_API_KEY not configured. Simulated email to ${to}: ${subject}`);
    return true;
  }
  try {
    const { data, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
    });
    if (error) {
      console.error('[Email] Failed to send email via Resend:', error);
      return false;
    }
    console.log(`[Email] Successfully sent email to ${to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[Email] Exception while sending email:', err);
    return false;
  }
}

// In-memory rate limiting map for sensitive endpoints: key -> lastRequestTimestamp
const rateLimitMap = new Map<string, number>();
function isRateLimited(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(key);
  if (last && now - last < cooldownMs) {
    return true;
  }
  rateLimitMap.set(key, now);
  // Periodic cleanup if map grows
  if (rateLimitMap.size > 2000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now - v > cooldownMs * 2) rateLimitMap.delete(k);
    }
  }
  return false;
}

const app = express();
app.use(express.json());

// Allow iframe embedding on itch.io and other sites
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.itch.io https://itch.io https://*.itch.zone https://*.html5.gamedistribution.com *;"
  );
  next();
});

// --- REST API Endpoints ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/leaderboard', (req, res) => {
  const category = (req.query.category as string) || 'total';
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
  const entries = storage.getLeaderboard(category as any, limit);
  res.json({
    category,
    entries,
  });
});

app.post('/api/auth/guest', (req, res) => {
  const { guestId } = req.body || {};
  let player = guestId ? storage.getPlayer(guestId) : undefined;
  if (!player) {
    player = storage.createGuestPlayer();
  }
  res.json({ player });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, guestId, referralCode } = req.body || {};
  const result = storage.registerAccount(username, password, guestId, referralCode);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  gameEngine.onPlayerAccountBound(result.player);
  res.json({
    token: result.token,
    player: result.player,
    account: {
      id: result.account.id,
      username: result.account.username,
      isGuest: false,
      role: result.player.role,
      email: result.account.email || null,
      emailVerified: Boolean(result.account.emailVerified),
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = storage.loginAccount(username, password);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  gameEngine.onPlayerAccountBound(result.player);
  res.json({
    token: result.token,
    player: result.player,
    account: {
      id: result.account.id,
      username: result.account.username,
      isGuest: false,
      role: result.player.role,
      email: result.account.email || null,
      emailVerified: Boolean(result.account.emailVerified),
    },
  });
});

app.post('/api/auth/session', (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }
  const session = storage.getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  const account = storage.getAccountById(session.accountId);
  const player = storage.getPlayer(session.playerId);
  if (!account || !player) {
    res.status(401).json({ error: 'Account or adventurer data not found' });
    return;
  }
  res.json({
    player,
    account: {
      id: account.id,
      username: account.username,
      isGuest: false,
      role: player.role,
      email: account.email || null,
      emailVerified: Boolean(account.emailVerified),
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body || {};
  if (token) {
    storage.deleteSession(token);
  }
  res.json({ success: true });
});

// --- Email Binding & Verification API ---

app.post('/api/account/bind-email', async (req, res) => {
  try {
    const { token, email } = req.body || {};
    if (!token) {
      res.status(401).json({ error: 'Authentication required to link email.' });
      return;
    }
    const session = storage.getSession(token);
    if (!session) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    const account = storage.getAccountById(session.accountId);
    if (!account) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length > 100) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    // Rate limit per account: max 1 verification email every 3 minutes
    const rateLimitKey = `bind_email:${account.id}`;
    if (isRateLimited(rateLimitKey, 3 * 60 * 1000)) {
      res.status(429).json({ error: 'Please wait a few minutes before requesting another verification email.' });
      return;
    }

    // Check if another account already has this email bound and verified
    if (storage.isEmailAlreadyBound(cleanEmail, account.id)) {
      res.status(400).json({ error: 'That email address is already associated with another adventurer.' });
      return;
    }

    // Create verification token (24h expiry)
    const { token: verifyToken } = storage.createEmailVerificationToken(account.id, cleanEmail);
    const verifyUrl = `https://eldoriaidle.site?verify_email=${verifyToken}`;

    const html = `
      <div style="background-color: #1a1612; color: #f0e6d2; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 8px; max-width: 540px; margin: 0 auto; border: 1px solid #4a3622;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #dfa637; font-size: 24px; margin: 0; letter-spacing: 1px;">⚔️ Eldoria Idle</h1>
          <p style="color: #a0aec0; font-size: 13px; margin: 4px 0 0 0;">Realm Account Security</p>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #3d3429; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #ecc94b; font-size: 18px; margin-top: 0;">Hail, Adventurer ${account.username}!</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #e2e8f0;">
            A request was made to link this email address (<b>${cleanEmail}</b>) to your Eldoria Idle character account.
          </p>
          <p style="font-size: 14px; line-height: 1.5; color: #e2e8f0;">
            Once confirmed, this email will protect your character and allow you to request secure password resets should you ever forget your password.
          </p>
          <div style="text-align: center; margin: 26px 0;">
            <a href="${verifyUrl}" style="background: linear-gradient(180deg, #d4af37, #b8860b); color: #1a1612; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 4px; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
              Confirm & Bind Email Address
            </a>
          </div>
          <p style="font-size: 12px; color: #a0aec0; margin-bottom: 0;">
            This link is valid for 24 hours. If you did not initiate this request, you may safely ignore this message.
          </p>
        </div>
        <div style="text-align: center; font-size: 11px; color: #718096;">
          Eldoria Idle · The Shared-World Idle Realm · <a href="https://eldoriaidle.site" style="color: #dfa637;">eldoriaidle.site</a>
        </div>
      </div>
    `;

    await sendEldoriaEmail(cleanEmail, 'Confirm your Eldoria Idle email address', html);

    res.json({
      success: true,
      message: 'Verification dispatch sent! Please check your inbox and click the link to confirm your address.',
    });
  } catch (err) {
    console.error('Error in /api/account/bind-email:', err);
    res.status(500).json({ error: 'Internal error processing email binding request.' });
  }
});

app.post('/api/account/verify-email', (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ error: 'Missing verification token.' });
    return;
  }

  const result = storage.verifyAndConsumeEmailToken(token);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    message: `Email address ${result.email} has been successfully verified and linked to ${result.account.username}!`,
    account: {
      id: result.account.id,
      username: result.account.username,
      email: result.account.email,
      emailVerified: true,
    },
  });
});

// --- Password Reset API (Authgear Best Practices) ---

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

    // Constant message for anti-enumeration
    const genericResponse = {
      success: true,
      message: 'If an account matching that verified email exists, password reset instructions have been sent to your inbox.',
    };

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.json(genericResponse);
      return;
    }

    // Rate limiting: max 1 reset email per 5 minutes per email and IP
    const rateLimitEmailKey = `pwd_reset_email:${cleanEmail}`;
    const rateLimitIpKey = `pwd_reset_ip:${clientIp}`;
    if (isRateLimited(rateLimitEmailKey, 5 * 60 * 1000) || isRateLimited(rateLimitIpKey, 1 * 60 * 1000)) {
      // Respond with identical success message so timing/rate limits do not leak existence
      res.json(genericResponse);
      return;
    }

    // Look up account by email
    const account = storage.getAccountByEmail(cleanEmail);
    if (!account || !account.emailVerified) {
      // Do not disclose that account doesn't exist
      res.json(genericResponse);
      return;
    }

    // Generate cryptographic token (15-minute expiry)
    const { token: resetToken } = storage.createPasswordResetToken(account.id);
    const resetUrl = `https://eldoriaidle.site?reset_token=${resetToken}`;

    const html = `
      <div style="background-color: #1a1612; color: #f0e6d2; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 8px; max-width: 540px; margin: 0 auto; border: 1px solid #4a3622;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #dfa637; font-size: 24px; margin: 0; letter-spacing: 1px;">⚔️ Eldoria Idle</h1>
          <p style="color: #a0aec0; font-size: 13px; margin: 4px 0 0 0;">Password Reset Request</p>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid #3d3429; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #ecc94b; font-size: 18px; margin-top: 0;">Greetings, Adventurer ${account.username}!</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #e2e8f0;">
            A password reset was requested for your Eldoria account. Click the button below to choose a new secret password:
          </p>
          <div style="text-align: center; margin: 26px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(180deg, #d4af37, #b8860b); color: #1a1612; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 4px; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
              Reset Account Password
            </a>
          </div>
          <p style="font-size: 12px; color: #fc8181; line-height: 1.4; margin-bottom: 6px;">
            ⚠️ <b>Security Notice:</b> This link will expire in <b>15 minutes</b> and can only be used once.
          </p>
          <p style="font-size: 12px; color: #a0aec0; margin-bottom: 0;">
            If you did not request this password reset, please ignore this email. Your password remains safe and unchanged.
          </p>
        </div>
        <div style="text-align: center; font-size: 11px; color: #718096;">
          Eldoria Idle · The Shared-World Idle Realm · <a href="https://eldoriaidle.site" style="color: #dfa637;">eldoriaidle.site</a>
        </div>
      </div>
    `;

    await sendEldoriaEmail(account.email || cleanEmail, 'Reset your Eldoria Idle password', html);

    res.json(genericResponse);
  } catch (err) {
    console.error('Error in /api/auth/forgot-password:', err);
    res.json({
      success: true,
      message: 'If an account matching that verified email exists, password reset instructions have been sent to your inbox.',
    });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required.' });
      return;
    }

    const result = storage.completePasswordResetWithToken(token, newPassword);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Your password has been successfully reset! All active sessions have been signed out. You may now log in with your new password.',
    });
  } catch (err) {
    console.error('Error in /api/auth/reset-password:', err);
    res.status(500).json({ error: 'An unexpected error occurred while resetting your password.' });
  }
});

app.get('/api/world/nodes', (req, res) => {
  res.json({ nodes: storage.getWorldNodes() });
});

app.get('/api/world/npcs', (req, res) => {
  res.json({ npcs: storage.getNpcs() });
});

app.get('/api/world/quests', (req, res) => {
  res.json({ quests: storage.getQuests() });
});

app.get('/api/world/collisions', (req, res) => {
  res.json({ collisions: Array.from(storage.getCollisions()) });
});

app.get('/api/data/items', (req, res) => {
  res.json({ items: ITEMS });
});

app.get('/api/data/recipes', (req, res) => {
  res.json({ recipes: RECIPES });
});

// --- Gem Packs & PayPal Payment Endpoints ---
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_MODE === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error('PayPal Client ID or Secret is not configured on server.');
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const resp = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(`[PayPal] OAuth error (${resp.status} ${resp.statusText}):`, errBody);
    throw new Error(`PayPal auth failed: ${resp.statusText} (${errBody})`);
  }
  const data = (await resp.json()) as any;
  return data.access_token;
}

app.get('/api/gem-packs', (req, res) => {
  res.json({
    packs: Object.values(GEM_PACKS),
    paypalClientId: PAYPAL_CLIENT_ID,
    paypalMode: PAYPAL_MODE,
  });
});

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { packId, playerId } = req.body || {};
    const pack = GEM_PACKS[packId];
    if (!pack) {
      res.status(400).json({ error: 'Invalid gem pack selected.' });
      return;
    }

    if (PAYPAL_CLIENT_ID && PAYPAL_SECRET) {
      const token = await getPayPalAccessToken();
      const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: pack.id,
              description: `${pack.name} (${pack.gems} Gems)`,
              custom_id: playerId,
              amount: {
                currency_code: 'USD',
                value: pack.priceUsd.toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: 'Eldoria Idle',
            landing_page: 'NO_PREFERENCE',
            user_action: 'PAY_NOW',
            return_url: `${req.protocol}://${req.get('host')}/api/paypal/return`,
            cancel_url: `${req.protocol}://${req.get('host')}/api/paypal/cancel`,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('PayPal create-order error:', errText);
        res.status(500).json({ error: 'Failed to create PayPal order.' });
        return;
      }

      const order = (await response.json()) as any;
      const approveLink = (order.links || []).find((l: any) => l.rel === 'approve')?.href;
      res.json({ orderId: order.id, approvalUrl: approveLink });
    } else {
      // Development test order ID
      res.json({ orderId: `DEV_${Date.now()}_${packId}` });
    }
  } catch (err: any) {
    console.error('PayPal create-order exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderId, packId, playerId } = req.body || {};
    const pack = GEM_PACKS[packId];
    if (!pack) {
      res.status(400).json({ error: 'Invalid gem pack.' });
      return;
    }

    if (PAYPAL_CLIENT_ID && PAYPAL_SECRET) {
      const token = await getPayPalAccessToken();
      const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('PayPal capture-order error:', errText);
        res.status(500).json({ error: 'Failed to capture PayPal payment.' });
        return;
      }

      const capture = (await response.json()) as any;
      if (capture.status !== 'COMPLETED') {
        res.status(400).json({ error: `PayPal payment not completed (status: ${capture.status})` });
        return;
      }
    }

    // Deliver tradeable Gem Pack item into player inventory (or overflow tray if full)
    const player = storage.getPlayer(playerId);
    if (!player) {
      res.status(404).json({ error: 'Player character not found.' });
      return;
    }

    const itemDef = storage.getItem(pack.id) || ITEMS[pack.id];
    const addRes = addItemToSlots(player.inventory, 28, pack.id, 1, 'plain', 0, itemDef, 'inventory');
    if (addRes.remainder > 0) {
      if (!player.overflowTray) player.overflowTray = [];
      player.overflowTray.push({ itemId: pack.id, quantity: addRes.remainder, rarity: 'plain', plus: 0 });
    }

    storage.savePlayer(player);
    gameEngine.notifyPlayerPayment(playerId, pack.name, pack.id);

    res.json({
      success: true,
      pack,
      player,
    });
  } catch (err: any) {
    console.error('PayPal capture-order exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/paypal/return', (req, res) => {
  const token = req.query.token;
  res.send(`<!DOCTYPE html>
<html>
<head><title>Processing Checkout...</title></head>
<body style="background:#0a0c10;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2 style="color:#d4af37;">Payment Approved!</h2>
    <p>Finalizing your pack... You can close this window.</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'PAYPAL_APPROVED', token: '${token || ''}' }, '*');
    }
    setTimeout(() => { window.close(); }, 1200);
  </script>
</body>
</html>`);
});

app.get('/api/paypal/cancel', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Checkout Cancelled</title></head>
<body style="background:#0a0c10;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2 style="color:#ef4444;">Checkout Cancelled</h2>
    <p>You can close this window and return to the game.</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'PAYPAL_CANCELLED' }, '*');
    }
    setTimeout(() => { window.close(); }, 1500);
  </script>
</body>
</html>`);
});

app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Eldoria Idle</title>
  <style>
    body {
      background: #100c08;
      color: #cbd5e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px 16px;
      line-height: 1.6;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 680px;
      width: 100%;
      background: #1c150f;
      border: 1px solid #432e1c;
      border-radius: 8px;
      padding: 24px 28px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h1 {
      color: #ecc94b;
      font-size: 1.5rem;
      margin-top: 0;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h2 {
      color: #ecc94b;
      font-size: 1.05rem;
      margin-top: 20px;
      margin-bottom: 6px;
      border-bottom: 1px solid #2d2013;
      padding-bottom: 4px;
    }
    .highlight {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid #3d3429;
      border-radius: 6px;
      padding: 12px 14px;
      color: #e2e8f0;
      margin-bottom: 16px;
    }
    ul {
      margin: 6px 0 12px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
    }
    a {
      color: #ecc94b;
      text-decoration: underline;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #2d2013;
      font-size: 0.85rem;
      color: #a0aec0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚔️ Privacy Policy & Data Commitment</h1>
    <div style="font-size: 0.8rem; color: #a0aec0; margin-bottom: 16px;">Effective: 2026 • Eldoria Idle</div>

    <div class="highlight">
      <strong style="color: #ecc94b;">Our Commitment:</strong> At <strong>Eldoria Idle</strong>, we believe in old-school gaming and respect for our players. <strong>We do not track you across the web, we do not sell your personal data, and we collect only the bare minimum information needed to let you play the game.</strong>
    </div>

    <h2>1. The Information We Collect & Why</h2>
    <ul>
      <li><strong>Account Credentials:</strong> Your chosen adventurer username and a salted, cryptographically hashed password (<code>scrypt</code>). We never see, transmit, or store your plaintext password.</li>
      <li><strong>Game Save Data:</strong> Your character's skills, items, Hearth bank vault contents, active tasks, and in-game gold/gems.</li>
      <li><strong>Optional Linked Email:</strong> Providing an email is never required to play. If you voluntarily link an email, it is used <strong>strictly and exclusively</strong> to send account verification links and single-use, 15-minute password reset links. We will never sell your email or send promotional spam.</li>
      <li><strong>Temporary Server Logs:</strong> Standard transient technical logs (IP address and timestamp) are processed briefly to mitigate DDoS attacks, prevent bot spam, and enforce rate limits on password resets.</li>
    </ul>

    <h2>2. What We DO NOT Do</h2>
    <ul>
      <li><strong>No Tracking Cookies / Ad Networks:</strong> We do not use Google Analytics, advertising trackers, tracking pixels, or third-party behavioral scripts.</li>
      <li><strong>No Data Selling:</strong> We will never sell, trade, or monetize your personal information to data brokers or advertisers.</li>
      <li><strong>No Invasive Profiling:</strong> We do not build behavioral profiles or harvest device contacts.</li>
    </ul>

    <h2>3. Cookies & Local Storage</h2>
    <p>We do not use invasive tracking cookies. Your browser's Local Storage (<code>localStorage</code>) is used solely for essential gameplay functions: remembering your active session token so you stay logged in, and saving your audio preferences (volume and mute toggles).</p>

    <h2>4. Third-Party Infrastructure</h2>
    <ul>
      <li><strong>Resend:</strong> Used solely to dispatch transactional account emails (verification and password reset links).</li>
      <li><strong>PayPal:</strong> Optional cosmetic gem pack purchases are processed securely through PayPal's hosted checkout. Eldoria Idle never receives, processes, or stores your credit card numbers, bank details, or billing addresses.</li>
    </ul>

    <h2>5. Your Rights & Data Deletion</h2>
    <p>You have full transparency over your saved character data right from your in-game profile. If you ever want your account, character progress, and linked email permanently erased from our database, email us at <strong style="color: #ecc94b;">support@eldoriaidle.site</strong> and all records associated with your account will be promptly and permanently deleted.</p>

    <h2>6. Contact Us</h2>
    <p>For any privacy inquiries or deletion requests, contact us directly at: <a href="mailto:support@eldoriaidle.site"><strong>support@eldoriaidle.site</strong></a></p>

    <div class="footer">
      <div>© 2026 Eldoria Idle. All rights reserved.</div>
      <div><a href="/">← Return to Eldoria</a></div>
    </div>
  </div>
</body>
</html>`);
});

// Serve frontend dist if available (Single-port production serving)
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'packages/client/dist');

const activeDist = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altClientDistPath)
  ? altClientDistPath
  : null;

if (activeDist) {
  console.log(`Serving static client files from ${activeDist}`);
  app.use(express.static(activeDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(activeDist, 'index.html'));
    }
  });
}

const server = http.createServer(app);

// WebSocket Server attached to same HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const playerId = url.searchParams.get('playerId');

  if (!playerId) {
    ws.close(4000, 'Missing playerId');
    return;
  }

  gameEngine.registerConnection(ws, playerId);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      gameEngine.handleClientMessage(playerId, msg);
    } catch (err) {
      console.error('Invalid message format', err);
    }
  });

  ws.on('close', () => {
    gameEngine.removeConnection(playerId, ws);
  });
});

const handleGracefulShutdown = (signal: string) => {
  console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);
  try {
    gameEngine.shutdown();
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

server.listen(PORT, HOST, () => {
  console.log(`[Server] Eldoria Idle Server listening on http://${HOST}:${PORT}`);
});
