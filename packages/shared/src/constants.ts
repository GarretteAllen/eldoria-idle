export const TICK_MS = 600;

export const MAX_OFFLINE_SECONDS_DEFAULT = 24 * 3600; // 24 hours
export const MAX_OFFLINE_SECONDS_BLESSING = 168 * 3600; // 7 days (168 hours)

export const DEFAULT_STORAGE_SLOTS = 75;
export const OVERFLOW_TRAY_SLOTS = 10;

// Safe static spawn coordinates for all newly created players & guests
export const PLAYER_SPAWN_POINT = {
  x: 12,
  y: 22,
};

// Offline Progression Time Configuration
export const OFFLINE_TIME_CONFIG = {
  BASE_SECONDS: 24 * 3600, // 24 hours default base
  INCREMENT_SECONDS: 15 * 60, // +15 minutes per upgrade (900 seconds)
  COST_PER_INCREMENT: 25, // 25 Gems per +15m
};

// Action Queue Slot Limits & Gem Costs (Easily editable configuration)
export const QUEUE_SLOT_CONFIG = {
  BASE_SLOTS: 2,
  MAX_SLOTS: 5,
  COSTS: {
    3: 100, // Slot 3: 100 Gems
    4: 250, // Slot 4: 250 Gems
    5: 500, // Slot 5: 500 Gems
  } as Record<number, number>,
};

export interface GemPackDef {
  id: string;
  name: string;
  priceUsd: number;
  gems: number;
  description: string;
  isFounderPack?: boolean;
}

export const GEM_PACKS: Record<string, GemPackDef> = {
  gem_pack_small: {
    id: 'gem_pack_small',
    name: 'Small Gem Pack',
    priceUsd: 0.99,
    gems: 50,
    description: 'A pouch of glittering celestial gems. Yields 50 Gems when opened. Can be traded on the player market.',
  },
  gem_pack_medium: {
    id: 'gem_pack_medium',
    name: 'Medium Gem Pack',
    priceUsd: 1.99,
    gems: 120,
    description: 'A sturdy satchel of celestial gems. Yields 120 Gems when opened. Can be traded on the player market.',
  },
  gem_pack_large: {
    id: 'gem_pack_large',
    name: 'Large Gem Pack',
    priceUsd: 4.99,
    gems: 350,
    description: 'A heavy chest of celestial gems. Yields 350 Gems when opened. Can be traded on the player market.',
  },
  gem_pack_founder: {
    id: 'gem_pack_founder',
    name: 'Founder Pack',
    priceUsd: 5.99,
    gems: 600,
    description: 'An exclusive Founder coffer containing 600 Celestial Gems and permanently bestowing the prestigious aqua [FOUNDER] chat badge. One purchase per account.',
    isFounderPack: true,
  },
  gem_pack_grand: {
    id: 'gem_pack_grand',
    name: 'Grand Gem Pack',
    priceUsd: 9.99,
    gems: 900,
    description: 'A resplendent coffer of celestial gems. Yields 900 Gems when opened. Can be traded on the player market.',
  },
  gem_pack_colossal: {
    id: 'gem_pack_colossal',
    name: 'Colossal Gem Pack',
    priceUsd: 19.99,
    gems: 2000,
    description: 'An immense hoard of celestial gems. Yields 2,000 Gems when opened. Can be traded on the player market.',
  },
};

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

// Tool efficiency bonus by rarity (+1% uncommon, +3% rare, +5% epic, +8% legendary)
export const RARITY_TOOL_BONUS: Record<Rarity, number> = {
  plain: 0,
  uncommon: 0.01,
  rare: 0.03,
  epic: 0.05,
  legendary: 0.08,
};

// Crafting XP multiplier based on input material rarity (+10% uncommon, +25% rare, +50% epic, +100% legendary)
export const RARITY_CRAFT_XP_MULTIPLIER: Record<Rarity, number> = {
  plain: 1.0,
  uncommon: 1.10,
  rare: 1.25,
  epic: 1.50,
  legendary: 2.00,
};

// Cooked food healing multiplier by rarity (+10% uncommon, +25% rare, +50% epic, +100% legendary)
export const RARITY_HEALING_MULTIPLIER: Record<Rarity, number> = {
  plain: 1.0,
  uncommon: 1.10,
  rare: 1.25,
  epic: 1.50,
  legendary: 2.00,
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

// Steeds (Mounts): +1% at uncommon (13%), +3% at rare (15%)
export const STEED_BASE_BONUS: Record<Rarity, number> = {
  plain: 0.12,
  uncommon: 0.13,
  rare: 0.15,
  epic: 0.20,
  legendary: 0.30,
};

export function getSteedWalkSpeedBonus(rarity: Rarity, plus: number, itemId?: string): number {
  const base = STEED_BASE_BONUS[rarity] || 0.12;
  const multiplier = itemId === 'steed_chorse' ? 2 : 1;
  return base * multiplier * (1 + 0.15 * plus);
}

import type { SkillType } from './types.js';

export const GATHERING_SKILLS: SkillType[] = ['mining', 'fishing', 'woodcutting', 'herbalism', 'farming', 'thieving'];
export const CRAFTING_SKILLS: SkillType[] = ['cooking', 'smithing', 'fletching', 'alchemy', 'crafting', 'attunement'];
export const COMBAT_SKILLS: SkillType[] = ['melee', 'ranged', 'magic', 'defence', 'hitpoints'];

export const ALL_SKILLS: SkillType[] = [
  ...GATHERING_SKILLS,
  ...CRAFTING_SKILLS,
  ...COMBAT_SKILLS,
];

// Mount Breeding Configuration
export const MOUNT_BREED_CONFIG = {
  UPGRADE_CHANCE: 0.05, // 5% chance to upgrade to next rarity tier
  BASE_FEE_GOLD: 5000,   // Base gold fee for breeding attempt
  TIER_FEE_MULTIPLIER: {
    plain: 1,
    uncommon: 2,
    rare: 4,
    epic: 8,
    legendary: 15,
  } as Record<Rarity, number>,
};

export const RARITY_TIER_INDEX: Record<Rarity, number> = {
  plain: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export const RARITY_LIST: Rarity[] = ['plain', 'uncommon', 'rare', 'epic', 'legendary'];

/**
 * Calculates offspring species and base tier for mount breeding.
 */
export function getOffspringSpecies(parentAId: string, parentBId: string): string {
  // If either cross involves courser + chicken -> Chorse
  const isCourserAndChicken =
    (parentAId === 'steed_courser' && parentBId === 'steed_chicken') ||
    (parentAId === 'steed_chicken' && parentBId === 'steed_courser');
  if (isCourserAndChicken) return 'steed_chorse';

  // If both parents are Chorse -> Chorse
  if (parentAId === 'steed_chorse' && parentBId === 'steed_chorse') return 'steed_chorse';

  // If one parent is Chorse and other is courser or chicken -> Chorse dominant
  if (parentAId === 'steed_chorse' || parentBId === 'steed_chorse') return 'steed_chorse';

  // If both parents are the same species -> keep species
  if (parentAId === parentBId) return parentAId;

  // Fallback
  return 'steed_chorse';
}

/**
 * Calculates offspring rarity from two parent rarities.
 * Base rarity is the lowest parent rarity.
 * Upgrades to next tier with 5% chance if both match, or if roll succeeds.
 */
export function calculateBreedingRarity(
  rarityA: Rarity,
  rarityB: Rarity,
  roll: number = Math.random()
): { rarity: Rarity; didUpgrade: boolean; guaranteedBase: Rarity } {
  const indexA = RARITY_TIER_INDEX[rarityA] ?? 0;
  const indexB = RARITY_TIER_INDEX[rarityB] ?? 0;
  const baseIndex = Math.min(indexA, indexB);
  const guaranteedBase = RARITY_LIST[baseIndex];

  // If already legendary, cannot upgrade further
  if (baseIndex >= RARITY_LIST.length - 1) {
    return { rarity: 'legendary', didUpgrade: false, guaranteedBase: 'legendary' };
  }

  // If roll < UPGRADE_CHANCE, upgrade to baseIndex + 1
  if (roll < MOUNT_BREED_CONFIG.UPGRADE_CHANCE) {
    const nextRarity = RARITY_LIST[baseIndex + 1];
    return { rarity: nextRarity, didUpgrade: true, guaranteedBase };
  }

  return { rarity: guaranteedBase, didUpgrade: false, guaranteedBase };
}
