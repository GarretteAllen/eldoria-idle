// Exact Level & XP tables from the Codex
// Level 2 takes 100 xp; each level after asks ~12% more up to 99 (55,485,366 total)
// Beyond 99, compounds ~14% per level up to 241.

export const LEVEL_MILESTONES: Record<number, number> = {
  1: 0,
  2: 100,
  3: 212,
  4: 337,
  5: 478,
  6: 635,
  7: 812,
  8: 1009,
  9: 1230,
  10: 1478,
  11: 1755,
  12: 2065,
  13: 2413,
  14: 2803,
  15: 3239,
  16: 3728,
  17: 4275,
  18: 4888,
  19: 5575,
  20: 6344,
  25: 11816,
  30: 21458,
  35: 38452,
  40: 68401,
  45: 121181,
  50: 214198,
  55: 378125,
  60: 667022,
  65: 1176155,
  70: 2073422,
  75: 3654714,
  80: 6441490,
  85: 11352742,
  90: 20008046,
  95: 35261649,
  98: 49540416,
  99: 55485366,
  100: 61033903,
  110: 186915284,
  120: 674462148,
  130: 2562763195,
  140: 9876277257,
  150: 38201997890,
  160: 147909375566,
  170: 572813259665,
  180: 2218493928967,
  190: 8592323321144,
  200: 33278583467707,
  210: 128890091483878,
  220: 499199745957762,
  230: 1933433375798384,
  240: 7488314487089727,
  241: 8574120085220896
};

// Generate full table up to 99 using exact ~1.12 factor anchored at 99
export const XP_TABLE: number[] = [0, 0]; // 1-indexed

(() => {
  let currentTotal = 0;
  let diff = 100;
  XP_TABLE.push(100); // Level 2
  for (let lvl = 3; lvl <= 99; lvl++) {
    diff = Math.round(diff * 1.12);
    currentTotal = XP_TABLE[lvl - 1] + diff;
    if (LEVEL_MILESTONES[lvl] !== undefined) {
      currentTotal = LEVEL_MILESTONES[lvl];
      diff = currentTotal - XP_TABLE[lvl - 1];
    }
    XP_TABLE.push(currentTotal);
  }
  // Level 100 to 241
  diff = Math.round(55485366 * 0.10); // ~10% slice of 99 journey
  for (let lvl = 100; lvl <= 241; lvl++) {
    currentTotal = XP_TABLE[lvl - 1] + diff;
    if (LEVEL_MILESTONES[lvl] !== undefined) {
      currentTotal = LEVEL_MILESTONES[lvl];
    }
    diff = Math.round(diff * 1.14);
    XP_TABLE.push(currentTotal);
  }
})();

export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1];
  return XP_TABLE[level];
}

export function getLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  let low = 1;
  let high = XP_TABLE.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (XP_TABLE[mid] <= xp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return high;
}

export function getXpToNextLevel(level: number, currentXp: number): { current: number; needed: number; percent: number } {
  const currentLvlXp = getXpForLevel(level);
  const nextLvlXp = getXpForLevel(level + 1);
  const needed = nextLvlXp - currentLvlXp;
  const progress = Math.max(0, currentXp - currentLvlXp);
  const percent = needed > 0 ? Math.min(100, Math.floor((progress / needed) * 100)) : 100;
  return { current: progress, needed, percent };
}

/**
 * Every level above a job's requirement makes that job 0.5% faster.
 */
export function getJobSpeedMultiplier(playerLevel: number, reqLevel: number): number {
  if (playerLevel <= reqLevel) return 1.0;
  const extraLevels = playerLevel - reqLevel;
  return 1.0 + extraLevels * 0.005;
}
