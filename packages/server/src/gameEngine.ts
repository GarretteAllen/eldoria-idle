import { WebSocket } from 'ws';
import {
  TICK_MS,
  PlayerData,
  RECIPES,
  ITEMS,
  MONSTERS,
  WORLD_BOSSES,
  getLevelFromXp,
  getJobSpeedMultiplier,
  rollRarity,
  calculateHitChance,
  calculateMaxHit,
  simulateOfflineCatchUp,
  WorldBossDefinition,
  RecipeDefinition
} from '@eldoria/shared';
import { storage } from './storage.js';

interface ConnectedSession {
  ws: WebSocket;
  player: PlayerData;
  ticksInTask: number;
}

export class GameEngine {
  private sessions = new Map<string, ConnectedSession>();
  private tickCount = 0;

  // World Boss State
  private activeBoss: {
    def: WorldBossDefinition;
    currentHp: number;
    maxHp: number;
    expiresAt: number;
    damageDealt: Record<string, number>;
  } | null = null;

  constructor() {
    this.spawnWorldBoss();
    setInterval(() => this.tick(), TICK_MS);
  }

  public registerConnection(ws: WebSocket, playerId: string) {
    let player = storage.getPlayer(playerId);
    let catchUpSummary = null;

    if (!player) {
      player = storage.createGuestPlayer();
    } else {
      // Calculate offline progress
      const elapsedSeconds = (Date.now() - player.lastActiveTimestamp) / 1000;
      if (elapsedSeconds > 10) {
        catchUpSummary = simulateOfflineCatchUp(player, elapsedSeconds);
      }
    }

    player.lastActiveTimestamp = Date.now();
    this.sessions.set(player.id, { ws, player, ticksInTask: 0 });

    // Send initial handshake
    this.send(ws, {
      type: 'INIT',
      player,
      boss: this.getBossSummary(),
      catchUp: catchUpSummary,
      onlineCount: this.sessions.size,
    });

    this.broadcastWorldState();
  }

  public removeConnection(playerId: string) {
    const session = this.sessions.get(playerId);
    if (session) {
      session.player.lastActiveTimestamp = Date.now();
      storage.savePlayer(session.player);
      this.sessions.delete(playerId);
      this.broadcastWorldState();
    }
  }

  public handleClientMessage(playerId: string, msg: any) {
    const session = this.sessions.get(playerId);
    if (!session) return;
    const { player } = session;

    switch (msg.type) {
      case 'MOVE':
        if (typeof msg.x === 'number' && typeof msg.y === 'number') {
          player.x = Math.max(0, Math.min(60, msg.x));
          player.y = Math.max(0, Math.min(60, msg.y));
          this.broadcastWorldState();
        }
        break;

      case 'START_TASK':
        if (msg.recipeId && RECIPES[msg.recipeId]) {
          const rec = RECIPES[msg.recipeId];
          player.currentTask = {
            recipeId: msg.recipeId,
            skill: rec.skill,
            startedAtTick: this.tickCount,
            targetQuantity: msg.quantity || Infinity,
            completedQuantity: 0,
            targetNodeX: msg.targetX,
            targetNodeY: msg.targetY,
          };
          session.ticksInTask = 0;
          this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        }
        break;

      case 'STOP_TASK':
        player.currentTask = null;
        session.ticksInTask = 0;
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        break;

      case 'CHAT':
        if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
          const chatPayload = {
            type: 'CHAT_BROADCAST',
            channel: msg.channel || 'All',
            senderId: player.id,
            senderName: player.username,
            title: player.activeTitle,
            text: msg.text.trim().slice(0, 150),
            timestamp: Date.now(),
            x: player.x,
            y: player.y,
          };
          this.broadcast(chatPayload);
        }
        break;

      case 'ATTACK_BOSS':
        this.handleBossAttack(session);
        break;
    }
  }

  private tick() {
    this.tickCount++;

    // Process tasks for all active sessions
    for (const [id, session] of this.sessions.entries()) {
      const { player } = session;

      if (player.currentTask) {
        session.ticksInTask++;
        const recipe = RECIPES[player.currentTask.recipeId];

        if (recipe) {
          const level = player.skills[recipe.skill]?.level || 1;
          const speedMult = getJobSpeedMultiplier(level, recipe.levelReq);
          const effectiveInterval = Math.max(0.6, recipe.intervalSeconds / speedMult);
          const requiredTicks = Math.max(1, Math.round(effectiveInterval / (TICK_MS / 1000)));

          if (session.ticksInTask >= requiredTicks) {
            session.ticksInTask = 0;
            this.executeTaskCycle(session, recipe);
          }
        }
      }
    }

    // Every 50 ticks (30s) auto-save
    if (this.tickCount % 50 === 0) {
      for (const session of this.sessions.values()) {
        session.player.lastActiveTimestamp = Date.now();
        storage.savePlayer(session.player);
      }
    }
  }

  private executeTaskCycle(session: ConnectedSession, recipe: RecipeDefinition) {
    const { player, ws } = session;
    const task = player.currentTask!;

    // Deduct inputs
    if (recipe.inputs?.length > 0) {
      for (const inp of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
        if (!slot) {
          // Ran out of materials
          player.currentTask = null;
          this.send(ws, { type: 'NOTIFICATION', message: 'Materials depleted for task.' });
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          return;
        }
      }
      for (const inp of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === inp.itemId)!;
        slot.quantity -= inp.quantity;
      }
      player.inventory = player.inventory.filter(s => s.quantity > 0);
    }

    // Add output item
    const rarity = rollRarity(1.0);
    const existingSlot = player.inventory.find(s => s.itemId === recipe.outputItemId && s.rarity === rarity && s.plus === 0);
    if (existingSlot) {
      existingSlot.quantity += recipe.outputQuantity;
    } else if (player.inventory.length < 28) {
      player.inventory.push({
        itemId: recipe.outputItemId,
        quantity: recipe.outputQuantity,
        rarity,
        plus: 0,
      });
    } else {
      // Divert to Storage
      const storageSlot = player.storage.find(s => s.itemId === recipe.outputItemId && s.rarity === rarity && s.plus === 0);
      if (storageSlot) {
        storageSlot.quantity += recipe.outputQuantity;
      } else if (player.storage.length < player.storageSlotsMax) {
        player.storage.push({
          itemId: recipe.outputItemId,
          quantity: recipe.outputQuantity,
          rarity,
          plus: 0,
        });
      }
    }

    // Grant XP
    const skillRecord = player.skills[recipe.skill];
    if (skillRecord) {
      const oldLevel = skillRecord.level;
      skillRecord.xp += recipe.xp;
      skillRecord.level = getLevelFromXp(skillRecord.xp);
      if (skillRecord.level > oldLevel) {
        this.send(ws, {
          type: 'LEVEL_UP',
          skill: recipe.skill,
          newLevel: skillRecord.level,
        });
      }
    }

    task.completedQuantity++;
    if (task.completedQuantity >= task.targetQuantity) {
      // Complete or pull next from queue
      if (player.taskQueue.length > 0) {
        const next = player.taskQueue.shift()!;
        player.currentTask = {
          recipeId: next.recipeId,
          skill: next.skill,
          startedAtTick: this.tickCount,
          targetQuantity: next.targetQuantity,
          completedQuantity: 0,
        };
      } else {
        player.currentTask = null;
      }
    }

    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleBossAttack(session: ConnectedSession) {
    if (!this.activeBoss) return;
    const { player, ws } = session;

    const hit = Math.floor(10 + Math.random() * 25);
    this.activeBoss.currentHp = Math.max(0, this.activeBoss.currentHp - hit);
    this.activeBoss.damageDealt[player.id] = (this.activeBoss.damageDealt[player.id] || 0) + hit;

    // Grant bladesmanship / combat xp
    player.skills.bladesmanship.xp += hit;
    player.skills.bladesmanship.level = getLevelFromXp(player.skills.bladesmanship.xp);

    this.send(ws, {
      type: 'BOSS_HIT',
      damage: hit,
      bossHp: this.activeBoss.currentHp,
    });

    if (this.activeBoss.currentHp <= 0) {
      this.distributeBossLoot();
    }
  }

  private distributeBossLoot() {
    if (!this.activeBoss) return;
    const bossDef = this.activeBoss.def;
    this.broadcast({
      type: 'CHAT_BROADCAST',
      channel: 'Raid',
      senderName: 'WORLD EVENT',
      text: `${bossDef.name} has fallen! Rewards have been dispatched to all valiant raiders.`,
      timestamp: Date.now(),
    });

    for (const [playerId, dmg] of Object.entries(this.activeBoss.damageDealt)) {
      const session = this.sessions.get(playerId);
      if (session) {
        // Pool of 5,000 gold + 40 anima
        const goldReward = Math.max(100, Math.floor(5000 * (dmg / this.activeBoss.maxHp)));
        session.player.gold += goldReward;
        session.player.anima += 40;
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Raid reward: +${goldReward} Gold, +40 Anima!`,
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player: session.player });
      }
    }

    // Respawn next boss in 15 minutes
    setTimeout(() => this.spawnWorldBoss(), 15 * 60 * 1000);
    this.activeBoss = null;
    this.broadcast({ type: 'BOSS_UPDATE', boss: null });
  }

  private spawnWorldBoss() {
    const bossKeys = Object.keys(WORLD_BOSSES);
    const chosenKey = bossKeys[Math.floor(Math.random() * bossKeys.length)];
    const def = WORLD_BOSSES[chosenKey];
    this.activeBoss = {
      def,
      currentHp: def.baseHp,
      maxHp: def.baseHp,
      expiresAt: Date.now() + 60 * 60 * 1000,
      damageDealt: {},
    };
    this.broadcast({ type: 'BOSS_UPDATE', boss: this.getBossSummary() });
  }

  private getBossSummary() {
    if (!this.activeBoss) return null;
    return {
      id: this.activeBoss.def.id,
      name: this.activeBoss.def.name,
      currentHp: this.activeBoss.currentHp,
      maxHp: this.activeBoss.maxHp,
      weakness: this.activeBoss.def.styleWeakness,
      expiresAt: this.activeBoss.expiresAt,
    };
  }

  private broadcastWorldState() {
    const playersList = Array.from(this.sessions.values()).map(s => ({
      id: s.player.id,
      name: s.player.username,
      title: s.player.activeTitle,
      x: s.player.x,
      y: s.player.y,
      currentTask: s.player.currentTask ? s.player.currentTask.skill : null,
    }));

    this.broadcast({
      type: 'WORLD_STATE',
      players: playersList,
      onlineCount: this.sessions.size,
    });
  }

  private send(ws: WebSocket, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private broadcast(payload: any) {
    const raw = JSON.stringify(payload);
    for (const session of this.sessions.values()) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(raw);
      }
    }
  }
}

export const gameEngine = new GameEngine();
