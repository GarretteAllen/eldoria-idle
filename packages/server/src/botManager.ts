import {
  PlayerData,
  SkillType,
  RECIPES,
  MONSTERS,
  InventorySlot,
  Rarity,
} from '@eldoria/shared';
import { storage } from './storage.js';
import { GameEngine, LiveMonsterInstance } from './gameEngine.js';

export interface BotState {
  id: string;
  nextDecisionTick: number;
  currentGoal: 'skilling' | 'combat' | 'banking' | 'wander' | 'idle';
  goalTargetName: string;
  cyclesInGoal: number;
  lastChatTick: number;
}

const CHAT_PHRASES: Record<string, string[]> = {
  skilling: [
    'Grinding out a few more levels!',
    'Level progression feels smooth today.',
    'Just filling up the satchel then banking.',
    'Need more materials for crafting.',
    'Afk skilling while doing chores :)',
    'Love how clean the queue system is.',
    'Mining away!',
    'Timber supplies are looking good.',
    'Gotta keep the queue rolling.',
  ],
  combat: [
    'Farming some loot drops here.',
    'Testing out my combat style.',
    'These monsters give decent XP.',
    'Need some rare monster trophy drops!',
    'Gotta watch my HP bar haha.',
    'Nice drop!',
  ],
  banking: [
    'Quick bank trip.',
    'Satchel full, time to store everything.',
    'Checking out the marketplace listings.',
    'Dumping goods in the vault.',
  ],
  general: [
    'Hello everyone!',
    'Hey all!',
    'Any good deals on the market?',
    'What skill is everyone working on?',
    'Eldoria is so cozy.',
    'gg',
  ],
};

export class BotManager {
  private engine: GameEngine;
  private bots = new Map<string, BotState>();
  private nextChatRollTick = 0;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public getActiveBotCount(): number {
    return this.bots.size;
  }

  public getBotSummaries(): Array<{
    id: string;
    username: string;
    goal: string;
    target: string;
    x: number;
    y: number;
    skill?: string;
  }> {
    const list: Array<{
      id: string;
      username: string;
      goal: string;
      target: string;
      x: number;
      y: number;
      skill?: string;
    }> = [];

    for (const [id, state] of this.bots.entries()) {
      const session = this.engine.getSession(id);
      if (session) {
        list.push({
          id,
          username: session.player.username,
          goal: state.currentGoal,
          target: state.goalTargetName,
          x: Math.round(session.player.x),
          y: Math.round(session.player.y),
          skill: (session.player.currentTask?.skill as string) || undefined,
        });
      }
    }
    return list;
  }

  public startBots(count: number): number {
    const targetCount = Math.min(50, Math.max(1, count));
    let spawned = 0;

    for (let i = 0; i < targetCount; i++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const username = `Wanderer_${randomSuffix}`;

      // Create a full guest player state
      const player = storage.createGuestPlayer(username);
      player.id = botId;

      // Randomize starter location near Hearth Town
      const hearth = this.engine.getHearthLocation();
      const offsetX = Math.floor(Math.random() * 7) - 3;
      const offsetY = Math.floor(Math.random() * 7) - 3;
      player.x = hearth.x + offsetX;
      player.y = hearth.y + offsetY;
      player.targetX = player.x;
      player.targetY = player.y;

      // Give starter food in case of combat
      if (!player.inventory.some(s => s.itemId === 'crusty_bread' || s.itemId === 'smoked_prawn')) {
        player.inventory.push({ itemId: 'crusty_bread', quantity: 25, rarity: 'plain', plus: 0 });
      }

      // Save initial bot player
      storage.savePlayer(player);

      // Register virtual socket session in GameEngine
      this.engine.registerVirtualBot(player);

      this.bots.set(botId, {
        id: botId,
        nextDecisionTick: 0,
        currentGoal: 'idle',
        goalTargetName: 'Arriving in Eldoria',
        cyclesInGoal: 0,
        lastChatTick: 0,
      });

      spawned++;
    }

    return spawned;
  }

  public stopAllBots(): number {
    const count = this.bots.size;
    for (const botId of this.bots.keys()) {
      this.engine.removeVirtualBot(botId);
      storage.deletePlayer(botId);
    }
    this.bots.clear();
    return count;
  }

  public update(currentTick: number) {
    if (this.bots.size === 0) return;

    for (const [botId, state] of this.bots.entries()) {
      const session = this.engine.getSession(botId);
      if (!session) {
        this.bots.delete(botId);
        continue;
      }

      const player = session.player;

      // Check if bot should make a decision
      const isWorking = Boolean(player.currentTask || session.activeCombat || session.pendingCombat || player.bankingState !== 'idle');
      const isMoving = Boolean(player.isMoving || (player.path && player.path.length > 0));

      if (currentTick >= state.nextDecisionTick && (!isWorking || state.cyclesInGoal > 30)) {
        this.decideNextGoal(botId, state, currentTick);
      } else if (isWorking) {
        state.cyclesInGoal++;
      }

      // Check occasional friendly chat (every 2-5 minutes per bot with small random chance)
      if (currentTick > state.lastChatTick + 200 && Math.random() < 0.001) {
        this.emitBotChat(botId, state, currentTick);
      }
    }
  }

  private decideNextGoal(botId: string, state: BotState, currentTick: number) {
    const session = this.engine.getSession(botId);
    if (!session) return;
    const player = session.player;

    state.cyclesInGoal = 0;

    // 1. If satchel is very full (>= 22/28 slots), prioritize banking/depositing
    const invCount = player.inventory.length;
    if (invCount >= 22) {
      this.executeBankingGoal(botId, state, currentTick);
      return;
    }

    // 2. Roll a weighted random activity:
    // 55% Skilling / Gathering (Mining, Woodcutting, Fishing, Farming, Herbalism)
    // 25% Combat (Monster hunting in zones)
    // 10% Banking / Market check
    // 10% Strolling / Exploring
    const roll = Math.random();

    if (roll < 0.55) {
      this.executeSkillingGoal(botId, state, currentTick);
    } else if (roll < 0.80) {
      this.executeCombatGoal(botId, state, currentTick);
    } else if (roll < 0.90) {
      this.executeBankingGoal(botId, state, currentTick);
    } else {
      this.executeWanderGoal(botId, state, currentTick);
    }
  }

  private executeSkillingGoal(botId: string, state: BotState, currentTick: number) {
    const allNodes = this.engine.getAllWorldNodes();
    // Eligible skilling nodes
    const skillNodes = allNodes.filter(n =>
      (n.type === 'mine' || n.type === 'tree' || n.type === 'water' || n.type === 'herb' || n.type === 'farm') &&
      Boolean(n.recipeId && RECIPES[n.recipeId])
    );

    if (skillNodes.length === 0) {
      this.executeWanderGoal(botId, state, currentTick);
      return;
    }

    // Pick a random node
    const chosenNode = skillNodes[Math.floor(Math.random() * skillNodes.length)];
    const rec = RECIPES[chosenNode.recipeId!];
    if (!rec) {
      this.executeWanderGoal(botId, state, currentTick);
      return;
    }

    // Roll random quantity (5 to 15, or occasionally queue 2 tasks)
    const qty = Math.floor(5 + Math.random() * 11);

    // Stop current task and start new task
    this.engine.handleClientMessage(botId, { type: 'STOP_TASK', clearQueue: true });

    this.engine.handleClientMessage(botId, {
      type: 'START_TASK',
      recipeId: rec.id,
      quantity: qty,
      nodeX: chosenNode.x,
      nodeY: chosenNode.y,
    });

    state.currentGoal = 'skilling';
    state.goalTargetName = `${rec.name} (${qty}x)`;
    // Next decision in ~25 to 45 seconds (40 to 75 ticks)
    state.nextDecisionTick = currentTick + Math.floor(40 + Math.random() * 35);

    // 40% chance the bot also queues a complementary task!
    if (Math.random() < 0.40) {
      const secondNode = skillNodes[Math.floor(Math.random() * skillNodes.length)];
      if (secondNode.recipeId && secondNode.recipeId !== chosenNode.recipeId) {
        const secondRec = RECIPES[secondNode.recipeId];
        if (secondRec) {
          const secondQty = Math.floor(5 + Math.random() * 10);
          this.engine.handleClientMessage(botId, {
            type: 'ENQUEUE_TASK',
            recipeId: secondRec.id,
            quantity: secondQty,
            nodeX: secondNode.x,
            nodeY: secondNode.y,
          });
          state.goalTargetName += ` + ${secondRec.name} (${secondQty}x)`;
        }
      }
    }
  }

  private executeCombatGoal(botId: string, state: BotState, currentTick: number) {
    const zones = storage.getMonsterZones();
    if (zones.length === 0) {
      this.executeSkillingGoal(botId, state, currentTick);
      return;
    }

    const zone = zones[Math.floor(Math.random() * zones.length)];
    const mobDef = MONSTERS[zone.monsterId];
    if (!mobDef) {
      this.executeSkillingGoal(botId, state, currentTick);
      return;
    }

    const session = this.engine.getSession(botId);
    if (!session) return;

    // Find alive monster in zone
    const targetMob = this.engine.findNearestAliveMonsterInZone(session.player.x, session.player.y, zone.id, zone.monsterId);
    const targetX = targetMob ? targetMob.x : (zone.x + Math.floor(zone.width / 2));
    const targetY = targetMob ? targetMob.y : (zone.y + Math.floor(zone.height / 2));

    this.engine.handleClientMessage(botId, { type: 'STOP_TASK', clearQueue: true });

    const killCount = Math.floor(3 + Math.random() * 6);
    this.engine.handleClientMessage(botId, {
      type: 'START_COMBAT',
      monsterId: zone.monsterId,
      targetX,
      targetY,
      nodeId: targetMob ? targetMob.id : undefined,
      zoneId: zone.id,
      quantity: killCount,
    });

    state.currentGoal = 'combat';
    state.goalTargetName = `Hunting ${mobDef.name} (${killCount}x)`;
    state.nextDecisionTick = currentTick + Math.floor(45 + Math.random() * 35);
  }

  private executeBankingGoal(botId: string, state: BotState, currentTick: number) {
    const hearth = this.engine.getHearthLocation();
    this.engine.handleClientMessage(botId, { type: 'STOP_TASK', clearQueue: true });
    this.engine.handleClientMessage(botId, { type: 'MOVE_TO', x: hearth.x, y: hearth.y });

    // Deposit all gathered resources into storage
    this.engine.handleClientMessage(botId, { type: 'DEPOSIT_ALL_RESOURCES' });

    // 20% chance to put a gathered raw item on the player marketplace!
    const session = this.engine.getSession(botId);
    if (session && session.player.inventory.length > 0 && Math.random() < 0.25) {
      const sellableIndex = session.player.inventory.findIndex(
        s => (s.itemId.endsWith('_ore') || s.itemId.endsWith('_timber') || s.itemId.endsWith('_ingot')) && s.quantity >= 3
      );
      if (sellableIndex !== -1) {
        const slot = session.player.inventory[sellableIndex];
        const sellQty = Math.min(slot.quantity, Math.floor(3 + Math.random() * 8));
        const itemDef = storage.getItem(slot.itemId);
        const unitPrice = Math.max(1, Math.round((itemDef?.vendorFloorPrice || 2) * (1.2 + Math.random() * 0.6)));

        this.engine.handleClientMessage(botId, {
          type: 'CREATE_MARKET_LISTING',
          inventoryIndex: sellableIndex,
          quantity: sellQty,
          unitPrice,
        });
      }
    }

    state.currentGoal = 'banking';
    state.goalTargetName = 'Hearth Bank & Stalls';
    state.nextDecisionTick = currentTick + Math.floor(15 + Math.random() * 15);
  }

  private executeWanderGoal(botId: string, state: BotState, currentTick: number) {
    const hearth = this.engine.getHearthLocation();
    // Roam anywhere within 15 tiles of Hearth town center
    const targetX = hearth.x + Math.floor(Math.random() * 25) - 12;
    const targetY = hearth.y + Math.floor(Math.random() * 25) - 12;

    this.engine.handleClientMessage(botId, { type: 'STOP_TASK', clearQueue: true });
    this.engine.handleClientMessage(botId, { type: 'MOVE_TO', x: targetX, y: targetY });

    state.currentGoal = 'wander';
    state.goalTargetName = `Exploring (${targetX}, ${targetY})`;
    state.nextDecisionTick = currentTick + Math.floor(20 + Math.random() * 20);
  }

  private emitBotChat(botId: string, state: BotState, currentTick: number) {
    const session = this.engine.getSession(botId);
    if (!session) return;

    let pool = CHAT_PHRASES[state.currentGoal] || CHAT_PHRASES.general;
    if (Math.random() < 0.3) {
      pool = CHAT_PHRASES.general;
    }

    const text = pool[Math.floor(Math.random() * pool.length)];
    state.lastChatTick = currentTick;

    this.engine.handleClientMessage(botId, {
      type: 'CHAT',
      channel: 'All',
      text,
    });
  }
}
