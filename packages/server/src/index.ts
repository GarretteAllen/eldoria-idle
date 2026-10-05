import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ITEMS, RECIPES, MONSTERS, WORLD_BOSSES } from '@eldoria/shared';
import { storage } from './storage.js';
import { WORLD_NODES } from './world.js';
import { gameEngine } from './gameEngine.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json());

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
