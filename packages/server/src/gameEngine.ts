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
  RecipeDefinition,
  EquipSlot,
  InventorySlot,
  findPath,
  calculatePlayerMoveSpeed,
} from '@eldoria/shared';
import { storage } from './storage.js';

interface ConnectedSession {
  ws: WebSocket;
  player: PlayerData;
  ticksInTask: number;
  moveAccumulator: number;
  pendingTask: { recipeId: string; targetX: number; targetY: number } | null;
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
    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);
    this.sessions.set(player.id, { ws, player, ticksInTask: 0, moveAccumulator: 0, pendingTask: null });

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
      case 'MOVE_TO':
      case 'MOVE':
        if (typeof msg.x === 'number' && typeof msg.y === 'number') {
          // Stop current work when voluntarily walking elsewhere
          if (player.currentTask) {
            player.currentTask = null;
          }
          session.pendingTask = null;
          player.bankReturnTask = null;
          player.bankingState = 'idle';

          const path = findPath(player.x, player.y, msg.x, msg.y);
          player.targetX = msg.x;
          player.targetY = msg.y;
          player.path = path;
          player.isMoving = path.length > 0;
          this.send(session.ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
        }
        break;

      case 'INTERACT_NODE':
      case 'START_TASK':
        if (msg.recipeId && RECIPES[msg.recipeId]) {
          const targetX = typeof msg.targetX === 'number' ? msg.targetX : player.x;
          const targetY = typeof msg.targetY === 'number' ? msg.targetY : player.y;

          // If not adjacent to or on the node, walk there first!
          const dist = Math.hypot(player.x - targetX, player.y - targetY);
          if (dist > 1.5) {
            session.pendingTask = { recipeId: msg.recipeId, targetX, targetY };
            const path = findPath(player.x, player.y, targetX, targetY);
            player.targetX = targetX;
            player.targetY = targetY;
            player.path = path;
            player.isMoving = true;
            this.send(session.ws, {
              type: 'NOTIFICATION',
              message: `Traveling to ${RECIPES[msg.recipeId].name}... (${path.length} steps)`
            });
            this.send(session.ws, { type: 'PLAYER_UPDATE', player });
            this.broadcastWorldState();
          } else {
            // Already there -> start immediately
            const rec = RECIPES[msg.recipeId];
            player.currentTask = {
              recipeId: msg.recipeId,
              skill: rec.skill,
              startedAtTick: this.tickCount,
              targetQuantity: msg.quantity || Infinity,
              completedQuantity: 0,
              targetNodeX: targetX,
              targetNodeY: targetY,
            };
            session.ticksInTask = 0;
            session.pendingTask = null;
            player.isMoving = false;
            player.path = [];
            this.send(session.ws, { type: 'PLAYER_UPDATE', player });
            this.broadcastWorldState();
          }
        }
        break;

      case 'STOP_TASK':
        player.currentTask = null;
        session.ticksInTask = 0;
        session.pendingTask = null;
        player.bankReturnTask = null;
        player.bankingState = 'idle';
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        break;

      case 'EQUIP_ITEM':
        this.handleEquipItem(session, msg.inventoryIndex);
        break;

      case 'UNEQUIP_ITEM':
        this.handleUnequipItem(session, msg.slot);
        break;

      case 'EAT_FOOD':
        this.handleEatFood(session, msg.inventoryIndex);
        break;

      case 'DEPOSIT_ALL_RESOURCES':
        this.handleDepositAll(session);
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

  private handleEquipItem(session: ConnectedSession, invIndex: number) {
    const { player } = session;
    const slot = player.inventory[invIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def || !def.slot) return;

    // Check level req
    if (def.equipReq) {
      const pLvl = player.skills[def.equipReq.skill]?.level || 1;
      if (pLvl < def.equipReq.level) {
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Requires ${def.equipReq.skill} Level ${def.equipReq.level} to wield.`
        });
        return;
      }
    }

    // Remove from inventory
    player.inventory.splice(invIndex, 1);

    // Unequip currently worn in that slot if any
    const existing = player.equipment[def.slot];
    if (existing) {
      player.inventory.push(existing);
    }

    player.equipment[def.slot] = slot;
    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);

    this.send(session.ws, {
      type: 'NOTIFICATION',
      message: `Equipped ${def.name}. Move speed: ${player.moveSpeedTilesPerTick} tiles/tick.`
    });
    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleUnequipItem(session: ConnectedSession, slotKey: EquipSlot) {
    const { player } = session;
    const worn = player.equipment[slotKey];
    if (!worn) return;

    if (player.inventory.length >= 28) {
      this.send(session.ws, { type: 'NOTIFICATION', message: 'Satchel full! Cannot unequip.' });
      return;
    }

    delete player.equipment[slotKey];
    player.inventory.push(worn);
    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);

    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleEatFood(session: ConnectedSession, invIndex: number) {
    const { player } = session;
    const slot = player.inventory[invIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def || def.category !== 'cooked_food' || !def.baseStats?.healing) return;

    const maxHp = (player.skills.vitality?.level || 10);
    player.currentHp = Math.min(maxHp, player.currentHp + def.baseStats.healing);

    slot.quantity--;
    if (slot.quantity <= 0) {
      player.inventory.splice(invIndex, 1);
    }

    // Uncommon+ food gives Satiated Fury (+25% damage)
    if (slot.rarity && slot.rarity !== 'plain') {
      const durations: Record<string, number> = {
        uncommon: 2 * 60 * 1000,
        rare: 10 * 60 * 1000,
        epic: 3 * 3600 * 1000,
        legendary: 24 * 3600 * 1000,
      };
      const durationMs = durations[slot.rarity] || (2 * 60 * 1000);
      if (!player.activeBuffs) player.activeBuffs = [];
      player.activeBuffs.push({
        id: 'satiated_fury',
        name: 'Satiated Fury (+25% Strike)',
        type: 'food_damage',
        value: 0.25,
        expiresAt: Date.now() + durationMs,
      });
      this.send(session.ws, {
        type: 'NOTIFICATION',
        message: `Ate ${def.name} (${slot.rarity})! Satiated Fury awakened for ${Math.round(durationMs / 60000)}m.`
      });
    }

    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleDepositAll(session: ConnectedSession) {
    const { player } = session;
    let count = 0;
    const keep: InventorySlot[] = [];

    for (const slot of player.inventory) {
      const def = ITEMS[slot.itemId];
      // Keep tools & equipped items
      if (def?.category === 'tool' || def?.category === 'steed' || def?.category === 'weapon') {
        keep.push(slot);
        continue;
      }

      // Move to storage
      const storageSlot = player.storage.find(s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus);
      if (storageSlot) {
        storageSlot.quantity += slot.quantity;
        count += slot.quantity;
      } else if (player.storage.length < player.storageSlotsMax) {
        player.storage.push(slot);
        count += slot.quantity;
      } else {
        keep.push(slot);
      }
    }

    player.inventory = keep;
    this.send(session.ws, {
      type: 'NOTIFICATION',
      message: `Deposited ${count} items into the Hearth Reliquary.`
    });
    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
  }

  private tick() {
    this.tickCount++;

    // Process movement and tasks for all active sessions
    for (const [id, session] of this.sessions.entries()) {
      const { player, ws } = session;

      // 1. Process Path Traversal (Tick-Based Movement)
      if (player.path && player.path.length > 0) {
        const speed = calculatePlayerMoveSpeed(player);
        session.moveAccumulator += speed;

        while (session.moveAccumulator >= 1.0 && player.path.length > 0) {
          const nextStep = player.path.shift()!;
          player.x = nextStep.x;
          player.y = nextStep.y;
          session.moveAccumulator -= 1.0;
        }

        if (player.path.length === 0) {
          player.isMoving = false;
          session.moveAccumulator = 0;

          // Arrived at destination! Check banking state machine
          if (player.bankingState === 'walking_to_bank') {
            this.handleAutoDepositAtHearth(session);
          } else if (player.bankingState === 'returning_to_work') {
            player.bankingState = 'idle';
            if (player.bankReturnTask) {
              player.currentTask = player.bankReturnTask;
              player.bankReturnTask = null;
              this.send(ws, {
                type: 'NOTIFICATION',
                message: `Returned to work on ${RECIPES[player.currentTask.recipeId]?.name || player.currentTask.skill}.`
              });
            }
          } else if (session.pendingTask) {
            // Arrived at target work node
            const rec = RECIPES[session.pendingTask.recipeId];
            if (rec) {
              player.currentTask = {
                recipeId: session.pendingTask.recipeId,
                skill: rec.skill,
                startedAtTick: this.tickCount,
                targetQuantity: Infinity,
                completedQuantity: 0,
                targetNodeX: session.pendingTask.targetX,
                targetNodeY: session.pendingTask.targetY,
              };
              session.ticksInTask = 0;
              this.send(ws, {
                type: 'NOTIFICATION',
                message: `Arrived at ${rec.name}. Began work.`
              });
            }
            session.pendingTask = null;
          }
        }

        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
      }

      // 2. Process Active Work Task
      if (player.currentTask && !player.isMoving) {
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

  private handleAutoDepositAtHearth(session: ConnectedSession) {
    const { player, ws } = session;
    player.bankingState = 'depositing';

    let count = 0;
    const keep: InventorySlot[] = [];

    for (const slot of player.inventory) {
      const def = ITEMS[slot.itemId];
      if (def?.category === 'tool' || def?.category === 'steed' || def?.category === 'weapon') {
        keep.push(slot);
        continue;
      }

      // Move into Hearth storage
      const storageSlot = player.storage.find(s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus);
      if (storageSlot) {
        storageSlot.quantity += slot.quantity;
        count += slot.quantity;
      } else if (player.storage.length < player.storageSlotsMax) {
        player.storage.push(slot);
        count += slot.quantity;
      } else {
        // Move to overflow tray (up to 10 types)
        const traySlot = player.overflowTray.find(s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus);
        if (traySlot) {
          traySlot.quantity += slot.quantity;
          count += slot.quantity;
        } else if (player.overflowTray.length < 10) {
          player.overflowTray.push(slot);
          count += slot.quantity;
        } else {
          keep.push(slot);
        }
      }
    }

    player.inventory = keep;
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Hearth reached! Deposited ${count} resources. Riding back to work...`
    });

    // Walk back to previous task node!
    if (player.bankReturnTask && typeof player.bankReturnTask.targetNodeX === 'number') {
      player.bankingState = 'returning_to_work';
      const path = findPath(player.x, player.y, player.bankReturnTask.targetNodeX, player.bankReturnTask.targetNodeY!);
      player.path = path;
      player.isMoving = path.length > 0;
    } else {
      player.bankingState = 'idle';
    }

    this.send(ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
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
      // Inventory is full! Check auto-banking vs drop
      if (player.dropWhenFull) {
        this.send(ws, { type: 'NOTIFICATION', message: `Satchel full! Discarded ${ITEMS[recipe.outputItemId]?.name || 'spoils'}.` });
      } else {
        // Trigger Autonomous Banking Run to the Hearth!
        player.bankReturnTask = { ...player.currentTask! };
        player.currentTask = null;
        player.bankingState = 'walking_to_bank';

        const path = findPath(player.x, player.y, 8, 22);
        player.targetX = 8;
        player.targetY = 22;
        player.path = path;
        player.isMoving = path.length > 0;

        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Satchel full (28/28)! Riding to the Hearth to bank resources... (${path.length} tiles)`
        });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
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
