export const TICK_MS = 600;

export const MAX_OFFLINE_SECONDS_DEFAULT = 24 * 3600; // 24 hours
export const MAX_OFFLINE_SECONDS_BLESSING = 168 * 3600; // 7 days (168 hours)

export const DEFAULT_STORAGE_SLOTS = 75;
export const OVERFLOW_TRAY_SLOTS = 10;
export const MAX_TASK_QUEUE_DEFAULT = 1;
export const MAX_TASK_QUEUE_MAX = 10;

export type Rarity = 'plain' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_CHANCES: Record<Rarity, number> = {
  plain: 1,
  uncommon: 0.025, // 2.5%
  rare: 1 / 400, // 0.25%
  epic: 1 / 8000,
  legendary: 1 / 150000,
};

export const RARITY_STAT_MULTIPLIER: Record<Rarity, number> = {
  plain: 1.0,
  uncommon: 1.3,
  rare: 1.6,
  epic: 2.2,
  legendary: 3.0,
};

export const RARITY_PRICE_MULTIPLIER: Record<Rarity, number> = {
  plain: 1,
  uncommon: 3,
  rare: 8,
  epic: 20,
  legendary: 50,
};

export const RARITY_TOOL_LUCK: Record<Rarity, number> = {
  plain: 0,
  uncommon: 0.25,
  rare: 0.75,
  epic: 2.00,
  legendary: 5.00,
};

// Enhancing costs and odds
export const TIER_BASE_ENHANCE_COST = [0, 100, 300, 1000, 3000, 8000, 20000];

export function getEnhanceChance(currentPlus: number): number {
  return Math.max(0.20, 1 - currentPlus * 0.06);
}

export function getEnhanceAnimaCost(currentPlus: number): number {
  return 3 * (currentPlus + 1);
}

export function getEnhanceGoldCost(tier: number, rarity: Rarity, currentPlus: number): number {
  const baseCost = TIER_BASE_ENHANCE_COST[tier] || 100;
  const rarityMult = RARITY_PRICE_MULTIPLIER[rarity] || 1;
  return baseCost * rarityMult * (currentPlus + 1);
}

// Steeds (Mounts)
export const STEED_BASE_BONUS: Record<Rarity, number> = {
  plain: 0.12,
  uncommon: 0.18,
  rare: 0.27,
  epic: 0.42,
  legendary: 0.60,
};

export function getSteedWalkSpeedBonus(rarity: Rarity, plus: number): number {
  const base = STEED_BASE_BONUS[rarity] || 0.12;
  return base * (1 + 0.15 * plus);
}
