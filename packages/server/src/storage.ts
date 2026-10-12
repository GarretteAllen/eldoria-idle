import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { PlayerData, SkillType, WorldNode, NpcDefinition, QuestDefinition, MonsterSpawnZone, getLevelFromXp, ItemDefinition, ITEMS, LevelBounds, parseLdtkLevelBounds, isTileInAnyLevel, InventorySlot, MarketListing, MarketTradeHistory, ChangelogEntry, Poll, StoredChatMessage, isItemStackable, getItemMaxStack, PLAYER_SPAWN_POINT, DungeonRecoveryItem } from '@eldoria/shared';
import { WORLD_NODES as DEFAULT_WORLD_NODES } from './world.js';

export const DEFAULT_MONSTER_ZONES: MonsterSpawnZone[] = [
  { id: 'zone_murkwarrens', name: 'The Murkwarrens', monsterId: 'mire_rat', x: 2, y: 43, width: 4, height: 4, maxMonsters: 3, respawnSeconds: 5 },
  { id: 'zone_cragridge', name: 'Cragridge', monsterId: 'stone_carapace', x: 7, y: 43, width: 4, height: 4, maxMonsters: 3, respawnSeconds: 5 },
  { id: 'zone_dread_marsh', name: 'Dread Marsh', monsterId: 'fen_creeper', x: 11, y: 43, width: 4, height: 4, maxMonsters: 3, respawnSeconds: 5 },
  { id: 'zone_blackbog', name: 'Blackbog', monsterId: 'mire_ghoul', x: 16, y: 43, width: 4, height: 4, maxMonsters: 3, respawnSeconds: 5 },
  { id: 'zone_sunken_barrow', name: 'Sunken Barrow', monsterId: 'carrion_scarab', x: 20, y: 43, width: 4, height: 4, maxMonsters: 3, respawnSeconds: 5 },
];

function getProjectRoot(): string {
  let curr = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(curr, 'packages', 'server')) || fs.existsSync(path.join(curr, 'package.json'))) {
      const pkgPath = path.join(curr, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.name === 'eldoria-idle' || pkg.workspaces) {
            return curr;
          }
        } catch {}
      }
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

const PROJECT_ROOT = getProjectRoot();

// Automatically load .env file if present
try {
  const rootEnv = path.join(PROJECT_ROOT, '.env');
  const serverEnv = path.join(PROJECT_ROOT, 'packages', 'server', '.env');
  if (fs.existsSync(rootEnv) && typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile(rootEnv);
  } else if (fs.existsSync(serverEnv) && typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile(serverEnv);
  }
} catch {}

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.join(PROJECT_ROOT, 'data');
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'eldoria.db');
console.log(`[Database] SQLite Database: ${DB_FILE}`);

export interface AccountRecord {
  id: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  salt: string;
  playerId: string;
  createdAt: number;
  referredBy?: string | null; // normalized username or account id of inviter
  referralRewardsClaimed?: number; // total gems claimed from referrals
  referralTitlesClaimed?: string[]; // list of unlocked titles
}

export interface SessionRecord {
  token: string;
  accountId: string;
  playerId: string;
  createdAt: number;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'eldoria_admin_2026';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'gar,admin')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const INITIAL_SKILLS: Record<SkillType, { xp: number; level: number }> = {
  mining: { xp: 0, level: 1 },
  woodcutting: { xp: 0, level: 1 },
  fishing: { xp: 0, level: 1 },
  herbalism: { xp: 0, level: 1 },
  thieving: { xp: 0, level: 1 },
  farming: { xp: 0, level: 1 },
  smithing: { xp: 0, level: 1 },
  cooking: { xp: 0, level: 1 },
  fletching: { xp: 0, level: 1 },
  alchemy: { xp: 0, level: 1 },
  crafting: { xp: 0, level: 1 },
  attunement: { xp: 0, level: 1 },
  melee: { xp: 0, level: 1 },
  ranged: { xp: 0, level: 1 },
  magic: { xp: 0, level: 1 },
  defence: { xp: 0, level: 1 },
  hitpoints: { xp: 1154, level: 10 },
};

const DEFAULT_NPCS: NpcDefinition[] = [
  {
    id: 'npc_elder',
    name: 'Elder Theodosius',
    title: 'Hearth Elder',
    x: 9,
    y: 21,
    role: 'guide',
    dialogue: [
      'Welcome to Eldoria, traveler.',
      'The Hearth Storage Counter provides boundless vault space for all who work the land.',
      'Deposit your spoils here before venturing into the northern quarries or eastern timberlands.'
    ],
    questIds: ['quest_intro_mining']
  },
  {
    id: 'npc_blacksmith',
    name: 'Gorim Anvilheart',
    title: 'Master Smith',
    x: 5,
    y: 24,
    role: 'merchant',
    dialogue: [
      'The Runeforge is ready. Smelt raw ores into gleaming ingots and craft steadfast arms.',
      'Bring me pyrite and cold iron, and we will forge glory.'
    ],
    questIds: ['quest_intro_smithing']
  },
  {
    id: 'npc_scout',
    name: 'Ranger Elyse',
    title: 'Frontier Scout',
    x: 6,
    y: 43,
    role: 'quest_giver',
    dialogue: [
      'Keep your wits about you in the southern flats.',
      'Mire-rats and carapaces infest the riverbeds. Cull their numbers for bounties and provisions.'
    ],
    questIds: ['quest_hunt_rats']
  },
  {
    id: 'npc_barnaby',
    name: 'Barnaby',
    title: 'Lost Goods Porter',
    x: 10,
    y: 22,
    role: 'merchant',
    dialogue: [
      'Pip-pip! Looking for things misplaced in the damp catacombs?',
      'If your pack or hearth vault runs full when delving through dungeons, fear not!',
      'I collect every stray trinket and keep them safe and dry here in town for a tiny porter fee.'
    ]
  }
];

const DEFAULT_QUESTS: QuestDefinition[] = [
  {
    id: 'quest_intro_mining',
    title: 'The First Spark',
    description: 'Mine 10 Pyrite from the Northern Quarry to prove your resourcefulness.',
    npcId: 'npc_elder',
    objective: { type: 'gather', targetId: 'pyrite_ore', count: 10 },
    reward: { xp: { skill: 'mining', amount: 120 }, gold: 50 },
    levelReq: 1,
  },
  {
    id: 'quest_intro_smithing',
    title: 'Forging Ahead',
    description: 'Smelt 5 Dawnburn Ingots at the Ancestral Runeforge in town square.',
    npcId: 'npc_blacksmith',
    objective: { type: 'gather', targetId: 'dawnburn_ingot', count: 5 },
    reward: { xp: { skill: 'smithing', amount: 160 }, gold: 75 },
    levelReq: 1,
  },
  {
    id: 'quest_hunt_rats',
    title: 'Burrow Exterminator',
    description: 'Hunt 3 Mire-Rats in the southern marshes to safeguard the frontier trail.',
    npcId: 'npc_scout',
    objective: { type: 'kill', targetId: 'mire_rat', count: 3 },
    reward: { xp: { skill: 'melee', amount: 200 }, gold: 100 },
    levelReq: 1,
  }
];

const DEFAULT_COLLISIONS: string[] = [
  '0,37', '1,37', '2,37', '3,37',
  '14,37', '15,37', '16,37', '17,37',
  '7,21', '8,21', '10,21',
  '5,23', '7,23', '9,23', '11,23',
];

class StorageManager {
  private db: Database.Database;

  // Cached world data for nanosecond reads
  private nodesCache: WorldNode[] = [];
  private npcsCache: NpcDefinition[] = [];
  private questsCache: QuestDefinition[] = [];
  private collisionsCache = new Set<string>();
  private levelBounds: LevelBounds[] = [];

  // Prepared Statements
  private stmtGetPlayer: Database.Statement;
  private stmtSavePlayer: Database.Statement;
  private stmtDeletePlayer: Database.Statement;
  private stmtDeleteBotPlayers: Database.Statement;
  private stmtGetAccountByUsername: Database.Statement;
  private stmtGetAccountById: Database.Statement;
  private stmtInsertAccount: Database.Statement;
  private stmtGetSession: Database.Statement;
  private stmtInsertSession: Database.Statement;
  private stmtDeleteSession: Database.Statement;
  private stmtGetWorldNodes: Database.Statement;
  private stmtUpsertWorldNode: Database.Statement;
  private stmtDeleteWorldNode: Database.Statement;
  private stmtGetNpcs: Database.Statement;
  private stmtUpsertNpc: Database.Statement;
  private stmtDeleteNpc: Database.Statement;
  private stmtGetQuests: Database.Statement;
  private stmtUpsertQuest: Database.Statement;
  private stmtDeleteQuest: Database.Statement;
  private stmtGetCollisions: Database.Statement;
  private stmtInsertCollision: Database.Statement;
  private stmtDeleteAllCollisions: Database.Statement;
  private stmtGetMeta: Database.Statement;
  private stmtSetMeta: Database.Statement;
  private stmtGetItems: Database.Statement;
  private stmtUpsertItem: Database.Statement;
  private stmtDeleteItem: Database.Statement;
  private stmtGetMonsterZones: Database.Statement;
  private stmtUpsertMonsterZone: Database.Statement;
  private stmtDeleteMonsterZone: Database.Statement;
  private stmtGetMarketListings: Database.Statement;
  private stmtGetMarketListingById: Database.Statement;
  private stmtInsertMarketListing: Database.Statement;
  private stmtDeleteMarketListing: Database.Statement;
  private stmtInsertMarketTrade: Database.Statement;
  private stmtGetRecentTradesByItem: Database.Statement;
  private stmtGetAllRecentTrades: Database.Statement;
  private stmtGetChangelogs: Database.Statement;
  private stmtUpsertChangelog: Database.Statement;
  private stmtDeleteChangelog: Database.Statement;
  private stmtGetPolls: Database.Statement;
  private stmtUpsertPoll: Database.Statement;
  private stmtDeletePoll: Database.Statement;
  private stmtGetPollVotes: Database.Statement;
  private stmtInsertPollVote: Database.Statement;
  private stmtGetPlayerPollVote: Database.Statement;
  private stmtDeletePollVotes: Database.Statement;
  private stmtInsertChatMessage: Database.Statement;
  private stmtGetRecentChatMessages: Database.Statement;
  private stmtDeleteChatMessage: Database.Statement;
  private stmtPruneOldChatMessages: Database.Statement;
  private stmtGetDungeonRecoveries: Database.Statement;
  private stmtInsertDungeonRecovery: Database.Statement;
  private stmtGetDungeonRecoveryById: Database.Statement;
  private stmtDeleteDungeonRecovery: Database.Statement;
  private changelogsCache: ChangelogEntry[] = [];
  private pollsCache: Poll[] = [];
  private itemsCache: Record<string, ItemDefinition> = {};
  private monsterZonesCache: MonsterSpawnZone[] = [];

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.db = new Database(DB_FILE);

    // High performance SQLite tuning: WAL mode + normal sync + foreign keys
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.initSchema();

    // Prepare cached SQL statements
    this.stmtGetPlayer = this.db.prepare('SELECT data FROM players WHERE id = ?');
    this.stmtSavePlayer = this.db.prepare(
      `INSERT INTO players (id, username, role, is_guest, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         role = excluded.role,
         is_guest = excluded.is_guest,
         data = excluded.data,
         updated_at = excluded.updated_at`
    );
    this.stmtDeletePlayer = this.db.prepare('DELETE FROM players WHERE id = ?');
    this.stmtDeleteBotPlayers = this.db.prepare("DELETE FROM players WHERE id LIKE 'bot_%'");

    this.stmtGetAccountByUsername = this.db.prepare('SELECT * FROM accounts WHERE normalized_username = ?');
    this.stmtGetAccountById = this.db.prepare('SELECT * FROM accounts WHERE id = ?');
    this.stmtInsertAccount = this.db.prepare(
      `INSERT INTO accounts (id, username, normalized_username, password_hash, salt, player_id, created_at, referred_by, referral_rewards_claimed, referral_titles_claimed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    this.stmtGetSession = this.db.prepare('SELECT * FROM sessions WHERE token = ?');
    this.stmtInsertSession = this.db.prepare(
      'INSERT INTO sessions (token, account_id, player_id, created_at) VALUES (?, ?, ?, ?)'
    );
    this.stmtDeleteSession = this.db.prepare('DELETE FROM sessions WHERE token = ?');

    this.stmtGetWorldNodes = this.db.prepare('SELECT data FROM world_nodes');
    this.stmtUpsertWorldNode = this.db.prepare(
      `INSERT INTO world_nodes (id, type, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data`
    );
    this.stmtDeleteWorldNode = this.db.prepare('DELETE FROM world_nodes WHERE id = ?');

    this.stmtGetNpcs = this.db.prepare('SELECT data FROM npcs');
    this.stmtUpsertNpc = this.db.prepare(
      `INSERT INTO npcs (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    );
    this.stmtDeleteNpc = this.db.prepare('DELETE FROM npcs WHERE id = ?');

    this.stmtGetQuests = this.db.prepare('SELECT data FROM quests');
    this.stmtUpsertQuest = this.db.prepare(
      `INSERT INTO quests (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    );
    this.stmtDeleteQuest = this.db.prepare('DELETE FROM quests WHERE id = ?');

    this.stmtGetCollisions = this.db.prepare('SELECT coord FROM collisions');
    this.stmtInsertCollision = this.db.prepare('INSERT OR IGNORE INTO collisions (coord) VALUES (?)');
    this.stmtDeleteAllCollisions = this.db.prepare('DELETE FROM collisions');

    this.stmtGetMeta = this.db.prepare('SELECT val FROM metadata WHERE key = ?');
    this.stmtSetMeta = this.db.prepare(
      `INSERT INTO metadata (key, val) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET val = excluded.val`
    );

    this.stmtGetItems = this.db.prepare('SELECT id, data FROM items');
    this.stmtUpsertItem = this.db.prepare(
      `INSERT INTO items (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    );
    this.stmtDeleteItem = this.db.prepare('DELETE FROM items WHERE id = ?');

    this.stmtGetMonsterZones = this.db.prepare('SELECT data FROM monster_zones');
    this.stmtUpsertMonsterZone = this.db.prepare(
      `INSERT INTO monster_zones (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    );
    this.stmtDeleteMonsterZone = this.db.prepare('DELETE FROM monster_zones WHERE id = ?');

    this.stmtGetMarketListings = this.db.prepare('SELECT * FROM market_listings ORDER BY created_at DESC');
    this.stmtGetMarketListingById = this.db.prepare('SELECT * FROM market_listings WHERE id = ?');
    this.stmtInsertMarketListing = this.db.prepare(
      `INSERT INTO market_listings (id, seller_id, seller_name, item_id, quantity, unit_price, total_price, rarity, plus, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtDeleteMarketListing = this.db.prepare('DELETE FROM market_listings WHERE id = ?');
    this.stmtInsertMarketTrade = this.db.prepare(
      `INSERT INTO market_trades (id, item_id, quantity, unit_price, total_price, seller_id, seller_name, buyer_id, buyer_name, rarity, plus, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtGetRecentTradesByItem = this.db.prepare(
      'SELECT * FROM market_trades WHERE item_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    this.stmtGetAllRecentTrades = this.db.prepare(
      'SELECT * FROM market_trades ORDER BY timestamp DESC LIMIT ?'
    );

    this.stmtGetChangelogs = this.db.prepare('SELECT data FROM changelogs ORDER BY created_at DESC');
    this.stmtUpsertChangelog = this.db.prepare(
      `INSERT INTO changelogs (id, version, created_at, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version, data = excluded.data`
    );
    this.stmtDeleteChangelog = this.db.prepare('DELETE FROM changelogs WHERE id = ?');

    this.stmtGetPolls = this.db.prepare('SELECT data FROM polls ORDER BY created_at DESC');
    this.stmtUpsertPoll = this.db.prepare(
      `INSERT INTO polls (id, is_active, created_at, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET is_active = excluded.is_active, data = excluded.data`
    );
    this.stmtDeletePoll = this.db.prepare('DELETE FROM polls WHERE id = ?');
    this.stmtGetPollVotes = this.db.prepare('SELECT player_id, option_id, created_at FROM poll_votes WHERE poll_id = ?');
    this.stmtInsertPollVote = this.db.prepare(
      `INSERT INTO poll_votes (poll_id, player_id, option_id, created_at) VALUES (?, ?, ?, ?)`
    );
    this.stmtGetPlayerPollVote = this.db.prepare('SELECT option_id FROM poll_votes WHERE poll_id = ? AND player_id = ?');
    this.stmtDeletePollVotes = this.db.prepare('DELETE FROM poll_votes WHERE poll_id = ?');

    this.stmtInsertChatMessage = this.db.prepare(
      `INSERT INTO chat_messages (id, sender_id, sender_name, role, is_admin, title, channel, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtGetRecentChatMessages = this.db.prepare(
      `SELECT id, sender_id as senderId, sender_name as senderName, role, is_admin as isAdmin, title, channel, text, created_at as timestamp
       FROM chat_messages
       ORDER BY created_at DESC
       LIMIT ?`
    );
    this.stmtDeleteChatMessage = this.db.prepare('DELETE FROM chat_messages WHERE id = ?');
    this.stmtPruneOldChatMessages = this.db.prepare('DELETE FROM chat_messages WHERE created_at < ?');

    this.stmtGetDungeonRecoveries = this.db.prepare(
      'SELECT * FROM dungeon_recoveries WHERE player_id = ? ORDER BY timestamp DESC'
    );
    this.stmtInsertDungeonRecovery = this.db.prepare(
      `INSERT INTO dungeon_recoveries (id, player_id, dungeon_id, dungeon_name, item_id, quantity, rarity, plus, recovery_fee, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stmtGetDungeonRecoveryById = this.db.prepare(
      'SELECT * FROM dungeon_recoveries WHERE id = ?'
    );
    this.stmtDeleteDungeonRecovery = this.db.prepare(
      'DELETE FROM dungeon_recoveries WHERE id = ?'
    );

    // Run automatic migration from legacy json files if upgrading
    this.migrateLegacyJson();

    // Load active caches
    this.loadCaches();
    this.loadLdtkMapBounds();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        val TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        normalized_username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        player_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        referred_by TEXT,
        referral_rewards_claimed INTEGER NOT NULL DEFAULT 0,
        referral_titles_claimed TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        is_guest INTEGER NOT NULL DEFAULT 1,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS world_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monster_zones (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS npcs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quests (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collisions (
        coord TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS market_listings (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        seller_name TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        rarity TEXT NOT NULL DEFAULT 'plain',
        plus INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS market_trades (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        seller_id TEXT NOT NULL,
        seller_name TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        rarity TEXT NOT NULL DEFAULT 'plain',
        plus INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS changelogs (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS polls (
        id TEXT PRIMARY KEY,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        option_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(poll_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        sender_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        is_admin INTEGER NOT NULL DEFAULT 0,
        title TEXT,
        channel TEXT NOT NULL DEFAULT 'All',
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dungeon_recoveries (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        dungeon_id TEXT NOT NULL,
        dungeon_name TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        rarity TEXT NOT NULL DEFAULT 'plain',
        plus INTEGER NOT NULL DEFAULT 0,
        recovery_fee INTEGER NOT NULL DEFAULT 25,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_accounts_norm_user ON accounts(normalized_username);
      CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
      CREATE INDEX IF NOT EXISTS idx_market_item ON market_listings(item_id);
      CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id);
      CREATE INDEX IF NOT EXISTS idx_changelogs_created ON changelogs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_polls_created ON polls(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
      CREATE INDEX IF NOT EXISTS idx_poll_votes_player ON poll_votes(player_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_dungeon_recoveries_player ON dungeon_recoveries(player_id);
    `);

    // Safe column migrations for existing SQLite accounts table (BEFORE creating index on referred_by)
    try {
      this.db.exec(`ALTER TABLE accounts ADD COLUMN referred_by TEXT;`);
    } catch {}
    try {
      this.db.exec(`ALTER TABLE accounts ADD COLUMN referral_rewards_claimed INTEGER NOT NULL DEFAULT 0;`);
    } catch {}
    try {
      this.db.exec(`ALTER TABLE accounts ADD COLUMN referral_titles_claimed TEXT NOT NULL DEFAULT '[]';`);
    } catch {}

    // Index on referred_by now that the column is guaranteed to exist
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_referred_by ON accounts(referred_by);`);
    } catch {}
  }

  private migrateLegacyJson() {
    const playersJson = path.join(DATA_DIR, 'players.json');
    const accountsJson = path.join(DATA_DIR, 'accounts.json');
    const nodesJson = path.join(DATA_DIR, 'world_nodes.json');
    const npcsJson = path.join(DATA_DIR, 'npcs.json');
    const questsJson = path.join(DATA_DIR, 'quests.json');
    const collisionsJson = path.join(DATA_DIR, 'collisions.json');

    // Players migration
    const playerCount = (this.db.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count;
    if (playerCount === 0 && fs.existsSync(playersJson)) {
      try {
        const raw = fs.readFileSync(playersJson, 'utf-8');
        const players = JSON.parse(raw);
        const insert = this.db.prepare(
          'INSERT OR IGNORE INTO players (id, username, role, is_guest, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const tx = this.db.transaction(() => {
          for (const [id, p] of Object.entries(players as Record<string, PlayerData>)) {
            insert.run(id, p.username, p.role || 'player', p.isGuest ? 1 : 0, JSON.stringify(p), Date.now());
          }
        });
        tx();
        console.log(`[Migration] SQLite: Migrated legacy players from players.json`);
      } catch (err) {
        console.error('Failed to migrate players.json', err);
      }
    }

    // Accounts migration
    const accountCount = (this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }).count;
    if (accountCount === 0 && fs.existsSync(accountsJson)) {
      try {
        const raw = fs.readFileSync(accountsJson, 'utf-8');
        const accounts = JSON.parse(raw);
        const insert = this.db.prepare(
          'INSERT OR IGNORE INTO accounts (id, username, normalized_username, password_hash, salt, player_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        const tx = this.db.transaction(() => {
          for (const acc of Object.values(accounts as Record<string, AccountRecord>)) {
            insert.run(
              acc.id,
              acc.username,
              acc.normalizedUsername || acc.username.toLowerCase(),
              acc.passwordHash,
              acc.salt,
              acc.playerId,
              acc.createdAt
            );
          }
        });
        tx();
        console.log(`[Migration] SQLite: Migrated legacy accounts from accounts.json`);
      } catch (err) {
        console.error('Failed to migrate accounts.json', err);
      }
    }

    // World entities seeding check:
    // If the world has already been seeded in the past, NEVER re-seed default entities!
    // (If the table is empty, that is an intentional admin action like deleting all NPCs or nodes.)
    const seeded = this.stmtGetMeta.get('world_seeded') as { val: string } | undefined;
    if (seeded) {
      return;
    }

    // If accounts or players already exist, this is an active database with custom data.
    // Preserve custom world state completely.
    const existingAccounts = (this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }).count;
    const existingPlayers = (this.db.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count;
    if (existingAccounts > 0 || existingPlayers > 0) {
      console.log('[World] SQLite: Active world detected. Preserving custom NPCs, nodes, and quests.');
      this.stmtSetMeta.run('world_seeded', 'true');
      this.checkpoint();
      return;
    }

    // World Nodes
    const nodeCount = (this.db.prepare('SELECT COUNT(*) as count FROM world_nodes').get() as { count: number }).count;
    if (nodeCount === 0) {
      let nodes = DEFAULT_WORLD_NODES;
      if (fs.existsSync(nodesJson)) {
        try {
          nodes = JSON.parse(fs.readFileSync(nodesJson, 'utf-8'));
        } catch {}
      }
      this.saveWorldNodes(nodes);
    }

    // NPCs
    const npcCount = (this.db.prepare('SELECT COUNT(*) as count FROM npcs').get() as { count: number }).count;
    if (npcCount === 0) {
      let npcs = DEFAULT_NPCS;
      if (fs.existsSync(npcsJson)) {
        try {
          npcs = JSON.parse(fs.readFileSync(npcsJson, 'utf-8'));
        } catch {}
      }
      this.saveNpcs(npcs);
    }

    // Quests
    const questCount = (this.db.prepare('SELECT COUNT(*) as count FROM quests').get() as { count: number }).count;
    if (questCount === 0) {
      let quests = DEFAULT_QUESTS;
      if (fs.existsSync(questsJson)) {
        try {
          quests = JSON.parse(fs.readFileSync(questsJson, 'utf-8'));
        } catch {}
      }
      this.saveQuests(quests);
    }

    // Collisions
    const collCount = (this.db.prepare('SELECT COUNT(*) as count FROM collisions').get() as { count: number }).count;
    if (collCount === 0) {
      let cols = DEFAULT_COLLISIONS;
      if (fs.existsSync(collisionsJson)) {
        try {
          cols = JSON.parse(fs.readFileSync(collisionsJson, 'utf-8'));
        } catch {}
      }
      this.saveCollisions(cols);
    }

    // Monster Spawn Zones
    const zoneCount = (this.db.prepare('SELECT COUNT(*) as count FROM monster_zones').get() as { count: number }).count;
    if (zoneCount === 0) {
      const zonesJson = path.join(DATA_DIR, 'monster_zones.json');
      let zones = DEFAULT_MONSTER_ZONES;
      if (fs.existsSync(zonesJson)) {
        try {
          zones = JSON.parse(fs.readFileSync(zonesJson, 'utf-8'));
        } catch {}
      }
      this.saveMonsterZones(zones);
    }

    this.stmtSetMeta.run('world_seeded', 'true');
    this.checkpoint();
  }

  private loadCaches() {
    // World nodes
    const nodeRows = this.stmtGetWorldNodes.all() as Array<{ data: string }>;
    this.nodesCache = nodeRows.map(r => JSON.parse(r.data));

    // Ensure central Town Noticeboard is present in world nodes
    if (!this.nodesCache.some(n => n.id === 'hearth_notice_board')) {
      const noticeNode: WorldNode = {
        id: 'hearth_notice_board',
        name: 'Town Noticeboard',
        type: 'notice_board',
        x: 10,
        y: 22,
      };
      this.nodesCache.push(noticeNode);
      try {
        this.stmtUpsertWorldNode.run(noticeNode.id, noticeNode.type, JSON.stringify(noticeNode));
      } catch (err) {
        console.error('Failed to insert hearth_notice_board', err);
      }
    }

    // Monster Spawn Zones
    const zoneRows = this.stmtGetMonsterZones.all() as Array<{ data: string }>;
    this.monsterZonesCache = zoneRows.map(r => JSON.parse(r.data));

    // NPCs
    const npcRows = this.stmtGetNpcs.all() as Array<{ data: string }>;
    this.npcsCache = npcRows.map(r => JSON.parse(r.data));

    // Quests
    const questRows = this.stmtGetQuests.all() as Array<{ data: string }>;
    this.questsCache = questRows.map(r => JSON.parse(r.data));

    // Collisions
    const collRows = this.stmtGetCollisions.all() as Array<{ coord: string }>;
    this.collisionsCache = new Set<string>(collRows.map(r => r.coord));

    // Changelogs
    const changelogRows = this.stmtGetChangelogs.all() as Array<{ data: string }>;
    this.changelogsCache = changelogRows.map(r => JSON.parse(r.data));

    // Polls
    const pollRows = this.stmtGetPolls.all() as Array<{ data: string }>;
    this.pollsCache = pollRows.map(r => JSON.parse(r.data));

    // Items
    this.itemsCache = { ...ITEMS };
    const itemRows = this.stmtGetItems.all() as Array<{ id: string; data: string }>;
    for (const row of itemRows) {
      try {
        const item = JSON.parse(row.data) as ItemDefinition;
        if (item.id === 'pelt_jerkin') {
          item.id = 'leather_tunic';
          item.name = 'Leather Tunic';
          this.stmtDeleteItem.run('pelt_jerkin');
          this.stmtUpsertItem.run('leather_tunic', JSON.stringify(item));
        } else if (item.id === 'pelt_quiver') {
          item.id = 'leather_quiver';
          item.name = 'Leather Quiver';
          this.stmtDeleteItem.run('pelt_quiver');
          this.stmtUpsertItem.run('leather_quiver', JSON.stringify(item));
        }
        const baseCodeDef = ITEMS[item.id];
        if (baseCodeDef?.description) {
          item.description = baseCodeDef.description;
        }
        this.itemsCache[item.id] = item;
      } catch (e) {
        console.error(`Failed to parse item ${row.id}`, e);
      }
    }
    // Ensure all code-defined items are in cache with their descriptions
    for (const [id, def] of Object.entries(ITEMS)) {
      if (!this.itemsCache[id]) {
        this.itemsCache[id] = { ...def };
      } else if (def.description) {
        this.itemsCache[id].description = def.description;
      }
    }
    if (this.itemsCache['pelt_jerkin']) this.itemsCache['pelt_jerkin'].name = 'Leather Tunic';
    if (this.itemsCache['leather_tunic']) this.itemsCache['leather_tunic'].name = 'Leather Tunic';
    if (this.itemsCache['pelt_quiver']) this.itemsCache['pelt_quiver'].name = 'Leather Quiver';
    if (this.itemsCache['leather_quiver']) this.itemsCache['leather_quiver'].name = 'Leather Quiver';
  }

  public checkpoint() {
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)');
    } catch (err) {
      console.error('SQLite wal_checkpoint error', err);
    }
  }

  public close() {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.db.close();
    } catch (err) {
      console.error('Error closing SQLite DB', err);
    }
  }

  // --- Players ---
  public getPlayer(id: string): PlayerData | undefined {
    try {
      const row = this.stmtGetPlayer.get(id) as { data: string } | undefined;
      if (!row) return undefined;
      const player = JSON.parse(row.data) as PlayerData;
      if (this.isPlayerAdmin(player)) {
        player.role = 'admin';
      }
      // Ensure hitpoints is never below Level 10 / 1154 XP (OSRS level 10 base)
      if (!player.skills.hitpoints || player.skills.hitpoints.level < 10 || player.skills.hitpoints.xp < 1154) {
        const hpXp = Math.max(1154, player.skills.hitpoints?.xp || 1154);
        player.skills.hitpoints = {
          xp: hpXp,
          level: Math.max(10, getLevelFromXp(hpXp)),
        };
        if (!player.currentHp || player.currentHp < player.skills.hitpoints.level) {
          player.currentHp = player.skills.hitpoints.level;
        }
      }
      if (!player.skills.farming) {
        player.skills.farming = { level: 1, xp: 0 };
      }
      if (!player.farmPlots) {
        player.farmPlots = {};
      }
      if (!player.completedQuests) {
        player.completedQuests = [];
      }
      if (!player.questProgress) {
        player.questProgress = {};
      }
      if (typeof player.unlockedQueueSlots !== 'number' || player.unlockedQueueSlots < 2) {
        player.unlockedQueueSlots = 2;
      }
      if (typeof player.maxOfflineSeconds !== 'number' || player.maxOfflineSeconds < 24 * 3600) {
        player.maxOfflineSeconds = 24 * 3600;
      }
      if (!Array.isArray(player.taskQueue)) {
        player.taskQueue = [];
      }
      // Ensure targetQuantity is restored as Infinity if null (from JSON serialization)
      if (player.currentTask) {
        player.currentTask.targetQuantity = (typeof player.currentTask.targetQuantity === 'number' && player.currentTask.targetQuantity > 0)
          ? player.currentTask.targetQuantity
          : Infinity;
        if (typeof player.currentTask.completedQuantity !== 'number') {
          player.currentTask.completedQuantity = 0;
        }
      }
      if (player.bankReturnTask) {
        player.bankReturnTask.targetQuantity = (typeof player.bankReturnTask.targetQuantity === 'number' && player.bankReturnTask.targetQuantity > 0)
          ? player.bankReturnTask.targetQuantity
          : Infinity;
        if (typeof player.bankReturnTask.completedQuantity !== 'number') {
          player.bankReturnTask.completedQuantity = 0;
        }
      }
      // Migrate legacy item and recipe IDs
      const migrateSlot = (slot: InventorySlot) => {
        if (!slot) return;
        if (slot.itemId === 'pelt_jerkin') slot.itemId = 'leather_tunic';
        if (slot.itemId === 'pelt_quiver') slot.itemId = 'leather_quiver';
        if (slot.itemId === 'bogling_hide') slot.itemId = 'ghoul_hide';
        if (slot.itemId === 'bogskin_hood') slot.itemId = 'ghoulskin_hood';
        if (slot.itemId === 'bogskin_tunic') slot.itemId = 'ghoulskin_tunic';
        if (slot.itemId === 'bogskin_chaps') slot.itemId = 'ghoulskin_chaps';
        if (slot.itemId === 'bogskin_quiver') slot.itemId = 'ghoulskin_quiver';
      };
      if (player.inventory) player.inventory.forEach(migrateSlot);
      if (player.storage) player.storage.forEach(migrateSlot);
      if (player.overflowTray) player.overflowTray.forEach(migrateSlot);
      if (player.marketMailbox) {
        player.marketMailbox.forEach((m: any) => {
          if (m && m.itemId === 'bogling_hide') m.itemId = 'ghoul_hide';
          if (m && m.itemId === 'bogskin_hood') m.itemId = 'ghoulskin_hood';
          if (m && m.itemId === 'bogskin_tunic') m.itemId = 'ghoulskin_tunic';
          if (m && m.itemId === 'bogskin_chaps') m.itemId = 'ghoulskin_chaps';
          if (m && m.itemId === 'bogskin_quiver') m.itemId = 'ghoulskin_quiver';
        });
      }
      if (player.equipment) {
        if (player.equipment.body?.itemId === 'pelt_jerkin') player.equipment.body.itemId = 'leather_tunic';
        if (player.equipment.shield?.itemId === 'pelt_quiver') player.equipment.shield.itemId = 'leather_quiver';
        if (player.equipment.helmet?.itemId === 'bogskin_hood') player.equipment.helmet.itemId = 'ghoulskin_hood';
        if (player.equipment.body?.itemId === 'bogskin_tunic') player.equipment.body.itemId = 'ghoulskin_tunic';
        if (player.equipment.legs?.itemId === 'bogskin_chaps') player.equipment.legs.itemId = 'ghoulskin_chaps';
        if (player.equipment.shield?.itemId === 'bogskin_quiver') player.equipment.shield.itemId = 'ghoulskin_quiver';
      }
      if (player.currentTask) {
        if (player.currentTask.recipeId === 'craft_pelt_jerkin') player.currentTask.recipeId = 'craft_leather_tunic';
        if (player.currentTask.recipeId === 'fletch_pelt_quiver') player.currentTask.recipeId = 'fletch_leather_quiver';
        if (player.currentTask.recipeId === 'craft_bogskin_hood') player.currentTask.recipeId = 'craft_ghoulskin_hood';
        if (player.currentTask.recipeId === 'craft_bogskin_tunic') player.currentTask.recipeId = 'craft_ghoulskin_tunic';
        if (player.currentTask.recipeId === 'craft_bogskin_chaps') player.currentTask.recipeId = 'craft_ghoulskin_chaps';
        if (player.currentTask.recipeId === 'fletch_bogskin_quiver') player.currentTask.recipeId = 'fletch_ghoulskin_quiver';
      }
      if (player.bankReturnTask) {
        if (player.bankReturnTask.recipeId === 'craft_pelt_jerkin') player.bankReturnTask.recipeId = 'craft_leather_tunic';
        if (player.bankReturnTask.recipeId === 'fletch_pelt_quiver') player.bankReturnTask.recipeId = 'fletch_leather_quiver';
        if (player.bankReturnTask.recipeId === 'craft_bogskin_hood') player.bankReturnTask.recipeId = 'craft_ghoulskin_hood';
        if (player.bankReturnTask.recipeId === 'craft_bogskin_tunic') player.bankReturnTask.recipeId = 'craft_ghoulskin_tunic';
        if (player.bankReturnTask.recipeId === 'craft_bogskin_chaps') player.bankReturnTask.recipeId = 'craft_ghoulskin_chaps';
        if (player.bankReturnTask.recipeId === 'fletch_bogskin_quiver') player.bankReturnTask.recipeId = 'fletch_ghoulskin_quiver';
      }

      // Auto-consolidate stackable items in Hearth vault storage
      if (player.storage && player.storage.length > 0) {
        const consolidatedStorage: InventorySlot[] = [];
        for (const slot of player.storage) {
          const def = this.itemsCache[slot.itemId] || ITEMS[slot.itemId];
          const isStack = isItemStackable(def, 'bank');
          const maxStack = getItemMaxStack(def, 'bank');
          let remaining = slot.quantity;
          if (isStack) {
            for (const target of consolidatedStorage) {
              if (
                target.itemId === slot.itemId &&
                (target.rarity || 'plain') === (slot.rarity || 'plain') &&
                (target.plus || 0) === (slot.plus || 0) &&
                target.quantity < maxStack
              ) {
                const canAdd = Math.min(remaining, maxStack - target.quantity);
                target.quantity += canAdd;
                remaining -= canAdd;
                if (remaining <= 0) break;
              }
            }
          }
          if (remaining > 0) {
            consolidatedStorage.push({ ...slot, quantity: remaining });
          }
        }
        player.storage = consolidatedStorage;
      }

      return player;
    } catch (err) {
      console.error('SQLite getPlayer error', err);
      return undefined;
    }
  }

  public getPlayerByUsername(username: string): PlayerData | undefined {
    const trimmed = (username || '').trim();
    if (!trimmed) return undefined;
    const account = this.getAccountByUsername(trimmed);
    if (account && account.playerId) {
      return this.getPlayer(account.playerId);
    }
    try {
      const row = this.db.prepare('SELECT id FROM players WHERE username = ? COLLATE NOCASE').get(trimmed) as { id: string } | undefined;
      if (row) return this.getPlayer(row.id);
    } catch (err) {
      console.error('SQLite getPlayerByUsername error', err);
    }
    return undefined;
  }

  public savePlayer(player: PlayerData) {
    if (this.isPlayerAdmin(player)) {
      player.role = 'admin';
    }
    try {
      this.stmtSavePlayer.run(
        player.id,
        player.username,
        player.role || 'player',
        player.isGuest ? 1 : 0,
        JSON.stringify(player),
        Date.now()
      );
    } catch (err) {
      console.error('SQLite savePlayer error', err);
    }
  }

  public deletePlayer(playerId: string) {
    try {
      this.stmtDeletePlayer.run(playerId);
    } catch (err) {
      console.error('SQLite deletePlayer error', err);
    }
  }

  public clearBotPlayers() {
    try {
      this.stmtDeleteBotPlayers.run();
    } catch (err) {
      console.error('SQLite clearBotPlayers error', err);
    }
  }

  public isPlayerAdmin(player: PlayerData): boolean {
    if (!player) return false;
    const adminUsernames = this.getAdminUsernames();
    const adminIds = (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (player.id && adminIds.includes(player.id.toLowerCase())) return true;
    if (!player.isGuest && player.username && adminUsernames.includes(player.username.toLowerCase())) return true;
    return player.role === 'admin';
  }

  public getAdminUsernames(): string[] {
    return (process.env.ADMIN_USERNAMES || 'gar,admin')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  public isAdminUsername(username: string): boolean {
    return this.getAdminUsernames().includes(username.trim().toLowerCase());
  }

  public createGuestPlayer(desiredUsername?: string): PlayerData {
    const id = 'guest_' + crypto.randomBytes(6).toString('hex');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = desiredUsername ? desiredUsername.trim().slice(0, 16) : `Wanderer_${randomSuffix}`;

    const newPlayer: PlayerData = {
      id,
      username,
      role: 'player',
      isGuest: true,
      x: PLAYER_SPAWN_POINT.x,
      y: PLAYER_SPAWN_POINT.y,
      gold: 50,
      gems: 0,
      anima: 0,
      activeTitle: 'Novice of Eldoria',
      skills: JSON.parse(JSON.stringify(INITIAL_SKILLS)),
      inventory: [
        { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'rune_axe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'fishing_rod_willow', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'dawnburn_blade', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'smoked_prawn', quantity: 15, rarity: 'plain', plus: 0 },
        { itemId: 'earthtuber_seed', quantity: 5, rarity: 'plain', plus: 0 },
        { itemId: 'silverleaf_seed', quantity: 5, rarity: 'plain', plus: 0 },
      ],
      storage: [],
      storageSlotsMax: 75,
      overflowTray: [],
      equipment: {
        tool_pickaxe: { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        tool_axe: { itemId: 'rune_axe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        tool_rod: { itemId: 'fishing_rod_willow', quantity: 1, rarity: 'plain', plus: 0 },
        weapon: { itemId: 'dawnburn_blade', quantity: 1, rarity: 'plain', plus: 0 },
      },
      currentTask: null,
      taskQueue: [],
      unlockedQueueSlots: 2,
      maxOfflineSeconds: 24 * 3600,
      eatsAtHpPercent: 50,
      selectedFoodItemId: null,
      currentHp: 10,
      lastActiveTimestamp: Date.now(),
      completedQuests: [],
      questProgress: {},
    };

    this.savePlayer(newPlayer);
    return newPlayer;
  }

  public getLeaderboard(category: 'total' | SkillType = 'total', limit: number = 50): Array<{
    rank: number;
    username: string;
    level: number;
    xp: number;
    isGuest: boolean;
  }> {
    try {
      const rows = this.db.prepare('SELECT data FROM players').all() as Array<{ data: string }>;
      const entries: Array<{ username: string; level: number; xp: number; isGuest: boolean }> = [];

      for (const row of rows) {
        try {
          const p = JSON.parse(row.data) as PlayerData;
          // Admins and bots must not count towards the leaderboard
          if (this.isPlayerAdmin(p) || p.role === 'admin' || p.id.startsWith('bot_')) {
            continue;
          }

          if (category === 'total') {
            let totalLevel = 0;
            let totalXp = 0;
            if (p.skills) {
              for (const sk of Object.values(p.skills)) {
                totalLevel += sk.level || 1;
                totalXp += sk.xp || 0;
              }
            }
            entries.push({
              username: p.username || 'Adventurer',
              level: totalLevel,
              xp: totalXp,
              isGuest: !!p.isGuest,
            });
          } else {
            const skillData = p.skills?.[category as SkillType] || { level: 1, xp: 0 };
            entries.push({
              username: p.username || 'Adventurer',
              level: skillData.level || 1,
              xp: skillData.xp || 0,
              isGuest: !!p.isGuest,
            });
          }
        } catch {}
      }

      // Sort by level DESC, then xp DESC, then username ASC
      entries.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.xp !== a.xp) return b.xp - a.xp;
        return a.username.localeCompare(b.username);
      });

      return entries.slice(0, limit).map((entry, idx) => ({
        rank: idx + 1,
        ...entry,
      }));
    } catch (err) {
      console.error('getLeaderboard error', err);
      return [];
    }
  }

  public createPersistentPlayer(username: string): PlayerData {
    const id = 'player_' + crypto.randomBytes(6).toString('hex');
    const isAdmin = this.isAdminUsername(username);

    const newPlayer: PlayerData = {
      id,
      username,
      role: isAdmin ? 'admin' : 'player',
      isGuest: false,
      x: PLAYER_SPAWN_POINT.x,
      y: PLAYER_SPAWN_POINT.y,
      gold: 50,
      gems: 0,
      anima: 0,
      activeTitle: 'Novice of Eldoria',
      skills: JSON.parse(JSON.stringify(INITIAL_SKILLS)),
      inventory: [
        { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'rune_axe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'fishing_rod_willow', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'dawnburn_blade', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'smoked_prawn', quantity: 15, rarity: 'plain', plus: 0 },
        { itemId: 'earthtuber_seed', quantity: 5, rarity: 'plain', plus: 0 },
        { itemId: 'silverleaf_seed', quantity: 5, rarity: 'plain', plus: 0 },
      ],
      storage: [],
      storageSlotsMax: 75,
      overflowTray: [],
      equipment: {
        tool_pickaxe: { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        tool_axe: { itemId: 'rune_axe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        tool_rod: { itemId: 'fishing_rod_willow', quantity: 1, rarity: 'plain', plus: 0 },
        weapon: { itemId: 'dawnburn_blade', quantity: 1, rarity: 'plain', plus: 0 },
      },
      currentTask: null,
      taskQueue: [],
      unlockedQueueSlots: 2,
      maxOfflineSeconds: 24 * 3600,
      eatsAtHpPercent: 50,
      selectedFoodItemId: null,
      currentHp: 10,
      lastActiveTimestamp: Date.now(),
      completedQuests: [],
      questProgress: {},
    };

    this.savePlayer(newPlayer);
    return newPlayer;
  }

  // --- Accounts & Authentication ---
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, s, 64).toString('hex');
    return { hash, salt: s };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }


  public isUsernameTaken(username: string): boolean {
    const norm = username.trim().toLowerCase();
    const row = this.stmtGetAccountByUsername.get(norm);
    return !!row;
  }

  public getAccountByUsername(username: string): AccountRecord | undefined {
    const norm = username.trim().toLowerCase();
    const row = this.stmtGetAccountByUsername.get(norm) as any;
    if (!row) return undefined;
    let titles: string[] = [];
    try {
      titles = JSON.parse(row.referral_titles_claimed || '[]');
    } catch {}
    return {
      id: row.id,
      username: row.username,
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      salt: row.salt,
      playerId: row.player_id,
      createdAt: row.created_at,
      referredBy: row.referred_by || null,
      referralRewardsClaimed: row.referral_rewards_claimed || 0,
      referralTitlesClaimed: titles,
    };
  }

  public getAccountById(id: string): AccountRecord | undefined {
    const row = this.stmtGetAccountById.get(id) as any;
    if (!row) return undefined;
    let titles: string[] = [];
    try {
      titles = JSON.parse(row.referral_titles_claimed || '[]');
    } catch {}
    return {
      id: row.id,
      username: row.username,
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      salt: row.salt,
      playerId: row.player_id,
      createdAt: row.created_at,
      referredBy: row.referred_by || null,
      referralRewardsClaimed: row.referral_rewards_claimed || 0,
      referralTitlesClaimed: titles,
    };
  }

  public createSession(accountId: string, playerId: string): string {
    const token = 'sess_' + crypto.randomBytes(24).toString('hex');
    this.stmtInsertSession.run(token, accountId, playerId, Date.now());
    return token;
  }

  public getSession(token: string): SessionRecord | undefined {
    const row = this.stmtGetSession.get(token) as any;
    if (!row) return undefined;
    return {
      token: row.token,
      accountId: row.account_id,
      playerId: row.player_id,
      createdAt: row.created_at,
    };
  }

  public deleteSession(token: string) {
    this.stmtDeleteSession.run(token);
  }

  public registerAccount(
    rawUsername: string,
    rawPassword: string,
    guestId?: string,
    rawReferralCode?: string
  ): { success: true; account: AccountRecord; player: PlayerData; token: string } | { success: false; error: string } {
    const username = (rawUsername || '').trim();
    if (username.length < 3 || username.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { success: false, error: 'Username may only contain letters, numbers, and underscores.' };
    }
    const norm = username.toLowerCase();
    if (this.isUsernameTaken(norm)) {
      return { success: false, error: 'That username is already registered. Please choose another or log in.' };
    }
    if (!rawPassword || rawPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    // Resolve referredBy inviter username (cannot refer yourself)
    let referredByNorm: string | null = null;
    if (rawReferralCode) {
      const refClean = rawReferralCode.trim().toLowerCase();
      if (refClean && refClean !== norm) {
        const inviter = this.getAccountByUsername(refClean);
        if (inviter) {
          referredByNorm = inviter.normalizedUsername;
        }
      }
    }

    const { hash, salt } = this.hashPassword(rawPassword);
    const accountId = 'acc_' + crypto.randomBytes(8).toString('hex');

    let player: PlayerData | undefined;
    if (guestId) {
      player = this.getPlayer(guestId);
      if (player) {
        player.username = username;
        player.isGuest = false;
        if (this.isAdminUsername(username)) {
          player.role = 'admin';
        }
      }
    }

    if (!player) {
      player = this.createPersistentPlayer(username);
    }

    this.savePlayer(player);

    const account: AccountRecord = {
      id: accountId,
      username,
      normalizedUsername: norm,
      passwordHash: hash,
      salt,
      playerId: player.id,
      createdAt: Date.now(),
      referredBy: referredByNorm,
      referralRewardsClaimed: 0,
      referralTitlesClaimed: [],
    };

    this.stmtInsertAccount.run(
      account.id,
      account.username,
      account.normalizedUsername,
      account.passwordHash,
      account.salt,
      account.playerId,
      account.createdAt,
      account.referredBy,
      account.referralRewardsClaimed || 0,
      JSON.stringify(account.referralTitlesClaimed || [])
    );

    const token = this.createSession(account.id, player.id);
    return { success: true, account, player, token };
  }

  public loginAccount(
    rawUsername: string,
    rawPassword: string
  ): { success: true; account: AccountRecord; player: PlayerData; token: string } | { success: false; error: string } {
    const username = (rawUsername || '').trim();
    const account = this.getAccountByUsername(username);
    if (!account) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const isValid = this.verifyPassword(rawPassword, account.passwordHash, account.salt);
    if (!isValid) {
      return { success: false, error: 'Invalid username or password.' };
    }

    let player = this.getPlayer(account.playerId);
    if (!player) {
      player = this.createPersistentPlayer(account.username);
      account.playerId = player.id;
      this.db.prepare('UPDATE accounts SET player_id = ? WHERE id = ?').run(player.id, account.id);
    }

    if (this.isAdminUsername(account.username)) {
      player.role = 'admin';
    }
    this.savePlayer(player);

    const token = this.createSession(account.id, player.id);
    return { success: true, account, player, token };
  }

  public getAccountByPlayerId(playerId: string): AccountRecord | undefined {
    const row = this.db.prepare('SELECT * FROM accounts WHERE player_id = ?').get(playerId) as any;
    if (!row) return undefined;
    let titles: string[] = [];
    try {
      titles = JSON.parse(row.referral_titles_claimed || '[]');
    } catch {}
    return {
      id: row.id,
      username: row.username,
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      salt: row.salt,
      playerId: row.player_id,
      createdAt: row.created_at,
      referredBy: row.referred_by || null,
      referralRewardsClaimed: row.referral_rewards_claimed || 0,
      referralTitlesClaimed: titles,
    };
  }

  public getReferralSummary(account: AccountRecord): import('@eldoria/shared').ReferralSummary {
    const norm = account.normalizedUsername;
    const rows = this.db
      .prepare('SELECT username, player_id, created_at FROM accounts WHERE referred_by = ? ORDER BY created_at DESC')
      .all(norm) as Array<{ username: string; player_id: string; created_at: number }>;

    let qualifiedCount = 0;
    const referrals: Array<{ username: string; totalLevel: number; qualified: boolean; createdAt: number }> = [];

    for (const r of rows) {
      const p = this.getPlayer(r.player_id);
      let totalLvl = 1;
      if (p && p.skills) {
        totalLvl = Object.values(p.skills).reduce((acc: number, s: any) => acc + (s.level || 1), 0);
      }
      const qualified = totalLvl >= 100;
      if (qualified) qualifiedCount++;
      referrals.push({
        username: r.username,
        totalLevel: totalLvl,
        qualified,
        createdAt: r.created_at,
      });
    }

    // Calculate total earned gems according to ladder:
    // 1 qualified -> 50 gems
    // 3 qualified -> 50 + 150 = 200 gems
    // 5 qualified -> 50 + 150 + 300 = 500 gems
    // Each additional above 5 -> +50 gems each
    let totalEarnableGems = 0;
    if (qualifiedCount >= 1) totalEarnableGems += 50;
    if (qualifiedCount >= 3) totalEarnableGems += 150;
    if (qualifiedCount >= 5) totalEarnableGems += 300;
    if (qualifiedCount > 5) {
      totalEarnableGems += (qualifiedCount - 5) * 50;
    }

    const claimedGems = account.referralRewardsClaimed || 0;
    const unclaimedGems = Math.max(0, totalEarnableGems - claimedGems);

    return {
      referralCode: account.username,
      referralUrl: `https://eldoriaidle.site?ref=${encodeURIComponent(account.username)}`,
      totalReferred: rows.length,
      qualifiedCount,
      claimedGems,
      unclaimedGems,
      claimedTitles: account.referralTitlesClaimed || [],
      referrals,
    };
  }

  public claimReferralRewards(account: AccountRecord): { gemsAwarded: number; newTitles: string[] } {
    const summary = this.getReferralSummary(account);
    const gemsAwarded = summary.unclaimedGems;
    const newTitles: string[] = [];

    const existingTitles = new Set(account.referralTitlesClaimed || []);
    if (summary.qualifiedCount >= 1 && !existingTitles.has('Herald of Eldoria')) {
      newTitles.push('Herald of Eldoria');
      existingTitles.add('Herald of Eldoria');
    }
    if (summary.qualifiedCount >= 3 && !existingTitles.has('Vanguard Recruiter')) {
      newTitles.push('Vanguard Recruiter');
      existingTitles.add('Vanguard Recruiter');
    }
    if (summary.qualifiedCount >= 5 && !existingTitles.has('Realm Ambassador')) {
      newTitles.push('Realm Ambassador');
      existingTitles.add('Realm Ambassador');
    }

    const updatedClaimedGems = (account.referralRewardsClaimed || 0) + gemsAwarded;
    const updatedTitlesList = Array.from(existingTitles);

    account.referralRewardsClaimed = updatedClaimedGems;
    account.referralTitlesClaimed = updatedTitlesList;

    this.db
      .prepare('UPDATE accounts SET referral_rewards_claimed = ?, referral_titles_claimed = ? WHERE id = ?')
      .run(updatedClaimedGems, JSON.stringify(updatedTitlesList), account.id);

    return { gemsAwarded, newTitles };
  }

  private syncJsonFile(filename: string, data: any) {
    try {
      const p = path.join(DATA_DIR, filename);
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed to sync ${filename}`, err);
    }
  }

  // --- World Nodes ---
  public getWorldNodes(): WorldNode[] {
    return this.nodesCache;
  }

  public saveWorldNodes(nodes: WorldNode[]) {
    this.nodesCache = nodes;
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM world_nodes').run();
      for (const n of nodes) {
        this.stmtUpsertWorldNode.run(n.id, n.type, JSON.stringify(n));
      }
    });
    tx();
    this.checkpoint();
    this.syncJsonFile('world_nodes.json', this.nodesCache);
  }

  public upsertWorldNode(node: WorldNode) {
    const idx = this.nodesCache.findIndex(n => n.id === node.id);
    if (idx >= 0) {
      this.nodesCache[idx] = node;
    } else {
      this.nodesCache.push(node);
    }
    this.stmtUpsertWorldNode.run(node.id, node.type, JSON.stringify(node));
    this.checkpoint();
    this.syncJsonFile('world_nodes.json', this.nodesCache);
  }

  public deleteWorldNode(nodeId: string) {
    this.nodesCache = this.nodesCache.filter(n => n.id !== nodeId);
    this.stmtDeleteWorldNode.run(nodeId);
    this.checkpoint();
    this.syncJsonFile('world_nodes.json', this.nodesCache);
  }

  // --- Monster Spawn Zones ---
  public getMonsterZones(): MonsterSpawnZone[] {
    return this.monsterZonesCache;
  }

  public saveMonsterZones(zones: MonsterSpawnZone[]) {
    this.monsterZonesCache = zones;
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM monster_zones').run();
      for (const z of zones) {
        this.stmtUpsertMonsterZone.run(z.id, JSON.stringify(z));
      }
    });
    tx();
    this.checkpoint();
    this.syncJsonFile('monster_zones.json', this.monsterZonesCache);
  }

  public upsertMonsterZone(zone: MonsterSpawnZone) {
    const idx = this.monsterZonesCache.findIndex(z => z.id === zone.id);
    if (idx >= 0) {
      this.monsterZonesCache[idx] = zone;
    } else {
      this.monsterZonesCache.push(zone);
    }
    this.stmtUpsertMonsterZone.run(zone.id, JSON.stringify(zone));
    this.checkpoint();
    this.syncJsonFile('monster_zones.json', this.monsterZonesCache);
  }

  public deleteMonsterZone(zoneId: string) {
    this.monsterZonesCache = this.monsterZonesCache.filter(z => z.id !== zoneId);
    this.stmtDeleteMonsterZone.run(zoneId);
    this.checkpoint();
    this.syncJsonFile('monster_zones.json', this.monsterZonesCache);
  }

  // --- NPCs ---
  public getNpcs(): NpcDefinition[] {
    return this.npcsCache;
  }

  public saveNpcs(npcs: NpcDefinition[]) {
    this.npcsCache = npcs;
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM npcs').run();
      for (const n of npcs) {
        this.stmtUpsertNpc.run(n.id, JSON.stringify(n));
      }
    });
    tx();
    this.checkpoint();
    this.syncJsonFile('npcs.json', this.npcsCache);
  }

  public upsertNpc(npc: NpcDefinition) {
    const idx = this.npcsCache.findIndex(n => n.id === npc.id);
    if (idx >= 0) {
      this.npcsCache[idx] = npc;
    } else {
      this.npcsCache.push(npc);
    }
    this.stmtUpsertNpc.run(npc.id, JSON.stringify(npc));
    this.checkpoint();
    this.syncJsonFile('npcs.json', this.npcsCache);
  }

  public deleteNpc(npcId: string) {
    this.npcsCache = this.npcsCache.filter(n => n.id !== npcId);
    this.stmtDeleteNpc.run(npcId);
    this.checkpoint();
    this.syncJsonFile('npcs.json', this.npcsCache);
  }

  // --- Quests ---
  public getQuests(): QuestDefinition[] {
    return this.questsCache;
  }

  public saveQuests(quests: QuestDefinition[]) {
    this.questsCache = quests;
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM quests').run();
      for (const q of quests) {
        this.stmtUpsertQuest.run(q.id, JSON.stringify(q));
      }
    });
    tx();
    this.checkpoint();
    this.syncJsonFile('quests.json', this.questsCache);
  }

  public upsertQuest(quest: QuestDefinition) {
    const idx = this.questsCache.findIndex(q => q.id === quest.id);
    if (idx >= 0) {
      this.questsCache[idx] = quest;
    } else {
      this.questsCache.push(quest);
    }
    this.stmtUpsertQuest.run(quest.id, JSON.stringify(quest));
    this.checkpoint();
    this.syncJsonFile('quests.json', this.questsCache);
  }

  public deleteQuest(questId: string) {
    this.questsCache = this.questsCache.filter(q => q.id !== questId);
    this.stmtDeleteQuest.run(questId);
    this.checkpoint();
    this.syncJsonFile('quests.json', this.questsCache);
  }

  // --- Collisions ---
  public getCollisions(): Set<string> {
    return this.collisionsCache;
  }

  public loadLdtkMapBounds() {
    try {
      const candidates = [
        path.join(PROJECT_ROOT, 'packages', 'client', 'public', 'maps', 'world.ldtk'),
        path.join(PROJECT_ROOT, 'client', 'public', 'maps', 'world.ldtk'),
        path.join(process.cwd(), 'packages', 'client', 'public', 'maps', 'world.ldtk'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
          this.levelBounds = parseLdtkLevelBounds(raw.levels);
          console.log(`[World] Loaded ${this.levelBounds.length} LDtk map boundaries for void collision blocking.`);
          break;
        }
      }
    } catch (err) {
      console.warn('Could not load LDtk map bounds for server void collisions', err);
    }
  }

  public getLevelBounds(): LevelBounds[] {
    return this.levelBounds;
  }

  public isCollidable(x: number, y: number): boolean {
    if (this.levelBounds.length > 0 && !isTileInAnyLevel(x, y, this.levelBounds)) {
      return true; // The Void is impassable!
    }
    return this.collisionsCache.has(`${x},${y}`);
  }

  public saveCollisions(cols: string[] | Set<string>) {
    const arr = Array.from(cols);
    this.collisionsCache = new Set<string>(arr);
    const tx = this.db.transaction(() => {
      this.stmtDeleteAllCollisions.run();
      for (const coord of arr) {
        this.stmtInsertCollision.run(coord);
      }
    });
    tx();
    this.checkpoint();
    this.syncJsonFile('collisions.json', Array.from(this.collisionsCache));
  }

  public addCollision(coord: string) {
    this.collisionsCache.add(coord);
    this.stmtInsertCollision.run(coord);
    this.checkpoint();
    this.syncJsonFile('collisions.json', Array.from(this.collisionsCache));
  }

  public removeCollision(coord: string) {
    this.collisionsCache.delete(coord);
    this.db.prepare('DELETE FROM collisions WHERE coord = ?').run(coord);
    this.checkpoint();
    this.syncJsonFile('collisions.json', Array.from(this.collisionsCache));
  }

  // --- Items ---
  public getItems(): Record<string, ItemDefinition> {
    return this.itemsCache;
  }

  public getItem(id: string): ItemDefinition | undefined {
    if (id === 'pelt_jerkin') return this.itemsCache['leather_tunic'] || this.itemsCache['pelt_jerkin'] || ITEMS['leather_tunic'] || ITEMS['pelt_jerkin'];
    if (id === 'pelt_quiver') return this.itemsCache['leather_quiver'] || this.itemsCache['pelt_quiver'] || ITEMS['leather_quiver'] || ITEMS['pelt_quiver'];
    return this.itemsCache[id] || ITEMS[id];
  }

  public saveItem(item: ItemDefinition) {
    this.itemsCache[item.id] = item;
    this.stmtUpsertItem.run(item.id, JSON.stringify(item));
    this.checkpoint();
    this.syncJsonFile('items.json', Object.values(this.itemsCache));
  }

  public deleteItem(id: string) {
    this.stmtDeleteItem.run(id);
    if (ITEMS[id]) {
      this.itemsCache[id] = { ...ITEMS[id] };
    } else {
      delete this.itemsCache[id];
    }
    this.checkpoint();
    this.syncJsonFile('items.json', Object.values(this.itemsCache));
  }

  // --- Admin Verification ---
  public verifyAdminSecret(secret: string): boolean {
    if (!secret) return false;
    return secret.trim() === ADMIN_SECRET;
  }

  // --- Marketplace Methods ---
  private normalizeMarketItemId(id: string): string {
    if (id === 'bogling_hide') return 'ghoul_hide';
    if (id === 'bogskin_hood') return 'ghoulskin_hood';
    if (id === 'bogskin_tunic') return 'ghoulskin_tunic';
    if (id === 'bogskin_chaps') return 'ghoulskin_chaps';
    if (id === 'bogskin_quiver') return 'ghoulskin_quiver';
    return id;
  }

  public getMarketListings(): MarketListing[] {
    const rows = this.stmtGetMarketListings.all() as any[];
    return rows.map(r => ({
      id: r.id,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      itemId: this.normalizeMarketItemId(r.item_id),
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      rarity: r.rarity,
      plus: r.plus,
      createdAt: r.created_at,
    }));
  }

  public getMarketListing(id: string): MarketListing | null {
    const r = this.stmtGetMarketListingById.get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      itemId: this.normalizeMarketItemId(r.item_id),
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      rarity: r.rarity,
      plus: r.plus,
      createdAt: r.created_at,
    };
  }

  public createMarketListing(listing: MarketListing): void {
    this.stmtInsertMarketListing.run(
      listing.id,
      listing.sellerId,
      listing.sellerName,
      listing.itemId,
      listing.quantity,
      listing.unitPrice,
      listing.totalPrice,
      listing.rarity || 'plain',
      listing.plus || 0,
      listing.createdAt || Date.now()
    );
    this.checkpoint();
  }

  public removeMarketListing(id: string): void {
    this.stmtDeleteMarketListing.run(id);
    this.checkpoint();
  }

  public recordMarketTrade(trade: MarketTradeHistory): void {
    this.stmtInsertMarketTrade.run(
      trade.id,
      trade.itemId,
      trade.quantity,
      trade.unitPrice,
      trade.totalPrice,
      trade.sellerId,
      trade.sellerName,
      trade.buyerId,
      trade.buyerName,
      trade.rarity || 'plain',
      trade.plus || 0,
      trade.timestamp || Date.now()
    );
    this.checkpoint();
  }

  public getRecentTradesForItem(itemId: string, limit = 20): MarketTradeHistory[] {
    const norm = this.normalizeMarketItemId(itemId);
    const rows = this.stmtGetRecentTradesByItem.all(norm, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      itemId: this.normalizeMarketItemId(r.item_id),
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      buyerId: r.buyer_id,
      buyerName: r.buyer_name,
      rarity: r.rarity,
      plus: r.plus,
      timestamp: r.timestamp,
    }));
  }

  public getAllRecentTrades(limit = 100): MarketTradeHistory[] {
    const rows = this.stmtGetAllRecentTrades.all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      itemId: this.normalizeMarketItemId(r.item_id),
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      buyerId: r.buyer_id,
      buyerName: r.buyer_name,
      rarity: r.rarity,
      plus: r.plus,
      timestamp: r.timestamp,
    }));
  }

  public getChangelogs(): ChangelogEntry[] {
    return [...this.changelogsCache];
  }

  public saveChangelog(entry: ChangelogEntry): void {
    const payload = JSON.stringify(entry);
    this.stmtUpsertChangelog.run(entry.id, entry.version, entry.createdAt, payload);
    const idx = this.changelogsCache.findIndex(c => c.id === entry.id);
    if (idx >= 0) {
      this.changelogsCache[idx] = entry;
    } else {
      this.changelogsCache.unshift(entry);
      this.changelogsCache.sort((a, b) => b.createdAt - a.createdAt);
    }
    this.checkpoint();
  }

  public deleteChangelog(id: string): void {
    this.stmtDeleteChangelog.run(id);
    this.changelogsCache = this.changelogsCache.filter(c => c.id !== id);
    this.checkpoint();
  }

  // --- Polls Methods ---
  public getPolls(): Poll[] {
    return [...this.pollsCache];
  }

  public savePoll(poll: Poll): void {
    const payload = JSON.stringify(poll);
    this.stmtUpsertPoll.run(poll.id, poll.isActive ? 1 : 0, poll.createdAt, payload);
    const idx = this.pollsCache.findIndex(p => p.id === poll.id);
    if (idx >= 0) {
      this.pollsCache[idx] = poll;
    } else {
      this.pollsCache.unshift(poll);
      this.pollsCache.sort((a, b) => b.createdAt - a.createdAt);
    }
    this.checkpoint();
  }

  public deletePoll(id: string): void {
    this.stmtDeletePoll.run(id);
    this.stmtDeletePollVotes.run(id);
    this.pollsCache = this.pollsCache.filter(p => p.id !== id);
    this.checkpoint();
  }

  public recordVote(pollId: string, playerId: string, optionId: string): boolean {
    const poll = this.pollsCache.find(p => p.id === pollId);
    if (!poll || !poll.isActive) return false;

    // Check if player already voted
    const existing = this.stmtGetPlayerPollVote.get(pollId, playerId) as { option_id: string } | undefined;
    if (existing) return false;

    const opt = poll.options.find(o => o.id === optionId);
    if (!opt) return false;

    return this.runTransaction(() => {
      this.stmtInsertPollVote.run(pollId, playerId, optionId, Date.now());
      opt.voteCount = (opt.voteCount || 0) + 1;
      poll.totalVotes = (poll.totalVotes || 0) + 1;
      this.savePoll(poll);
      return true;
    });
  }

  public getPlayerVote(pollId: string, playerId: string): string | null {
    const row = this.stmtGetPlayerPollVote.get(pollId, playerId) as { option_id: string } | undefined;
    return row ? row.option_id : null;
  }

  public getPlayerVotesForPolls(playerId: string): Record<string, string> {
    const rows = this.db.prepare('SELECT poll_id, option_id FROM poll_votes WHERE player_id = ?').all(playerId) as Array<{
      poll_id: string;
      option_id: string;
    }>;
    const votes: Record<string, string> = {};
    for (const r of rows) {
      votes[r.poll_id] = r.option_id;
    }
    return votes;
  }

  // --- Persistent Chat Methods ---
  public saveChatMessage(msg: StoredChatMessage): void {
    this.stmtInsertChatMessage.run(
      msg.id,
      msg.senderId || null,
      msg.senderName,
      msg.role || 'player',
      msg.isAdmin ? 1 : 0,
      msg.title || null,
      msg.channel || 'All',
      msg.text,
      msg.timestamp || Date.now()
    );
  }

  public getRecentChatMessages(limit = 60): StoredChatMessage[] {
    const rows = this.stmtGetRecentChatMessages.all(limit) as Array<{
      id: string;
      senderId?: string;
      senderName: string;
      role: 'admin' | 'player';
      isAdmin: number;
      title?: string;
      channel: string;
      text: string;
      timestamp: number;
    }>;

    return rows.reverse().map(r => ({
      id: r.id,
      senderId: r.senderId || undefined,
      senderName: r.senderName,
      role: r.role,
      isAdmin: Boolean(r.isAdmin),
      title: r.title || undefined,
      channel: r.channel,
      text: r.text,
      timestamp: r.timestamp,
    }));
  }

  public deleteChatMessage(id: string): void {
    this.stmtDeleteChatMessage.run(id);
  }

  public pruneOldChatMessages(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    this.stmtPruneOldChatMessages.run(cutoff);
  }

  // --- Dungeon Recovery (Barnaby) Methods ---
  public getDungeonRecoveries(playerId: string): DungeonRecoveryItem[] {
    const rows = this.stmtGetDungeonRecoveries.all(playerId) as Array<{
      id: string;
      player_id: string;
      dungeon_id: string;
      dungeon_name: string;
      item_id: string;
      quantity: number;
      rarity: string;
      plus: number;
      recovery_fee: number;
      timestamp: number;
    }>;

    return rows.map(r => ({
      id: r.id,
      playerId: r.player_id,
      dungeonId: r.dungeon_id,
      dungeonName: r.dungeon_name,
      itemId: r.item_id,
      quantity: r.quantity,
      rarity: (r.rarity as any) || 'plain',
      plus: r.plus || 0,
      recoveryFee: r.recovery_fee || 25,
      timestamp: r.timestamp,
    }));
  }

  public addDungeonRecovery(item: DungeonRecoveryItem): void {
    this.stmtInsertDungeonRecovery.run(
      item.id,
      item.playerId,
      item.dungeonId,
      item.dungeonName,
      item.itemId,
      item.quantity,
      item.rarity || 'plain',
      item.plus || 0,
      item.recoveryFee || 25,
      item.timestamp || Date.now()
    );
  }

  public getDungeonRecoveryById(id: string): DungeonRecoveryItem | null {
    const r = this.stmtGetDungeonRecoveryById.get(id) as {
      id: string;
      player_id: string;
      dungeon_id: string;
      dungeon_name: string;
      item_id: string;
      quantity: number;
      rarity: string;
      plus: number;
      recovery_fee: number;
      timestamp: number;
    } | undefined;

    if (!r) return null;
    return {
      id: r.id,
      playerId: r.player_id,
      dungeonId: r.dungeon_id,
      dungeonName: r.dungeon_name,
      itemId: r.item_id,
      quantity: r.quantity,
      rarity: (r.rarity as any) || 'plain',
      plus: r.plus || 0,
      recoveryFee: r.recovery_fee || 25,
      timestamp: r.timestamp,
    };
  }

  public deleteDungeonRecovery(id: string): void {
    this.stmtDeleteDungeonRecovery.run(id);
  }

  // Execute in an atomic SQLite transaction
  public runTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Legacy no-op compatibility helpers
  public savePlayers() {}
  public saveAccounts() {}
  public saveSessions() {}
  public saveAll() {}
}

export const storage = new StorageManager();
