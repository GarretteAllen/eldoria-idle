// Canonical Old School RuneScape (OSRS) Experience & Level System
// Reference: https://oldschool.runescape.wiki/w/Experience
// Mathematical formula: Experience(L) = floor( 1/4 * sum_{l=1}^{L-1} floor( l + 300 * 2^(l/7) ) )

export const MAX_LEVEL = 99; // Classic OSRS skill cap
export const MAX_VIRTUAL_LEVEL = 126; // OSRS virtual level cap before 200M XP
export const MAX_XP = 200_000_000; // Classic 200,000,000 XP cap

/**
 * Calculates the exact cumulative experience required to reach level L
 * according to the canonical Old School RuneScape formula.
 */
export function calculateOsrsXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(total / 4);
}

export const LEVEL_MILESTONES: Record<number, number> = {
  1: 0,
  2: 83,
  3: 174,
  4: 276,
  5: 388,
  6: 512,
  7: 650,
  8: 801,
  9: 969,
  10: 1154,
  15: 2411,
  20: 4470,
  25: 7842,
  30: 13363,
  35: 22406,
  40: 37224,
  45: 61512,
  50: 101333,
  55: 166636,
  60: 273742,
  65: 449428,
  70: 737627,
  75: 1210421,
  80: 1986068,
  85: 3258594,
  90: 5346332,
  92: 6517253, // Exactly half of 99!
  95: 8771558,
  98: 11805606,
  99: 13034431, // Classic 99 cap
  120: 104273167,
  126: 188884740,
};

// 1-indexed XP table up to level 126 (virtual level cap)
// XP_TABLE[1] = 0, XP_TABLE[2] = 83, ..., XP_TABLE[99] = 13,034,431
export const XP_TABLE: number[] = [0];

(() => {
  for (let lvl = 1; lvl <= MAX_VIRTUAL_LEVEL; lvl++) {
    XP_TABLE.push(calculateOsrsXpForLevel(lvl));
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
