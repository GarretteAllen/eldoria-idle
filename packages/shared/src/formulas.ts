import { Rarity, RARITY_CHANCES, getSteedWalkSpeedBonus } from './constants.js';
import { getLevelFromXp, getJobSpeedMultiplier } from './levels.js';
import { ITEMS, addItemToSlots } from './items.js';
import { RECIPES } from './recipes.js';
import { MONSTERS } from './monsters.js';
import { PlayerData, InventorySlot, RecipeDefinition, MonsterDefinition } from './types.js';

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
  let remainingTime = Math.min(elapsedSeconds, effectiveMaxSeconds);
  const summary: CatchUpSummary = {
    elapsedSeconds: remainingTime,
    completedCycles: 0,
    xpGained: 0,
    leveledUp: false,
    levelUps: [],
    itemsGained: {},
    overflowOccurred: false,
  };

  // If no active task currently, try to start the first task in queue
  if (!player.currentTask && Array.isArray(player.taskQueue) && player.taskQueue.length > 0) {
    const next = player.taskQueue.shift()!;
    const mobId = next.monsterId || next.recipeId;
    const isCombat = Boolean(next.monsterId || ((next.skill as string) === 'combat') || (mobId && MONSTERS[mobId]));
    player.currentTask = {
      recipeId: isCombat ? mobId : next.recipeId,
      skill: next.skill,
      startedAtTick: 0,
      targetQuantity: (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity,
      completedQuantity: 0,
    };
  }

  if (!player.currentTask || remainingTime <= 0) {
    return summary;
  }

  // Loop while player has time left and an active task
  while (player.currentTask && remainingTime > 0.5) {
    const recipe: RecipeDefinition | undefined = RECIPES[player.currentTask.recipeId];
    const monster: MonsterDefinition | undefined = MONSTERS[player.currentTask.recipeId];
    if (!recipe && !monster) {
      player.currentTask = null;
      // Try next queued task if recipe/monster not found
      if (Array.isArray(player.taskQueue) && player.taskQueue.length > 0) {
        const next = player.taskQueue.shift()!;
        const mobId = next.monsterId || next.recipeId;
        const isCombat = Boolean(next.monsterId || ((next.skill as string) === 'combat') || (mobId && MONSTERS[mobId]));
        player.currentTask = {
          recipeId: isCombat ? mobId : next.recipeId,
          skill: next.skill,
          startedAtTick: 0,
          targetQuantity: (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity,
          completedQuantity: 0,
        };
        continue;
      }
      break;
    }

    if (monster) {
      const combatStyle = (player.currentTask.skill === 'ranged' || player.currentTask.skill === 'magic')
        ? player.currentTask.skill
        : 'melee';
      const combatLvl = player.skills[combatStyle]?.level || 1;
      const weaponItem = player.equipment?.weapon ? ITEMS[player.equipment.weapon.itemId] : undefined;
      const strBonus = weaponItem?.baseStats?.strength || 0;
      const avgHit = Math.max(1, Math.floor((combatLvl + strBonus) / 10) + 1);
      const swingsToKill = Math.ceil(monster.hp / avgHit);
      const swingSec = weaponItem?.baseStats?.swingSpeedSeconds || (combatStyle === 'ranged' ? 1.8 : combatStyle === 'magic' ? 3.6 : 2.4);
      const killSec = Math.max(2.4, swingsToKill * swingSec);

      const rawTarget: number | undefined = player.currentTask.targetQuantity;
      const targetQuantity: number = (typeof rawTarget === 'number' && rawTarget > 0) ? rawTarget : Infinity;
      const remainingTarget: number = targetQuantity === Infinity
        ? Infinity
        : Math.max(0, targetQuantity - (player.currentTask.completedQuantity || 0));
      const potentialKills = Math.floor(remainingTime / killSec);
      const killsToExecute = Math.min(potentialKills, remainingTarget);

      if (killsToExecute <= 0) break;

      let executed = 0;
      let totalStyleXp = 0;
      let totalHpXp = 0;

      for (let i = 0; i < killsToExecute; i++) {
        if (monster.maxHit > 0) {
          const foodSlot = player.inventory.find(s => {
            const def = ITEMS[s.itemId];
            return (def?.baseStats?.healing || 0) > 0;
          });
          if (foodSlot) {
            foodSlot.quantity -= 1;
            player.inventory = player.inventory.filter(s => s.quantity > 0);
          }
        }

        const coins = Math.floor((monster.minCoins + monster.maxCoins) / 2);
        player.gold = (player.gold || 0) + coins;
        summary.itemsGained['gold'] = (summary.itemsGained['gold'] || 0) + coins;

        if (monster.guaranteedDropItemId && ITEMS[monster.guaranteedDropItemId]) {
          const itemDef = ITEMS[monster.guaranteedDropItemId];
          const res = addItemToSlots(player.inventory, 28, monster.guaranteedDropItemId, 1, 'plain', 0, itemDef, 'inventory');
          if (res.remainder > 0) {
            const maxStorage = player.storageSlotsMax || 75;
            const bankRes = addItemToSlots(player.storage, maxStorage, monster.guaranteedDropItemId, res.remainder, 'plain', 0, itemDef, 'bank');
            if (bankRes.remainder > 0) {
              summary.overflowOccurred = true;
            }
          }
          summary.itemsGained[monster.guaranteedDropItemId] = (summary.itemsGained[monster.guaranteedDropItemId] || 0) + 1;
        }

        totalStyleXp += (monster.hp * 4) + monster.xp;
        totalHpXp += Math.floor(monster.hp * 1.33);
        executed++;

        if (player.inventory.length >= 28) {
          break;
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
        if (Array.isArray(player.taskQueue) && player.taskQueue.length > 0) {
          const next = player.taskQueue.shift()!;
          const mobId = next.monsterId || next.recipeId;
          const isCombat = Boolean(next.monsterId || ((next.skill as string) === 'combat') || (mobId && MONSTERS[mobId]));
          player.currentTask = {
            recipeId: isCombat ? mobId : next.recipeId,
            skill: next.skill,
            startedAtTick: 0,
            targetQuantity: (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity,
            completedQuantity: 0,
          };
          continue;
        }
      }

      break;
    }

    // Non-combat recipe task
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

    const rawTarget: number | undefined = player.currentTask.targetQuantity;
    const targetQuantity: number = (typeof rawTarget === 'number' && rawTarget > 0) ? rawTarget : Infinity;
    player.currentTask.targetQuantity = targetQuantity;

    const potentialCycles = Math.floor(remainingTime / effectiveInterval);
    const remainingTarget: number = targetQuantity === Infinity
      ? Infinity
      : Math.max(0, targetQuantity - (player.currentTask.completedQuantity || 0));
    const cyclesToExecute = Math.min(potentialCycles, remainingTarget);

    if (cyclesToExecute <= 0) break;

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
      if (recipe.outputItemId === 'gold') {
        player.gold = (player.gold || 0) + recipe.outputQuantity;
        summary.itemsGained['gold'] = (summary.itemsGained['gold'] || 0) + recipe.outputQuantity;
      } else {
        const outputItem = ITEMS[recipe.outputItemId];
        if (outputItem) {
          const rarity = rollRarity(1.0);
          const invRes = addItemToSlots(player.inventory, 28, recipe.outputItemId, recipe.outputQuantity, rarity, 0, outputItem, 'inventory');
          if (invRes.remainder > 0) {
            summary.overflowOccurred = true;
            const maxStorage = player.storageSlotsMax || 75;
            const bankRes = addItemToSlots(player.storage, maxStorage, recipe.outputItemId, invRes.remainder, rarity, 0, outputItem, 'bank');
            if (bankRes.remainder > 0) {
              if (!player.overflowTray) player.overflowTray = [];
              const traySlot = player.overflowTray.find(s => s.itemId === recipe.outputItemId && s.rarity === rarity && s.plus === 0);
              if (traySlot) {
                traySlot.quantity += bankRes.remainder;
              } else if (player.overflowTray.length < 10) {
                player.overflowTray.push({
                  itemId: recipe.outputItemId,
                  quantity: bankRes.remainder,
                  rarity,
                  plus: 0,
                });
              } else {
                break;
              }
            }
          }
          summary.itemsGained[recipe.outputItemId] = (summary.itemsGained[recipe.outputItemId] || 0) + recipe.outputQuantity;
        }
      }

      totalXp += recipe.xp;
      executed++;
    }

    summary.completedCycles += executed;
    summary.xpGained += totalXp;
    player.currentTask.completedQuantity = (player.currentTask.completedQuantity || 0) + executed;
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

    // Check if task finished its target quantity
    if (targetQuantity !== Infinity && player.currentTask.completedQuantity >= targetQuantity) {
      player.currentTask = null;
      if (Array.isArray(player.taskQueue) && player.taskQueue.length > 0) {
        const next = player.taskQueue.shift()!;
        const mobId = next.monsterId || next.recipeId;
        const isCombat = Boolean(next.monsterId || ((next.skill as string) === 'combat') || (mobId && MONSTERS[mobId]));
        player.currentTask = {
          recipeId: isCombat ? mobId : next.recipeId,
          skill: next.skill,
          startedAtTick: 0,
          targetQuantity: (typeof next.targetQuantity === 'number' && next.targetQuantity > 0) ? next.targetQuantity : Infinity,
          completedQuantity: 0,
        };
        continue;
      }
    }

    break;
  }

  return summary;
}
