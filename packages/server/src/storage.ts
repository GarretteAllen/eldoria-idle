import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { PlayerData, SkillType, WorldNode, NpcDefinition, QuestDefinition, getLevelFromXp } from '@eldoria/shared';
import { WORLD_NODES as DEFAULT_WORLD_NODES } from './world.js';

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
console.log(`🗄️ SQLite Database: ${DB_FILE}`);

export interface AccountRecord {
  id: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  salt: string;
  playerId: string;
  createdAt: number;
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
  hitpoints: { xp: 1478, level: 10 },
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

  // Prepared Statements
  private stmtGetPlayer: Database.Statement;
  private stmtSavePlayer: Database.Statement;
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

    this.stmtGetAccountByUsername = this.db.prepare('SELECT * FROM accounts WHERE normalized_username = ?');
    this.stmtGetAccountById = this.db.prepare('SELECT * FROM accounts WHERE id = ?');
    this.stmtInsertAccount = this.db.prepare(
      `INSERT INTO accounts (id, username, normalized_username, password_hash, salt, player_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
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

    // Run automatic migration from legacy json files if upgrading
    this.migrateLegacyJson();

    // Load active caches
    this.loadCaches();
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
        created_at INTEGER NOT NULL
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

      CREATE INDEX IF NOT EXISTS idx_accounts_norm_user ON accounts(normalized_username);
      CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
    `);
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
        console.log(`📦 SQLite: Migrated legacy players from players.json`);
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
        console.log(`📦 SQLite: Migrated legacy accounts from accounts.json`);
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
    // Preserve all existing data and do not re-seed defaults!
    const existingAccounts = (this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }).count;
    const existingPlayers = (this.db.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count;
    if (existingAccounts > 0 || existingPlayers > 0) {
      console.log('📦 SQLite: Active world detected. Preserving custom NPCs, nodes, and quests without overwriting.');
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

    this.stmtSetMeta.run('world_seeded', 'true');
    this.checkpoint();
  }

  private loadCaches() {
    // World nodes
    const nodeRows = this.stmtGetWorldNodes.all() as Array<{ data: string }>;
    this.nodesCache = nodeRows.map(r => JSON.parse(r.data));

    // Ensure farm plots and universal stations exist in world nodes!
    let nodesUpdated = false;
    const farmPlotsNeeded: WorldNode[] = [
      { id: 'farm_plot_1', name: 'Verdant Allotment (Plot I)', type: 'farm', x: 13, y: 22 },
      { id: 'farm_plot_2', name: 'Verdant Allotment (Plot II)', type: 'farm', x: 14, y: 24 },
    ];
    for (const plot of farmPlotsNeeded) {
      if (!this.nodesCache.some(n => n.id === plot.id)) {
        this.nodesCache.push(plot);
        nodesUpdated = true;
      }
    }
    // Universalize hearth_fire and hearth_forge if still bound to single recipe
    for (const n of this.nodesCache) {
      if (n.id === 'hearth_fire' && n.recipeId) {
        delete n.recipeId;
        nodesUpdated = true;
      }
      if (n.id === 'hearth_forge' && n.recipeId) {
        delete n.recipeId;
        nodesUpdated = true;
      }
    }
    if (nodesUpdated) {
      this.saveWorldNodes(this.nodesCache);
    }

    // NPCs
    const npcRows = this.stmtGetNpcs.all() as Array<{ data: string }>;
    this.npcsCache = npcRows.map(r => JSON.parse(r.data));

    // Quests
    const questRows = this.stmtGetQuests.all() as Array<{ data: string }>;
    this.questsCache = questRows.map(r => JSON.parse(r.data));

    // Collisions
    const collRows = this.stmtGetCollisions.all() as Array<{ coord: string }>;
    this.collisionsCache = new Set<string>(collRows.map(r => r.coord));
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
      // Ensure hitpoints is never below Level 10 / 1478 XP
      if (!player.skills.hitpoints || player.skills.hitpoints.level < 10 || player.skills.hitpoints.xp < 1478) {
        const hpXp = Math.max(1478, player.skills.hitpoints?.xp || 1478);
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
      x: 8,
      y: 24,
      gold: 50,
      gems: 0,
      anima: 0,
      activeTitle: 'Novice of Eldoria',
      skills: JSON.parse(JSON.stringify(INITIAL_SKILLS)),
      inventory: [
        { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'smoked_prawn', quantity: 10, rarity: 'plain', plus: 0 },
        { itemId: 'earthtuber_seed', quantity: 5, rarity: 'plain', plus: 0 },
      ],
      storage: [],
      storageSlotsMax: 75,
      overflowTray: [],
      equipment: {
        tool: { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
      },
      currentTask: {
        recipeId: 'mine_pyrite',
        skill: 'mining',
        startedAtTick: 0,
        targetQuantity: Infinity,
        completedQuantity: 0,
        targetNodeX: 6,
        targetNodeY: 5,
      },
      taskQueue: [],
      eatsAtHpPercent: 50,
      currentHp: 10,
      lastActiveTimestamp: Date.now(),
    };

    this.savePlayer(newPlayer);
    return newPlayer;
  }

  public createPersistentPlayer(username: string): PlayerData {
    const id = 'player_' + crypto.randomBytes(6).toString('hex');
    const isAdmin = this.isAdminUsername(username);

    const newPlayer: PlayerData = {
      id,
      username,
      role: isAdmin ? 'admin' : 'player',
      isGuest: false,
      x: 8,
      y: 24,
      gold: 50,
      gems: 0,
      anima: 0,
      activeTitle: 'Novice of Eldoria',
      skills: JSON.parse(JSON.stringify(INITIAL_SKILLS)),
      inventory: [
        { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'smoked_prawn', quantity: 10, rarity: 'plain', plus: 0 },
        { itemId: 'earthtuber_seed', quantity: 5, rarity: 'plain', plus: 0 },
      ],
      storage: [],
      storageSlotsMax: 75,
      overflowTray: [],
      equipment: {
        tool: { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
      },
      currentTask: {
        recipeId: 'mine_pyrite',
        skill: 'mining',
        startedAtTick: 0,
        targetQuantity: Infinity,
        completedQuantity: 0,
        targetNodeX: 6,
        targetNodeY: 5,
      },
      taskQueue: [],
      eatsAtHpPercent: 50,
      currentHp: 10,
      lastActiveTimestamp: Date.now(),
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
    return {
      id: row.id,
      username: row.username,
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      salt: row.salt,
      playerId: row.player_id,
      createdAt: row.created_at,
    };
  }

  public getAccountById(id: string): AccountRecord | undefined {
    const row = this.stmtGetAccountById.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      username: row.username,
      normalizedUsername: row.normalized_username,
      passwordHash: row.password_hash,
      salt: row.salt,
      playerId: row.player_id,
      createdAt: row.created_at,
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
    guestId?: string
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
    };

    this.stmtInsertAccount.run(
      account.id,
      account.username,
      account.normalizedUsername,
      account.passwordHash,
      account.salt,
      account.playerId,
      account.createdAt
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

  public isCollidable(x: number, y: number): boolean {
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

  // --- Admin Verification ---
  public verifyAdminSecret(secret: string): boolean {
    if (!secret) return false;
    return secret.trim() === ADMIN_SECRET;
  }

  // Legacy no-op compatibility helpers
  public savePlayers() {}
  public saveAccounts() {}
  public saveSessions() {}
  public saveAll() {}
}

export const storage = new StorageManager();
