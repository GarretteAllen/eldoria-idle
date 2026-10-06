import { WebSocket } from 'ws';
import {
  TICK_MS,
  PlayerData,
  RECIPES,
  ITEMS,
  MONSTERS,
  WORLD_BOSSES,
  WorldNode,
  MonsterSpawnZone,
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
  FARMING_CROPS,
  ONLINE_GROWTH_MULTIPLIER,
  addItemToSlots,
  isItemStackable,
  getItemMaxStack,
  Rarity,
  QUEUE_SLOT_CONFIG,
  GEM_PACKS,
  QueuedTask,
  MarketListing,
} from '@eldoria/shared';
import { storage } from './storage.js';

export interface LiveMonsterInstance {
  id: string;
  zoneId: string;
  monsterId: string;
  name: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  respawnAtTick?: number;
  nextMoveTick?: number;
}

interface ConnectedSession {
  ws: WebSocket;
  player: PlayerData;
  ticksInTask: number;
  moveAccumulator: number;
  pendingTask: { recipeId: string; targetX: number; targetY: number; quantity?: number; nodeX?: number; nodeY?: number } | null;
  pendingDeposit?: { itemId: string; rarity?: string; plus?: number; quantity?: number } | null;
  pendingCombat?: { monsterId: string; targetX: number; targetY: number; nodeId?: string; zoneId?: string } | null;
  activeCombat?: {
    monsterId: string;
    targetX: number;
    targetY: number;
    nodeId?: string;
    zoneId?: string;
    currentHp: number;
    maxHp: number;
    playerSwingTicks: number;
    monsterSwingTicks: number;
  } | null;
  lastBossAttackTime?: number;
  lastActivityTimestamp?: number;
}


export class GameEngine {
  private sessions = new Map<string, ConnectedSession>();
  private tickCount = 0;
  private liveMonsters = new Map<string, LiveMonsterInstance>();

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
    this.initMonsterZones();
    setInterval(() => this.tick(), TICK_MS);
  }

  public initMonsterZones() {
    const zones = storage.getMonsterZones();
    const activeZoneIds = new Set(zones.map(z => z.id));

    // Remove instances belonging to removed zones
    for (const [id, inst] of this.liveMonsters.entries()) {
      if (!activeZoneIds.has(inst.zoneId)) {
        this.liveMonsters.delete(id);
      }
    }

    const occupied = new Set<string>();
    for (const inst of this.liveMonsters.values()) {
      if (inst.currentHp > 0 && !inst.respawnAtTick) {
        occupied.add(`${inst.x},${inst.y}`);
      }
    }

    for (const zone of zones) {
      const def = MONSTERS[zone.monsterId];
      if (!def) continue;

      const targetCount = Math.max(1, Math.min(20, zone.maxMonsters || 3));
      for (let i = 0; i < targetCount; i++) {
        const instId = `${zone.id}_m${i}`;
        const existing = this.liveMonsters.get(instId);
        if (!existing) {
          const tile = this.findWalkableTileInZone(zone, occupied);
          occupied.add(`${tile.x},${tile.y}`);
          this.liveMonsters.set(instId, {
            id: instId,
            zoneId: zone.id,
            monsterId: zone.monsterId,
            name: def.name,
            x: tile.x,
            y: tile.y,
            currentHp: def.hp,
            maxHp: def.hp,
          });
        }
      }

      // If zone capacity was lowered, trim excess
      for (let i = targetCount; i < 20; i++) {
        const instId = `${zone.id}_m${i}`;
        this.liveMonsters.delete(instId);
      }
    }
  }

  public findWalkableTileInZone(zone: MonsterSpawnZone, occupiedCoords: Set<string>): { x: number; y: number } {
    const collisions = storage.getCollisions();
    const candidates: Array<{ x: number; y: number }> = [];
    const minX = zone.x;
    const maxX = zone.x + Math.max(1, zone.width) - 1;
    const minY = zone.y;
    const maxY = zone.y + Math.max(1, zone.height) - 1;

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const key = `${tx},${ty}`;
        if (!collisions.has(key) && !occupiedCoords.has(key)) {
          candidates.push({ x: tx, y: ty });
        }
      }
    }

    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      return candidates[idx];
    }

    // Fallback: pick any non-colliding tile in the zone
    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        if (!collisions.has(`${tx},${ty}`)) {
          return { x: tx, y: ty };
        }
      }
    }

    return { x: zone.x, y: zone.y };
  }

  public getActiveMonsterNodes(): WorldNode[] {
    const list: WorldNode[] = [];
    for (const inst of this.liveMonsters.values()) {
      if (inst.currentHp > 0 && !inst.respawnAtTick) {
        list.push({
          id: inst.id,
          name: inst.name,
          type: 'monster',
          x: inst.x,
          y: inst.y,
          monsterId: inst.monsterId,
          zoneId: inst.zoneId,
        });
      }
    }
    return list;
  }

  public getAllWorldNodes(): WorldNode[] {
    const staticNodes = storage.getWorldNodes().filter(n => n.type !== 'monster');
    const monsterNodes = this.getActiveMonsterNodes();
    return [...staticNodes, ...monsterNodes];
  }

  public findNearestAliveMonsterInZone(playerX: number, playerY: number, zoneId?: string, monsterId?: string): LiveMonsterInstance | null {
    let nearest: LiveMonsterInstance | null = null;
    let minDist = Infinity;

    for (const inst of this.liveMonsters.values()) {
      if (inst.currentHp <= 0 || inst.respawnAtTick) continue;
      if (zoneId && inst.zoneId !== zoneId) continue;
      if (monsterId && inst.monsterId !== monsterId) continue;

      const d = Math.hypot(inst.x - playerX, inst.y - playerY);
      if (d < minDist) {
        minDist = d;
        nearest = inst;
      }
    }

    return nearest;
  }

  public registerConnection(ws: WebSocket, playerId: string) {
    const existing = this.sessions.get(playerId);
    if (existing) {
      existing.player.lastActiveTimestamp = Date.now();
      storage.savePlayer(existing.player);
      try {
        existing.ws.close();
      } catch {}
    }

    let player = storage.getPlayer(playerId);
    let catchUpSummary = null;

    if (!player) {
      player = storage.createGuestPlayer();
    } else {
      // Calculate offline progress
      const elapsedSeconds = (Date.now() - player.lastActiveTimestamp) / 1000;
      if (elapsedSeconds > 10) {
        catchUpSummary = simulateOfflineCatchUp(player, elapsedSeconds);
        if (catchUpSummary && catchUpSummary.completedCycles > 0) {
          storage.savePlayer(player);
        }
      }
    }

    if (storage.isPlayerAdmin(player)) {
      player.role = 'admin';
    }

    // Ensure player Hitpoints is at least Level 10 and 1,154 XP (OSRS level 10 base)
    if (!player.skills.hitpoints || player.skills.hitpoints.level < 10 || player.skills.hitpoints.xp < 1154) {
      const hpXp = Math.max(1154, player.skills.hitpoints?.xp || 1154);
      player.skills.hitpoints = {
        xp: hpXp,
        level: Math.max(10, getLevelFromXp(hpXp)),
      };
      if (!player.currentHp || player.currentHp < player.skills.hitpoints.level) {
        player.currentHp = player.skills.hitpoints.level;
      }
      storage.savePlayer(player);
    }

    // Auto-migrate any legacy 'gold' items in inventory or storage into the player's coin pouch
    let migratedGold = 0;
    if (player.inventory && player.inventory.length > 0) {
      player.inventory = player.inventory.filter(slot => {
        if (slot.itemId === 'gold') {
          migratedGold += slot.quantity || 1;
          return false;
        }
        return true;
      });
    }
    if (player.storage && player.storage.length > 0) {
      player.storage = player.storage.filter(slot => {
        if (slot.itemId === 'gold') {
          migratedGold += slot.quantity || 1;
          return false;
        }
        return true;
      });
    }
    if (migratedGold > 0) {
      player.gold = (player.gold || 0) + migratedGold;
      storage.savePlayer(player);
    }

    player.lastActiveTimestamp = Date.now();
    this.catchUpFarmPlots(player);
    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);

    const session: ConnectedSession = {
      ws,
      player,
      ticksInTask: 0,
      moveAccumulator: 0,
      pendingTask: player.pendingTask || null,
      pendingCombat: null,
      activeCombat: null,
      lastActivityTimestamp: Date.now(),
    };
    this.sessions.set(player.id, session);

    // 1. If reconnecting with an active combat task, resume combat session
    if (player.currentTask && ((player.currentTask.skill as string) === 'combat' || Boolean(MONSTERS[player.currentTask.recipeId]))) {
      const mobId = player.currentTask.recipeId;
      const monDef = MONSTERS[mobId];
      if (monDef) {
        const mobX = player.currentTask.targetNodeX ?? player.x;
        const mobY = player.currentTask.targetNodeY ?? player.y;
        this.resumeCombatSession(session, mobId, mobX, mobY, player.currentTask.targetNodeId);
      }
    }

    // 2. If reconnecting while in a banking navigation cycle, resume path or deposit
    if (player.bankingState === 'walking_to_bank') {
      const hearth = this.getHearthLocation(player.x, player.y);
      if (Math.hypot(player.x - hearth.x, player.y - hearth.y) <= 1.5) {
        this.handleAutoDepositAtHearth(session);
      } else if (!player.isMoving || !player.path || player.path.length === 0) {
        const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = path;
        player.isMoving = path.length > 0;
      }
    } else if (player.bankingState === 'returning_to_work') {
      const targetTask = player.bankReturnTask || player.currentTask;
      if (targetTask && typeof targetTask.targetNodeX === 'number' && typeof targetTask.targetNodeY === 'number') {
        const dist = Math.hypot(player.x - targetTask.targetNodeX, player.y - targetTask.targetNodeY);
        if (dist <= 1.5) {
          player.bankingState = 'idle';
          if (player.bankReturnTask) {
            player.currentTask = player.bankReturnTask;
            player.bankReturnTask = null;
          }
          if (MONSTERS[player.currentTask?.recipeId || '']) {
            this.resumeCombatSession(session, player.currentTask!.recipeId, targetTask.targetNodeX, targetTask.targetNodeY, targetTask.targetNodeId);
          }
        } else if (!player.isMoving || !player.path || player.path.length === 0) {
          const adj = this.getAdjacentWalkableTile(player.x, player.y, targetTask.targetNodeX, targetTask.targetNodeY);
          const path = this.findPathWithCollisions(player.x, player.y, adj.x, adj.y);
          player.targetX = adj.x;
          player.targetY = adj.y;
          player.path = path;
          player.isMoving = path.length > 0;
        }
      }
    } else if (player.bankReturnTask && !player.currentTask) {
      player.currentTask = player.bankReturnTask;
      player.bankReturnTask = null;
      player.bankingState = 'idle';
    }

    // 3. If player was traveling to a node, resume path or begin work
    if (player.pendingTask && (!player.isMoving || !player.path || player.path.length === 0)) {
      const pt = player.pendingTask;
      const targetNodeX = pt.nodeX ?? pt.targetX;
      const targetNodeY = pt.nodeY ?? pt.targetY;
      const distToDest = Math.hypot(player.x - pt.targetX, player.y - pt.targetY);
      const distToNode = Math.hypot(player.x - targetNodeX, player.y - targetNodeY);
      if (distToDest <= 1.5 || distToNode <= 1.5) {
        const rec = RECIPES[pt.recipeId];
        if (rec) {
          player.currentTask = {
            recipeId: pt.recipeId,
            skill: rec.skill,
            startedAtTick: this.tickCount,
            targetQuantity: (typeof pt.quantity === 'number' && pt.quantity > 0) ? pt.quantity : Infinity,
            completedQuantity: 0,
            targetNodeX: targetNodeX,
            targetNodeY: targetNodeY,
          };
          player.pendingTask = null;
          session.pendingTask = null;
        }
      } else {
        const path = this.findPathWithCollisions(player.x, player.y, pt.targetX, pt.targetY);
        player.targetX = pt.targetX;
        player.targetY = pt.targetY;
        player.path = path;
        player.isMoving = path.length > 0;
      }
    }

    // Send initial handshake with persistent world nodes, npcs, quests, and collisions
    this.send(ws, {
      type: 'INIT',
      player,
      boss: this.getBossSummary(),
      catchUp: catchUpSummary,
      onlineCount: this.sessions.size,
      nodes: this.getAllWorldNodes(),
      monsterZones: storage.getMonsterZones(),
      npcs: storage.getNpcs(),
      quests: storage.getQuests(),
      collisions: Array.from(storage.getCollisions()),
      items: storage.getItems(),
    });

    this.broadcastWorldState();
  }

  public removeConnection(playerId: string, ws?: WebSocket) {
    const session = this.sessions.get(playerId);
    if (session) {
      if (ws && session.ws !== ws) {
        // Disconnect event from a replaced socket; do not destroy active session
        return;
      }
      session.player.lastActiveTimestamp = Date.now();
      storage.savePlayer(session.player);
      this.sessions.delete(playerId);
      this.broadcastWorldState();
    }
  }

  public shutdown() {
    console.log(`[Save] Saving ${this.sessions.size} active player session(s)...`);
    for (const session of this.sessions.values()) {
      session.player.lastActiveTimestamp = Date.now();
      storage.savePlayer(session.player);
    }
    storage.checkpoint();
    storage.close();
  }

  private findPathWithCollisions(startX: number, startY: number, targetX: number, targetY: number) {
    return findPath(startX, startY, targetX, targetY, -10000, -10000, 10000, 10000, (x, y) => storage.isCollidable(x, y));
  }

  private catchUpFarmPlots(player: PlayerData) {
    if (!player.farmPlots) {
      player.farmPlots = {};
      return;
    }
    const now = Date.now();
    let updated = false;
    for (const plot of Object.values(player.farmPlots)) {
      if (plot.status === 'growing') {
        const elapsedSec = Math.max(0, (now - plot.lastUpdated) / 1000);
        if (elapsedSec > 0) {
          // Offline growth proceeds at 1.0x standard rate
          plot.effectiveProgressSeconds += elapsedSec * 1.0;
          plot.lastUpdated = now;
          if (plot.effectiveProgressSeconds >= plot.baseDurationSeconds) {
            plot.status = 'ready';
          }
          updated = true;
        }
      }
    }
    if (updated) {
      storage.savePlayer(player);
    }
  }

  private addItemToPlayer(session: ConnectedSession, itemId: string, qty: number, rarity: Rarity = 'plain', plus: number = 0) {
    const { player } = session;
    const itemDef = storage.getItem(itemId);
    const invRes = addItemToSlots(player.inventory, 28, itemId, qty, rarity, plus, itemDef, 'inventory');
    if (invRes.remainder > 0) {
      const maxStorage = player.storageSlotsMax || 75;
      addItemToSlots(player.storage, maxStorage, itemId, invRes.remainder, rarity, plus, itemDef, 'bank');
    }
  }

  public handleClientMessage(playerId: string, msg: any) {
    const session = this.sessions.get(playerId);
    if (!session) return;
    session.lastActivityTimestamp = Date.now();
    const { player } = session;

    switch (msg.type) {
      case 'HEARTBEAT':
        break;

      case 'ENTER_AFK': {
        session.player.lastActiveTimestamp = Date.now();
        storage.savePlayer(session.player);
        this.removeConnection(playerId, session.ws);
        try {
          session.ws.close(4001, 'User AFK');
        } catch {}
        break;
      }
      case 'MOVE_TO':
      case 'MOVE':
        if (typeof msg.x === 'number' && typeof msg.y === 'number') {
          // Stop current work when voluntarily walking elsewhere
          if (player.currentTask) {
            player.currentTask = null;
          }
          player.pendingTask = null;
          session.pendingTask = null;
          session.pendingCombat = null;
          session.activeCombat = null;
          player.bankReturnTask = null;
          player.bankingState = 'idle';

          const path = this.findPathWithCollisions(player.x, player.y, msg.x, msg.y);
          player.targetX = msg.x;
          player.targetY = msg.y;
          player.path = path;
          player.isMoving = path.length > 0;
          storage.savePlayer(player);
          this.send(session.ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
        }
        break;

      case 'INTERACT_NODE':
      case 'START_TASK':
        if (msg.enqueue) {
          this.handleEnqueueTask(session, msg);
        } else {
          this.handleStartTask(session, msg);
        }
        break;

      case 'ENQUEUE_TASK':
        this.handleEnqueueTask(session, msg);
        break;

      case 'CANCEL_QUEUED_TASK':
        this.handleCancelQueuedTask(session, msg);
        break;

      case 'REORDER_QUEUE':
        this.handleReorderQueue(session, msg);
        break;

      case 'UNLOCK_QUEUE_SLOT':
        this.handleUnlockQueueSlot(session);
        break;

      case 'REDEEM_GEM_PACK':
        this.handleRedeemGemPack(session, msg.itemId);
        break;

      case 'STOP_TASK':
        if (msg.clearQueue) {
          player.taskQueue = [];
        }
        player.currentTask = null;
        player.pendingTask = null;
        session.ticksInTask = 0;
        session.pendingTask = null;
        session.pendingCombat = null;
        session.activeCombat = null;
        player.bankReturnTask = null;
        player.bankingState = 'idle';
        storage.savePlayer(player);
        storage.checkpoint();
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        if (msg.skipToNext && Array.isArray(player.taskQueue) && player.taskQueue.length > 0) {
          this.startNextQueuedTask(session);
        }
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

      case 'DEPOSIT_ITEM':
        if (typeof msg.inventoryIndex === 'number') {
          this.handleDepositItem(session, msg.inventoryIndex, msg.quantity);
        }
        break;

      case 'WITHDRAW_ITEM':
        if (typeof msg.storageIndex === 'number') {
          this.handleWithdrawItem(session, msg.storageIndex, msg.quantity);
        }
        break;

      case 'BUY_STORAGE_SLOT':
        this.handleBuyStorageSlot(session);
        break;

      case 'SORT_STORAGE':
        this.handleSortStorage(session);
        break;

      case 'SELL_ITEM':
        if (typeof msg.inventoryIndex === 'number') {
          this.handleSellItem(session, msg.inventoryIndex, msg.quantity);
        }
        break;

      case 'SELL_ALL_JUNK':
        this.handleSellAllJunk(session);
        break;

      case 'GET_MARKET_LISTINGS':
        this.handleGetMarketListings(session);
        break;

      case 'CREATE_MARKET_LISTING':
        this.handleCreateMarketListing(session, msg.inventoryIndex, msg.quantity, msg.unitPrice);
        break;

      case 'BUY_MARKET_LISTING':
        this.handleBuyMarketListing(session, msg.listingId, msg.quantity);
        break;

      case 'CANCEL_MARKET_LISTING':
        this.handleCancelMarketListing(session, msg.listingId);
        break;

      case 'SET_COMBAT_FOOD_SETTINGS':
        if (typeof msg.eatsAtHpPercent === 'number' && !isNaN(msg.eatsAtHpPercent)) {
          player.eatsAtHpPercent = Math.max(10, Math.min(95, Math.round(msg.eatsAtHpPercent)));
        }
        if (msg.selectedFoodItemId !== undefined) {
          player.selectedFoodItemId = (typeof msg.selectedFoodItemId === 'string' && msg.selectedFoodItemId.trim().length > 0)
            ? msg.selectedFoodItemId.trim()
            : null;
        }
        storage.savePlayer(player);
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        break;

      case 'CHAT':
        if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
          const trimmed = msg.text.trim();

          // Set name command: /name <username> or /nick <username>
          if (trimmed.startsWith('/name ') || trimmed.startsWith('/nick ') || trimmed.startsWith('/setname ')) {
            const newName = trimmed.replace(/^\/(name|nick|setname)\s+/, '').trim().slice(0, 16);
            if (!player.isGuest) {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Your adventurer name is bound to your registered account (${player.username}).`,
              });
              break;
            }
            if (newName) {
              if (storage.isUsernameTaken(newName) || storage.isAdminUsername(newName)) {
                this.send(session.ws, {
                  type: 'NOTIFICATION',
                  message: `"${newName}" is a registered or reserved account name. Please log in or register with a password to claim it.`,
                });
                break;
              }
              player.username = newName;
              player.role = 'player';
              storage.savePlayer(player);
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Guest name changed to "${newName}". Create an account with a password to save it permanently!`,
              });
              this.send(session.ws, { type: 'PLAYER_UPDATE', player });
              this.broadcastWorldState();
            }
            break;
          }

          // Admin give command: /give <item> [qty] or /give <player> <item> [qty]
          if (trimmed.startsWith('/give ') || trimmed.startsWith('/item ')) {
            if (player.role !== 'admin') {
              this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
              break;
            }
            const parts = trimmed.split(/\s+/).slice(1);
            if (parts.length === 0) {
              this.send(session.ws, { type: 'NOTIFICATION', message: 'Usage: /give <itemId> [qty] OR /give <player> <itemId> [qty]' });
              break;
            }
            if (ITEMS[parts[0]]) {
              const itemId = parts[0];
              const qty = Math.max(1, parseInt(parts[1], 10) || 1);
              this.handleAdminGiveItem(session, { itemId, quantity: qty, destination: 'inventory' });
            } else if (parts.length >= 2 && ITEMS[parts[1]]) {
              const target = parts[0];
              const itemId = parts[1];
              const qty = Math.max(1, parseInt(parts[2], 10) || 1);
              this.handleAdminGiveItem(session, { target, itemId, quantity: qty, destination: 'inventory' });
            } else {
              this.send(session.ws, { type: 'NOTIFICATION', message: `Unknown item ID: "${parts[0]}". Check item ID or use the Admin panel.` });
            }
            break;
          }

          // Admin teleport command: /tp <x> <y> or /tp castle or /tp town
          if (trimmed.startsWith('/tp ') || trimmed.startsWith('/teleport ')) {
            if (player.role !== 'admin') {
              this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
              break;
            }
            const parts = trimmed.split(/\s+/).slice(1);
            if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
              const tx = Math.round(Number(parts[0]));
              const ty = Math.round(Number(parts[1]));
              player.x = tx;
              player.y = ty;
              player.targetX = tx;
              player.targetY = ty;
              player.path = [];
              player.isMoving = false;
              this.send(session.ws, { type: 'NOTIFICATION', message: `Teleported to (${tx}, ${ty}).` });
              this.send(session.ws, { type: 'PLAYER_UPDATE', player });
              this.broadcastWorldState();
              break;
            } else if (parts.length === 1 && (parts[0].toLowerCase() === 'castle' || parts[0].toLowerCase().includes('eldoria'))) {
              player.x = -301;
              player.y = -15;
              player.targetX = -301;
              player.targetY = -15;
              player.path = [];
              player.isMoving = false;
              this.send(session.ws, { type: 'NOTIFICATION', message: `Teleported to Eldoria Castle (-301, -15).` });
              this.send(session.ws, { type: 'PLAYER_UPDATE', player });
              this.broadcastWorldState();
              break;
            } else if (parts.length === 1 && parts[0].toLowerCase() === 'town') {
              const hearth = this.getHearthLocation(player.x, player.y);
              player.x = hearth.x;
              player.y = hearth.y;
              player.targetX = hearth.x;
              player.targetY = hearth.y;
              player.path = [];
              player.isMoving = false;
              this.send(session.ws, { type: 'NOTIFICATION', message: `Teleported to Hearth Town (${hearth.x}, ${hearth.y}).` });
              this.send(session.ws, { type: 'PLAYER_UPDATE', player });
              this.broadcastWorldState();
              break;
            } else {
              this.send(session.ws, { type: 'NOTIFICATION', message: 'Usage: /tp <x> <y> OR /tp castle OR /tp town' });
              break;
            }
          }

          const chatPayload = {
            type: 'CHAT_BROADCAST',
            channel: msg.channel || 'All',
            senderId: player.id,
            senderName: player.username,
            role: player.role || 'player',
            isAdmin: player.role === 'admin',
            title: player.activeTitle,
            text: trimmed.slice(0, 150),
            timestamp: Date.now(),
            x: player.x,
            y: player.y,
          };
          this.broadcast(chatPayload);
        }
        break;

      case 'ADMIN_GIVE_ITEM':
        this.handleAdminGiveItem(session, msg);
        break;

      case 'START_COMBAT':
      case 'ATTACK_MONSTER':
        this.handleStartCombat(session, msg);
        break;

      case 'ADMIN_SAVE_NODE':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.node && msg.node.id) {
          storage.upsertWorldNode(msg.node);
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Node "${msg.node.name}" saved at (${msg.node.x}, ${msg.node.y}).`
          });
        }
        break;

      case 'ADMIN_DELETE_NODE':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        const deleteNodeId = msg.nodeId || msg.id;
        if (deleteNodeId) {
          storage.deleteWorldNode(deleteNodeId);
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Node ${deleteNodeId} deleted.`
          });
        }
        break;

      case 'ADMIN_SAVE_MONSTER_ZONE': {
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.zone && msg.zone.id) {
          storage.upsertMonsterZone(msg.zone);
          this.initMonsterZones();
          this.broadcast({ type: 'WORLD_MONSTER_ZONES_UPDATE', monsterZones: storage.getMonsterZones() });
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Monster Zone "${msg.zone.name}" saved.`
          });
        }
        break;
      }

      case 'ADMIN_DELETE_MONSTER_ZONE': {
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        const zoneId = msg.zoneId || msg.id;
        if (zoneId) {
          storage.deleteMonsterZone(zoneId);
          this.initMonsterZones();
          this.broadcast({ type: 'WORLD_MONSTER_ZONES_UPDATE', monsterZones: storage.getMonsterZones() });
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Monster Zone deleted.`
          });
        }
        break;
      }

      case 'ADMIN_TELEPORT': {
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        const x = Math.round(Number(msg.x));
        const y = Math.round(Number(msg.y));
        if (Number.isFinite(x) && Number.isFinite(y)) {
          // Cancel active tasks, pathing, and combat
          if (player.currentTask) player.currentTask = null;
          player.pendingTask = null;
          session.pendingTask = null;
          session.pendingCombat = null;
          session.activeCombat = null;
          player.bankReturnTask = null;
          player.bankingState = 'idle';

          player.x = x;
          player.y = y;
          player.targetX = x;
          player.targetY = y;
          player.path = [];
          player.isMoving = false;
          storage.savePlayer(player);
          this.send(session.ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Admin Teleported to (${x}, ${y}).`
          });
        }
        break;
      }

      case 'ADMIN_SAVE_NPC':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.npc && msg.npc.id) {
          storage.upsertNpc(msg.npc);

          // Synchronize quest assignments
          const assignedQuestIds = new Set(msg.npc.questIds || []);
          const allQuests = storage.getQuests();
          let questsChanged = false;
          for (const q of allQuests) {
            if (assignedQuestIds.has(q.id)) {
              if (q.npcId !== msg.npc.id) {
                q.npcId = msg.npc.id;
                storage.upsertQuest(q);
                questsChanged = true;
              }
            } else if (q.npcId === msg.npc.id) {
              q.npcId = '';
              storage.upsertQuest(q);
              questsChanged = true;
            }
          }

          this.broadcast({ type: 'NPCS_UPDATE', npcs: storage.getNpcs() });
          if (questsChanged) {
            this.broadcast({ type: 'QUESTS_UPDATE', quests: storage.getQuests() });
          }
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `NPC "${msg.npc.name}" saved at (${msg.npc.x}, ${msg.npc.y}).`
          });
        }
        break;

      case 'ADMIN_DELETE_NPC':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        const deleteNpcId = msg.npcId || msg.id;
        if (deleteNpcId) {
          storage.deleteNpc(deleteNpcId);

          // Detach deleted NPC from any quests
          const allQuests = storage.getQuests();
          let questsChanged = false;
          for (const q of allQuests) {
            if (q.npcId === deleteNpcId) {
              q.npcId = '';
              storage.upsertQuest(q);
              questsChanged = true;
            }
          }

          this.broadcast({ type: 'NPCS_UPDATE', npcs: storage.getNpcs() });
          if (questsChanged) {
            this.broadcast({ type: 'QUESTS_UPDATE', quests: storage.getQuests() });
          }
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `NPC ${deleteNpcId} deleted.`
          });
        }
        break;

      case 'ADMIN_SAVE_QUEST':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.quest && msg.quest.id) {
          storage.upsertQuest(msg.quest);

          // Synchronize NPC questIds
          let npcsChanged = false;
          const allNpcs = storage.getNpcs();
          for (const n of allNpcs) {
            n.questIds = n.questIds || [];
            if (msg.quest.npcId && n.id === msg.quest.npcId) {
              if (!n.questIds.includes(msg.quest.id)) {
                n.questIds.push(msg.quest.id);
                storage.upsertNpc(n);
                npcsChanged = true;
              }
            } else if (n.questIds.includes(msg.quest.id) && n.id !== msg.quest.npcId) {
              n.questIds = n.questIds.filter(id => id !== msg.quest.id);
              storage.upsertNpc(n);
              npcsChanged = true;
            }
          }

          this.broadcast({ type: 'QUESTS_UPDATE', quests: storage.getQuests() });
          if (npcsChanged) {
            this.broadcast({ type: 'NPCS_UPDATE', npcs: storage.getNpcs() });
          }
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Quest "${msg.quest.title}" saved.`
          });
        }
        break;

      case 'ADMIN_DELETE_QUEST':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        const deleteQuestId = msg.questId || msg.id;
        if (deleteQuestId) {
          storage.deleteQuest(deleteQuestId);
          this.broadcast({ type: 'QUESTS_UPDATE', quests: storage.getQuests() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Quest ${deleteQuestId} deleted.`
          });
        }
        break;

      case 'ADMIN_SAVE_COLLISIONS':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (Array.isArray(msg.collisions)) {
          storage.saveCollisions(msg.collisions);
          this.broadcast({
            type: 'COLLISIONS_UPDATE',
            collisions: Array.from(storage.getCollisions())
          });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Saved ${msg.collisions.length} collision tiles. Pathfinding updated!`
          });
        }
        break;

      case 'ADMIN_SAVE_ITEM':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.item && msg.item.id) {
          storage.saveItem(msg.item);
          this.broadcast({ type: 'ITEMS_UPDATE', items: storage.getItems() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Saved item "${msg.item.name}" (${msg.item.id}).`
          });
        }
        break;

      case 'ADMIN_DELETE_ITEM':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
          break;
        }
        if (msg.id) {
          storage.deleteItem(msg.id);
          this.broadcast({ type: 'ITEMS_UPDATE', items: storage.getItems() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Deleted / reset item "${msg.id}".`
          });
        }
        break;

      case 'PLANT_PLOT': {
        const { plotId, seedId } = msg;
        const cropDef = FARMING_CROPS[seedId];
        if (!cropDef) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Unknown agricultural seed.' });
          break;
        }

        const farmingLevel = player.skills.farming?.level || 1;
        if (farmingLevel < cropDef.levelReq) {
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Locked: Requires Farming Level ${cropDef.levelReq} to sow ${cropDef.name}.`
          });
          break;
        }

        const plotNode = storage.getWorldNodes().find(n => n.id === plotId && n.type === 'farm');
        if (!plotNode) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Farm allotment not found.' });
          break;
        }

        const dist = Math.hypot(player.x - plotNode.x, player.y - plotNode.y);
        if (dist > 2.5) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'Move closer to the farm allotment to plant.' });
          break;
        }

        player.farmPlots = player.farmPlots || {};
        if (player.farmPlots[plotId] && player.farmPlots[plotId].status === 'growing') {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'A crop is already growing in this allotment.' });
          break;
        }

        // Deduct 1 seed from inventory or storage
        const invIdx = player.inventory.findIndex(s => s.itemId === seedId && s.quantity > 0);
        if (invIdx >= 0) {
          player.inventory[invIdx].quantity--;
          if (player.inventory[invIdx].quantity <= 0) {
            player.inventory.splice(invIdx, 1);
          }
        } else {
          const storageIdx = player.storage.findIndex(s => s.itemId === seedId && s.quantity > 0);
          if (storageIdx >= 0) {
            player.storage[storageIdx].quantity--;
            if (player.storage[storageIdx].quantity <= 0) {
              player.storage.splice(storageIdx, 1);
            }
          } else {
            this.send(session.ws, {
              type: 'NOTIFICATION',
              message: `No ${cropDef.name} seeds in your satchel or Hearth storage.`
            });
            break;
          }
        }

        player.farmPlots[plotId] = {
          plotId,
          seedId,
          cropId: cropDef.cropId,
          cropName: cropDef.name,
          plantedAt: Date.now(),
          baseDurationSeconds: cropDef.baseDurationSeconds,
          effectiveProgressSeconds: 0,
          lastUpdated: Date.now(),
          status: 'growing',
          minYield: cropDef.minYield,
          maxYield: cropDef.maxYield,
          xp: cropDef.xp,
          isHighXpMethod: cropDef.isHighXpMethod,
        };

        storage.savePlayer(player);
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Sowed ${cropDef.name} seeds! Growing at 2x online speed (${Math.round(cropDef.baseDurationSeconds / 120)}m online / ${Math.round(cropDef.baseDurationSeconds / 60)}m offline).`
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        break;
      }

      case 'HARVEST_PLOT': {
        const { plotId } = msg;
        player.farmPlots = player.farmPlots || {};
        const plot = player.farmPlots[plotId];
        if (!plot) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'No crop growing in this allotment.' });
          break;
        }

        if (plot.status !== 'ready') {
          const remainingSec = Math.max(0, Math.ceil((plot.baseDurationSeconds - plot.effectiveProgressSeconds) / ONLINE_GROWTH_MULTIPLIER));
          const mins = Math.floor(remainingSec / 60);
          const secs = remainingSec % 60;
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `${plot.cropName} is still maturing (~${mins}m ${secs}s remaining online).`
          });
          break;
        }

        const plotNode = storage.getWorldNodes().find(n => n.id === plotId && n.type === 'farm');
        if (plotNode) {
          const dist = Math.hypot(player.x - plotNode.x, player.y - plotNode.y);
          if (dist > 2.5) {
            this.send(session.ws, { type: 'NOTIFICATION', message: 'Move closer to harvest this allotment.' });
            break;
          }
        }

        const cropDef = FARMING_CROPS[plot.seedId];
        const minYield = cropDef?.minYield || 3;
        const maxYield = cropDef?.maxYield || 5;
        const yieldQty = Math.floor(Math.random() * (maxYield - minYield + 1)) + minYield;
        const seedReturn = Math.random() < (cropDef?.seedReturnChance || 0.4);

        // Add harvest to player inventory (or storage)
        this.addItemToPlayer(session, plot.cropId, yieldQty);
        if (seedReturn) {
          this.addItemToPlayer(session, plot.seedId, 1);
        }

        // Award Farming XP
        const farmingSkill = player.skills.farming || { xp: 0, level: 1 };
        farmingSkill.xp += plot.xp;
        const oldLevel = farmingSkill.level;
        farmingSkill.level = getLevelFromXp(farmingSkill.xp);
        player.skills.farming = farmingSkill;

        if (farmingSkill.level > oldLevel) {
          this.send(session.ws, {
            type: 'LEVEL_UP',
            skill: 'farming',
            newLevel: farmingSkill.level,
          });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Congratulations! Your Farming skill advanced to Level ${farmingSkill.level}!`
          });
        }

        // If harvested crop is an herb, also award proportional Herbalism XP per unit
        const isManualHerb = ['silverleaf', 'glowshroom', 'nightshade_bell', 'bramble_mandrake', 'wyrmfrond', 'sunfire_pepper'].includes(plot.cropId || '');
        if (isManualHerb) {
          const herbRecipe = RECIPES[`gather_${plot.cropId}`];
          const herbPerUnitXp = herbRecipe?.xp || 3;
          const herbXpGained = herbPerUnitXp * yieldQty;
          const herbalismSkill = player.skills.herbalism || { xp: 0, level: 1 };
          const oldHerbLevel = herbalismSkill.level;
          herbalismSkill.xp += herbXpGained;
          herbalismSkill.level = getLevelFromXp(herbalismSkill.xp);
          player.skills.herbalism = herbalismSkill;

          if (herbalismSkill.level > oldHerbLevel) {
            this.send(session.ws, {
              type: 'LEVEL_UP',
              skill: 'herbalism',
              newLevel: herbalismSkill.level,
            });
            this.send(session.ws, {
              type: 'NOTIFICATION',
              message: `Congratulations! Your Herbalism skill advanced to Level ${herbalismSkill.level}!`
            });
          }
        }

        delete player.farmPlots[plotId];
        storage.savePlayer(player);

        const cropName = ITEMS[plot.cropId]?.name || plot.cropName;
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Harvested ${yieldQty}x ${cropName}${seedReturn ? ' + 1 bonus seed' : ''}! (+${plot.xp} Farming XP)`
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        break;
      }

      case 'CLAIM_STARTER_SEEDS': {
        player.farmPlots = player.farmPlots || {};
        const hasSeeds = player.inventory.some(s => s.itemId.includes('seed') || s.itemId.includes('spore') || s.itemId.includes('pod')) ||
                         player.storage.some(s => s.itemId.includes('seed') || s.itemId.includes('spore') || s.itemId.includes('pod'));
        const hasPlots = Object.keys(player.farmPlots).length > 0;
        if (hasSeeds || hasPlots) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'You already possess agricultural seeds or have active crops planted.' });
          break;
        }
        this.addItemToPlayer(session, 'earthtuber_seed', 3);
        storage.savePlayer(player);
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: 'Received 3x Starter Earthtuber Seeds from the garden shed!'
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        break;
      }

      case 'CLAIM_QUEST_REWARD': {
        const { questId } = msg;
        const quests = storage.getQuests();
        const quest = quests.find(q => q.id === questId);
        if (!quest) break;

        if (!player.completedQuests) player.completedQuests = [];
        if (player.completedQuests.includes(questId)) {
          this.send(session.ws, { type: 'NOTIFICATION', message: 'You have already claimed this quest reward.' });
          break;
        }

        // Validate quest objective requirements
        if (quest.objective) {
          if (quest.objective.type === 'kill') {
            const kills = player.questProgress?.[quest.id] || 0;
            if (kills < quest.objective.count) {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Objective incomplete: Defeated ${kills}/${quest.objective.count} ${quest.objective.targetId}.`
              });
              break;
            }
          } else if (quest.objective.type === 'gather') {
            const reqItem = quest.objective.targetId;
            const reqCount = quest.objective.count;
            let countInInv = 0;
            for (const slot of player.inventory) {
              if (slot.itemId === reqItem) countInInv += slot.quantity;
            }
            if (countInInv < reqCount) {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Objective incomplete: Need ${reqCount}x ${ITEMS[reqItem]?.name || reqItem} in your satchel.`
              });
              break;
            }

            // Deduct gathered items from inventory
            let toDeduct = reqCount;
            for (let i = player.inventory.length - 1; i >= 0; i--) {
              const slot = player.inventory[i];
              if (slot.itemId === reqItem) {
                const take = Math.min(slot.quantity, toDeduct);
                slot.quantity -= take;
                toDeduct -= take;
                if (slot.quantity <= 0) player.inventory.splice(i, 1);
                if (toDeduct <= 0) break;
              }
            }
          }
        }

        player.completedQuests.push(questId);

        const goldReward = quest.reward.gold || 0;
        if (goldReward > 0) {
          player.gold = (player.gold || 0) + goldReward;
        }

        if (quest.reward.xp) {
          const xpAmt = typeof quest.reward.xp === 'number' ? quest.reward.xp : (quest.reward.xp.amount || 0);
          const skillKey = (typeof quest.reward.xp === 'object' && quest.reward.xp.skill) ? quest.reward.xp.skill : 'melee';
          if (xpAmt > 0 && player.skills[skillKey]) {
            const oldLevel = player.skills[skillKey].level;
            player.skills[skillKey].xp += xpAmt;
            const newLevel = getLevelFromXp(player.skills[skillKey].xp);
            player.skills[skillKey].level = newLevel;
            if (newLevel > oldLevel) {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Level Up! Your ${skillKey} advanced to Level ${newLevel}!`
              });
            }
          }
        }

        if (quest.reward.items && quest.reward.items.length > 0) {
          for (const it of quest.reward.items) {
            this.addItemToPlayer(session, it.itemId, it.quantity);
          }
        }

        storage.savePlayer(player);
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Quest Completed: "${quest.title || quest.id}"! Rewards claimed.`
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        break;
      }

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
    if (!def) return;

    let targetSlot = def.slot;
    if (targetSlot === 'tool' || def.category === 'tool') {
      if (def.id.includes('pickaxe')) targetSlot = 'tool_pickaxe';
      else if (def.id.includes('axe')) targetSlot = 'tool_axe';
      else if (def.id.includes('rod') || def.id.includes('fish')) targetSlot = 'tool_rod';
      else targetSlot = 'tool';
    }
    if (!targetSlot) return;

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

    // Unequip currently worn in that slot if any
    const existing = player.equipment[targetSlot];

    // Remove 1 item from inventory
    if (slot.quantity > 1) {
      slot.quantity--;
      player.equipment[targetSlot] = { ...slot, quantity: 1 };
    } else {
      player.inventory.splice(invIndex, 1);
      player.equipment[targetSlot] = slot;
    }

    if (existing) {
      const existingDef = storage.getItem(existing.itemId) || ITEMS[existing.itemId];
      addItemToSlots(player.inventory, 28, existing.itemId, existing.quantity || 1, existing.rarity, existing.plus, existingDef, 'inventory');
    }

    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);

    storage.savePlayer(player);
    storage.checkpoint();

    this.send(session.ws, {
      type: 'NOTIFICATION',
      message: targetSlot === 'steed'
        ? `Equipped ${def.name}. Mounted speed: ${player.moveSpeedTilesPerTick} tiles/tick.`
        : `Equipped ${def.name}.`
    });
    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
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

    storage.savePlayer(player);
    storage.checkpoint();

    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
  }

  private handleEatFood(session: ConnectedSession, invIndex: number) {
    const { player } = session;
    const slot = player.inventory[invIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def || def.category !== 'cooked_food' || !def.baseStats?.healing) return;

    const maxHp = (player.skills.hitpoints?.level || 10);
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

  public getHearthLocation(playerX?: number, playerY?: number): { x: number; y: number } {
    const nodes = storage.getWorldNodes();
    const hearthNodes = nodes.filter(n =>
      n.type === 'hearth_counter' ||
      n.id.toLowerCase().includes('hearth') ||
      n.id.toLowerCase().includes('bank') ||
      (n.name && (n.name.toLowerCase().includes('hearth') || n.name.toLowerCase().includes('bank')))
    );

    if (hearthNodes.length === 0) {
      return { x: 8, y: 22 };
    }

    if (playerX !== undefined && playerY !== undefined) {
      let nearest = hearthNodes[0];
      let minDist = Math.hypot(playerX - nearest.x, playerY - nearest.y);
      for (let i = 1; i < hearthNodes.length; i++) {
        const d = Math.hypot(playerX - hearthNodes[i].x, playerY - hearthNodes[i].y);
        if (d < minDist) {
          minDist = d;
          nearest = hearthNodes[i];
        }
      }
      return { x: nearest.x, y: nearest.y };
    }

    return { x: hearthNodes[0].x, y: hearthNodes[0].y };
  }

  private handleDepositAll(session: ConnectedSession) {
    const { player, ws } = session;
    // Explicit manual deposit: cancel active/pending return tasks
    player.currentTask = null;
    session.pendingTask = null;
    player.bankReturnTask = null;
    session.ticksInTask = 0;

    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);

    if (distToHearth > 1.5) {
      const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
      if (path.length === 0) {
        if (distToHearth <= 3.0) {
          this.handleAutoDepositAtHearth(session);
          return;
        }
        this.send(ws, {
          type: 'NOTIFICATION',
          message: 'Unable to reach the Hearth Storage Counter (path blocked).'
        });
        player.bankingState = 'idle';
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        return;
      }

      player.targetX = hearth.x;
      player.targetY = hearth.y;
      player.path = path;
      player.isMoving = true;
      player.bankingState = 'walking_to_bank';

      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Heading to the bank to drop off your items...'
      });
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.broadcastWorldState();
      return;
    }

    // Already at Hearth counter: deposit immediately
    this.handleAutoDepositAtHearth(session);
  }

  private handleWithdrawItem(session: ConnectedSession, storageIndex: number, requestedQty?: number) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);

    if (distToHearth > 1.5) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Must be at the Hearth Storage Counter to withdraw items.'
      });
      return;
    }

    const slot = player.storage[storageIndex];
    if (!slot) return;
    const def = storage.getItem(slot.itemId) || ITEMS[slot.itemId];

    let validQty: number | undefined = undefined;
    if (typeof requestedQty === 'number') {
      if (!Number.isFinite(requestedQty) || requestedQty <= 0) return;
      validQty = Math.floor(requestedQty);
      if (validQty <= 0) return;
    }

    const qtyToTake = (typeof validQty === 'number')
      ? Math.min(slot.quantity, validQty)
      : slot.quantity;

    const res = addItemToSlots(player.inventory, 28, slot.itemId, qtyToTake, slot.rarity, slot.plus, def, 'inventory');
    if (res.added <= 0) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Satchel full! Cannot withdraw items.'
      });
      return;
    }

    slot.quantity -= res.added;
    if (slot.quantity <= 0) {
      player.storage.splice(storageIndex, 1);
    }

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Withdrew ${res.added}x ${def?.name || slot.itemId} from the vault.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleDepositItem(session: ConnectedSession, inventoryIndex: number, requestedQty?: number) {
    const { player, ws } = session;
    const slot = player.inventory[inventoryIndex];
    if (!slot) return;
    const def = storage.getItem(slot.itemId) || ITEMS[slot.itemId];

    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);

    if (distToHearth > 1.5) {
      const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
      if (path.length === 0) {
        if (distToHearth > 3.0) {
          this.send(ws, {
            type: 'NOTIFICATION',
            message: 'Unable to reach the Hearth Storage Counter (path blocked).'
          });
          return;
        }
      } else {
        player.currentTask = null;
        session.pendingTask = null;
        player.bankReturnTask = null;
        session.ticksInTask = 0;

        session.pendingDeposit = {
          itemId: slot.itemId,
          rarity: slot.rarity,
          plus: slot.plus,
          quantity: requestedQty,
        };

        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = path;
        player.isMoving = true;
        player.bankingState = 'walking_to_bank';

        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Traveling to the Hearth to deposit ${def?.name || slot.itemId}... (${path.length} paces)`
        });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      }
    }

    const maxSlots = player.storageSlotsMax || 75;
    let validDepositQty: number | undefined = undefined;
    if (typeof requestedQty === 'number') {
      if (!Number.isFinite(requestedQty) || requestedQty <= 0) return;
      validDepositQty = Math.floor(requestedQty);
      if (validDepositQty <= 0) return;
    }

    const qtyToTake = (typeof validDepositQty === 'number')
      ? Math.min(slot.quantity, validDepositQty)
      : slot.quantity;

    const res = addItemToSlots(player.storage, maxSlots, slot.itemId, qtyToTake, slot.rarity, slot.plus, def, 'bank');
    if (res.added <= 0) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Hearth Vault full! Purchase additional slots or withdraw items.'
      });
      return;
    }

    slot.quantity -= res.added;
    if (slot.quantity <= 0) {
      player.inventory.splice(inventoryIndex, 1);
    }

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Deposited ${qtyToTake}x ${def?.name || slot.itemId} into the vault.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleBuyStorageSlot(session: ConnectedSession) {
    const { player, ws } = session;
    const cost = 1000;
    if ((player.gold || 0) < cost) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Insufficient gold. Expanding vault requires ${cost.toLocaleString()} gold.`
      });
      return;
    }

    player.gold -= cost;
    player.storageSlotsMax = (player.storageSlotsMax || 75) + 5;
    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Vault expanded to ${player.storageSlotsMax} slots (+5)!`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleSortStorage(session: ConnectedSession) {
    const { player, ws } = session;
    const categoryOrder: Record<string, number> = {
      tool: 1, weapon: 2, shield: 3, armor: 4, bar: 5, ore: 6,
      log: 7, cooked_food: 8, raw_food: 9, crop: 10, seed: 11,
      herb: 12, potion: 13, relic: 14, trophy: 15
    };

    player.storage.sort((a, b) => {
      const defA = ITEMS[a.itemId];
      const defB = ITEMS[b.itemId];
      const catA = categoryOrder[defA?.category || ''] || 99;
      const catB = categoryOrder[defB?.category || ''] || 99;
      if (catA !== catB) return catA - catB;
      const tierA = defA?.tier || 0;
      const tierB = defB?.tier || 0;
      if (tierA !== tierB) return tierB - tierA;
      return (defA?.name || a.itemId).localeCompare(defB?.name || b.itemId);
    });

    storage.savePlayer(player);
    this.send(ws, {
      type: 'NOTIFICATION',
      message: 'Vault sorted by category and tier.'
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleSellItem(session: ConnectedSession, inventoryIndex: number, requestedQty?: number) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    const nearbyNpc = storage.getNpcs().some(n => Math.hypot(player.x - n.x, player.y - n.y) <= 3.5);
    if (distToHearth > 3.5 && !nearbyNpc) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Must be at the Hearth Counter or near a Merchant NPC to sell items.'
      });
      return;
    }

    const slot = player.inventory[inventoryIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    const unitPrice = def?.vendorFloorPrice || 1;

    let validSellQty: number | undefined = undefined;
    if (typeof requestedQty === 'number') {
      if (!Number.isFinite(requestedQty) || requestedQty <= 0) return;
      validSellQty = Math.floor(requestedQty);
      if (validSellQty <= 0) return;
    }

    const qtyToSell = (typeof validSellQty === 'number')
      ? Math.min(slot.quantity, validSellQty)
      : slot.quantity;

    slot.quantity -= qtyToSell;
    if (slot.quantity <= 0) {
      player.inventory.splice(inventoryIndex, 1);
    }

    const totalGold = unitPrice * qtyToSell;
    player.gold = (player.gold || 0) + totalGold;

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Sold ${qtyToSell}x ${def?.name || slot.itemId} for ${totalGold.toLocaleString()} gold.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleSellAllJunk(session: ConnectedSession) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    const nearbyNpc = storage.getNpcs().some(n => Math.hypot(player.x - n.x, player.y - n.y) <= 3.5);
    if (distToHearth > 3.5 && !nearbyNpc) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Must be at the Hearth Counter or near a Merchant NPC to sell items.'
      });
      return;
    }

    let totalGold = 0;
    let soldCount = 0;
    const keep: typeof player.inventory = [];

    for (const slot of player.inventory) {
      const def = ITEMS[slot.itemId];
      if (def?.category === 'tool' || def?.category === 'steed' || def?.category === 'weapon' || def?.slot) {
        keep.push(slot);
        continue;
      }

      const unitPrice = def?.vendorFloorPrice || 1;
      totalGold += unitPrice * slot.quantity;
      soldCount += slot.quantity;
    }

    if (soldCount === 0) {
      this.send(ws, { type: 'NOTIFICATION', message: "You don't have anything in your bag to sell." });
      return;
    }

    player.inventory = keep;
    player.gold = (player.gold || 0) + totalGold;

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Sold ${soldCount} items to merchant for ${totalGold.toLocaleString()} gold.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleGetMarketListings(session: ConnectedSession) {
    const listings = storage.getMarketListings();
    this.send(session.ws, {
      type: 'MARKET_LISTINGS',
      listings,
    });
  }

  private handleCreateMarketListing(session: ConnectedSession, inventoryIndex: number, quantity: number, unitPrice: number) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    if (distToHearth > 3.5) {
      this.send(ws, { type: 'NOTIFICATION', message: 'You must be at the Hearth to list items on the marketplace.' });
      return;
    }

    if (typeof inventoryIndex !== 'number' || inventoryIndex < 0 || inventoryIndex >= player.inventory.length) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Invalid item selected.' });
      return;
    }

    const slot = player.inventory[inventoryIndex];
    if (!slot) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Item no longer exists in satchel.' });
      return;
    }

    if (slot.itemId === 'gold') {
      this.send(ws, { type: 'NOTIFICATION', message: 'Cannot list gold coins on the marketplace.' });
      return;
    }

    const safeQty = Math.floor(quantity);
    if (!Number.isFinite(safeQty) || safeQty <= 0) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Quantity must be greater than zero.' });
      return;
    }

    if (safeQty > slot.quantity) {
      this.send(ws, { type: 'NOTIFICATION', message: 'You do not have enough of that item.' });
      return;
    }

    const safeUnitPrice = Math.floor(unitPrice);
    if (!Number.isFinite(safeUnitPrice) || safeUnitPrice <= 0 || safeUnitPrice > 2000000000) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Unit price must be between 1 and 2,000,000,000 gold.' });
      return;
    }

    const totalPrice = safeUnitPrice * safeQty;
    if (totalPrice <= 0 || totalPrice > 2000000000) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Total price exceeds gold capacity.' });
      return;
    }

    // Deduct item from inventory immediately (escrow)
    slot.quantity -= safeQty;
    const itemRarity = slot.rarity || 'plain';
    const itemPlus = slot.plus || 0;
    const itemId = slot.itemId;

    if (slot.quantity <= 0) {
      player.inventory.splice(inventoryIndex, 1);
    }

    const listingId = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const listing: MarketListing = {
      id: listingId,
      sellerId: player.id,
      sellerName: player.username,
      itemId,
      quantity: safeQty,
      unitPrice: safeUnitPrice,
      totalPrice,
      rarity: itemRarity,
      plus: itemPlus,
      createdAt: Date.now(),
    };

    storage.createMarketListing(listing);
    storage.savePlayer(player);
    storage.checkpoint();

    const itemDef = storage.getItem(itemId) || ITEMS[itemId];
    const itemName = itemDef?.name || itemId;

    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Listed ${safeQty}x ${itemName} for ${safeUnitPrice.toLocaleString()} gold each.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });

    // Broadcast updated market listings to all online players
    this.broadcast({
      type: 'MARKET_LISTINGS',
      listings: storage.getMarketListings(),
    });
  }

  private handleBuyMarketListing(session: ConnectedSession, listingId: string, requestedQty?: number) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    if (distToHearth > 3.5) {
      this.send(ws, { type: 'NOTIFICATION', message: 'You must be at the Hearth to buy items from the marketplace.' });
      return;
    }

    if (!listingId || typeof listingId !== 'string') return;

    // Execute purchase inside an atomic transaction
    let purchaseSuccess = false;
    let errMessage = '';
    let purchasedListing: MarketListing | null = null;
    let actualBoughtQty = 0;
    let totalCost = 0;

    try {
      storage.runTransaction(() => {
        const listing = storage.getMarketListing(listingId);
        if (!listing) {
          errMessage = 'Listing is no longer available.';
          return;
        }

        if (listing.sellerId === player.id) {
          errMessage = 'You cannot buy your own listing. Use Cancel Listing instead.';
          return;
        }

        let buyQty = listing.quantity;
        if (typeof requestedQty === 'number') {
          const parsed = Math.floor(requestedQty);
          if (parsed > 0 && parsed <= listing.quantity) {
            buyQty = parsed;
          }
        }

        const cost = listing.unitPrice * buyQty;
        if ((player.gold || 0) < cost) {
          errMessage = `You do not have enough gold. Required: ${cost.toLocaleString()} gold.`;
          return;
        }

        const itemDef = storage.getItem(listing.itemId) || ITEMS[listing.itemId];

        // Attempt to deliver items to buyer inventory
        const addRes = addItemToSlots(player.inventory, 28, listing.itemId, buyQty, listing.rarity, listing.plus, itemDef, 'inventory');
        if (addRes.added < buyQty) {
          // If satchel was partially filled or completely full, rollback satchel add
          if (addRes.added > 0) {
            let rollBack = addRes.added;
            for (let i = player.inventory.length - 1; i >= 0 && rollBack > 0; i--) {
              const s = player.inventory[i];
              if (s.itemId === listing.itemId && s.rarity === listing.rarity && (s.plus || 0) === (listing.plus || 0)) {
                const take = Math.min(s.quantity, rollBack);
                s.quantity -= take;
                rollBack -= take;
                if (s.quantity <= 0) {
                  player.inventory.splice(i, 1);
                }
              }
            }
          }
          errMessage = 'Not enough free satchel space to receive the items.';
          return;
        }

        // Deduct gold from buyer
        player.gold = (player.gold || 0) - cost;

        // Credit gold to seller
        let sellerSession: ConnectedSession | undefined;
        for (const s of this.sessions.values()) {
          if (s.player.id === listing.sellerId) {
            sellerSession = s;
            break;
          }
        }

        if (sellerSession) {
          sellerSession.player.gold = (sellerSession.player.gold || 0) + cost;
          storage.savePlayer(sellerSession.player);
          this.send(sellerSession.ws, {
            type: 'NOTIFICATION',
            message: `${player.username} bought ${buyQty}x ${itemDef?.name || listing.itemId} from your listing for +${cost.toLocaleString()} gold!`
          });
          this.send(sellerSession.ws, { type: 'PLAYER_UPDATE', player: sellerSession.player });
        } else {
          // Seller is offline: load player from DB, credit gold, and persist
          const offlineSeller = storage.getPlayer(listing.sellerId);
          if (offlineSeller) {
            offlineSeller.gold = (offlineSeller.gold || 0) + cost;
            storage.savePlayer(offlineSeller);
          }
        }

        // Update or delete listing in database
        if (buyQty >= listing.quantity) {
          storage.removeMarketListing(listing.id);
        } else {
          // Partial buy: reduce listing quantity and update total price
          storage.removeMarketListing(listing.id);
          const updatedListing: MarketListing = {
            ...listing,
            quantity: listing.quantity - buyQty,
            totalPrice: listing.unitPrice * (listing.quantity - buyQty),
          };
          storage.createMarketListing(updatedListing);
        }

        storage.savePlayer(player);
        purchasedListing = listing;
        actualBoughtQty = buyQty;
        totalCost = cost;
        purchaseSuccess = true;
      });
    } catch (err) {
      console.error('Marketplace buy transaction error:', err);
      errMessage = 'Transaction failed. Please try again.';
      purchaseSuccess = false;
    }

    if (!purchaseSuccess) {
      if (errMessage) {
        this.send(ws, { type: 'NOTIFICATION', message: errMessage });
      }
      return;
    }

    storage.checkpoint();
    const itemDef = storage.getItem(purchasedListing!.itemId) || ITEMS[purchasedListing!.itemId];
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Purchased ${actualBoughtQty}x ${itemDef?.name || purchasedListing!.itemId} for ${totalCost.toLocaleString()} gold.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });

    this.broadcast({
      type: 'MARKET_LISTINGS',
      listings: storage.getMarketListings(),
    });
  }

  private handleCancelMarketListing(session: ConnectedSession, listingId: string) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    if (distToHearth > 3.5) {
      this.send(ws, { type: 'NOTIFICATION', message: 'You must be at the Hearth to cancel marketplace listings.' });
      return;
    }

    if (!listingId || typeof listingId !== 'string') return;

    let cancelSuccess = false;
    let errMessage = '';
    let cancelledItemName = '';

    try {
      storage.runTransaction(() => {
        const listing = storage.getMarketListing(listingId);
        if (!listing) {
          errMessage = 'Listing no longer exists.';
          return;
        }

        if (listing.sellerId !== player.id) {
          errMessage = 'You can only cancel your own listings.';
          return;
        }

        const itemDef = storage.getItem(listing.itemId) || ITEMS[listing.itemId];
        cancelledItemName = itemDef?.name || listing.itemId;

        // Try to return items to satchel first
        const invRes = addItemToSlots(player.inventory, 28, listing.itemId, listing.quantity, listing.rarity, listing.plus, itemDef, 'inventory');
        if (invRes.remainder > 0) {
          // If satchel cannot fit all, try to place remainder in vault/bank
          const maxStorage = player.storageSlotsMax || 75;
          const bankRes = addItemToSlots(player.storage, maxStorage, listing.itemId, invRes.remainder, listing.rarity, listing.plus, itemDef, 'bank');
          if (bankRes.remainder > 0) {
            // Roll back inventory addition if storage is also full
            if (invRes.added > 0) {
              let rollBack = invRes.added;
              for (let i = player.inventory.length - 1; i >= 0 && rollBack > 0; i--) {
                const s = player.inventory[i];
                if (s.itemId === listing.itemId && s.rarity === listing.rarity && (s.plus || 0) === (listing.plus || 0)) {
                  const take = Math.min(s.quantity, rollBack);
                  s.quantity -= take;
                  rollBack -= take;
                  if (s.quantity <= 0) {
                    player.inventory.splice(i, 1);
                  }
                }
              }
            }
            if (bankRes.added > 0) {
              let rollBack = bankRes.added;
              for (let i = player.storage.length - 1; i >= 0 && rollBack > 0; i--) {
                const s = player.storage[i];
                if (s.itemId === listing.itemId && s.rarity === listing.rarity && (s.plus || 0) === (listing.plus || 0)) {
                  const take = Math.min(s.quantity, rollBack);
                  s.quantity -= take;
                  rollBack -= take;
                  if (s.quantity <= 0) {
                    player.storage.splice(i, 1);
                  }
                }
              }
            }
            errMessage = 'Both your satchel and storage vault are full. Make room to cancel this listing.';
            return;
          }
        }

        storage.removeMarketListing(listing.id);
        storage.savePlayer(player);
        cancelSuccess = true;
      });
    } catch (err) {
      console.error('Marketplace cancel transaction error:', err);
      errMessage = 'Failed to cancel listing. Please try again.';
      cancelSuccess = false;
    }

    if (!cancelSuccess) {
      if (errMessage) {
        this.send(ws, { type: 'NOTIFICATION', message: errMessage });
      }
      return;
    }

    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Cancelled listing and returned ${cancelledItemName} to your possession.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });

    this.broadcast({
      type: 'MARKET_LISTINGS',
      listings: storage.getMarketListings(),
    });
  }

  private tick() {
    this.tickCount++;

    // 0. Process Monster Respawns in Active Zones
    let monstersChanged = false;
    const occupied = new Set<string>();
    for (const inst of this.liveMonsters.values()) {
      if (inst.currentHp > 0 && !inst.respawnAtTick) {
        occupied.add(`${inst.x},${inst.y}`);
      }
    }

    const zones = storage.getMonsterZones();
    const zoneMap = new Map(zones.map(z => [z.id, z]));

    for (const inst of this.liveMonsters.values()) {
      if (inst.respawnAtTick && this.tickCount >= inst.respawnAtTick) {
        const zone = zoneMap.get(inst.zoneId);
        if (zone) {
          const tile = this.findWalkableTileInZone(zone, occupied);
          occupied.add(`${tile.x},${tile.y}`);
          inst.x = tile.x;
          inst.y = tile.y;
          inst.currentHp = inst.maxHp;
          inst.respawnAtTick = undefined;
          inst.nextMoveTick = this.tickCount + Math.floor(Math.random() * 8) + 4;
          monstersChanged = true;
        }
      }
    }

    // 0.5 Process Random Monster Movement Within Spawn Zones
    const engagedMonsterIds = new Set<string>();
    for (const session of this.sessions.values()) {
      if (session.activeCombat?.nodeId) {
        engagedMonsterIds.add(session.activeCombat.nodeId);
      }
      if (session.pendingCombat?.nodeId) {
        engagedMonsterIds.add(session.pendingCombat.nodeId);
      }
    }

    const collisions = storage.getCollisions();
    const staticNodes = storage.getWorldNodes();
    for (const sn of staticNodes) {
      if (sn.type !== 'monster') {
        occupied.add(`${sn.x},${sn.y}`);
      }
    }

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (const inst of this.liveMonsters.values()) {
      if (inst.currentHp <= 0 || inst.respawnAtTick) continue;
      if (engagedMonsterIds.has(inst.id)) continue;

      if (!inst.nextMoveTick) {
        inst.nextMoveTick = this.tickCount + Math.floor(Math.random() * 8) + 4;
        continue;
      }

      if (this.tickCount >= inst.nextMoveTick) {
        // Schedule next wandering check in 3 - 7 seconds (5 - 11 ticks)
        inst.nextMoveTick = this.tickCount + Math.floor(Math.random() * 7) + 5;

        // 60% chance to wander 1 step, 40% chance to pause/idle
        if (Math.random() < 0.6) {
          const zone = zoneMap.get(inst.zoneId);
          if (!zone) continue;

          // Shuffle directions randomly
          const shuffled = [...directions].sort(() => Math.random() - 0.5);
          for (const dir of shuffled) {
            const nx = inst.x + dir.dx;
            const ny = inst.y + dir.dy;

            // Must stay strictly within zone bounds
            if (nx < zone.x || nx >= zone.x + zone.width || ny < zone.y || ny >= zone.y + zone.height) {
              continue;
            }

            const key = `${nx},${ny}`;
            if (collisions.has(key) || occupied.has(key)) {
              continue;
            }

            // Valid step within zone!
            occupied.delete(`${inst.x},${inst.y}`);
            inst.x = nx;
            inst.y = ny;
            occupied.add(key);
            monstersChanged = true;
            break;
          }
        }
      }
    }

    if (monstersChanged) {
      this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });
    }

    // Auto-engage alive monsters for idle combat sessions in cleared zones
    for (const session of this.sessions.values()) {
      const { player } = session;
      if (player.currentTask && (player.currentTask.skill === 'melee' || player.currentTask.skill === 'ranged' || player.currentTask.skill === 'magic' || (player.currentTask.skill as string) === 'combat')) {
        if (!session.activeCombat && !session.pendingCombat && !player.isMoving && player.bankingState === 'idle') {
          const targetMob = this.findNearestAliveMonsterInZone(player.x, player.y, undefined, player.currentTask.recipeId);
          if (targetMob && Math.hypot(player.x - targetMob.x, player.y - targetMob.y) <= 12) {
            this.handleStartCombat(session, {
              monsterId: targetMob.monsterId,
              targetX: targetMob.x,
              targetY: targetMob.y,
              nodeId: targetMob.id,
            });
          }
        }
      }
    }

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
            if (session.pendingDeposit) {
              const pending = session.pendingDeposit;
              session.pendingDeposit = null;
              player.bankingState = 'idle';
              const invIdx = player.inventory.findIndex(
                s => s.itemId === pending.itemId && (pending.rarity === undefined || s.rarity === pending.rarity)
              );
              if (invIdx >= 0) {
                this.handleDepositItem(session, invIdx, pending.quantity);
              } else {
                this.send(ws, { type: 'PLAYER_UPDATE', player });
              }
            } else {
              this.handleAutoDepositAtHearth(session);
            }
          } else if (player.bankingState === 'returning_to_work') {
            player.bankingState = 'idle';
            if (player.bankReturnTask) {
              player.currentTask = player.bankReturnTask;
              player.bankReturnTask = null;
              session.ticksInTask = 0;
              if (MONSTERS[player.currentTask.recipeId]) {
                const mobId = player.currentTask.recipeId;
                this.startCombatSession(session, mobId, player.currentTask.targetNodeX || player.x, player.currentTask.targetNodeY || player.y, player.currentTask.targetNodeId);
              } else {
                this.send(ws, {
                  type: 'NOTIFICATION',
                  message: `Returned to work on ${RECIPES[player.currentTask.recipeId]?.name || player.currentTask.skill}.`
                });
              }
            } else if (session.pendingTask) {
              const rec = RECIPES[session.pendingTask.recipeId];
              if (rec) {
                const targetQty = (typeof session.pendingTask.quantity === 'number' && session.pendingTask.quantity > 0) ? session.pendingTask.quantity : Infinity;
                player.currentTask = {
                  recipeId: session.pendingTask.recipeId,
                  skill: rec.skill,
                  startedAtTick: this.tickCount,
                  targetQuantity: targetQty,
                  completedQuantity: 0,
                  targetNodeX: session.pendingTask.nodeX ?? session.pendingTask.targetX,
                  targetNodeY: session.pendingTask.nodeY ?? session.pendingTask.targetY,
                  standX: player.x,
                  standY: player.y,
                };
                session.ticksInTask = 0;
                this.send(ws, {
                  type: 'NOTIFICATION',
                  message: `Arrived at ${rec.name}. Began work.`
                });
              }
              session.pendingTask = null;
              player.pendingTask = null;
              storage.savePlayer(player);
            }
          } else if (session.pendingCombat) {
            // Arrived adjacent to target monster!
            const pending = session.pendingCombat;
            session.pendingCombat = null;
            this.startCombatSession(session, pending.monsterId, pending.targetX, pending.targetY, pending.nodeId, pending.zoneId);
          } else if (session.pendingTask) {
            // Arrived at target work node
            const rec = RECIPES[session.pendingTask.recipeId];
            if (rec) {
              const targetQty = (typeof session.pendingTask.quantity === 'number' && session.pendingTask.quantity > 0) ? session.pendingTask.quantity : Infinity;
              player.currentTask = {
                recipeId: session.pendingTask.recipeId,
                skill: rec.skill,
                startedAtTick: this.tickCount,
                targetQuantity: targetQty,
                completedQuantity: 0,
                targetNodeX: session.pendingTask.nodeX ?? session.pendingTask.targetX,
                targetNodeY: session.pendingTask.nodeY ?? session.pendingTask.targetY,
                standX: player.x,
                standY: player.y,
              };
              session.ticksInTask = 0;
              this.send(ws, {
                type: 'NOTIFICATION',
                message: `Arrived at ${rec.name}. Began work.`
              });
            }
            session.pendingTask = null;
            player.pendingTask = null;
            storage.savePlayer(player);
          }
        }

        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
      }

      // 2. Process Active Work Task OR Combat
      if (player.currentTask && !player.isMoving) {
        if (session.activeCombat) {
          this.processCombatCycle(session);
        } else {
          session.ticksInTask++;
          const recipe = RECIPES[player.currentTask.recipeId];

        if (recipe) {
          const level = player.skills[recipe.skill]?.level || 1;
          const speedMult = getJobSpeedMultiplier(level, recipe.levelReq);

          let toolBonus = 0;
          if (recipe.skill === 'mining') {
            const toolItem = player.equipment?.tool_pickaxe || player.equipment?.tool;
            if (toolItem && ITEMS[toolItem.itemId]?.baseStats?.toolSpeedBonus) {
              toolBonus = ITEMS[toolItem.itemId].baseStats!.toolSpeedBonus!;
            }
          } else if (recipe.skill === 'woodcutting') {
            const toolItem = player.equipment?.tool_axe || player.equipment?.tool;
            if (toolItem && ITEMS[toolItem.itemId]?.baseStats?.toolSpeedBonus) {
              toolBonus = ITEMS[toolItem.itemId].baseStats!.toolSpeedBonus!;
            }
          } else if (recipe.skill === 'fishing') {
            const toolItem = player.equipment?.tool_rod || player.equipment?.tool;
            if (toolItem && ITEMS[toolItem.itemId]?.baseStats?.toolSpeedBonus) {
              toolBonus = ITEMS[toolItem.itemId].baseStats!.toolSpeedBonus!;
            }
          }

          const effectiveInterval = Math.max(0.6, recipe.intervalSeconds / (speedMult * (1 + toolBonus)));
          const requiredTicks = Math.max(1, Math.round(effectiveInterval / (TICK_MS / 1000)));


          if (session.ticksInTask >= requiredTicks) {
            session.ticksInTask = 0;
            this.executeTaskCycle(session, recipe);
          }
        }
        }
      }

      // 3. Natural Out-of-Combat Health Regeneration
      const maxHp = Math.max(10, player.skills.hitpoints?.level || 10);
      if (player.currentHp < maxHp && !session.activeCombat) {
        // Regenerate 1 HP every 10 ticks (6 seconds) out of combat
        // Or 2 HP every 3 ticks (1.8s) if resting near the Hearth
        const hearth = this.getHearthLocation(player.x, player.y);
        const nearHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y) <= 3.5;
        const regenInterval = nearHearth ? 3 : 10;
        const regenAmount = nearHearth ? 2 : 1;

        if (this.tickCount % regenInterval === 0) {
          player.currentHp = Math.min(maxHp, player.currentHp + regenAmount);
          this.send(ws, { type: 'PLAYER_UPDATE', player });
        }
      }

      // 4. Online Accelerated Crop Growth (2.0x online speed boost!)
      if (player.farmPlots) {
        let plotsChanged = false;
        const now = Date.now();
        const dt = TICK_MS / 1000;
        for (const plot of Object.values(player.farmPlots)) {
          if (plot.status === 'growing') {
            plot.effectiveProgressSeconds += dt * ONLINE_GROWTH_MULTIPLIER;
            plot.lastUpdated = now;
            if (plot.effectiveProgressSeconds >= plot.baseDurationSeconds) {
              plot.status = 'ready';
              plotsChanged = true;
              this.send(ws, {
                type: 'NOTIFICATION',
                message: `${plot.cropName} is fully grown and ready to harvest!`
              });
            }
          }
        }
        if (plotsChanged || (this.tickCount % 5 === 0 && Object.keys(player.farmPlots).length > 0)) {
          this.send(ws, { type: 'PLAYER_UPDATE', player });
        }
      }
    }

    // Every 5 ticks (3s) auto-save & idle session cleanup
    if (this.tickCount % 5 === 0) {
      const now = Date.now();
      const idleSessionsToDrop: string[] = [];

      for (const [playerId, session] of this.sessions.entries()) {
        session.player.lastActiveTimestamp = now;
        storage.savePlayer(session.player);

        // Disconnect sessions that have been completely inactive for > 16 minutes
        if (session.lastActivityTimestamp && now - session.lastActivityTimestamp > 16 * 60 * 1000) {
          idleSessionsToDrop.push(playerId);
        }
      }

      for (const playerId of idleSessionsToDrop) {
        const session = this.sessions.get(playerId);
        if (session) {
          try {
            session.ws.close(4001, 'Idle timeout (16+ minutes of inactivity)');
          } catch {}
          this.removeConnection(playerId, session.ws);
        }
      }
    }
  }

  private handleAutoDepositAtHearth(session: ConnectedSession) {
    const { player, ws } = session;
    player.bankingState = 'depositing';

    let count = 0;
    const keep: InventorySlot[] = [];

    const targetTask = session.pendingTask || player.bankReturnTask;
    const activeRecipe = targetTask?.recipeId ? RECIPES[targetTask.recipeId] : null;
    const isCombatWork = Boolean(targetTask && (MONSTERS[targetTask.recipeId] || ('skill' in targetTask && targetTask.skill && ['melee', 'ranged', 'magic'].includes(targetTask.skill))));

    let combatFoodKept = 0;
    const targetFoodStock = 15;

    for (const slot of player.inventory) {
      const def = storage.getItem(slot.itemId) || ITEMS[slot.itemId];

      // Steeds in inventory are kept (mounts are companions, not cargo)
      if (def?.category === 'steed') {
        keep.push(slot);
        continue;
      }

      // Tools in inventory (e.g. pickaxe, axe, rod) are kept UNLESS this tool is the active recipe's crafted output
      if (def?.category === 'tool') {
        if (!activeRecipe || activeRecipe.outputItemId !== slot.itemId) {
          keep.push(slot);
          continue;
        }
      }

      // Combat food: if returning to combat, keep up to targetFoodStock (15) food items in inventory
      let depositQty = slot.quantity;
      if (isCombatWork && (def?.category === 'cooked_food' || ((def?.baseStats?.healing || 0) > 0))) {
        if (combatFoodKept < targetFoodStock) {
          const toKeep = Math.min(slot.quantity, targetFoodStock - combatFoodKept);
          combatFoodKept += toKeep;
          keep.push({ ...slot, quantity: toKeep });
          depositQty = slot.quantity - toKeep;
          if (depositQty <= 0) {
            continue;
          }
        }
      }

      // Move into Hearth storage respecting bank stacking rules
      const maxStorage = player.storageSlotsMax || 75;
      const res = addItemToSlots(player.storage, maxStorage, slot.itemId, depositQty, slot.rarity, slot.plus, def, 'bank');
      count += res.added;
      if (res.remainder > 0) {
        if (!player.overflowTray) player.overflowTray = [];
        // Move to overflow tray (up to 10 types)
        const traySlot = player.overflowTray.find(s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus);
        if (traySlot && isItemStackable(def, 'bank')) {
          traySlot.quantity += res.remainder;
          count += res.remainder;
        } else if (player.overflowTray.length < 10) {
          player.overflowTray.push({ itemId: slot.itemId, quantity: res.remainder, rarity: slot.rarity, plus: slot.plus });
          count += res.remainder;
        } else {
          keep.push({ itemId: slot.itemId, quantity: res.remainder, rarity: slot.rarity, plus: slot.plus });
        }
      }
    }

    // Attempt to clear overflow tray into bank storage if bank space was freed
    if (player.overflowTray && player.overflowTray.length > 0) {
      const maxStorage = player.storageSlotsMax || 75;
      const remainingTray: InventorySlot[] = [];
      for (const tSlot of player.overflowTray) {
        const tDef = storage.getItem(tSlot.itemId) || ITEMS[tSlot.itemId];
        const res = addItemToSlots(player.storage, maxStorage, tSlot.itemId, tSlot.quantity, tSlot.rarity, tSlot.plus, tDef, 'bank');
        if (res.remainder > 0) {
          remainingTray.push({ ...tSlot, quantity: res.remainder });
        }
      }
      player.overflowTray = remainingTray;
    }

    player.inventory = keep;

    // Resting at Hearth restores health
    const maxHp = player.skills.hitpoints?.level || 10;
    player.currentHp = maxHp;

    // Check if target task (pendingTask or bankReturnTask) has inputs: withdraw from storage before heading to work!
    if (targetTask) {
      const rec = RECIPES[targetTask.recipeId];
      if (rec && rec.inputs && rec.inputs.length > 0) {
        let canWithdraw = true;
        for (const inp of rec.inputs) {
          const sSlot = player.storage.find(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
          if (!sSlot) {
            canWithdraw = false;
            break;
          }
        }

        if (canWithdraw) {
          // Withdraw up to available bag space (batch size)
          const emptySlots = Math.max(1, 28 - player.inventory.length);
          const batches = Math.min(20, Math.floor(emptySlots / rec.inputs.length));
          for (const inp of rec.inputs) {
            const sSlot = player.storage.find(s => s.itemId === inp.itemId)!;
            const toTake = Math.min(sSlot.quantity, inp.quantity * Math.max(1, batches));
            const inpDef = storage.getItem(inp.itemId) || ITEMS[inp.itemId];
            const res = addItemToSlots(player.inventory, 28, inp.itemId, toTake, 'plain', 0, inpDef, 'inventory');
            if (res.added > 0) {
              sSlot.quantity -= res.added;
            }
          }
          player.storage = player.storage.filter(s => s.quantity > 0);
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Withdrew materials from Hearth for ${rec.name}. Riding to work...`
          });
        } else {
          // Cannot withdraw from storage. Check if satchel still has enough inputs.
          const hasInputsInInv = rec.inputs.every(inp => player.inventory.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity));
          if (!hasInputsInInv) {
            // Out of materials in both inventory and storage! Stop here at the Hearth, do not return to work!
            player.bankReturnTask = null;
            session.pendingTask = null;
            player.bankingState = 'idle';
            this.send(ws, {
              type: 'NOTIFICATION',
              message: count > 0
                ? `Dropped off ${count} items in the bank. You ran out of materials for ${rec.name}!`
                : `You ran out of materials in your bank for ${rec.name}!`
            });
            storage.savePlayer(player);
            storage.checkpoint();
            this.send(ws, { type: 'PLAYER_UPDATE', player });
            this.broadcastWorldState();
            return;
          }
        }
      }

      // Check if output can fit in satchel (e.g. if Hearth storage was full and items couldn't be deposited)
      if (rec && rec.outputItemId !== 'gold' && !player.dropWhenFull) {
        const outDef = storage.getItem(rec.outputItemId) || ITEMS[rec.outputItemId];
        const simulatedInv = player.inventory.map(s => ({ ...s }));
        if (rec.inputs?.length > 0) {
          for (const inp of rec.inputs) {
            const slot = simulatedInv.find(s => s.itemId === inp.itemId);
            if (slot) slot.quantity -= inp.quantity;
          }
        }
        const cleanedInv = simulatedInv.filter(s => s.quantity > 0);
        const testRes = addItemToSlots(cleanedInv, 28, rec.outputItemId, rec.outputQuantity, 'plain', 0, outDef, 'inventory');
        if (testRes.remainder > 0) {
          // Satchel cannot hold output even after banking (e.g. Hearth storage is full)!
          player.bankReturnTask = null;
          session.pendingTask = null;
          player.bankingState = 'idle';
          this.send(ws, {
            type: 'NOTIFICATION',
            message: count > 0
              ? `Dropped off ${count} items, but your bag is still full!`
              : `Your bank is completely full! Can't deposit any more items right now.`
          });
          storage.savePlayer(player);
          storage.checkpoint();
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        }
      }

      // Restock combat provisions from bank AT the Hearth before heading back to the fight
      if (isCombatWork) {
        let carriedFoodCount = 0;
        for (const slot of player.inventory) {
          const d = ITEMS[slot.itemId];
          if (d && (d.category === 'cooked_food' || ((d.baseStats?.healing || 0) > 0))) {
            carriedFoodCount += slot.quantity;
          }
        }
        const targetStock = 15;
        if (carriedFoodCount < targetStock) {
          const targetFoodId = player.selectedFoodItemId;
          let storageIdx = -1;
          if (targetFoodId) {
            storageIdx = player.storage.findIndex(s => s.itemId === targetFoodId && s.quantity > 0);
          }
          if (storageIdx === -1) {
            storageIdx = player.storage.findIndex(s => {
              const d = ITEMS[s.itemId];
              return s.quantity > 0 && d && (d.category === 'cooked_food' || ((d.baseStats?.healing || 0) > 0));
            });
          }
          if (storageIdx >= 0) {
            const sSlot = player.storage[storageIdx];
            const foodDef = ITEMS[sSlot.itemId];
            const needed = targetStock - carriedFoodCount;
            const toTake = Math.min(needed, sSlot.quantity);
            const res = addItemToSlots(player.inventory, 28, sSlot.itemId, toTake, sSlot.rarity, sSlot.plus, foodDef, 'inventory');
            if (res.added > 0) {
              sSlot.quantity -= res.added;
              if (sSlot.quantity <= 0) {
                player.storage.splice(storageIdx, 1);
              }
              this.send(ws, {
                type: 'NOTIFICATION',
                message: `Provisioned ${res.added}x ${foodDef?.name || 'Food'} from Hearth bank for combat.`,
              });
            }
          }
        }
      }
    }

    // Walk back to previous task node or pending target node!
    let destX: number | undefined;
    let destY: number | undefined;

    if (player.bankReturnTask) {
      const nodeX = player.bankReturnTask.targetNodeX;
      const nodeY = player.bankReturnTask.targetNodeY;
      const isStandOnNode = typeof nodeX === 'number' && typeof nodeY === 'number' && player.bankReturnTask.standX === nodeX && player.bankReturnTask.standY === nodeY;
      if (!isStandOnNode && typeof player.bankReturnTask.standX === 'number' && typeof player.bankReturnTask.standY === 'number' && !storage.isCollidable(player.bankReturnTask.standX, player.bankReturnTask.standY)) {
        destX = player.bankReturnTask.standX;
        destY = player.bankReturnTask.standY;
      } else if (typeof nodeX === 'number' && typeof nodeY === 'number') {
        const adj = this.getAdjacentWalkableTile(player.x, player.y, nodeX, nodeY);
        destX = adj.x;
        destY = adj.y;
      } else if (player.bankReturnTask.recipeId) {
        const matching = storage.getWorldNodes().find(n => n.recipeId === player.bankReturnTask!.recipeId);
        if (matching) {
          const adj = this.getAdjacentWalkableTile(player.x, player.y, matching.x, matching.y);
          destX = adj.x;
          destY = adj.y;
        }
      }
    } else if (session.pendingTask) {
      const nodeX = session.pendingTask.nodeX ?? session.pendingTask.targetX;
      const nodeY = session.pendingTask.nodeY ?? session.pendingTask.targetY;
      const adj = this.getAdjacentWalkableTile(player.x, player.y, nodeX, nodeY);
      destX = adj.x;
      destY = adj.y;
    }

    if (typeof destX === 'number' && typeof destY === 'number') {
      player.bankingState = 'returning_to_work';
      const path = this.findPathWithCollisions(player.x, player.y, destX, destY);
      player.path = path;
      player.targetX = destX;
      player.targetY = destY;
      player.isMoving = path.length > 0;
      this.send(ws, {
        type: 'NOTIFICATION',
        message: count > 0 
          ? `Dropped off ${count} items in the bank! Heading back to work...`
          : `Heading back to work...`
      });
    } else {
      player.bankingState = 'idle';
      this.send(ws, {
        type: 'NOTIFICATION',
        message: count > 0
          ? `Deposited ${count} items into your bank.`
          : `Nothing in your bag to deposit.`
      });
    }

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
  }

  private executeTaskCycle(session: ConnectedSession, recipe: RecipeDefinition) {
    if (recipe.skill === 'farming') {
      this.executeFarmingTaskCycle(session, recipe);
      return;
    }

    const { player, ws } = session;
    const task = player.currentTask!;

    // Pre-check if crafted output can fit in satchel before consuming materials
    if (recipe.outputItemId !== 'gold' && !player.dropWhenFull) {
      const outDef = storage.getItem(recipe.outputItemId) || ITEMS[recipe.outputItemId];
      const simulatedInv = player.inventory.map(s => ({ ...s }));
      if (recipe.inputs?.length > 0) {
        for (const inp of recipe.inputs) {
          const slot = simulatedInv.find(s => s.itemId === inp.itemId);
          if (slot) slot.quantity -= inp.quantity;
        }
      }
      const cleanedInv = simulatedInv.filter(s => s.quantity > 0);
      const testRes = addItemToSlots(cleanedInv, 28, recipe.outputItemId, recipe.outputQuantity, 'plain', 0, outDef, 'inventory');
      if (testRes.remainder > 0) {
        // Output cannot fit! Head to bank before consuming materials!
        player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
        player.currentTask = null;
        player.bankingState = 'walking_to_bank';
        const hearth = this.getHearthLocation(player.x, player.y);
        const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = path;
        player.isMoving = path.length > 0;
        this.send(ws, {
          type: 'NOTIFICATION',
          message: 'Your bag is full! Heading to the bank...'
        });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      }
    }

    // Deduct inputs
    if (recipe.inputs?.length > 0) {
      let inputsAvailable = true;
      for (const inp of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
        if (!slot) {
          inputsAvailable = false;
          break;
        }
      }

      if (!inputsAvailable) {
        // Check if more materials exist in Hearth storage!
        const hasInStorage = recipe.inputs.every(inp => {
          return player.storage.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
        });

        if (hasInStorage) {
          // Autonomous run to Hearth to bank products & fetch materials!
          player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
          player.currentTask = null;
          player.bankingState = 'walking_to_bank';
          const hearth = this.getHearthLocation(player.x, player.y);
          const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
          player.targetX = hearth.x;
          player.targetY = hearth.y;
          player.path = path;
          player.isMoving = path.length > 0;
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Bag materials depleted. Riding to Hearth to bank and restock... (${path.length} tiles)`
          });
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        }

        // Materials depleted in storage too - advance to next queued task
        player.currentTask = null;
        this.send(ws, { type: 'NOTIFICATION', message: `Materials depleted for ${recipe.name} (${task.completedQuantity || 0} completed).` });
        storage.savePlayer(player);
        this.startNextQueuedTask(session);
        return;
      }

      for (const inp of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === inp.itemId)!;
        slot.quantity -= inp.quantity;
      }
      player.inventory = player.inventory.filter(s => s.quantity > 0);
    }

    // Add output item
    if (recipe.outputItemId === 'gold') {
      const coinAmt = recipe.outputQuantity || 1;
      player.gold = (player.gold || 0) + coinAmt;
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Pilfered +${coinAmt} Gold into your coin pouch!`
      });
    } else {
      const rarity = rollRarity(1.0);
      const outDef = storage.getItem(recipe.outputItemId) || ITEMS[recipe.outputItemId];
      const addRes = addItemToSlots(player.inventory, 28, recipe.outputItemId, recipe.outputQuantity, rarity, 0, outDef, 'inventory');

      if (addRes.remainder > 0) {
        // Inventory is full! Check auto-banking vs drop
        if (player.dropWhenFull) {
          this.send(ws, { type: 'NOTIFICATION', message: `Your bag is full! Discarded ${outDef?.name || 'item'}.` });
        } else {
          // Trigger Autonomous Banking Run to the Hearth!
          player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
          player.currentTask = null;
          player.bankingState = 'walking_to_bank';

          const hearth = this.getHearthLocation(player.x, player.y);
          const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
          player.targetX = hearth.x;
          player.targetY = hearth.y;
          player.path = path;
          player.isMoving = path.length > 0;

          this.send(ws, {
            type: 'NOTIFICATION',
            message: 'Your bag is full! Heading to the bank...'
          });
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        }
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
        storage.savePlayer(player);
      }
    }

    // Check rare finds (bonus seed returns, celestial gems, etc.)
    if (recipe.rareFinds) {
      for (const rf of recipe.rareFinds) {
        if (Math.random() < rf.chance) {
          if (rf.itemId === 'gold') {
            player.gold = (player.gold || 0) + 1;
            this.send(ws, {
              type: 'NOTIFICATION',
              message: `Rare swipe! Snatched +1 Gold into your coin pouch!`
            });
          } else {
            const rfItem = storage.getItem(rf.itemId) || ITEMS[rf.itemId];
            addItemToSlots(player.inventory, 28, rf.itemId, 1, 'plain', 0, rfItem, 'inventory');
            const isThief = recipe.skill === 'thieving';
            this.send(ws, {
              type: 'NOTIFICATION',
              message: isThief
                ? `Rare swipe! Pocketed bonus ${rfItem?.name || rf.itemId}!`
                : `Bonus yield! Discovered ${rfItem?.name || rf.itemId}!`
            });
          }
        }
      }
    }

    // Ensure any stray gold item in inventory is swept into coin pouch
    if (player.inventory && player.inventory.some(s => s.itemId === 'gold')) {
      let swept = 0;
      player.inventory = player.inventory.filter(s => {
        if (s.itemId === 'gold') {
          swept += s.quantity || 1;
          return false;
        }
        return true;
      });
      if (swept > 0) {
        player.gold = (player.gold || 0) + swept;
      }
    }

    task.completedQuantity = (task.completedQuantity || 0) + 1;
    const hasQuota = typeof task.targetQuantity === 'number' && task.targetQuantity > 0 && task.targetQuantity !== Infinity;
    if (hasQuota && task.completedQuantity >= task.targetQuantity) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Finished task: Completed ${task.completedQuantity}x ${recipe.name}.`
      });
      storage.savePlayer(player);
      this.startNextQueuedTask(session);
      return;
    }

    storage.savePlayer(player);
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private executeFarmingTaskCycle(session: ConnectedSession, recipe: RecipeDefinition) {
    const { player, ws } = session;
    const task = player.currentTask;
    if (!task) return;

    player.farmPlots = player.farmPlots || {};

    // 1. Identify all farm plots in the cluster around targetNode (or player position)
    const targetX = task.targetNodeX ?? player.x;
    const targetY = task.targetNodeY ?? player.y;
    const allPlots = storage.getWorldNodes().filter(n => n.type === 'farm');

    if (allPlots.length === 0) {
      player.currentTask = null;
      this.send(ws, { type: 'NOTIFICATION', message: 'No farm plot exists in the world.' });
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      return;
    }

    // Plots belonging to this allotment cluster (within 6.0 tiles of initial plot or player)
    let clusterPlots = allPlots.filter(n => Math.hypot(n.x - targetX, n.y - targetY) <= 6.0 || Math.hypot(n.x - player.x, n.y - player.y) <= 6.0);
    if (clusterPlots.length === 0) {
      allPlots.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
      clusterPlots = [allPlots[0]];
    }

    // Stable sort by distance to target node
    clusterPlots.sort((a, b) => {
      const distA = Math.hypot(a.x - targetX, a.y - targetY);
      const distB = Math.hypot(b.x - targetX, b.y - targetY);
      if (Math.abs(distA - distB) > 0.01) return distA - distB;
      return a.id.localeCompare(b.id);
    });

    const seedId = recipe.inputs[0]?.itemId || 'earthtuber_seed';
    const cropDef = FARMING_CROPS[seedId];

    // 1. HARVEST: Process exactly ONE ready plot per cycle! (XP granted on harvest only)
    const readyPlotNode = clusterPlots.find(p => player.farmPlots![p.id]?.status === 'ready');
    if (readyPlotNode) {
      const plot = player.farmPlots[readyPlotNode.id];

      // Pre-check if bag is completely full before harvesting
      if (player.inventory.length >= 28 && !player.dropWhenFull) {
        player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
        player.currentTask = null;
        player.bankingState = 'walking_to_bank';
        const hearth = this.getHearthLocation(player.x, player.y);
        const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = path;
        player.isMoving = path.length > 0;
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Satchel full before harvest! Riding to the Hearth to bank crops... (${path.length} tiles)`
        });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      }

      const minYield = plot.minYield || cropDef?.minYield || 3;
      const maxYield = plot.maxYield || cropDef?.maxYield || 5;
      const yieldQty = Math.floor(Math.random() * (maxYield - minYield + 1)) + minYield;
      const seedReturn = Math.random() < (cropDef?.seedReturnChance || 0.4);

      const produceItemId = plot.cropId || recipe.outputItemId;
      const produceDef = storage.getItem(produceItemId) || ITEMS[produceItemId];
      const rarity = rollRarity(1.0);

      // Delete plot immediately so it can never be duplicate-harvested
      delete player.farmPlots[readyPlotNode.id];

      const addRes = addItemToSlots(player.inventory, 28, produceItemId, yieldQty, rarity, 0, produceDef, 'inventory');
      if (addRes.remainder > 0) {
        if (player.dropWhenFull) {
          this.send(ws, { type: 'NOTIFICATION', message: `Satchel full! Discarded excess harvest.` });
        } else {
          if (!player.overflowTray) player.overflowTray = [];
          player.overflowTray.push({ itemId: produceItemId, quantity: addRes.remainder, rarity, plus: 0 });
        }
      }

      if (seedReturn) {
        const seedItemDef = storage.getItem(plot.seedId) || ITEMS[plot.seedId];
        addItemToSlots(player.inventory, 28, plot.seedId, 1, 'plain', 0, seedItemDef, 'inventory');
      }

      if (recipe.rareFinds) {
        for (const rf of recipe.rareFinds) {
          if (Math.random() < rf.chance) {
            const rfItem = storage.getItem(rf.itemId) || ITEMS[rf.itemId];
            addItemToSlots(player.inventory, 28, rf.itemId, 1, 'plain', 0, rfItem, 'inventory');
            this.send(ws, {
              type: 'NOTIFICATION',
              message: `Bonus yield! Discovered ${rfItem?.name || rf.itemId}!`
            });
          }
        }
      }

      // Award Farming and Herbalism XP on harvest!
      const xpEarned = plot.xp || cropDef?.xp || recipe.xp || 45;
      const isHerb = ['silverleaf', 'glowshroom', 'nightshade_bell', 'bramble_mandrake', 'wyrmfrond', 'sunfire_pepper'].includes(plot.cropId || '') || recipe.skill === 'herbalism';

      const farmingSkill = player.skills.farming || { xp: 0, level: 1 };
      const oldFarmLevel = farmingSkill.level;
      farmingSkill.xp += xpEarned;
      farmingSkill.level = getLevelFromXp(farmingSkill.xp);
      player.skills.farming = farmingSkill;

      if (farmingSkill.level > oldFarmLevel) {
        this.send(ws, {
          type: 'LEVEL_UP',
          skill: 'farming',
          newLevel: farmingSkill.level,
        });
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Congratulations! Your Farming skill advanced to Level ${farmingSkill.level}!`
        });
      }

      // If the harvested crop is an herb, award proportional Herbalism XP per unit harvested
      if (isHerb) {
        const herbRecipe = RECIPES[`gather_${produceItemId}`];
        const herbPerUnitXp = herbRecipe?.xp || 3;
        const herbXpGained = herbPerUnitXp * yieldQty;

        const herbalismSkill = player.skills.herbalism || { xp: 0, level: 1 };
        const oldHerbLevel = herbalismSkill.level;
        herbalismSkill.xp += herbXpGained;
        herbalismSkill.level = getLevelFromXp(herbalismSkill.xp);
        player.skills.herbalism = herbalismSkill;

        if (herbalismSkill.level > oldHerbLevel) {
          this.send(ws, {
            type: 'LEVEL_UP',
            skill: 'herbalism',
            newLevel: herbalismSkill.level,
          });
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Congratulations! Your Herbalism skill advanced to Level ${herbalismSkill.level}!`
          });
        }
      }

      const cropName = produceDef?.name || plot.cropName;
      const xpLabel = isHerb ? `(+${xpEarned} Farming & Herbalism XP)` : `(+${xpEarned} Farming XP)`;
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Harvested ${yieldQty}x ${cropName}${seedReturn ? ' + 1 bonus seed' : ''}! ${xpLabel}`
      });

      if (addRes.remainder > 0 && !player.dropWhenFull) {
        player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
        player.currentTask = null;
        player.bankingState = 'walking_to_bank';
        const hearth = this.getHearthLocation(player.x, player.y);
        const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = path;
        player.isMoving = path.length > 0;
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Satchel full during harvest! Riding to the Hearth to bank crops... (${path.length} tiles)`
        });
      }

      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.broadcastWorldState();
      return;
    }

    const hasQuota = typeof task.targetQuantity === 'number' && task.targetQuantity > 0 && task.targetQuantity !== Infinity;

    // 2. SOW: Process exactly ONE empty plot per cycle if quota remaining
    if (!hasQuota || task.completedQuantity < task.targetQuantity) {
      const emptyPlotNode = clusterPlots.find(p => !player.farmPlots![p.id]);
      if (emptyPlotNode) {
        const seedSlot = player.inventory.find(s => s.itemId === seedId && s.quantity > 0);
        if (seedSlot) {
          seedSlot.quantity--;
          player.inventory = player.inventory.filter(s => s.quantity > 0);

          const baseDur = cropDef?.baseDurationSeconds || 300;
          const xp = cropDef?.xp || recipe.xp || 45;
          const cropName = cropDef?.name || recipe.name.replace('Cultivate ', '');
          const cropId = cropDef?.cropId || recipe.outputItemId;
          const minYield = cropDef?.minYield || 3;
          const maxYield = cropDef?.maxYield || 5;

          player.farmPlots[emptyPlotNode.id] = {
            plotId: emptyPlotNode.id,
            seedId,
            cropId,
            cropName,
            plantedAt: Date.now(),
            baseDurationSeconds: baseDur,
            effectiveProgressSeconds: 0,
            lastUpdated: Date.now(),
            status: 'growing',
            minYield,
            maxYield,
            xp,
          };

          task.completedQuantity = (task.completedQuantity || 0) + 1;
          const targetStr = (!hasQuota || task.targetQuantity === Infinity) ? '' : ` (${task.completedQuantity}/${task.targetQuantity})`;
          const plotDisplayName = (emptyPlotNode.name && !emptyPlotNode.name.startsWith('node_')) ? emptyPlotNode.name : 'Verdant Plot';
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Sowed ${cropName} in ${plotDisplayName}.${targetStr}`
          });

          if (hasQuota && task.completedQuantity >= task.targetQuantity) {
            const anyGrowing = clusterPlots.some(p => player.farmPlots![p.id]?.status === 'growing' || player.farmPlots![p.id]?.status === 'ready');
            if (!anyGrowing) {
              this.send(ws, { type: 'NOTIFICATION', message: `Completed farming task for ${recipe.name}.` });
              storage.savePlayer(player);
              this.startNextQueuedTask(session);
              return;
            }
          }

          storage.savePlayer(player);
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        } else {
          // No seeds in inventory! Check if seeds exist in storage to bank & fetch
          const hasInStorage = player.storage.some(s => s.itemId === seedId && s.quantity > 0);
          if (hasInStorage) {
            player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
            player.currentTask = null;
            player.bankingState = 'walking_to_bank';
            const hearth = this.getHearthLocation(player.x, player.y);
            const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
            player.targetX = hearth.x;
            player.targetY = hearth.y;
            player.path = path;
            player.isMoving = path.length > 0;
            this.send(ws, {
              type: 'NOTIFICATION',
              message: `Seeds depleted. Riding to Hearth to bank and withdraw more seeds... (${path.length} tiles)`
            });
            this.send(ws, { type: 'PLAYER_UPDATE', player });
            this.broadcastWorldState();
            return;
          } else {
            // Out of seeds everywhere!
            const anyGrowing = clusterPlots.some(p => player.farmPlots![p.id]?.status === 'growing' || player.farmPlots![p.id]?.status === 'ready');
            if (!anyGrowing) {
              player.currentTask = null;
              this.send(ws, { type: 'NOTIFICATION', message: `Seeds depleted for ${recipe.name}.` });
              storage.savePlayer(player);
              this.startNextQueuedTask(session);
              return;
            }
          }
        }
      }
    }

    // 3. Task completion check (if quota reached and no crops left growing or ready in cluster)
    if (hasQuota && task.completedQuantity >= task.targetQuantity) {
      const anyGrowing = clusterPlots.some(p => player.farmPlots![p.id]?.status === 'growing' || player.farmPlots![p.id]?.status === 'ready');
      if (!anyGrowing) {
        this.send(ws, { type: 'NOTIFICATION', message: `Completed farming task for ${recipe.name}.` });
        storage.savePlayer(player);
        this.startNextQueuedTask(session);
        return;
      }
    }
  }

  private handleBossAttack(session: ConnectedSession) {
    if (!this.activeBoss) return;
    const { player, ws } = session;

    if (player.currentHp <= 0) return;

    // Rate limit attack frequency (minimum 1.8s between strikes)
    const now = Date.now();
    if (session.lastBossAttackTime && now - session.lastBossAttackTime < 1800) {
      return;
    }
    session.lastBossAttackTime = now;

    // Proximity check: must be near the Boss Arena
    const arenaNode = storage.getWorldNodes().find(n => n.type === 'boss_arena');
    if (arenaNode) {
      const dist = Math.hypot(player.x - arenaNode.x, player.y - arenaNode.y);
      if (dist > 18) {
        this.send(ws, { type: 'NOTIFICATION', message: 'You are too far from the Boss Arena to strike.' });
        return;
      }
    }

    const hit = Math.floor(10 + Math.random() * 25);
    this.activeBoss.currentHp = Math.max(0, this.activeBoss.currentHp - hit);
    this.activeBoss.damageDealt[player.id] = (this.activeBoss.damageDealt[player.id] || 0) + hit;

    // Grant combat style and hitpoints xp based on equipped weapon
    const combatStyle = this.getPlayerCombatStyle(player);
    const styleXp = hit * 4;
    const hpXp = Math.max(1, Math.floor(hit * 1.33));

    const oldStyleLevel = player.skills[combatStyle].level;
    player.skills[combatStyle].xp += styleXp;
    player.skills[combatStyle].level = getLevelFromXp(player.skills[combatStyle].xp);
    if (player.skills[combatStyle].level > oldStyleLevel) {
      this.send(ws, {
        type: 'LEVEL_UP',
        skill: combatStyle,
        newLevel: player.skills[combatStyle].level,
      });
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Congratulations! Your ${combatStyle.toUpperCase()} skill advanced to Level ${player.skills[combatStyle].level}!`,
      });
    }

    const oldHpLevel = player.skills.hitpoints.level;
    player.skills.hitpoints.xp = Math.max(1154, (player.skills.hitpoints.xp || 1154) + hpXp);
    player.skills.hitpoints.level = Math.max(10, getLevelFromXp(player.skills.hitpoints.xp));
    if (player.skills.hitpoints.level > oldHpLevel) {
      this.send(ws, {
        type: 'LEVEL_UP',
        skill: 'hitpoints',
        newLevel: player.skills.hitpoints.level,
      });
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Congratulations! Your Hitpoints advanced to Level ${player.skills.hitpoints.level}!`,
      });
    }

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
        // Pool of 5,000 gold + 40 anima + 5,000 boss kill XP pool
        const goldReward = Math.max(100, Math.floor(5000 * (dmg / this.activeBoss.maxHp)));
        const killXpReward = Math.max(50, Math.floor(5000 * (dmg / this.activeBoss.maxHp)));
        session.player.gold += goldReward;
        session.player.anima += 40;

        const style = this.getPlayerCombatStyle(session.player);
        const oldLvl = session.player.skills[style].level;
        session.player.skills[style].xp += killXpReward;
        session.player.skills[style].level = getLevelFromXp(session.player.skills[style].xp);
        if (session.player.skills[style].level > oldLvl) {
          this.send(session.ws, {
            type: 'LEVEL_UP',
            skill: style,
            newLevel: session.player.skills[style].level,
          });
        }

        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Raid reward: +${goldReward} Gold, +40 Anima, +${killXpReward} ${style.toUpperCase()} XP!`,
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

  private handleAdminGiveItem(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    if (player.role !== 'admin') {
      this.send(ws, { type: 'NOTIFICATION', message: 'Admin privileges required.' });
      return;
    }

    const itemId = (msg.itemId || '').trim();
    const quantity = Math.max(1, Math.min(10000, parseInt(msg.quantity, 10) || 1));
    const destination: 'inventory' | 'storage' = msg.destination === 'storage' ? 'storage' : 'inventory';

    const itemDef = storage.getItem(itemId) || ITEMS[itemId];
    if (!itemDef) {
      this.send(ws, { type: 'NOTIFICATION', message: `Unknown item ID: "${itemId}". No item given.` });
      return;
    }

    // Determine target player
    let targetSession: ConnectedSession | undefined;
    let targetPlayer: PlayerData | undefined;
    const targetName = (msg.target || '').trim();

    if (targetName) {
      // Find online session first
      for (const s of this.sessions.values()) {
        if (s.player.username?.toLowerCase() === targetName.toLowerCase()) {
          targetSession = s;
          targetPlayer = s.player;
          break;
        }
      }
      // Fallback: load from DB
      if (!targetPlayer) {
        targetPlayer = storage.getPlayerByUsername(targetName);
        if (!targetPlayer) {
          this.send(ws, { type: 'NOTIFICATION', message: `Player "${targetName}" not found.` });
          return;
        }
      }
    } else {
      targetPlayer = player;
      targetSession = session;
    }

    // Give item: stack if matching slot exists and space permits
    if (destination === 'storage') {
      const maxSlots = targetPlayer.storageSlotsMax || 75;
      targetPlayer.storage = targetPlayer.storage || [];
      const res = addItemToSlots(targetPlayer.storage, maxSlots, itemId, quantity, 'plain', 0, itemDef, 'bank');
      if (res.added <= 0) {
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `${targetPlayer.username}'s storage is full.`,
        });
        return;
      }
    } else {
      const res = addItemToSlots(targetPlayer.inventory, 28, itemId, quantity, 'plain', 0, itemDef, 'inventory');
      if (res.added <= 0) {
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `${targetPlayer.username}'s inventory is full (28 slots). Try Storage destination.`,
        });
        return;
      }
    }

    storage.savePlayer(targetPlayer);

    const itemName = ITEMS[itemId].name;
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Gave ${quantity}x ${itemName} to ${targetPlayer.username}'s ${destination}.`,
    });

    if (targetSession && targetSession !== session) {
      if (msg.silent === false) {
        this.send(targetSession.ws, {
          type: 'NOTIFICATION',
          message: `An admin gave you ${quantity}x ${itemName}.`,
        });
      }
      this.send(targetSession.ws, { type: 'PLAYER_UPDATE', player: targetPlayer });
    } else if (targetSession) {
      // Giving to self: update their own client
      this.send(ws, { type: 'PLAYER_UPDATE', player: targetPlayer });
    }
  }

  private resolveRecipeLocation(
    player: PlayerData,
    rec: RecipeDefinition,
    preferredNodeX?: number,
    preferredNodeY?: number
  ): { targetX: number; targetY: number; nodeX: number; nodeY: number } {
    let targetX = player.x;
    let targetY = player.y;
    let nodeX = preferredNodeX ?? player.x;
    let nodeY = preferredNodeY ?? player.y;

    if (rec.skill === 'cooking') {
      const fireNode = storage.getWorldNodes().find(n => n.type === 'fire');
      if (fireNode) {
        const adj = this.getAdjacentWalkableTile(player.x, player.y, fireNode.x, fireNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: fireNode.x, nodeY: fireNode.y };
      }
    } else if (rec.skill === 'smithing') {
      const forgeNode = storage.getWorldNodes().find(n => n.type === 'forge');
      if (forgeNode) {
        const adj = this.getAdjacentWalkableTile(player.x, player.y, forgeNode.x, forgeNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: forgeNode.x, nodeY: forgeNode.y };
      }
    } else if (rec.skill === 'farming') {
      const farmNodes = storage.getWorldNodes().filter(n => n.type === 'farm');
      if (farmNodes.length > 0) {
        let farmNode = (preferredNodeX !== undefined && preferredNodeY !== undefined)
          ? farmNodes.find(n => Math.hypot(n.x - preferredNodeX, n.y - preferredNodeY) < 1.0)
          : undefined;
        if (!farmNode) {
          farmNodes.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
          farmNode = farmNodes[0];
        }
        const adj = this.getAdjacentWalkableTile(player.x, player.y, farmNode.x, farmNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: farmNode.x, nodeY: farmNode.y };
      }
    } else if (rec.skill === 'crafting' || rec.skill === 'fletching') {
      const wbNodes = storage.getWorldNodes().filter(n => n.type === 'workbench');
      if (wbNodes.length > 0) {
        let wbNode = (preferredNodeX !== undefined && preferredNodeY !== undefined)
          ? wbNodes.find(n => Math.hypot(n.x - preferredNodeX, n.y - preferredNodeY) < 1.0)
          : undefined;
        if (!wbNode) {
          wbNodes.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
          wbNode = wbNodes[0];
        }
        const adj = this.getAdjacentWalkableTile(player.x, player.y, wbNode.x, wbNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: wbNode.x, nodeY: wbNode.y };
      }
    } else if (rec.skill === 'alchemy') {
      const cNodes = storage.getWorldNodes().filter(n => n.type === 'cauldron');
      if (cNodes.length > 0) {
        let cNode = (preferredNodeX !== undefined && preferredNodeY !== undefined)
          ? cNodes.find(n => Math.hypot(n.x - preferredNodeX, n.y - preferredNodeY) < 1.0)
          : undefined;
        if (!cNode) {
          cNodes.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
          cNode = cNodes[0];
        }
        const adj = this.getAdjacentWalkableTile(player.x, player.y, cNode.x, cNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: cNode.x, nodeY: cNode.y };
      }
    } else if (rec.skill === 'attunement') {
      const mNodes = storage.getWorldNodes().filter(n => n.type === 'monolith');
      if (mNodes.length > 0) {
        let mNode = (preferredNodeX !== undefined && preferredNodeY !== undefined)
          ? mNodes.find(n => Math.hypot(n.x - preferredNodeX, n.y - preferredNodeY) < 1.0)
          : undefined;
        if (!mNode) {
          mNodes.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
          mNode = mNodes[0];
        }
        const adj = this.getAdjacentWalkableTile(player.x, player.y, mNode.x, mNode.y);
        return { targetX: adj.x, targetY: adj.y, nodeX: mNode.x, nodeY: mNode.y };
      }
    } else {
      const worldNodes = this.getAllWorldNodes();
      let matchingNode = (preferredNodeX !== undefined && preferredNodeY !== undefined)
        ? worldNodes.find(n => (n.recipeId === rec.id || n.type === 'mine' || n.type === 'tree' || n.type === 'water' || n.type === 'herb') && Math.hypot(n.x - preferredNodeX, n.y - preferredNodeY) <= 3.0)
        : undefined;
      if (!matchingNode) {
        const matches = worldNodes.filter(n => n.recipeId === rec.id ||
          (rec.skill === 'mining' && n.type === 'mine') ||
          (rec.skill === 'woodcutting' && n.type === 'tree') ||
          (rec.skill === 'fishing' && n.type === 'water') ||
          (rec.skill === 'herbalism' && n.type === 'herb')
        );
        if (matches.length > 0) {
          matches.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y));
          matchingNode = matches[0];
        }
      }
      if (matchingNode) {
        nodeX = matchingNode.x;
        nodeY = matchingNode.y;
        const adj = this.getAdjacentWalkableTile(player.x, player.y, nodeX, nodeY);
        return { targetX: adj.x, targetY: adj.y, nodeX, nodeY };
      }
    }

    const adj = this.getAdjacentWalkableTile(player.x, player.y, nodeX, nodeY);
    return { targetX: adj.x, targetY: adj.y, nodeX, nodeY };
  }

  private startTaskExecution(
    session: ConnectedSession,
    rec: RecipeDefinition,
    targetX: number,
    targetY: number,
    nodeX: number,
    nodeY: number,
    targetQty: number
  ) {
    const { player } = session;

    const hasReadyPlots = rec.skill === 'farming' && player.farmPlots &&
      Object.values(player.farmPlots).some(p => p.status === 'ready');

    const hasInputsInBag = hasReadyPlots || !rec.inputs || rec.inputs.length === 0 || rec.inputs.every(inp => {
      const slot = player.inventory.find(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
      return !!slot;
    });

    if (!hasInputsInBag && rec.inputs && rec.inputs.length > 0) {
      const hasInStorage = rec.inputs.every(inp => {
        return player.storage.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
      });

      if (hasInStorage) {
        const pending = { recipeId: rec.id, targetX, targetY, quantity: targetQty, nodeX, nodeY };
        session.pendingTask = pending;
        player.pendingTask = pending;
        const hearth = this.getHearthLocation(player.x, player.y);
        const pathToHearth = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
        player.path = pathToHearth;
        player.isMoving = true;
        player.bankingState = 'walking_to_bank';
        storage.savePlayer(player);
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Drawing materials from Hearth for ${rec.name}... (${pathToHearth.length} steps)`
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      } else {
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Insufficient materials for ${rec.name} in bag or Hearth storage.`
        });
        return;
      }
    }

    const distToDest = Math.hypot(player.x - targetX, player.y - targetY);
    const distToNode = Math.hypot(player.x - nodeX, player.y - nodeY);
    const isAdjacent = distToDest <= 1.5 || distToNode <= 1.5;

    if (!isAdjacent) {
      const path = this.findPathWithCollisions(player.x, player.y, targetX, targetY);
      if (path.length > 0) {
        const pending = { recipeId: rec.id, targetX, targetY, quantity: targetQty, nodeX, nodeY };
        session.pendingTask = pending;
        player.pendingTask = pending;
        player.targetX = targetX;
        player.targetY = targetY;
        player.path = path;
        player.isMoving = true;
        storage.savePlayer(player);
        this.send(session.ws, {
          type: 'NOTIFICATION',
          message: `Traveling to ${rec.name}... (${path.length} steps)`
        });
        this.send(session.ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      }
    }

    player.currentTask = {
      recipeId: rec.id,
      skill: rec.skill,
      startedAtTick: this.tickCount,
      targetQuantity: targetQty,
      completedQuantity: 0,
      targetNodeX: nodeX,
      targetNodeY: nodeY,
      standX: targetX,
      standY: targetY,
    };
    player.pendingTask = null;
    session.ticksInTask = 0;
    session.pendingTask = null;
    player.isMoving = false;
    player.path = [];
    storage.savePlayer(player);
    storage.checkpoint();
    this.send(session.ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
  }

  private handleStartTask(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    if (!msg.recipeId || !RECIPES[msg.recipeId]) return;

    const rec = RECIPES[msg.recipeId];
    const playerSkillLevel = player.skills[rec.skill]?.level || 1;
    if (playerSkillLevel < rec.levelReq) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Locked: Requires ${rec.skill} Level ${rec.levelReq}.`
      });
      return;
    }

    const dest = this.resolveRecipeLocation(player, rec, msg.nodeX ?? msg.targetX, msg.nodeY ?? msg.targetY);
    const targetQty = (typeof msg.quantity === 'number' && msg.quantity > 0) ? msg.quantity : Infinity;
    this.startTaskExecution(session, rec, dest.targetX, dest.targetY, dest.nodeX, dest.nodeY, targetQty);
  }

  private handleEnqueueTask(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    const maxSlots = Math.min(QUEUE_SLOT_CONFIG.MAX_SLOTS, Math.max(QUEUE_SLOT_CONFIG.BASE_SLOTS, player.unlockedQueueSlots || 2));
    if (!Array.isArray(player.taskQueue)) {
      player.taskQueue = [];
    }

    if (player.taskQueue.length >= maxSlots) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Task queue full (${player.taskQueue.length}/${maxSlots}). Unlock more queue slots with Gems!`
      });
      return;
    }

    let targetLabel = msg.targetLabel || 'Task';
    let skill: any = msg.skill || 'mining';
    const targetQty = (typeof msg.quantity === 'number' && msg.quantity > 0) ? msg.quantity : Infinity;

    if (msg.monsterId) {
      const mobDef = MONSTERS[msg.monsterId];
      if (!mobDef) {
        this.send(ws, { type: 'NOTIFICATION', message: `Unknown monster: ${msg.monsterId}` });
        return;
      }
      targetLabel = mobDef.name;
      skill = 'melee';
    } else if (msg.recipeId) {
      const rec = RECIPES[msg.recipeId];
      if (!rec) {
        this.send(ws, { type: 'NOTIFICATION', message: `Unknown recipe: ${msg.recipeId}` });
        return;
      }
      targetLabel = rec.name;
      skill = rec.skill;

      const playerLevel = player.skills[rec.skill]?.level || 1;
      if (playerLevel < rec.levelReq) {
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Locked: Requires ${rec.skill} Level ${rec.levelReq}.`
        });
        return;
      }
    }

    const queuedTask: QueuedTask = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      recipeId: msg.recipeId || '',
      monsterId: msg.monsterId,
      skill,
      targetQuantity: targetQty,
      targetNodeId: msg.targetNodeId,
      targetNodeX: msg.targetNodeX ?? msg.nodeX,
      targetNodeY: msg.targetNodeY ?? msg.nodeY,
      targetLabel,
    };

    // If player has NO active task, start it immediately!
    if (!player.currentTask && !session.activeCombat && !player.isMoving && player.bankingState === 'idle') {
      player.taskQueue.push(queuedTask);
      this.startNextQueuedTask(session);
      return;
    }

    player.taskQueue.push(queuedTask);
    storage.savePlayer(player);
    this.send(ws, { type: 'PLAYER_UPDATE', player });
    const qtyStr = targetQty === Infinity ? '∞' : `${targetQty}x`;
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Queued: ${targetLabel} (${qtyStr}). [Slot ${player.taskQueue.length}/${maxSlots}]`
    });
  }

  private handleCancelQueuedTask(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    if (!Array.isArray(player.taskQueue) || player.taskQueue.length === 0) return;

    if (typeof msg.index === 'number' && msg.index >= 0 && msg.index < player.taskQueue.length) {
      const removed = player.taskQueue.splice(msg.index, 1)[0];
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Removed ${removed.targetLabel || 'task'} from queue.`
      });
    } else if (msg.id) {
      const idx = player.taskQueue.findIndex(t => t.id === msg.id);
      if (idx >= 0) {
        const removed = player.taskQueue.splice(idx, 1)[0];
        storage.savePlayer(player);
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Removed ${removed.targetLabel || 'task'} from queue.`
        });
      }
    } else if (msg.clearAll) {
      player.taskQueue = [];
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.send(ws, { type: 'NOTIFICATION', message: 'Cleared all queued tasks.' });
    }
  }

  private handleReorderQueue(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    if (!Array.isArray(player.taskQueue)) return;
    const { fromIndex, toIndex } = msg;
    if (
      typeof fromIndex === 'number' &&
      typeof toIndex === 'number' &&
      fromIndex >= 0 &&
      fromIndex < player.taskQueue.length &&
      toIndex >= 0 &&
      toIndex < player.taskQueue.length
    ) {
      const [item] = player.taskQueue.splice(fromIndex, 1);
      player.taskQueue.splice(toIndex, 0, item);
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
    }
  }

  private handleUnlockQueueSlot(session: ConnectedSession) {
    const { player, ws } = session;
    const currentUnlocked = Math.max(QUEUE_SLOT_CONFIG.BASE_SLOTS, player.unlockedQueueSlots || 2);
    if (currentUnlocked >= QUEUE_SLOT_CONFIG.MAX_SLOTS) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `You already have all ${QUEUE_SLOT_CONFIG.MAX_SLOTS} queue slots unlocked!`
      });
      return;
    }

    const nextSlot = currentUnlocked + 1;
    const cost = QUEUE_SLOT_CONFIG.COSTS[nextSlot] || 500;

    if ((player.gems || 0) < cost) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Not enough gems! Unlocking Slot ${nextSlot} requires ${cost} Gems (You have ${player.gems || 0}).`
      });
      return;
    }

    player.gems -= cost;
    player.unlockedQueueSlots = nextSlot;
    storage.savePlayer(player);
    this.send(ws, { type: 'PLAYER_UPDATE', player });
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `🎉 Unlocked Queue Slot ${nextSlot}! You can now queue up to ${nextSlot} tasks.`
    });
  }

  private handleRedeemGemPack(session: ConnectedSession, itemId: string) {
    const { player, ws } = session;
    const packDef = GEM_PACKS[itemId];
    if (!packDef) {
      this.send(ws, { type: 'NOTIFICATION', message: 'Not a recognized Gem Pack.' });
      return;
    }

    const invIdx = player.inventory.findIndex(s => s.itemId === itemId && s.quantity > 0);
    if (invIdx < 0) {
      this.send(ws, { type: 'NOTIFICATION', message: `You don't have a ${packDef.name} in your bag.` });
      return;
    }

    player.inventory[invIdx].quantity -= 1;
    if (player.inventory[invIdx].quantity <= 0) {
      player.inventory.splice(invIdx, 1);
    }

    player.gems = (player.gems || 0) + packDef.gems;
    storage.savePlayer(player);
    this.send(ws, { type: 'PLAYER_UPDATE', player });
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `💎 Opened ${packDef.name}! Received +${packDef.gems.toLocaleString()} Celestial Gems (Total: ${player.gems.toLocaleString()}).`
    });
  }

  public startNextQueuedTask(session: ConnectedSession): boolean {
    const { player, ws } = session;
    if (!Array.isArray(player.taskQueue) || player.taskQueue.length === 0) {
      player.currentTask = null;
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      return false;
    }

    const next = player.taskQueue.shift()!;
    // If it's a monster combat task:
    const isCombatTask = Boolean(next.monsterId || ((next.skill as string) === 'combat') || (next.recipeId && MONSTERS[next.recipeId]));
    if (isCombatTask) {
      const mobId = next.monsterId || next.recipeId;
      const monDef = MONSTERS[mobId];
      if (!monDef) {
        this.send(ws, { type: 'NOTIFICATION', message: `Unknown monster in queue: ${mobId}. Skipping...` });
        return this.startNextQueuedTask(session);
      }

      const allZones = storage.getMonsterZones();
      const matchingZone = allZones.find(z => z.monsterId === mobId);
      const nearestMob = this.findNearestAliveMonsterInZone(player.x, player.y, matchingZone?.id, mobId);
      const targetNodeX = nearestMob ? nearestMob.x : (matchingZone ? matchingZone.x : player.x);
      const targetNodeY = nearestMob ? nearestMob.y : (matchingZone ? matchingZone.y : player.y);

      player.currentTask = {
        recipeId: mobId,
        skill: (next.skill && ['melee', 'ranged', 'magic', 'defence', 'hitpoints'].includes(next.skill)) ? next.skill : 'melee',
        startedAtTick: this.tickCount,
        targetQuantity: (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity,
        completedQuantity: 0,
        targetNodeX,
        targetNodeY,
      };

      this.handleStartCombat(session, {
        monsterId: mobId,
        targetX: targetNodeX,
        targetY: targetNodeY,
        nodeId: nearestMob?.id,
      });

      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Queue advanced: Hunting ${monDef.name} (${next.targetQuantity === Infinity ? '∞' : next.targetQuantity}x).`
      });
      return true;
    }

    // It's a skilling / recipe task:
    const rec = RECIPES[next.recipeId];
    if (!rec) {
      this.send(ws, { type: 'NOTIFICATION', message: `Unknown recipe in queue: ${next.recipeId}. Skipping...` });
      return this.startNextQueuedTask(session);
    }

    const playerSkillLevel = player.skills[rec.skill]?.level || 1;
    if (playerSkillLevel < rec.levelReq) {
      this.send(ws, { type: 'NOTIFICATION', message: `Queue skipped ${rec.name}: Requires ${rec.skill} Level ${rec.levelReq}.` });
      return this.startNextQueuedTask(session);
    }

    // Check materials for crafting/cooking recipes:
    if (rec.inputs && rec.inputs.length > 0 && rec.skill !== 'farming') {
      const hasInputsInBag = rec.inputs.every(inp => {
        return player.inventory.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
      });
      const hasInputsInStorage = rec.inputs.every(inp => {
        return player.storage.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
      });

      if (!hasInputsInBag && !hasInputsInStorage) {
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Queue skipped ${rec.name}: No materials found in bag or Hearth storage.`
        });
        return this.startNextQueuedTask(session);
      }
    }

    const dest = this.resolveRecipeLocation(player, rec, next.targetNodeX, next.targetNodeY);
    const targetQty = (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity;

    this.startTaskExecution(session, rec, dest.targetX, dest.targetY, dest.nodeX, dest.nodeY, targetQty);
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Queue advanced: Starting ${rec.name} (${targetQty === Infinity ? '∞' : targetQty}x).`
    });
    return true;
  }

  private getPlayerCombatStyle(player: PlayerData): 'melee' | 'ranged' | 'magic' {
    const weaponSlot = player.equipment?.weapon;
    if (weaponSlot) {
      const def = ITEMS[weaponSlot.itemId];
      if (def?.equipReq?.skill === 'ranged' || def?.id.includes('bow')) {
        return 'ranged';
      }
      if (def?.equipReq?.skill === 'magic' || def?.id.includes('staff') || def?.id.includes('wand')) {
        return 'magic';
      }
    }
    return 'melee';
  }

  private getCombatMaxRange(player: PlayerData): number {
    const style = this.getPlayerCombatStyle(player);
    return (style === 'ranged' || style === 'magic') ? 4.5 : 1.5;
  }

  private handleStartCombat(session: ConnectedSession, msg: any) {
    const { player, ws } = session;
    const monsterId = (msg.monsterId || '').trim();
    const monsterDef = MONSTERS[monsterId];
    if (!monsterDef) {
      this.send(ws, { type: 'NOTIFICATION', message: `Unknown monster: ${monsterId}` });
      return;
    }

    const targetX = typeof msg.targetX === 'number' ? msg.targetX : player.x;
    const targetY = typeof msg.targetY === 'number' ? msg.targetY : player.y;

    // Resolve target live monster instance if possible
    let mobInst = msg.nodeId ? this.liveMonsters.get(msg.nodeId) : undefined;
    if (!mobInst) {
      mobInst = Array.from(this.liveMonsters.values()).find(
        m => m.currentHp > 0 && m.x === targetX && m.y === targetY
      );
    }
    const effectiveNodeId = mobInst ? mobInst.id : msg.nodeId;
    const effectiveZoneId = mobInst ? mobInst.zoneId : undefined;
    const actualTargetX = mobInst ? mobInst.x : targetX;
    const actualTargetY = mobInst ? mobInst.y : targetY;

    const dist = Math.hypot(player.x - actualTargetX, player.y - actualTargetY);

    // Cancel any pending work/banking tasks
    player.bankingState = 'idle';
    player.bankReturnTask = null;
    session.pendingTask = null;

    const maxRange = this.getCombatMaxRange(player);
    if (dist > maxRange) {
      // Find closest walkable tile within range (stop 1 tile before enemy for melee, or at range for bow/staff)
      const adj = this.getAdjacentWalkableTile(player.x, player.y, actualTargetX, actualTargetY);
      const path = this.findPathWithCollisions(player.x, player.y, adj.x, adj.y);
      player.targetX = adj.x;
      player.targetY = adj.y;
      player.path = path;
      player.isMoving = path.length > 0;
      session.pendingCombat = { monsterId, targetX: actualTargetX, targetY: actualTargetY, nodeId: effectiveNodeId, zoneId: effectiveZoneId };
      session.activeCombat = null;
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.broadcastWorldState();
    } else {
      // Already within attack range: begin combat immediately
      session.pendingCombat = null;
      this.startCombatSession(session, monsterId, actualTargetX, actualTargetY, effectiveNodeId, effectiveZoneId);
    }
  }

  private getAdjacentWalkableTile(playerX: number, playerY: number, targetX: number, targetY: number): { x: number; y: number } {
    const collisions = storage.getCollisions();
    const candidates = [
      // Cardinal directions first (closest, best looking for node interaction animations!)
      { x: targetX, y: targetY + 1, cardinal: true },
      { x: targetX, y: targetY - 1, cardinal: true },
      { x: targetX + 1, y: targetY, cardinal: true },
      { x: targetX - 1, y: targetY, cardinal: true },
      // Diagonal corners
      { x: targetX + 1, y: targetY + 1, cardinal: false },
      { x: targetX - 1, y: targetY + 1, cardinal: false },
      { x: targetX + 1, y: targetY - 1, cardinal: false },
      { x: targetX - 1, y: targetY - 1, cardinal: false },
    ].filter(pt => !collisions.has(`${pt.x},${pt.y}`));

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.x - playerX, a.y - playerY);
        const distB = Math.hypot(b.x - playerX, b.y - playerY);
        if (Math.abs(distA - distB) < 0.25) {
          if (a.cardinal && !b.cardinal) return -1;
          if (!a.cardinal && b.cardinal) return 1;
        }
        return distA - distB;
      });
      return { x: candidates[0].x, y: candidates[0].y };
    }

    // Secondary fallback: distance-2 perimeter around target
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dx) === 2 || Math.abs(dy) === 2) {
          const nx = targetX + dx;
          const ny = targetY + dy;
          if (!collisions.has(`${nx},${ny}`)) {
            return { x: nx, y: ny };
          }
        }
      }
    }

    // Extreme fallback: 1 step outside the node, never on top of the node!
    return { x: targetX, y: targetY + 1 };
  }

  private resumeCombatSession(session: ConnectedSession, monsterId: string, targetX: number, targetY: number, nodeId?: string, zoneId?: string) {
    const monsterDef = MONSTERS[monsterId];
    if (!monsterDef) return;

    let mobInst = nodeId ? this.liveMonsters.get(nodeId) : undefined;
    if (!mobInst) {
      mobInst = Array.from(this.liveMonsters.values()).find(
        m => m.currentHp > 0 && m.x === targetX && m.y === targetY
      );
    }

    const effectiveNodeId = mobInst ? mobInst.id : nodeId || `mob_${targetX}_${targetY}`;
    const effectiveZoneId = zoneId || (mobInst ? mobInst.zoneId : undefined);

    session.activeCombat = {
      monsterId,
      targetX: mobInst ? mobInst.x : targetX,
      targetY: mobInst ? mobInst.y : targetY,
      nodeId: effectiveNodeId,
      zoneId: effectiveZoneId,
      currentHp: mobInst ? mobInst.currentHp : monsterDef.hp,
      maxHp: mobInst ? mobInst.maxHp : monsterDef.hp,
      playerSwingTicks: 0,
      monsterSwingTicks: 0,
    };
  }

  private ensureCombatFoodFromBankAtHearth(session: ConnectedSession) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);
    if (distToHearth > 1.5) return; // Must be at the Hearth! Never remotely withdraw!

    const targetFoodItemId = player.selectedFoodItemId;

    // Check how many food items player currently carries in inventory
    let carriedFoodCount = 0;
    for (const slot of player.inventory) {
      if (targetFoodItemId) {
        if (slot.itemId === targetFoodItemId) carriedFoodCount += slot.quantity;
      } else {
        const def = ITEMS[slot.itemId];
        if (def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0))) {
          carriedFoodCount += slot.quantity;
        }
      }
    }

    const targetStock = 15;
    if (carriedFoodCount >= targetStock) return;
    const needed = targetStock - carriedFoodCount;

    // Find food in bank storage
    let storageIdx = -1;
    if (targetFoodItemId) {
      storageIdx = player.storage.findIndex(s => s.itemId === targetFoodItemId && s.quantity > 0);
    }
    if (storageIdx === -1) {
      storageIdx = player.storage.findIndex(s => {
        const def = ITEMS[s.itemId];
        return s.quantity > 0 && def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0));
      });
    }
    if (storageIdx === -1) return; // No food in bank

    const storageSlot = player.storage[storageIdx];
    const foodDef = ITEMS[storageSlot.itemId];
    const toWithdraw = Math.min(needed, storageSlot.quantity);
    if (toWithdraw <= 0) return;

    // Add to satchel respecting inventory unstackable rules (1 slot per food item)
    const res = addItemToSlots(player.inventory, 28, storageSlot.itemId, toWithdraw, storageSlot.rarity, storageSlot.plus, foodDef, 'inventory');
    if (res.added > 0) {
      storageSlot.quantity -= res.added;
      if (storageSlot.quantity <= 0) {
        player.storage.splice(storageIdx, 1);
      }
      this.send(ws, {
        type: 'NOTIFICATION',
        message: `Withdrew ${res.added}x ${foodDef?.name || 'Food'} from Hearth bank for combat.`,
      });
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
    }
  }

  private startCombatSession(session: ConnectedSession, monsterId: string, targetX: number, targetY: number, nodeId?: string, zoneId?: string) {
    const { player, ws } = session;
    const monsterDef = MONSTERS[monsterId];
    if (!monsterDef) return;

    let mobInst = nodeId ? this.liveMonsters.get(nodeId) : undefined;
    if (!mobInst) {
      mobInst = Array.from(this.liveMonsters.values()).find(
        m => m.currentHp > 0 && m.x === targetX && m.y === targetY
      );
    }

    const effectiveNodeId = mobInst ? mobInst.id : nodeId || `mob_${targetX}_${targetY}`;
    const effectiveZoneId = zoneId || (mobInst ? mobInst.zoneId : undefined);
    const actualTargetX = mobInst ? mobInst.x : targetX;
    const actualTargetY = mobInst ? mobInst.y : targetY;

    session.activeCombat = {
      monsterId,
      targetX: actualTargetX,
      targetY: actualTargetY,
      nodeId: effectiveNodeId,
      zoneId: effectiveZoneId,
      currentHp: mobInst ? mobInst.currentHp : monsterDef.hp,
      maxHp: mobInst ? mobInst.maxHp : monsterDef.hp,
      playerSwingTicks: 0,
      monsterSwingTicks: 0,
    };

    const combatStyle = this.getPlayerCombatStyle(player);
    player.currentTask = {
      recipeId: monsterId,
      skill: combatStyle,
      startedAtTick: this.tickCount,
      targetQuantity: Infinity,
      completedQuantity: 0,
      targetNodeX: actualTargetX,
      targetNodeY: actualTargetY,
      targetNodeId: effectiveNodeId,
    };

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private processCombatCycle(session: ConnectedSession) {
    const { player, ws } = session;
    const combat = session.activeCombat;
    if (!combat) return;

    const monsterDef = MONSTERS[combat.monsterId];
    if (!monsterDef) {
      session.activeCombat = null;
      player.currentTask = null;
      return;
    }

    const maxRange = this.getCombatMaxRange(player);
    const dist = Math.hypot(player.x - combat.targetX, player.y - combat.targetY);
    if (dist > maxRange + 0.5) {
      session.activeCombat = null;
      player.currentTask = null;
      this.send(ws, { type: 'PLAYER_UPDATE', player });
      this.broadcastWorldState();
      return;
    }

    combat.playerSwingTicks++;
    combat.monsterSwingTicks++;

    const combatStyle = this.getPlayerCombatStyle(player);
    const weaponItem = player.equipment?.weapon ? ITEMS[player.equipment.weapon.itemId] : null;
    const swingSpeedSec = weaponItem?.baseStats?.swingSpeedSeconds || (combatStyle === 'ranged' ? 1.8 : combatStyle === 'magic' ? 3.6 : 2.4);
    const playerRequiredTicks = Math.max(2, Math.round(swingSpeedSec / (TICK_MS / 1000)));

    const monsterSwingSec = monsterDef.swingSpeedSeconds || 2.4;
    const monsterRequiredTicks = Math.max(2, Math.round(monsterSwingSec / (TICK_MS / 1000)));

    let combatUpdated = false;

    // 1. PLAYER ATTACKS MONSTER
    if (combat.playerSwingTicks >= playerRequiredTicks) {
      combat.playerSwingTicks = 0;
      combatUpdated = true;

      let gearAccuracy = 0;
      let gearStrength = 0;
      for (const slot of Object.values(player.equipment || {})) {
        if (slot) {
          const item = ITEMS[slot.itemId];
          if (item?.baseStats?.accuracy) gearAccuracy += item.baseStats.accuracy;
          if (item?.baseStats?.strength) gearStrength += item.baseStats.strength;
        }
      }

      const combatLevel = player.skills[combatStyle]?.level || 1;
      const hitChance = calculateHitChance(combatLevel * 2 + gearAccuracy + 10, monsterDef.level * 3);
      let damage = 0;
      if (Math.random() < hitChance) {
        const maxHit = calculateMaxHit(combatLevel, gearStrength, Math.floor(monsterDef.level / 4));
        damage = Math.floor(1 + Math.random() * maxHit);
      }

      combat.currentHp = Math.max(0, combat.currentHp - damage);

      // XP gains to the matching combat style!
      const styleXp = Math.max(2, damage * 4);
      player.skills[combatStyle].xp += styleXp;
      player.skills[combatStyle].level = getLevelFromXp(player.skills[combatStyle].xp);

      const hpXp = Math.max(1, Math.floor(damage * 1.33));
      player.skills.hitpoints.xp = Math.max(1154, (player.skills.hitpoints.xp || 1154) + hpXp);
      player.skills.hitpoints.level = Math.max(10, getLevelFromXp(player.skills.hitpoints.xp));

      this.broadcast({
        type: 'COMBAT_HIT',
        target: 'monster',
        attackerId: player.id,
        damage,
        combatStyle,
        monsterId: monsterDef.id,
        monsterName: monsterDef.name,
        monsterHp: combat.currentHp,
        monsterMaxHp: combat.maxHp,
        nodeId: combat.nodeId,
        playerX: player.x,
        playerY: player.y,
        targetX: combat.targetX,
        targetY: combat.targetY,
      });

      // Check if monster died
      if (combat.currentHp <= 0) {
        const coinDrop = Math.floor(monsterDef.minCoins + Math.random() * (monsterDef.maxCoins - monsterDef.minCoins + 1));
        player.gold += coinDrop;

        if (monsterDef.guaranteedDropItemId && ITEMS[monsterDef.guaranteedDropItemId]) {
          this.giveLootItem(player, monsterDef.guaranteedDropItemId, 1);
        }

        if (monsterDef.rareDrop && Math.random() < monsterDef.rareDrop.chance && ITEMS[monsterDef.rareDrop.itemId]) {
          this.giveLootItem(player, monsterDef.rareDrop.itemId, 1);
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `RARE DROP: You found ${ITEMS[monsterDef.rareDrop.itemId].name}!`,
          });
        }

        const oldLevel = player.skills[combatStyle].level;
        player.skills[combatStyle].xp += monsterDef.xp;
        player.skills[combatStyle].level = getLevelFromXp(player.skills[combatStyle].xp);
        if (player.skills[combatStyle].level > oldLevel) {
          this.send(ws, {
            type: 'LEVEL_UP',
            skill: combatStyle,
            newLevel: player.skills[combatStyle].level,
          });
        }

        this.progressKillQuests(player, monsterDef.id);

        // Check if satchel full
        if (player.inventory.length >= 28) {
          player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
          player.currentTask = null;
          session.activeCombat = null;
          player.bankingState = 'walking_to_bank';
          const hearth = this.getHearthLocation(player.x, player.y);
          const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
          player.targetX = hearth.x;
          player.targetY = hearth.y;
          player.path = path;
          player.isMoving = path.length > 0;
          this.send(ws, {
            type: 'NOTIFICATION',
            message: 'Your bag is full! Heading to the bank to drop off your loot...',
          });
          storage.savePlayer(player);
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        }

        if (player.currentTask) {
          player.currentTask.completedQuantity++;
        }

        // Set live monster instance dead and schedule respawn in zone
        let mobInst = combat.nodeId ? this.liveMonsters.get(combat.nodeId) : undefined;
        if (!mobInst) {
          mobInst = Array.from(this.liveMonsters.values()).find(
            m => m.x === combat.targetX && m.y === combat.targetY
          );
        }

        if (mobInst) {
          mobInst.currentHp = 0;
          const zone = storage.getMonsterZones().find(z => z.id === mobInst!.zoneId);
          const respawnSec = zone?.respawnSeconds || 5;
          mobInst.respawnAtTick = this.tickCount + Math.max(3, Math.round(respawnSec * 1.67));
        }

        storage.savePlayer(player);
        this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: this.getAllWorldNodes() });

        const task = player.currentTask;
        const hasCombatQuota = task && typeof task.targetQuantity === 'number' && task.targetQuantity > 0 && task.targetQuantity !== Infinity;
        if (hasCombatQuota && task.completedQuantity >= task.targetQuantity) {
          session.activeCombat = null;
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Completed combat quota: Slain ${task.completedQuantity}x ${monsterDef.name}.`
          });
          this.startNextQueuedTask(session);
          return;
        }

        // Search for next alive monster in the zone to hunt
        const nextMob = this.findNearestAliveMonsterInZone(player.x, player.y, combat.zoneId || mobInst?.zoneId, monsterDef.id);
        if (nextMob) {
          this.handleStartCombat(session, {
            monsterId: nextMob.monsterId,
            targetX: nextMob.x,
            targetY: nextMob.y,
            nodeId: nextMob.id,
          });
        } else {
          session.activeCombat = null;
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Defeated ${monsterDef.name}! Waiting for enemies in zone...`,
          });
          this.send(ws, { type: 'PLAYER_UPDATE', player });
        }
        return;
      }
    }

    // 2. MONSTER ATTACKS PLAYER
    if (combat.monsterSwingTicks >= monsterRequiredTicks) {
      combat.monsterSwingTicks = 0;
      combatUpdated = true;

      let gearDefence = 0;
      for (const slot of Object.values(player.equipment || {})) {
        if (slot) {
          const item = ITEMS[slot.itemId];
          if (item?.baseStats?.defence) gearDefence += item.baseStats.defence;
        }
      }

      const defLevel = player.skills.defence?.level || 1;
      const monsterHitChance = calculateHitChance(monsterDef.level * 3, defLevel * 2 + gearDefence);
      let monsterDmg = 0;
      if (Math.random() < monsterHitChance) {
        monsterDmg = Math.floor(1 + Math.random() * monsterDef.maxHit);
      }

      player.currentHp = Math.max(0, player.currentHp - monsterDmg);

      if (monsterDmg > 0) {
        player.skills.defence.xp += monsterDmg * 2;
        player.skills.defence.level = getLevelFromXp(player.skills.defence.xp);
      }

      this.broadcast({
        type: 'COMBAT_HIT',
        target: 'player',
        targetPlayerId: player.id,
        damage: monsterDmg,
        monsterId: monsterDef.id,
        monsterName: monsterDef.name,
        playerHp: player.currentHp,
        playerMaxHp: player.skills.hitpoints?.level || 10,
        playerX: player.x,
        playerY: player.y,
        nodeId: combat.nodeId,
      });

      // Auto-eat food if below threshold
      const maxHp = player.skills.hitpoints?.level || 10;
      const eatThreshold = (maxHp * (player.eatsAtHpPercent || 50)) / 100;
      if (player.currentHp <= eatThreshold) {
        let eatenSlot: InventorySlot | null = null;
        let isFromBank = false;

        // 1. Try finding specified or any cooked food in inventory
        if (player.selectedFoodItemId) {
          const invIdx = player.inventory.findIndex(s => s.itemId === player.selectedFoodItemId && s.quantity > 0);
          if (invIdx >= 0) {
            eatenSlot = player.inventory[invIdx];
            eatenSlot.quantity--;
            if (eatenSlot.quantity <= 0) player.inventory.splice(invIdx, 1);
          }
        }
        if (!eatenSlot) {
          const invIdx = player.inventory.findIndex(s => {
            const def = ITEMS[s.itemId];
            return s.quantity > 0 && def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0));
          });
          if (invIdx >= 0) {
            eatenSlot = player.inventory[invIdx];
            eatenSlot.quantity--;
            if (eatenSlot.quantity <= 0) player.inventory.splice(invIdx, 1);
          }
        }

        // If satchel has no food, retreat to Hearth to restock rather than remotely eating from bank
        if (!eatenSlot) {
          const hasBankFood = player.storage.some(s => {
            if (s.quantity <= 0) return false;
            if (player.selectedFoodItemId) return s.itemId === player.selectedFoodItemId;
            const def = ITEMS[s.itemId];
            return def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0));
          });

          player.bankReturnTask = { ...player.currentTask!, standX: player.x, standY: player.y };
          player.currentTask = null;
          session.activeCombat = null;
          player.bankingState = 'walking_to_bank';
          const hearth = this.getHearthLocation(player.x, player.y);
          const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
          player.targetX = hearth.x;
          player.targetY = hearth.y;
          player.path = path;
          player.isMoving = path.length > 0;

          if (hasBankFood) {
            this.send(ws, {
              type: 'NOTIFICATION',
              message: 'Out of food! Heading to the bank to drop off loot and grab more food...',
            });
          } else {
            player.bankReturnTask = null;
            this.send(ws, {
              type: 'NOTIFICATION',
              message: 'Out of food and your bank is empty! Retreating to town for safety.',
            });
          }

          storage.savePlayer(player);
          this.send(ws, { type: 'PLAYER_UPDATE', player });
          this.broadcastWorldState();
          return;
        }

        if (eatenSlot) {
          const foodDef = ITEMS[eatenSlot.itemId];
          const heal = foodDef?.baseStats?.healing || 5;
          player.currentHp = Math.min(maxHp, player.currentHp + heal);

          // Uncommon+ food gives Satiated Fury buff (+25% strike)
          if (eatenSlot.rarity && eatenSlot.rarity !== 'plain') {
            const durations: Record<string, number> = {
              uncommon: 2 * 60 * 1000,
              rare: 10 * 60 * 1000,
              epic: 3 * 3600 * 1000,
              legendary: 24 * 3600 * 1000,
            };
            const durationMs = durations[eatenSlot.rarity] || (2 * 60 * 1000);
            if (!player.activeBuffs) player.activeBuffs = [];
            player.activeBuffs.push({
              id: 'satiated_fury',
              name: 'Satiated Fury (+25% Strike)',
              type: 'food_damage',
              value: 0.25,
              expiresAt: Date.now() + durationMs,
            });
          }

          this.broadcast({
            type: 'COMBAT_HEAL',
            playerId: player.id,
            heal,
            currentHp: player.currentHp,
            maxHp,
            foodName: foodDef?.name || 'Food',
            playerX: player.x,
            playerY: player.y,
          });

          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Ate ${foodDef?.name || 'Food'} (+${heal} HP, now ${player.currentHp}/${maxHp})`,
          });
          storage.savePlayer(player);
          this.send(ws, { type: 'PLAYER_UPDATE', player });
        }
      }

      // Check if player died
      if (player.currentHp <= 0) {
        session.activeCombat = null;
        player.currentTask = null;
        const hearth = this.getHearthLocation(player.x, player.y);
        player.x = hearth.x;
        player.y = hearth.y;
        player.currentHp = maxHp;
        player.isMoving = false;
        player.path = [];
        storage.savePlayer(player);
        this.send(ws, {
          type: 'NOTIFICATION',
          message: `Slain by ${monsterDef.name}. You awoke safely at the Hearth.`,
        });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        this.broadcastWorldState();
        return;
      }
    }

    if (combatUpdated) {
      storage.savePlayer(player);
      this.send(ws, { type: 'PLAYER_UPDATE', player });
    }
  }

  private giveLootItem(player: PlayerData, itemId: string, quantity: number = 1) {
    if (itemId === 'gold') {
      player.gold = (player.gold || 0) + quantity;
      return;
    }
    const rarity = rollRarity(1.0);
    const itemDef = storage.getItem(itemId);
    const res = addItemToSlots(player.inventory, 28, itemId, quantity, rarity, 0, itemDef, 'inventory');
    if (res.remainder > 0) {
      if (!player.overflowTray) player.overflowTray = [];
      const tray = player.overflowTray.find(s => s.itemId === itemId && s.rarity === rarity && s.plus === 0);
      if (tray && isItemStackable(itemDef, 'inventory')) {
        tray.quantity += res.remainder;
      } else {
        player.overflowTray.push({ itemId, quantity: res.remainder, rarity, plus: 0 });
      }
    }
  }

  private progressKillQuests(player: PlayerData, monsterId: string) {
    if (!player.questProgress) player.questProgress = {};
    const quests = storage.getQuests();
    for (const q of quests) {
      if (q.objective && q.objective.type === 'kill' && q.objective.targetId === monsterId) {
        player.questProgress[q.id] = (player.questProgress[q.id] || 0) + 1;
      }
    }
  }

  private broadcastWorldState() {
    const playersList = Array.from(this.sessions.values()).map(s => ({
      id: s.player.id,
      name: s.player.username,
      title: s.player.activeTitle,
      role: s.player.role,
      x: s.player.x,
      y: s.player.y,
      isMoving: s.player.isMoving || Boolean(s.player.path && s.player.path.length > 0),
      currentTask: s.player.currentTask
        ? ((s.player.currentTask.skill as string) === 'combat' ? this.getPlayerCombatStyle(s.player) : s.player.currentTask.skill)
        : null,
      targetNodeX: s.player.currentTask?.targetNodeX,
      targetNodeY: s.player.currentTask?.targetNodeY,
      bankingState: s.player.bankingState,
      equipment: s.player.equipment,
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

  public notifyPlayerPayment(playerId: string, packName: string, itemId: string) {
    const session = this.sessions.get(playerId);
    if (session) {
      const player = storage.getPlayer(playerId) || session.player;
      session.player = player;
      this.send(session.ws, { type: 'PLAYER_UPDATE', player });
      this.send(session.ws, {
        type: 'NOTIFICATION',
        message: `🎉 Payment received! 1x ${packName} added to your bag. Use it to redeem gems, or trade it on the market!`,
      });
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
