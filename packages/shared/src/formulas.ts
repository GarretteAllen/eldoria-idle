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
/**
 * Grid BFS Pathfinding (8-directional with collision avoidance, unbounded / dynamic map bounds).
 */
export function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  minX: number = -10000,
  minY: number = -10000,
  maxX: number = 10000,
  maxY: number = 10000,
  isBlocked?: (x: number, y: number) => boolean
): Array<{ x: number; y: number }> {
  const clampX = (v: number) => Math.max(minX, Math.min(maxX, v));
  const clampY = (v: number) => Math.max(minY, Math.min(maxY, v));

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
    ].filter(c => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY && !isBlocked(c.x, c.y));

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

  const queue: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  const cameFrom = new Map<number, number>();
  const visited = new Set<number>();

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
  let steps = 0;
  const MAX_STEPS = 8000;

  while (queue.length > 0 && steps++ < MAX_STEPS) {
    const curr = queue.shift()!;
    const currCode = encode(curr.x, curr.y);

    if (curr.x === tx && curr.y === ty) {
      found = true;
      break;
    }

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
