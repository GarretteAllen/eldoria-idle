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
  pendingTask: { recipeId: string; targetX: number; targetY: number; quantity?: number } | null;
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

    player.lastActiveTimestamp = Date.now();
    player.moveSpeedTilesPerTick = calculatePlayerMoveSpeed(player);
    this.sessions.set(player.id, { ws, player, ticksInTask: 0, moveAccumulator: 0, pendingTask: null });

    // Send initial handshake with persistent world nodes, npcs, quests, and collisions
    this.send(ws, {
      type: 'INIT',
      player,
      boss: this.getBossSummary(),
      catchUp: catchUpSummary,
      onlineCount: this.sessions.size,
      nodes: storage.getWorldNodes(),
      npcs: storage.getNpcs(),
      quests: storage.getQuests(),
      collisions: Array.from(storage.getCollisions()),
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
    console.log(`💾 Saving ${this.sessions.size} active player session(s)...`);
    for (const session of this.sessions.values()) {
      session.player.lastActiveTimestamp = Date.now();
      storage.savePlayer(session.player);
    }
    storage.checkpoint();
    storage.close();
  }

  private findPathWithCollisions(startX: number, startY: number, targetX: number, targetY: number) {
    return findPath(startX, startY, targetX, targetY, 60, 60, (x, y) => storage.isCollidable(x, y));
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

          const path = this.findPathWithCollisions(player.x, player.y, msg.x, msg.y);
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
          const rec = RECIPES[msg.recipeId];
          const targetX = typeof msg.targetX === 'number' ? msg.targetX : player.x;
          const targetY = typeof msg.targetY === 'number' ? msg.targetY : player.y;

          // Check if crafting recipe needs inputs not in bag
          const hasInputsInBag = !rec.inputs || rec.inputs.length === 0 || rec.inputs.every(inp => {
            const slot = player.inventory.find(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
            return !!slot;
          });

          if (!hasInputsInBag && rec.inputs && rec.inputs.length > 0) {
            const hasInStorage = rec.inputs.every(inp => {
              return player.storage.some(s => s.itemId === inp.itemId && s.quantity >= inp.quantity);
            });

            if (hasInStorage) {
              // Path to Hearth to withdraw materials first, then go to work!
              session.pendingTask = { recipeId: msg.recipeId, targetX, targetY, quantity: msg.quantity };
              const hearth = this.getHearthLocation(player.x, player.y);
              const pathToHearth = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
              player.targetX = hearth.x;
              player.targetY = hearth.y;
              player.path = pathToHearth;
              player.isMoving = true;
              player.bankingState = 'walking_to_bank';
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Drawing materials from Hearth for ${rec.name}... (${pathToHearth.length} steps)`
              });
              this.send(session.ws, { type: 'PLAYER_UPDATE', player });
              this.broadcastWorldState();
              break;
            } else {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `Insufficient materials for ${rec.name} in bag or Hearth storage.`
              });
              break;
            }
          }

          // If not adjacent to or on the node, walk there first!
          const dist = Math.hypot(player.x - targetX, player.y - targetY);
          if (dist > 1.5) {
            session.pendingTask = { recipeId: msg.recipeId, targetX, targetY, quantity: msg.quantity };
            const path = this.findPathWithCollisions(player.x, player.y, targetX, targetY);
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

      case 'CHAT':
        if (typeof msg.text === 'string' && msg.text.trim().length > 0) {
          const trimmed = msg.text.trim();

          // Set name command: /name <username> or /nick <username>
          if (trimmed.startsWith('/name ') || trimmed.startsWith('/nick ') || trimmed.startsWith('/setname ')) {
            const newName = trimmed.replace(/^\/(name|nick|setname)\s+/, '').trim().slice(0, 16);
            if (!player.isGuest) {
              this.send(session.ws, {
                type: 'NOTIFICATION',
                message: `🔒 Your adventurer name is bound to your registered account (${player.username}).`,
              });
              break;
            }
            if (newName) {
              if (storage.isUsernameTaken(newName) || storage.isAdminUsername(newName)) {
                this.send(session.ws, {
                  type: 'NOTIFICATION',
                  message: `❌ "${newName}" is a registered or reserved account name. Please log in or register with a password to claim it.`,
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

      case 'ADMIN_SAVE_NODE':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
          break;
        }
        if (msg.node && msg.node.id) {
          storage.upsertWorldNode(msg.node);
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: storage.getWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Node "${msg.node.name}" saved at (${msg.node.x}, ${msg.node.y}).`
          });
        }
        break;

      case 'ADMIN_DELETE_NODE':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
          break;
        }
        const deleteNodeId = msg.nodeId || msg.id;
        if (deleteNodeId) {
          storage.deleteWorldNode(deleteNodeId);
          this.broadcast({ type: 'WORLD_NODES_UPDATE', nodes: storage.getWorldNodes() });
          this.send(session.ws, {
            type: 'NOTIFICATION',
            message: `Node ${deleteNodeId} deleted.`
          });
        }
        break;

      case 'ADMIN_SAVE_NPC':
        if (player.role !== 'admin') {
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
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
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
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
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
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
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
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
          this.send(session.ws, { type: 'NOTIFICATION', message: '❌ Admin privileges required.' });
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
        message: `Riding to the Hearth Storage Counter to deposit spoils... (${path.length} paces)`
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
    const def = ITEMS[slot.itemId];

    // Check inventory capacity
    const existingInv = player.inventory.find(
      s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus
    );
    if (!existingInv && player.inventory.length >= 28) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Satchel full! Cannot withdraw items.'
      });
      return;
    }

    const qtyToTake = (typeof requestedQty === 'number' && requestedQty > 0)
      ? Math.min(slot.quantity, requestedQty)
      : slot.quantity;

    slot.quantity -= qtyToTake;
    if (slot.quantity <= 0) {
      player.storage.splice(storageIndex, 1);
    }

    if (existingInv) {
      existingInv.quantity += qtyToTake;
    } else {
      player.inventory.push({
        itemId: slot.itemId,
        quantity: qtyToTake,
        rarity: slot.rarity,
        plus: slot.plus,
      });
    }

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, {
      type: 'NOTIFICATION',
      message: `Withdrew ${qtyToTake}x ${def?.name || slot.itemId} from the vault.`
    });
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleDepositItem(session: ConnectedSession, inventoryIndex: number, requestedQty?: number) {
    const { player, ws } = session;
    const hearth = this.getHearthLocation(player.x, player.y);
    const distToHearth = Math.hypot(player.x - hearth.x, player.y - hearth.y);

    if (distToHearth > 1.5) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Must be at the Hearth Storage Counter to deposit items.'
      });
      return;
    }

    const slot = player.inventory[inventoryIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];

    const maxSlots = player.storageSlotsMax || 75;
    const existingStorage = player.storage.find(
      s => s.itemId === slot.itemId && s.rarity === slot.rarity && s.plus === slot.plus
    );
    if (!existingStorage && player.storage.length >= maxSlots) {
      this.send(ws, {
        type: 'NOTIFICATION',
        message: 'Hearth Vault full! Purchase additional slots or withdraw items.'
      });
      return;
    }

    const qtyToTake = (typeof requestedQty === 'number' && requestedQty > 0)
      ? Math.min(slot.quantity, requestedQty)
      : slot.quantity;

    slot.quantity -= qtyToTake;
    if (slot.quantity <= 0) {
      player.inventory.splice(inventoryIndex, 1);
    }

    if (existingStorage) {
      existingStorage.quantity += qtyToTake;
    } else {
      player.storage.push({
        itemId: slot.itemId,
        quantity: qtyToTake,
        rarity: slot.rarity,
        plus: slot.plus,
      });
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
    const slot = player.inventory[inventoryIndex];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    const unitPrice = def?.vendorFloorPrice || 1;

    const qtyToSell = (typeof requestedQty === 'number' && requestedQty > 0)
      ? Math.min(slot.quantity, requestedQty)
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
      this.send(ws, { type: 'NOTIFICATION', message: 'No sellable common spoils in satchel.' });
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

    // Every 5 ticks (3s) auto-save
    if (this.tickCount % 5 === 0) {
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

    // Check if target task (pendingTask or bankReturnTask) has inputs: withdraw from storage before heading to work!
    const targetTask = session.pendingTask || player.bankReturnTask;
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
            sSlot.quantity -= toTake;
            const invSlot = player.inventory.find(s => s.itemId === inp.itemId && s.rarity === 'plain');
            if (invSlot) {
              invSlot.quantity += toTake;
            } else {
              player.inventory.push({ itemId: inp.itemId, quantity: toTake, rarity: 'plain', plus: 0 });
            }
          }
          player.storage = player.storage.filter(s => s.quantity > 0);
          this.send(ws, {
            type: 'NOTIFICATION',
            message: `Withdrew materials from Hearth for ${rec.name}. Riding to work...`
          });
        }
      }
    }

    // Walk back to previous task node or pending target node!
    const destX = player.bankReturnTask ? player.bankReturnTask.targetNodeX : (session.pendingTask ? session.pendingTask.targetX : undefined);
    const destY = player.bankReturnTask ? player.bankReturnTask.targetNodeY : (session.pendingTask ? session.pendingTask.targetY : undefined);

    if (typeof destX === 'number' && typeof destY === 'number') {
      player.bankingState = 'returning_to_work';
      const path = this.findPathWithCollisions(player.x, player.y, destX, destY);
      player.path = path;
      player.isMoving = path.length > 0;
      this.send(ws, {
        type: 'NOTIFICATION',
        message: count > 0 
          ? `Hearth reached! Deposited ${count} resources. Riding back to work...`
          : `Hearth reached! Riding back to work...`
      });
    } else {
      player.bankingState = 'idle';
      this.send(ws, {
        type: 'NOTIFICATION',
        message: count > 0
          ? `Deposited ${count} resources into the Hearth Reliquary.`
          : `No spoils to deposit in satchel.`
      });
    }

    storage.savePlayer(player);
    storage.checkpoint();
    this.send(ws, { type: 'PLAYER_UPDATE', player });
    this.broadcastWorldState();
  }

  private executeTaskCycle(session: ConnectedSession, recipe: RecipeDefinition) {
    const { player, ws } = session;
    const task = player.currentTask!;

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
          player.bankReturnTask = { ...player.currentTask! };
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

        // Materials depleted in storage too
        player.currentTask = null;
        this.send(ws, { type: 'NOTIFICATION', message: `Materials depleted for ${recipe.name}.` });
        this.send(ws, { type: 'PLAYER_UPDATE', player });
        return;
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

        const hearth = this.getHearthLocation(player.x, player.y);
        const path = this.findPathWithCollisions(player.x, player.y, hearth.x, hearth.y);
        player.targetX = hearth.x;
        player.targetY = hearth.y;
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
        storage.savePlayer(player);
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

    storage.savePlayer(player);
    this.send(ws, { type: 'PLAYER_UPDATE', player });
  }

  private handleBossAttack(session: ConnectedSession) {
    if (!this.activeBoss) return;
    const { player, ws } = session;

    const hit = Math.floor(10 + Math.random() * 25);
    this.activeBoss.currentHp = Math.max(0, this.activeBoss.currentHp - hit);
    this.activeBoss.damageDealt[player.id] = (this.activeBoss.damageDealt[player.id] || 0) + hit;

    // Grant melee / combat xp
    player.skills.melee.xp += hit;
    player.skills.melee.level = getLevelFromXp(player.skills.melee.xp);

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
