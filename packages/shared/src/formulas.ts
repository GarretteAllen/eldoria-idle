import { Rarity, RARITY_CHANCES, getSteedWalkSpeedBonus, RARITY_TOOL_BONUS, RARITY_TOOL_LUCK, RARITY_CRAFT_XP_MULTIPLIER, RARITY_HEALING_MULTIPLIER, RARITY_STAT_MULTIPLIER, DEFAULT_STORAGE_SLOTS, OVERFLOW_TRAY_SLOTS } from './constants.js';
import { getLevelFromXp, getJobSpeedMultiplier } from './levels.js';
import { ITEMS, addItemToSlots } from './items.js';
import { RECIPES } from './recipes.js';
import { MONSTERS } from './monsters.js';
import { PlayerData, InventorySlot, ItemDefinition, RecipeDefinition, MonsterDefinition, SkillType } from './types.js';

/**
 * Safe dictionary lookup helpers to prevent prototype pollution (e.g. "__proto__", "constructor").
 */
function getSafeItem(id?: string | null): ItemDefinition | undefined {
  return id && Object.hasOwn(ITEMS, id) ? ITEMS[id] : undefined;
}

function getSafeRecipe(id?: string | null): RecipeDefinition | undefined {
  return id && Object.hasOwn(RECIPES, id) ? RECIPES[id] : undefined;
}

function getSafeMonster(id?: string | null): MonsterDefinition | undefined {
  return id && Object.hasOwn(MONSTERS, id) ? MONSTERS[id] : undefined;
}

/**
 * Normalizes targetQuantity across JSON serialization boundaries
 * (since JSON.stringify converts Infinity to null).
 */
export function getEffectiveTargetQuantity(rawTarget: unknown): number {
  return typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0
    ? Math.floor(rawTarget)
    : Infinity;
}

/**
 * Calculates effective move speed in tiles per 600ms tick.
 * Base = 1.0 tile/tick.
 * Steed adds +12% (plain) up to +150% (legendary +10).
 * Potions add further multipliers.
 */
export function calculatePlayerMoveSpeed(player: PlayerData): number {
  let speed = 1.0;

  // Mount bonus
  const steedSlot = player.equipment?.steed;
  if (steedSlot) {
    const bonus = getSteedWalkSpeedBonus(steedSlot.rarity || 'plain', steedSlot.plus || 0, steedSlot.itemId);
    speed += bonus;
  }

  // Active Potion Buffs
  if (player.activeBuffs) {
    const now = Date.now();
    const speedBuff = player.activeBuffs.find(b => b.type === 'speed' && b.expiresAt > now);
    if (speedBuff && Number.isFinite(speedBuff.value)) {
      speed += speedBuff.value;
    }
  }

  return Number(speed.toFixed(3));
}

/**
 * Fast Min-Binary Heap for A* pathfinding
 */
class MinBinaryHeap<T> {
  private heap: Array<{ f: number; val: T }> = [];

  public push(f: number, val: T): void {
    this.heap.push({ f, val });
    this.up(this.heap.length - 1);
  }

  public pop(): T | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.down(0);
    }
    return top.val;
  }

  public get size(): number {
    return this.heap.length;
  }

  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[i].f < this.heap[p].f) {
        const tmp = this.heap[i];
        this.heap[i] = this.heap[p];
        this.heap[p] = tmp;
        i = p;
      } else {
        break;
      }
    }
  }

  private down(i: number): void {
    const len = this.heap.length;
    while (true) {
      const left = (i << 1) + 1;
      const right = left + 1;
      let smallest = i;
      if (left < len && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < len && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest !== i) {
        const tmp = this.heap[i];
        this.heap[i] = this.heap[smallest];
        this.heap[smallest] = tmp;
        i = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * Grid A* Pathfinding (8-directional with diagonal corner-cutting prevention, unbounded / dynamic map bounds).
 */
export function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  minXOrBlocked?: number | ((x: number, y: number) => boolean),
  minY: number = -10000,
  maxX: number = 10000,
  maxY: number = 10000,
  maybeBlocked?: (x: number, y: number) => boolean
): Array<{ x: number; y: number }> {
  let minX = -10000;
  let isBlocked: ((x: number, y: number) => boolean) | undefined;

  if (typeof minXOrBlocked === 'function') {
    isBlocked = minXOrBlocked;
  } else {
    if (typeof minXOrBlocked === 'number') minX = minXOrBlocked;
    isBlocked = maybeBlocked;
  }

  // Ensure bounds stay safely within 16-bit integer encoding range [-15000, 15000]
  const safeMinX = Math.max(-15000, minX);
  const safeMaxX = Math.min(15000, maxX);
  const safeMinY = Math.max(-15000, minY);
  const safeMaxY = Math.min(15000, maxY);

  const clampX = (v: number) => Math.max(safeMinX, Math.min(safeMaxX, v));
  const clampY = (v: number) => Math.max(safeMinY, Math.min(safeMaxY, v));

  const sx = clampX(Math.round(startX));
  const sy = clampY(Math.round(startY));
  let tx = clampX(Math.round(targetX));
  let ty = clampY(Math.round(targetY));

  if (sx === tx && sy === ty) return [];

  // If the target tile itself is blocked, find the closest walkable adjacent tile
  if (isBlocked && isBlocked(tx, ty)) {
    const adjCandidates = [
      { x: tx, y: ty - 1 },
      { x: tx, y: ty + 1 },
      { x: tx - 1, y: ty },
      { x: tx + 1, y: ty },
      { x: tx - 1, y: ty - 1 },
      { x: tx + 1, y: ty - 1 },
      { x: tx - 1, y: ty + 1 },
      { x: tx + 1, y: ty + 1 },
    ].filter(c => c.x >= safeMinX && c.x <= safeMaxX && c.y >= safeMinY && c.y <= safeMaxY && !isBlocked(c.x, c.y));

    if (adjCandidates.length > 0) {
      adjCandidates.sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy));
      tx = adjCandidates[0].x;
      ty = adjCandidates[0].y;
      if (sx === tx && sy === ty) return [];
    }
  }

  // 32-bit integer encoding supporting coords from -20,000 to +40,000
  const encode = (x: number, y: number) => (((x + 20000) & 0xffff) << 16) | ((y + 20000) & 0xffff);
  const decode = (code: number) => ({ x: ((code >>> 16) & 0xffff) - 20000, y: (code & 0xffff) - 20000 });

  const startCode = encode(sx, sy);
  const targetCode = encode(tx, ty);

  // Octile distance heuristic for 8-directional movement
  const heuristic = (x: number, y: number): number => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };

  const heap = new MinBinaryHeap<{ x: number; y: number; code: number }>();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();

  gScore.set(startCode, 0);
  heap.push(heuristic(sx, sy), { x: sx, y: sy, code: startCode });

  const directions = [
    { dx: 0, dy: -1, cost: 1.0 },
    { dx: 0, dy: 1, cost: 1.0 },
    { dx: -1, dy: 0, cost: 1.0 },
    { dx: 1, dy: 0, cost: 1.0 },
    { dx: -1, dy: -1, cost: 1.414 },
    { dx: 1, dy: -1, cost: 1.414 },
    { dx: -1, dy: 1, cost: 1.414 },
    { dx: 1, dy: 1, cost: 1.414 },
  ];

  let found = false;
  let steps = 0;
  const MAX_STEPS = 10000;

  while (heap.size > 0 && steps++ < MAX_STEPS) {
    const curr = heap.pop()!;
    if (curr.x === tx && curr.y === ty) {
      found = true;
      break;
    }

    if (visited.has(curr.code)) continue;
    visited.add(curr.code);

    const currG = gScore.get(curr.code) ?? 0;

    for (const d of directions) {
      const nx = clampX(curr.x + d.dx);
      const ny = clampY(curr.y + d.dy);

      // Check collision
      if (isBlocked && isBlocked(nx, ny)) {
        continue;
      }

      // Corner-cutting check for diagonal moves:
      if (d.dx !== 0 && d.dy !== 0 && isBlocked) {
        if (isBlocked(curr.x + d.dx, curr.y) && isBlocked(curr.x, curr.y + d.dy)) {
          continue;
        }
      }

      const nCode = encode(nx, ny);
      if (visited.has(nCode)) continue;

      const tentG = currG + d.cost;
      const prevG = gScore.get(nCode);

      if (prevG === undefined || tentG < prevG) {
        gScore.set(nCode, tentG);
        cameFrom.set(nCode, curr.code);
        heap.push(tentG + heuristic(nx, ny), { x: nx, y: ny, code: nCode });
      }
    }
  }

  if (!found) return [];

  // Reconstruct path
  const path: Array<{ x: number; y: number }> = [];
  let curr = targetCode;
  while (curr !== startCode) {
    path.push(decode(curr));
    const prev = cameFrom.get(curr);
    if (prev === undefined) break;
    curr = prev;
  }

  return path.reverse();
}

/**
 * Combat Chance To Hit Formula:
 * Chance = Accuracy / (Accuracy + Evasion)
 */
export function calculateHitChance(accuracy: number, evasion: number): number {
  if (!Number.isFinite(accuracy) || !Number.isFinite(evasion) || accuracy <= 0 || (accuracy + evasion) <= 0) return 0.05;
  return Math.min(0.95, Math.max(0.05, accuracy / (accuracy + evasion)));
}

/**
 * Max Hit Formula:
 * 1 + floor((Level + GearStrength) / 8) - TargetArmour, never below 1
 */
export function calculateMaxHit(level: number, gearStrength: number, targetArmour: number = 0): number {
  const lvl = Number.isFinite(level) ? level : 1;
  const str = Number.isFinite(gearStrength) ? gearStrength : 0;
  const arm = Number.isFinite(targetArmour) ? targetArmour : 0;
  const raw = 1 + Math.floor((lvl + str) / 8);
  return Math.max(1, raw - arm);
}

/**
 * Returns the XP multiplier bonus for a given skill if the equipped aura matches.
 * e.g. 0.05 (+5%), 0.10 (+10%), or 0.15 (+15%).
 */
export function getAuraXpMultiplier(auraItemId: string | undefined, skill: SkillType): number {
  const def = getSafeItem(auraItemId);
  if (!def || def.category !== 'aura' || !def.auraBuff) return 0;
  if (def.auraBuff.skill === skill) {
    return def.auraBuff.xpMultiplier;
  }
  return 0;
}

/**
 * Calculates effective combat and defence stats for an equipped item,
 * applying rarity multiplier (plain: 1.0, uncommon: 1.3, rare: 1.6, epic: 2.2, legendary: 3.0)
 * and enhancement plus scaling.
 */
export function getItemEffectiveStats(
  baseStats: {
    accuracy?: number;
    strength?: number;
    defence?: number;
    meleeStrength?: number;
    rangedStrength?: number;
    magicStrength?: number;
    attackSpeedBonus?: number;
    swingSpeedSeconds?: number;
    toolSpeedBonus?: number;
    healing?: number;
  } | undefined,
  rarity: Rarity = 'plain',
  plus: number = 0
) {
  if (!baseStats) return {};
  const mult = (RARITY_STAT_MULTIPLIER[rarity] || 1.0) * (1 + 0.05 * (plus || 0));
  const scale = (val?: number) => (val ? Math.max(1, Math.round(val * mult)) : 0);
  return {
    accuracy: scale(baseStats.accuracy),
    strength: scale(baseStats.strength),
    defence: scale(baseStats.defence),
    meleeStrength: scale(baseStats.meleeStrength),
    rangedStrength: scale(baseStats.rangedStrength),
    magicStrength: scale(baseStats.magicStrength),
    attackSpeedBonus: baseStats.attackSpeedBonus || 0,
    swingSpeedSeconds: baseStats.swingSpeedSeconds,
    toolSpeedBonus: baseStats.toolSpeedBonus,
    healing: baseStats.healing,
  };
}

/**
 * Rarity Roll based on luck bonus from tools and amulets.
 */
export function rollRarity(luckMultiplier: number = 1.0): Rarity {
  const rand = Math.random();
  const legendaryChance = RARITY_CHANCES.legendary * luckMultiplier;
  if (rand < legendaryChance) return 'legendary';

  const epicChance = RARITY_CHANCES.epic * luckMultiplier;
  if (rand < epicChance) return 'epic';

  const rareChance = RARITY_CHANCES.rare * luckMultiplier;
  if (rand < rareChance) return 'rare';

  const uncommonChance = RARITY_CHANCES.uncommon * luckMultiplier;
  if (rand < uncommonChance) return 'uncommon';

  return 'plain';
}

export interface CatchUpSummary {
  elapsedSeconds: number;
  completedCycles: number;
  xpGained: number;
  leveledUp: boolean;
  skillName?: string;
  startLevel?: number;
  newLevel?: number;
  levelUps?: Array<{ skillName: string; startLevel: number; newLevel: number }>;
  itemsGained: Record<string, number>;
  overflowOccurred: boolean;
}

/**
 * Formats a duration in seconds into a clean human readable string (e.g. 24h 00m, 24h 15m).
 */
export function formatOfflineDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h 00m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Helper to check whether player already owns a vanity pet across equipment, inventory, storage, or overflow.
 */
export function playerOwnsPet(player: PlayerData, petItemId: string): boolean {
  if (player.equipment?.pet?.itemId === petItemId) return true;
  if (player.inventory?.some(s => s.itemId === petItemId)) return true;
  if (player.storage?.some(s => s.itemId === petItemId)) return true;
  if (player.overflowTray?.some(s => s.itemId === petItemId)) return true;
  return false;
}

/**
 * Unified helper to grant items during offline simulation:
 * Routes to Inventory -> Storage (Bank) -> Overflow Tray, and handles duplicate Pet prevention.
 * Returns false only if all three containers are 100% full.
 */
function grantOfflineItem(
  player: PlayerData,
  summary: CatchUpSummary,
  itemId: string,
  quantity: number,
  rarity: Rarity = 'plain',
  plus: number = 0
): boolean {
  if (quantity <= 0) return true;

  if (itemId === 'gold') {
    player.gold = (player.gold || 0) + quantity;
    summary.itemsGained['gold'] = (summary.itemsGained['gold'] || 0) + quantity;
    return true;
  }

  const itemDef = getSafeItem(itemId);
  if (!itemDef) return true;

  const isPet = itemDef.category === 'pet' || itemId.startsWith('pet_');
  if (isPet) {
    if (playerOwnsPet(player, itemId)) return true;
    if (!player.equipment) player.equipment = {};
    if (!player.equipment.pet) {
      player.equipment.pet = { itemId, quantity: 1, rarity: 'plain', plus: 0 };
      summary.itemsGained[itemId] = (summary.itemsGained[itemId] || 0) + 1;
      return true;
    }
    quantity = 1;
    rarity = 'plain';
    plus = 0;
  }

  if (!Array.isArray(player.inventory)) player.inventory = [];
  if (!Array.isArray(player.storage)) player.storage = [];

  const invRes = addItemToSlots(player.inventory, 28, itemId, quantity, rarity, plus, itemDef, 'inventory');
  let remainder = invRes.remainder;

  if (remainder > 0) {
    const maxStorage = player.storageSlotsMax || DEFAULT_STORAGE_SLOTS;
    const bankRes = addItemToSlots(player.storage, maxStorage, itemId, remainder, rarity, plus, itemDef, 'bank');
    remainder = bankRes.remainder;

    if (remainder > 0) {
      summary.overflowOccurred = true;
      if (!player.overflowTray) player.overflowTray = [];
      const traySlot = player.overflowTray.find(
        s => s.itemId === itemId && (s.rarity || 'plain') === rarity && (s.plus || 0) === plus
      );
      if (traySlot) {
        traySlot.quantity += remainder;
        remainder = 0;
      } else if (player.overflowTray.length < OVERFLOW_TRAY_SLOTS) {
        player.overflowTray.push({
          itemId,
          quantity: remainder,
          rarity,
          plus,
        });
        remainder = 0;
      }
    }
  }

  const actualAdded = quantity - remainder;
  if (actualAdded > 0) {
    summary.itemsGained[itemId] = (summary.itemsGained[itemId] || 0) + actualAdded;
  }

  return remainder === 0;
}

/**
 * Deterministic Offline Catch-Up Engine:
 * Simulates actions while player was away without running 600ms loops in real-time.
 * Automatically advances through queued tasks when currentTask completes its target quantity.
 */
export function simulateOfflineCatchUp(
  player: PlayerData,
  elapsedSeconds: number,
  maxOfflineSeconds?: number
): CatchUpSummary {
  const effectiveMaxSeconds = maxOfflineSeconds ?? player.maxOfflineSeconds ?? (24 * 3600);
  let remainingTime = Math.min(Math.max(0, elapsedSeconds), effectiveMaxSeconds);

  const summary: CatchUpSummary = {
    elapsedSeconds: remainingTime,
    completedCycles: 0,
    xpGained: 0,
    leveledUp: false,
    levelUps: [],
    itemsGained: {},
    overflowOccurred: false,
  };

  // 1. Advance Farming Plots (offline growth proceeds at 1.0x standard rate)
  if (player.farmPlots && remainingTime > 0) {
    const now = Date.now();
    for (const plot of Object.values(player.farmPlots)) {
      if (plot && plot.status === 'growing') {
        plot.effectiveProgressSeconds = (plot.effectiveProgressSeconds || 0) + remainingTime;
        plot.lastUpdated = now;
        if (plot.effectiveProgressSeconds >= plot.baseDurationSeconds) {
          plot.status = 'ready';
        }
      }
    }
  }

  // Helper to shift the next valid task from player.taskQueue
  const advanceTaskFromQueue = (): boolean => {
    if (!Array.isArray(player.taskQueue) || player.taskQueue.length === 0) return false;
    const next = player.taskQueue.shift()!;
    const mobId = next.monsterId || next.recipeId;
    const isCombat = Boolean(
      next.monsterId ||
      (next.skill as string) === 'combat' ||
      getSafeMonster(mobId)
    );
    player.currentTask = {
      recipeId: isCombat ? mobId : next.recipeId,
      skill: next.skill,
      startedAtTick: 0,
      targetQuantity: getEffectiveTargetQuantity(next.targetQuantity),
      completedQuantity: 0,
    };
    return true;
  };

  // If player went offline during auto-banking or commute, restore active task from bankReturnTask
  if (!player.currentTask && player.bankReturnTask) {
    player.currentTask = {
      ...player.bankReturnTask,
      targetQuantity: getEffectiveTargetQuantity(player.bankReturnTask.targetQuantity),
    };
    player.bankReturnTask = null;
    player.bankingState = 'idle';
  }

  // If player went offline while walking to their chosen node, restore active task from pendingTask
  if (!player.currentTask && player.pendingTask) {
    const pt = player.pendingTask;
    const rec = getSafeRecipe(pt.recipeId);
    const mob = getSafeMonster(pt.recipeId);
    if (rec || mob) {
      player.currentTask = {
        recipeId: pt.recipeId,
        skill: rec ? rec.skill : 'melee',
        startedAtTick: 0,
        targetQuantity: getEffectiveTargetQuantity(pt.quantity),
        completedQuantity: 0,
      };
      player.pendingTask = null;
    }
  }

  // If no active task currently, try to start the first task in queue
  if (!player.currentTask) {
    advanceTaskFromQueue();
  }

  if (!player.currentTask || remainingTime <= 0) {
    return summary;
  }

  // Loop while player has time left and an active task
  while (player.currentTask && remainingTime > 0.5) {
    const taskId = player.currentTask.recipeId;
    const recipe = getSafeRecipe(taskId);
    const monster = getSafeMonster(taskId);

    if (!recipe && !monster) {
      player.currentTask = null;
      if (advanceTaskFromQueue()) {
        continue;
      }
      break;
    }

    if (monster) {
      const combatStyle = (player.currentTask.skill === 'ranged' || player.currentTask.skill === 'magic')
        ? player.currentTask.skill
        : 'melee';
      const combatLvl = player.skills[combatStyle]?.level || 1;
      const weaponItem = getSafeItem(player.equipment?.weapon?.itemId);

      let gearAccuracy = 0;
      let gearStrength = 0;
      let gearSpeedBonus = 0;
      let gearDefence = 0;

      for (const eq of Object.values(player.equipment || {})) {
        if (eq) {
          const it = getSafeItem(eq.itemId);
          if (it?.baseStats) {
            const eff = getItemEffectiveStats(it.baseStats, eq.rarity || 'plain', eq.plus || 0);
            if (eff.accuracy) gearAccuracy += eff.accuracy;
            if (eff.strength) gearStrength += eff.strength;
            if (combatStyle === 'melee' && eff.meleeStrength) gearStrength += eff.meleeStrength;
            if (combatStyle === 'ranged' && eff.rangedStrength) gearStrength += eff.rangedStrength;
            if (combatStyle === 'magic' && eff.magicStrength) gearStrength += eff.magicStrength;
            if (eff.attackSpeedBonus) gearSpeedBonus += eff.attackSpeedBonus;
            if (eff.defence) gearDefence += eff.defence;
          }
        }
      }

      // 1. Calculate Player DPS matching live processCombatCycle
      const playerHitChance = calculateHitChance(combatLvl * 2 + gearAccuracy + 10, monster.level * 3);
      const monsterArmour = Math.floor(monster.level / 6);
      const playerMaxHit = calculateMaxHit(combatLvl, gearStrength, monsterArmour);
      const avgPlayerHit = playerHitChance * ((1 + playerMaxHit) / 2);

      const baseSwingSec = weaponItem?.baseStats?.swingSpeedSeconds || (combatStyle === 'ranged' ? 1.8 : combatStyle === 'magic' ? 3.6 : 2.4);
      const playerSwingSec = Math.max(1.2, baseSwingSec / (1 + gearSpeedBonus));

      // Expected swings needed to kill the monster (at least 1 swing)
      const expectedSwingsToKill = Math.max(1, Math.ceil(monster.hp / Math.max(0.5, avgPlayerHit)));
      const fightSec = expectedSwingsToKill * playerSwingSec;
      // In live combat, monsters have a zone respawn timer / search delay between kills (~2.5 seconds)
      const killSec = fightSec + 2.5;

      // 2. Calculate Monster Expected Damage taken per kill
      const defLevel = player.skills.defence?.level || 1;
      const monsterHitChance = calculateHitChance(monster.level * 3, defLevel * 2 + gearDefence);
      const monsterSwingSec = monster.swingSpeedSeconds || 2.4;
      const monsterSwingsPerFight = Math.floor(fightSec / monsterSwingSec);
      const avgMonsterDamagePerKill = monster.maxHit > 0
        ? Math.round(monsterSwingsPerFight * monsterHitChance * ((1 + monster.maxHit) / 2))
        : 0;

      const targetQuantity = getEffectiveTargetQuantity(player.currentTask.targetQuantity);
      player.currentTask.targetQuantity = targetQuantity;
      const remainingTarget = targetQuantity === Infinity
        ? Infinity
        : Math.max(0, targetQuantity - (player.currentTask.completedQuantity || 0));

      const potentialKills = Math.floor(remainingTime / killSec);
      const killsToExecute = Math.min(potentialKills, remainingTarget);

      if (killsToExecute <= 0) break;

      let executed = 0;
      let totalStyleXp = 0;
      let totalHpXp = 0;

      const findFoodInSlots = (slots: InventorySlot[]): number => {
        if (player.selectedFoodItemId) {
          const prefIdx = slots.findIndex(
            s => s.itemId === player.selectedFoodItemId && s.quantity > 0 && (getSafeItem(s.itemId)?.baseStats?.healing || 0) > 0
          );
          if (prefIdx !== -1) return prefIdx;
        }
        return slots.findIndex(s => s.quantity > 0 && (getSafeItem(s.itemId)?.baseStats?.healing || 0) > 0);
      };

      for (let i = 0; i < killsToExecute; i++) {
        // Sustenance check: handle food consumption based on actual monster damage taken
        if (avgMonsterDamagePerKill > 0) {
          let damageToHeal = avgMonsterDamagePerKill;
          while (damageToHeal > 0) {
            let foodIndex = findFoodInSlots(player.inventory);

            // If out of food in bag, check if bank has cooked food to restock (simulating auto-banking trip)
            if (foodIndex === -1 && Array.isArray(player.storage)) {
              const bankFoodIndex = findFoodInSlots(player.storage);
              if (bankFoodIndex >= 0) {
                const bSlot = player.storage[bankFoodIndex];
                const foodDef = getSafeItem(bSlot.itemId);
                const toTake = Math.min(bSlot.quantity, 15);
                const addRes = addItemToSlots(player.inventory, 28, bSlot.itemId, toTake, bSlot.rarity || 'plain', bSlot.plus || 0, foodDef, 'inventory');
                if (addRes.added > 0) {
                  bSlot.quantity -= addRes.added;
                  if (bSlot.quantity <= 0) player.storage.splice(bankFoodIndex, 1);
                  foodIndex = findFoodInSlots(player.inventory);
                }
              }
            }

            if (foodIndex === -1) {
              // Out of food in both satchel and bank: player cannot sustain combat further
              break;
            }

            const foodSlot = player.inventory[foodIndex];
            const foodDef = getSafeItem(foodSlot.itemId);
            const healMult = RARITY_HEALING_MULTIPLIER[foodSlot.rarity || 'plain'] || 1.0;
            const healAmount = Math.max(1, Math.round((foodDef?.baseStats?.healing || 5) * healMult));
            foodSlot.quantity -= 1;
            damageToHeal = Math.max(0, damageToHeal - healAmount);
            if (foodSlot.quantity <= 0) {
              player.inventory.splice(foodIndex, 1);
            }
          }

          // If still unresolved damage and no food left in bag or bank, player retreats from combat
          if (damageToHeal > 0) {
            const hasAnyFoodInBag = findFoodInSlots(player.inventory) !== -1;
            const hasAnyFoodInBank = Array.isArray(player.storage) && findFoodInSlots(player.storage) !== -1;
            if (!hasAnyFoodInBag && !hasAnyFoodInBank) {
              break;
            }
          }
        }

        const coins = Math.floor((monster.minCoins + monster.maxCoins) / 2);
        grantOfflineItem(player, summary, 'gold', coins);

        if (monster.guaranteedDropItemId) {
          grantOfflineItem(player, summary, monster.guaranteedDropItemId, 1, 'plain', 0);
        }

        // Roll rare drop for offline combat
        if (monster.rareDrop && Math.random() < monster.rareDrop.chance) {
          grantOfflineItem(player, summary, monster.rareDrop.itemId, 1, 'plain', 0);
        }

        // Roll dungeon keystone key drop for offline combat
        if (monster.keyDrop && Math.random() < monster.keyDrop.chance) {
          grantOfflineItem(player, summary, monster.keyDrop.itemId, 1, 'plain', 0);
        }

        const auraMult = 1.0 + getAuraXpMultiplier(player.equipment?.aura?.itemId, combatStyle);
        totalStyleXp += Math.round(((monster.hp * 4) + monster.xp) * auraMult);
        const hpAuraMult = 1.0 + getAuraXpMultiplier(player.equipment?.aura?.itemId, 'hitpoints');
        totalHpXp += Math.round(Math.floor(monster.hp * 1.33) * hpAuraMult);
        executed++;

        // If satchel is full of monster drops, auto-bank them into storage (matching live server loop)
        if (player.inventory.length >= 28) {
          const maxStorage = player.storageSlotsMax || DEFAULT_STORAGE_SLOTS;
          const keep: InventorySlot[] = [];
          for (const s of player.inventory) {
            const d = getSafeItem(s.itemId);
            if (d?.category === 'steed' || d?.category === 'tool' || (d?.baseStats?.healing || 0) > 0) {
              keep.push(s);
            } else {
              const bRes = addItemToSlots(player.storage, maxStorage, s.itemId, s.quantity, s.rarity || 'plain', s.plus || 0, d, 'bank');
              if (bRes.remainder > 0) {
                keep.push({ ...s, quantity: bRes.remainder });
              }
            }
          }
          player.inventory = keep;
          // If satchel and bank are both completely full and no food left, stop combat
          if (player.inventory.length >= 28) {
            break;
          }
        }
      }

      // Deplete equipped aura duration if active
      if (player.equipment?.aura && executed > 0) {
        const elapsedCombatSeconds = executed * killSec;
        const currentRemaining = player.equipment.aura.remainingSeconds ?? (getSafeItem(player.equipment.aura.itemId)?.auraBuff?.durationSeconds || 1800);
        const newRemaining = Math.max(0, currentRemaining - elapsedCombatSeconds);
        if (newRemaining <= 0) {
          delete player.equipment.aura;
        } else {
          player.equipment.aura.remainingSeconds = Math.round(newRemaining);
        }
      }

      summary.completedCycles += executed;
      summary.xpGained += totalStyleXp;
      player.currentTask.completedQuantity = (player.currentTask.completedQuantity || 0) + executed;
      remainingTime = Math.max(0, remainingTime - (executed * killSec));

      const styleRecord = player.skills[combatStyle];
      if (styleRecord) {
        const oldLevel = styleRecord.level;
        styleRecord.xp += totalStyleXp;
        styleRecord.level = getLevelFromXp(styleRecord.xp);
        if (styleRecord.level > oldLevel) {
          summary.leveledUp = true;
          summary.skillName = combatStyle;
          summary.startLevel = oldLevel;
          summary.newLevel = styleRecord.level;
          summary.levelUps!.push({ skillName: combatStyle, startLevel: oldLevel, newLevel: styleRecord.level });
        }
      }

      if (player.skills.hitpoints) {
        const oldHp = player.skills.hitpoints.level;
        player.skills.hitpoints.xp = Math.max(1154, (player.skills.hitpoints.xp || 1154) + totalHpXp);
        player.skills.hitpoints.level = Math.max(10, getLevelFromXp(player.skills.hitpoints.xp));
        if (player.skills.hitpoints.level > oldHp) {
          summary.leveledUp = true;
          summary.levelUps!.push({ skillName: 'hitpoints', startLevel: oldHp, newLevel: player.skills.hitpoints.level });
        }
      }

      // If target fulfilled or bag full, advance or exit
      if (targetQuantity !== Infinity && player.currentTask.completedQuantity >= targetQuantity) {
        player.currentTask = null;
        if (advanceTaskFromQueue()) {
          continue;
        }
      }
      break;
    }

    // Non-combat recipe task
    if (!recipe) {
      player.currentTask = null;
      if (advanceTaskFromQueue()) {
        continue;
      }
      break;
    }

    const activeTask = player.currentTask;
    const currentLevel = player.skills[recipe.skill]?.level || 1;
    const speedMult = getJobSpeedMultiplier(currentLevel, recipe.levelReq);

    let toolBonus = 0;
    let toolLuckMultiplier = 1.0;
    let equippedTool: InventorySlot | undefined;
    if (recipe.skill === 'mining') {
      equippedTool = player.equipment?.tool_pickaxe || player.equipment?.tool;
    } else if (recipe.skill === 'woodcutting') {
      equippedTool = player.equipment?.tool_axe || player.equipment?.tool;
    } else if (recipe.skill === 'fishing') {
      equippedTool = player.equipment?.tool_rod || player.equipment?.tool;
    }
    if (equippedTool) {
      const toolDef = getSafeItem(equippedTool.itemId);
      if (toolDef?.baseStats?.toolSpeedBonus) {
        toolBonus += toolDef.baseStats.toolSpeedBonus;
      }
      if (equippedTool.rarity) {
        toolBonus += (RARITY_TOOL_BONUS[equippedTool.rarity] || 0);
        toolLuckMultiplier += (RARITY_TOOL_LUCK[equippedTool.rarity] || 0);
      }
    }

    // Add tool speed bonuses from other equipped items (e.g. Ring of the Prospector)
    for (const [slotKey, eq] of Object.entries(player.equipment || {})) {
      if (eq && !slotKey.startsWith('tool') && slotKey !== 'weapon') {
        const item = getSafeItem(eq.itemId);
        if (item?.baseStats?.toolSpeedBonus) {
          toolBonus += item.baseStats.toolSpeedBonus;
        }
      }
    }

    const effectiveInterval = Math.max(0.6, recipe.intervalSeconds / (speedMult * (1 + toolBonus)));

    const targetQuantity = getEffectiveTargetQuantity(activeTask.targetQuantity);
    activeTask.targetQuantity = targetQuantity;

    const potentialCycles = Math.floor(remainingTime / effectiveInterval);
    const remainingTarget = targetQuantity === Infinity
      ? Infinity
      : Math.max(0, targetQuantity - (activeTask.completedQuantity || 0));

    const cyclesToExecute = Math.min(potentialCycles, remainingTarget);
    if (cyclesToExecute <= 0) break;

    let totalXp = 0;
    let executed = 0;
    let materialsDepleted = false;

    for (let i = 0; i < cyclesToExecute; i++) {
      let xpMult = 1.0;

      // Check Thieving catch rate / stun penalty
      if (recipe.thiefCatchRate) {
        const thiefLvl = player.skills.thieving?.level || 1;
        const { startLevel, startRate, neverCaughtLevel, benchPenaltySeconds } = recipe.thiefCatchRate;
        let catchRate = 0;
        if (thiefLvl < neverCaughtLevel) {
          if (thiefLvl <= startLevel) {
            catchRate = startRate;
          } else {
            const progress = (thiefLvl - startLevel) / Math.max(1, neverCaughtLevel - startLevel);
            catchRate = Math.max(0, startRate * (1 - progress));
          }
        }
        if (catchRate > 0 && Math.random() < catchRate) {
          // Player got caught: deduct penalty duration and skip reward/XP for this cycle
          remainingTime = Math.max(0, remainingTime - benchPenaltySeconds);
          if (remainingTime <= 0) break;
          continue;
        }
      }

      // Check Anima currency if recipe requires it
      if (recipe.animaCost) {
        if ((player.anima || 0) < recipe.animaCost) {
          materialsDepleted = true;
          break;
        }
      }

      // Check material inputs for crafting
      if (recipe.inputs.length > 0) {
        let canAfford = true;
        for (const input of recipe.inputs) {
          const totalInBag = player.inventory.reduce((sum, s) => s.itemId === input.itemId ? sum + s.quantity : sum, 0);
          if (totalInBag < input.quantity) {
            // Check if player has the materials in storage to restock
            const totalInBank = (player.storage || []).reduce((sum, s) => s.itemId === input.itemId ? sum + s.quantity : sum, 0);
            if (totalInBank >= input.quantity) {
              // Deduct realistic banking transit commute (matching the ~12-15s round-trip hike to Hearth)
              remainingTime = Math.max(0, remainingTime - 12);
              if (remainingTime <= 0) {
                canAfford = false;
                break;
              }
              // Transfer from storage to inventory for simulation
              let neededFromBank = input.quantity;
              for (const bSlot of player.storage) {
                if (bSlot.itemId === input.itemId) {
                  const take = Math.min(bSlot.quantity, neededFromBank);
                  bSlot.quantity -= take;
                  neededFromBank -= take;
                  const itemDef = getSafeItem(input.itemId);
                  addItemToSlots(player.inventory, 28, input.itemId, take, bSlot.rarity || 'plain', bSlot.plus || 0, itemDef, 'inventory');
                  if (neededFromBank <= 0) break;
                }
              }
              player.storage = player.storage.filter(s => s.quantity > 0);
            } else {
              canAfford = false;
              break;
            }
          }
        }
        if (!canAfford) {
          materialsDepleted = true;
          break;
        }

        let highestInputRarity: Rarity = 'plain';
        const rarityRank: Record<Rarity, number> = { plain: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

        // Deduct materials from inventory (handling multiple partial slots)
        for (const input of recipe.inputs) {
          let needed = input.quantity;
          for (const slot of player.inventory) {
            if (slot.itemId === input.itemId) {
              const slotRarity = slot.rarity || 'plain';
              if (rarityRank[slotRarity] > rarityRank[highestInputRarity]) {
                highestInputRarity = slotRarity;
              }
              const take = Math.min(slot.quantity, needed);
              slot.quantity -= take;
              needed -= take;
              if (needed <= 0) break;
            }
          }
        }
        // Clean up empty slots
        player.inventory = player.inventory.filter(s => s.quantity > 0);
        xpMult = RARITY_CRAFT_XP_MULTIPLIER[highestInputRarity] || 1.0;
      }

      if (recipe.animaCost) {
        player.anima = Math.max(0, (player.anima || 0) - recipe.animaCost);
      }

      // Check Cooking burn rate (inputs are consumed, but burned food yields no item or XP)
      if (recipe.burnRateAtLevel) {
        const cookLvl = player.skills.cooking?.level || 1;
        const { startLevel, startBurnRate, stopBurnLevel } = recipe.burnRateAtLevel;
        if (cookLvl < stopBurnLevel) {
          const progress = Math.max(0, (cookLvl - startLevel) / Math.max(1, stopBurnLevel - startLevel));
          const burnChance = Math.max(0, startBurnRate * (1 - progress));
          if (Math.random() < burnChance) {
            executed++;
            continue;
          }
        }
      }

      // Add output item
      if (recipe.outputItemId === 'gold') {
        grantOfflineItem(player, summary, 'gold', recipe.outputQuantity);
      } else {
        const rarity = rollRarity(toolLuckMultiplier);
        const canFit = grantOfflineItem(player, summary, recipe.outputItemId, recipe.outputQuantity, rarity, 0);
        if (!canFit) {
          break;
        }
      }

      // Roll rare finds (bonus seed returns, vanity pets, gems, etc.)
      if (recipe.rareFinds) {
        for (const rf of recipe.rareFinds) {
          if (Math.random() < rf.chance) {
            grantOfflineItem(player, summary, rf.itemId, 1, 'plain', 0);
          }
        }
      }

      const auraMult = 1.0 + getAuraXpMultiplier(player.equipment?.aura?.itemId, recipe.skill);
      totalXp += Math.max(1, Math.round(recipe.xp * xpMult * auraMult));
      executed++;
    }

    // Deplete equipped aura duration if active
    if (player.equipment?.aura && executed > 0) {
      const elapsedWorkSeconds = executed * effectiveInterval;
      const currentRemaining = player.equipment.aura.remainingSeconds ?? (getSafeItem(player.equipment.aura.itemId)?.auraBuff?.durationSeconds || 1800);
      const newRemaining = Math.max(0, currentRemaining - elapsedWorkSeconds);
      if (newRemaining <= 0) {
        delete player.equipment.aura;
      } else {
        player.equipment.aura.remainingSeconds = Math.round(newRemaining);
      }
    }

    summary.completedCycles += executed;
    summary.xpGained += totalXp;
    activeTask.completedQuantity = (activeTask.completedQuantity || 0) + executed;
    remainingTime = Math.max(0, remainingTime - (executed * effectiveInterval));

    // Apply XP & check level up
    const skillRecord = player.skills[recipe.skill];
    if (skillRecord) {
      const oldLevel = skillRecord.level;
      skillRecord.xp += totalXp;
      skillRecord.level = getLevelFromXp(skillRecord.xp);
      if (skillRecord.level > oldLevel) {
        summary.leveledUp = true;
        summary.skillName = recipe.skill;
        summary.startLevel = oldLevel;
        summary.newLevel = skillRecord.level;
        summary.levelUps!.push({ skillName: recipe.skill, startLevel: oldLevel, newLevel: skillRecord.level });
      }
    }

    // Check if task finished its target quantity or ran out of materials
    const isTargetReached = targetQuantity !== Infinity && activeTask.completedQuantity >= targetQuantity;
    if (isTargetReached || materialsDepleted) {
      player.currentTask = null;
      player.bankReturnTask = null;
      if (advanceTaskFromQueue()) {
        continue;
      }
    }

    break;
  }

  return summary;
}

/**
 * Calculates the graduated gold cost to expand Hearth Vault storage by +5 slots.
 * Scales smoothly to provide a perpetual gold sink across character progression.
 */
export function getStorageSlotUpgradeCost(currentSlots: number): number {
  const tier = Math.max(0, Math.floor(((currentSlots || 75) - 75) / 5));
  const costs = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
  if (tier < costs.length) return costs[tier];
  return 100000 + (tier - costs.length + 1) * 50000;
}