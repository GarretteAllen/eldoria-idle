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
    gameEngine.removeConnection(playerId);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`⚔️ Eldoria Idle Server listening on http://${HOST}:${PORT}`);
});
