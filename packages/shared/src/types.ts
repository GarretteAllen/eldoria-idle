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
  | 'pet'
  | 'aura'
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
  | 'pet'
  | 'aura'
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
  auraBuff?: {
    skill: SkillType;
    xpMultiplier: number; // e.g. 0.05 for +5%, 0.10 for +10%, 0.15 for +15%
    durationSeconds: number; // e.g. 1800 (30m), 2700 (45m), 3600 (60m)
  };
  baseStats?: {
    accuracy?: number;
    strength?: number;
    meleeStrength?: number;
    rangedStrength?: number;
    magicStrength?: number;
    defence?: number;
    swingSpeedSeconds?: number;
    attackSpeedBonus?: number; // e.g. 0.05 for +5% attack speed
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
  remainingSeconds?: number;
  hasBeenEquipped?: boolean;
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
  guaranteedDropItemId?: string;
  rareDrop?: {
    itemId: string;
    chance: number;
  };
  keyDrop?: {
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
  monsterName?: string;
  standX?: number;
  standY?: number;
}

export interface QueuedTask {
  id: string;
  recipeId: string;
  skill: SkillType;
  targetQuantity: number;
  targetNodeId?: string;
  targetNodeX?: number;
  targetNodeY?: number;
  monsterId?: string;
  targetLabel?: string;
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
  type: 'hearth_counter' | 'notice_board' | 'dungeon_gate' | 'forge' | 'fire' | 'mine' | 'tree' | 'water' | 'farm' | 'monster' | 'boss_arena' | 'portal' | 'door' | 'workbench' | 'cauldron' | 'monolith' | 'stall' | 'herb';
  x: number;
  y: number;
  recipeId?: string;
  monsterId?: string;
  targetX?: number;
  targetY?: number;
  targetLabel?: string;
  targetLevelId?: string;
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

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  quantity: number;
  unitPrice: number; // Gold per unit
  totalPrice: number;
  rarity: Rarity;
  plus: number;
  createdAt: number;
}

export interface MarketMailboxItem {
  id: string;
  itemId: string; // 'gold' or item ID
  quantity: number;
  rarity?: Rarity;
  plus?: number;
  reason: 'cancelled_listing' | 'sale_proceeds';
  createdAt: number;
}

export interface MarketTradeHistory {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  rarity?: Rarity;
  plus?: number;
  timestamp: number;
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
  marketMailbox?: MarketMailboxItem[];
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
  unlockedQueueSlots: number; // Defaults to 2, upgradable up to 5
  maxOfflineSeconds?: number; // Defaults to 24*3600, upgradable in +15m (900s) increments
  eatsAtHpPercent: number; // e.g. 50
  selectedFoodItemId?: string | null;
  currentHp: number;
  lastActiveTimestamp: number;
  lastDailyRewardTimestamp?: number;
  mutedUntil?: number; // timestamp until when player is muted
  muteReason?: string;
  completedQuests?: string[];
  questProgress?: Record<string, number>;
  dailyBounties?: PlayerBountiesState;
}

export interface DailyBounty {
  id: string;
  category: 'gathering' | 'refining' | 'combat';
  title: string;
  description: string;
  targetId: string;
  targetName: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
  claimed: boolean;
  rewardGold: number;
  rewardGems: number;
  rewardAnima: number;
}

export interface PlayerBountiesState {
  lastDateKey: string; // YYYY-MM-DD UTC
  bounties: DailyBounty[];
}

export interface StoredChatMessage {
  id: string;
  senderId?: string;
  senderName: string;
  role?: 'admin' | 'player';
  isAdmin?: boolean;
  title?: string;
  channel: string;
  text: string;
  timestamp: number;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  content: string; // BBCode formatted
  author?: string;
  createdAt: number;
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  question: string;
  description?: string;
  options: PollOption[];
  isActive: boolean;
  totalVotes: number;
  createdAt: number;
  closedAt?: number;
}

// ==================== DUNGEON & CO-OP SYSTEMS ====================

export interface DungeonPartyMember {
  playerId: string;
  username: string;
  isReady: boolean;
  isLeader: boolean;
  level: number;
}

export interface DungeonParty {
  id: string;
  dungeonId: string;
  leaderId: string;
  members: DungeonPartyMember[];
  status: 'lobby' | 'in_dungeon' | 'completed' | 'abandoned';
  instanceId?: string;
  createdAt: number;
}

export interface DungeonRoomMob {
  monsterId: string;
  name: string;
  count: number;
  x: number;
  y: number;
}

export interface DungeonRoomDef {
  roomIndex: number;
  name: string;
  description: string;
  startX: number;
  startY: number;
  mobs: DungeonRoomMob[];
  chestX?: number;
  chestY?: number;
  exitBarrierCoords?: Array<{ x: number; y: number }>;
}

export interface DungeonDefinition {
  id: string;
  name: string;
  description: string;
  requiredKeyItemId: string;
  minLevel: number;
  maxPartySize: number;
  gateNodeId: string;
  gateX: number;
  gateY: number;
  returnX: number;
  returnY: number;
  rooms: DungeonRoomDef[];
  bossMonsterId: string;
}

export interface DungeonRecoveryItem {
  id: string;
  playerId: string;
  dungeonId: string;
  dungeonName: string;
  itemId: string;
  quantity: number;
  rarity?: Rarity;
  plus?: number;
  recoveryFee: number;
  timestamp: number;
}

// ==================== REFERRAL SYSTEM ====================
export interface ReferralRewardTier {
  requiredQualified: number;
  gems: number;
  title?: string;
  cosmetic?: string;
  badge: string;
}

export const REFERRAL_REWARD_TIERS: ReferralRewardTier[] = [
  { requiredQualified: 1, gems: 50, title: 'Herald of Eldoria', badge: 'Herald' },
  { requiredQualified: 3, gems: 150, title: 'Vanguard Recruiter', cosmetic: 'Golden Recruiter Pennant', badge: 'Recruiter' },
  { requiredQualified: 5, gems: 300, title: 'Realm Ambassador', cosmetic: 'Ambassador Steed Cloak', badge: 'Ambassador' },
];

export const REFERRAL_REPEAT_INTERVAL = 1;
export const REFERRAL_REPEAT_GEMS = 50;
export const REFERRAL_QUALIFY_LEVEL = 100;

export interface ReferralSummary {
  referralCode: string; // usually the player's username
  referralUrl: string; // e.g. https://eldoriaidle.site?ref=Username
  totalReferred: number;
  qualifiedCount: number; // reached total level 100
  claimedGems: number;
  unclaimedGems: number;
  claimedTitles: string[];
  referrals: Array<{
    username: string;
    totalLevel: number;
    qualified: boolean;
    createdAt: number;
  }>;
}

