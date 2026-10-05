import { Rarity } from './constants.js';

export type GatheringSkill =
  | 'mining'
  | 'woodcutting'
  | 'fishing'
  | 'herbalism'
  | 'thieving'
  | 'farming';

export type CraftingSkill =
  | 'smithing'
  | 'cooking'
  | 'fletching'
  | 'alchemy'
  | 'crafting'
  | 'attunement';

export type CombatSkill =
  | 'melee'
  | 'ranged'
  | 'magic'
  | 'defence'
  | 'hitpoints';

export type SkillType = GatheringSkill | CraftingSkill | CombatSkill;

export type EquipSlot =
  | 'weapon'
  | 'shield'
  | 'helmet'
  | 'hair'
  | 'body'
  | 'legs'
  | 'ring'
  | 'amulet'
  | 'steed'
  | 'tool'
  | 'tool_pickaxe'
  | 'tool_axe'
  | 'tool_rod';


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
  stackable?: boolean;
  stackableInInventory?: boolean;
  stackableInBank?: boolean;
  maxStack?: number;
  maxStackInventory?: number;
  maxStackBank?: number;
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
  size?: number;
  recolor?: {
    filter?: string;
  };
}

export interface MonsterSpawnZone {
  id: string;
  name: string;
  monsterId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxMonsters: number;
  respawnSeconds?: number;
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
  targetNodeId?: string;
  standX?: number;
  standY?: number;
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

export interface WorldNode {
  id: string;
  name: string;
  type: 'hearth_counter' | 'forge' | 'fire' | 'mine' | 'tree' | 'water' | 'farm' | 'monster' | 'boss_arena' | 'portal' | 'workbench' | 'cauldron' | 'monolith' | 'stall' | 'herb';
  x: number;
  y: number;
  recipeId?: string;
  monsterId?: string;
  targetX?: number;
  targetY?: number;
  targetLabel?: string;
  zoneId?: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  title: string;
  x: number;
  y: number;
  dialogue: string[];
  role: 'guide' | 'merchant' | 'quest_giver';
  shopItemIds?: string[];
  questIds?: string[];
}

export interface QuestObjective {
  type: 'gather' | 'kill' | 'skill_level';
  targetId: string;
  count: number;
}

export interface QuestReward {
  xp?: { skill?: SkillType; amount: number } | number;
  gold?: number;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  npcId: string;
  objective: QuestObjective;
  reward: QuestReward;
  levelReq?: number;
  repeatable?: boolean;
}

export interface FarmPlotState {
  plotId: string;
  seedId: string;
  cropId: string;
  cropName: string;
  plantedAt: number;
  baseDurationSeconds: number;
  effectiveProgressSeconds: number;
  lastUpdated: number;
  status: 'growing' | 'ready';
  minYield: number;
  maxYield: number;
  xp: number;
  isHighXpMethod?: boolean;
}

export interface PlayerData {
  id: string;
  username: string;
  role?: 'admin' | 'player';
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
  farmPlots?: Record<string, FarmPlotState>;
  currentTask: ActiveTask | null;
  pendingTask?: {
    recipeId: string;
    targetX: number;
    targetY: number;
    quantity?: number;
    nodeX?: number;
    nodeY?: number;
  } | null;
  taskQueue: QueuedTask[];
  eatsAtHpPercent: number; // e.g. 50
  selectedFoodItemId?: string | null;
  currentHp: number;
  lastActiveTimestamp: number;
  completedQuests?: string[];
  questProgress?: Record<string, number>;
}
