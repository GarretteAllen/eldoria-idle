import { Rarity } from './constants.js';

export type GatheringSkill =
  | 'earth_delving'
  | 'timbercraft'
  | 'tidecalling'
  | 'flora_husbandry'
  | 'shadowcraft';

export type CraftingSkill =
  | 'rune_forging'
  | 'hearthcraft'
  | 'bow_fletching'
  | 'apothecary'
  | 'artificing'
  | 'soul_attunement';

export type CombatSkill =
  | 'bladesmanship'
  | 'marksmanship'
  | 'arcane_sorcery'
  | 'bulwark'
  | 'vitality';

export type SkillType = GatheringSkill | CraftingSkill | CombatSkill;

export type EquipSlot =
  | 'weapon'
  | 'shield'
  | 'helmet'
  | 'body'
  | 'legs'
  | 'ring'
  | 'amulet'
  | 'steed'
  | 'tool';

export type ItemCategory =
  | 'ore'
  | 'bar'
  | 'log'
  | 'raw_food'
  | 'cooked_food'
  | 'crop'
  | 'seed'
  | 'herb'
  | 'potion'
  | 'trophy'
  | 'relic'
  | 'weapon'
  | 'armour'
  | 'tool'
  | 'steed'
  | 'misc';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  tier: number; // 1 to 6
  slot?: EquipSlot;
  equipReq?: {
    skill: SkillType;
    level: number;
  };
  baseStats?: {
    accuracy?: number;
    strength?: number;
    defence?: number;
    swingSpeedSeconds?: number;
    healing?: number;
    toolSpeedBonus?: number;
  };
  vendorFloorPrice: number;
  description?: string;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
  rarity: Rarity;
  plus: number; // 0 to 15
}

export interface RecipeRequirement {
  itemId: string;
  quantity: number;
}

export interface RecipeDropChance {
  itemId: string;
  chance: number; // e.g. 1 / 2000
}

export interface RecipeDefinition {
  id: string;
  skill: SkillType;
  levelReq: number;
  name: string;
  inputs: RecipeRequirement[];
  outputItemId: string;
  outputQuantity: number;
  xp: number;
  intervalSeconds: number;
  rareFinds?: RecipeDropChance[];
  burnRateAtLevel?: {
    startLevel: number;
    startBurnRate: number;
    stopBurnLevel: number;
  };
  thiefCatchRate?: {
    startLevel: number;
    startRate: number;
    neverCaughtLevel: number;
    benchPenaltySeconds: number;
  };
}

export interface MonsterDefinition {
  id: string;
  name: string;
  zone: string;
  level: number;
  hp: number;
  xp: number;
  maxHit: number;
  swingSpeedSeconds: number;
  minCoins: number;
  maxCoins: number;
  guaranteedDropItemId: string;
  rareDrop?: {
    itemId: string;
    chance: number;
  };
}

export interface WorldBossDefinition {
  id: string;
  name: string;
  styleWeakness: 'melee' | 'ranged' | 'magic';
  baseHp: number;
  uniqueCoreItemId: string;
}

export interface ActiveTask {
  recipeId: string;
  skill: SkillType;
  startedAtTick: number;
  targetQuantity: number; // Infinity for endless
  completedQuantity: number;
  targetNodeX?: number;
  targetNodeY?: number;
}

export interface QueuedTask {
  recipeId: string;
  skill: SkillType;
  targetQuantity: number;
}

export interface PlayerStats {
  accuracy: number;
  strength: number;
  defence: number;
  maxHit: number;
  evasion: number;
  attackIntervalSeconds: number;
  walkSpeedBonus: number;
}

export interface ActiveBuff {
  id: string;
  name: string;
  type: 'speed' | 'food_damage' | 'crop_defence' | 'gather_xp';
  value: number;
  expiresAt: number;
}

export interface PlayerData {
  id: string;
  username: string;
  isGuest: boolean;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  path?: Array<{ x: number; y: number }>;
  isMoving?: boolean;
  moveSpeedTilesPerTick?: number;
  bankingState?: 'idle' | 'walking_to_bank' | 'depositing' | 'returning_to_work';
  bankReturnTask?: ActiveTask | null;
  dropWhenFull?: boolean;
  gold: number;
  gems: number;
  anima: number;
  activeTitle?: string;
  activeBuffs?: ActiveBuff[];
  skills: Record<SkillType, { xp: number; level: number }>;
  inventory: InventorySlot[];
  storage: InventorySlot[];
  storageSlotsMax: number;
  overflowTray: InventorySlot[];
  equipment: Partial<Record<EquipSlot, InventorySlot>>;
  currentTask: ActiveTask | null;
  taskQueue: QueuedTask[];
  eatsAtHpPercent: number; // e.g. 50
  currentHp: number;
  lastActiveTimestamp: number;
}
