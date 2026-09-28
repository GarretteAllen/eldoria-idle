import { Rarity, RARITY_CHANCES, getSteedWalkSpeedBonus } from './constants.js';
import { getLevelFromXp, getJobSpeedMultiplier } from './levels.js';
import { ITEMS } from './items.js';
import { RECIPES } from './recipes.js';
import { PlayerData, InventorySlot, RecipeDefinition } from './types.js';

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
    const bonus = getSteedWalkSpeedBonus(steedSlot.rarity || 'plain', steedSlot.plus || 0);
    speed += bonus;
  }

  // Active Potion Buffs
  if (player.activeBuffs) {
    const speedBuff = player.activeBuffs.find(b => b.type === 'speed' && b.expiresAt > Date.now());
    if (speedBuff) {
      speed += speedBuff.value;
    }
  }

  return Number(speed.toFixed(3));
}

/**
 * Grid BFS Pathfinding (8-directional or 4-directional with bounds 0..60).
 */
export function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maxX: number = 60,
  maxY: number = 60
): Array<{ x: number; y: number }> {
  const clampX = (v: number) => Math.max(0, Math.min(maxX, v));
  const clampY = (v: number) => Math.max(0, Math.min(maxY, v));

  const sx = clampX(Math.round(startX));
  const sy = clampY(Math.round(startY));
  const tx = clampX(Math.round(targetX));
  const ty = clampY(Math.round(targetY));

  if (sx === tx && sy === ty) return [];

  // Standard BFS queue
  const queue: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();

  const encode = (x: number, y: number) => y * (maxX + 1) + x;
  const decode = (code: number) => ({ x: code % (maxX + 1), y: Math.floor(code / (maxX + 1)) });

  const startCode = encode(sx, sy);
  const targetCode = encode(tx, ty);
  visited.add(startCode);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  let found = false;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currCode = encode(curr.x, curr.y);

    if (curr.x === tx && curr.y === ty) {
      found = true;
      break;
    }

    for (const d of directions) {
      const nx = clampX(curr.x + d.dx);
      const ny = clampY(curr.y + d.dy);
      const nCode = encode(nx, ny);

      if (!visited.has(nCode)) {
        visited.add(nCode);
        cameFrom.set(nCode, currCode);
        queue.push({ x: nx, y: ny });
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
  if (accuracy <= 0) return 0.05;
  return Math.min(0.95, Math.max(0.05, accuracy / (accuracy + evasion)));
}

/**
 * Max Hit Formula:
 * 1 + floor((Level + GearStrength) / 8) - TargetArmour, never below 1
 */
export function calculateMaxHit(level: number, gearStrength: number, targetArmour: number = 0): number {
  const raw = 1 + Math.floor((level + gearStrength) / 8);
  return Math.max(1, raw - targetArmour);
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
  itemsGained: Record<string, number>;
  overflowOccurred: boolean;
}

/**
 * Deterministic Offline Catch-Up Engine:
 * Simulates actions while player was away without running 600ms loops in real-time.
 */
export function simulateOfflineCatchUp(
  player: PlayerData,
  elapsedSeconds: number,
  maxOfflineSeconds: number = 24 * 3600
): CatchUpSummary {
  const cappedElapsed = Math.min(elapsedSeconds, maxOfflineSeconds);
  const summary: CatchUpSummary = {
    elapsedSeconds: cappedElapsed,
    completedCycles: 0,
    xpGained: 0,
    leveledUp: false,
    itemsGained: {},
    overflowOccurred: false,
  };

  if (!player.currentTask || cappedElapsed <= 0) {
    return summary;
  }

  const recipe: RecipeDefinition | undefined = RECIPES[player.currentTask.recipeId];
  if (!recipe) return summary;

  const currentLevel = player.skills[recipe.skill]?.level || 1;
  const speedMult = getJobSpeedMultiplier(currentLevel, recipe.levelReq);
  const effectiveInterval = Math.max(0.6, recipe.intervalSeconds / speedMult);

  const potentialCycles = Math.floor(cappedElapsed / effectiveInterval);
  const remainingTarget = player.currentTask.targetQuantity - player.currentTask.completedQuantity;
  const cyclesToExecute = Math.min(potentialCycles, remainingTarget);

  if (cyclesToExecute <= 0) return summary;

  let totalXp = 0;
  let executed = 0;

  for (let i = 0; i < cyclesToExecute; i++) {
    // Check material inputs for crafting
    if (recipe.inputs.length > 0) {
      let canAfford = true;
      for (const input of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === input.itemId && s.quantity >= input.quantity);
        if (!slot) {
          canAfford = false;
          break;
        }
      }
      if (!canAfford) break;

      // Deduct materials
      for (const input of recipe.inputs) {
        const slot = player.inventory.find(s => s.itemId === input.itemId)!;
        slot.quantity -= input.quantity;
      }
      // Clean up empty slots
      player.inventory = player.inventory.filter(s => s.quantity > 0);
    }

    // Add output item
    const outputItem = ITEMS[recipe.outputItemId];
    if (outputItem) {
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
        // Inventory full -> Divert to storage or overflow tray
        summary.overflowOccurred = true;
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
        } else {
          // Divert to Overflow Tray (up to 10 slots)
          const traySlot = player.overflowTray.find(s => s.itemId === recipe.outputItemId && s.rarity === rarity && s.plus === 0);
          if (traySlot) {
            traySlot.quantity += recipe.outputQuantity;
          } else if (player.overflowTray.length < 10) {
            player.overflowTray.push({
              itemId: recipe.outputItemId,
              quantity: recipe.outputQuantity,
              rarity,
              plus: 0,
            });
          } else {
            // Both inventory, storage, and overflow tray full -> Halt task
            break;
          }
        }
      }

      summary.itemsGained[recipe.outputItemId] = (summary.itemsGained[recipe.outputItemId] || 0) + recipe.outputQuantity;
    }

    totalXp += recipe.xp;
    executed++;
  }

  summary.completedCycles = executed;
  summary.xpGained = totalXp;
  player.currentTask.completedQuantity += executed;

  // Apply XP & check level up
  const skillRecord = player.skills[recipe.skill];
  if (skillRecord) {
    const oldLevel = skillRecord.level;
    skillRecord.xp += totalXp;
    skillRecord.level = getLevelFromXp(skillRecord.xp);
    if (skillRecord.level > oldLevel) {
      summary.leveledUp = true;
    }
  }

  return summary;
}
