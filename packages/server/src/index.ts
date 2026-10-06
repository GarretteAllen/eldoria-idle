import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ITEMS, RECIPES, MONSTERS, WORLD_BOSSES, GEM_PACKS, addItemToSlots } from '@eldoria/shared';
import { storage } from './storage.js';
import { WORLD_NODES } from './world.js';
import { gameEngine } from './gameEngine.js';

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

app.post('/api/auth/guest', (req, res) => {
  const { guestId } = req.body || {};
  let player = guestId ? storage.getPlayer(guestId) : undefined;
  if (!player) {
    player = storage.createGuestPlayer();
  }
  res.json({ player });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, guestId } = req.body || {};
  const result = storage.registerAccount(username, password, guestId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({
    token: result.token,
    player: result.player,
    account: {
      id: result.account.id,
      username: result.account.username,
      isGuest: false,
      role: result.player.role,
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
  res.json({
    token: result.token,
    player: result.player,
    account: {
      id: result.account.id,
      username: result.account.username,
      isGuest: false,
      role: result.player.role,
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
