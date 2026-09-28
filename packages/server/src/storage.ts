import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PlayerData, SkillType, WorldNode, NpcDefinition, QuestDefinition } from '@eldoria/shared';
import { WORLD_NODES as DEFAULT_WORLD_NODES } from './world.js';

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  const current = process.cwd();
  // Check if cwd is already root
  if (fs.existsSync(path.join(current, 'packages', 'server'))) {
    return path.join(current, 'data');
  }
  // Check if cwd is inside packages/server
  if (fs.existsSync(path.join(current, '..', '..', 'packages', 'server'))) {
    return path.resolve(current, '..', '..', 'data');
  }
  return path.join(current, 'data');
}

const DATA_DIR = resolveDataDir();
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const NODES_FILE = path.join(DATA_DIR, 'world_nodes.json');
const NPCS_FILE = path.join(DATA_DIR, 'npcs.json');
const QUESTS_FILE = path.join(DATA_DIR, 'quests.json');
const COLLISIONS_FILE = path.join(DATA_DIR, 'collisions.json');

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
  hitpoints: { xp: 0, level: 10 },
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

// Default water edge / wall obstacles for level_0 Hearth town boundaries
const DEFAULT_COLLISIONS: string[] = [
  // Deep river tiles south boundary
  '0,37', '1,37', '2,37', '3,37',
  '14,37', '15,37', '16,37', '17,37',
  // Stone masonry walls in town
  '7,21', '8,21', '10,21',
  '5,23', '7,23', '9,23', '11,23',
];

class StorageManager {
  private players = new Map<string, PlayerData>();
  private nodes: WorldNode[] = [];
  private npcs: NpcDefinition[] = [];
  private quests: QuestDefinition[] = [];
  private collisions = new Set<string>();

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Players
    if (fs.existsSync(PLAYERS_FILE)) {
      try {
        const raw = fs.readFileSync(PLAYERS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [id, player] of Object.entries(data)) {
          this.players.set(id, player as PlayerData);
        }
      } catch (err) {
        console.error('Failed to parse players.json, starting fresh', err);
      }
    }

    // 2. World Nodes
    if (fs.existsSync(NODES_FILE)) {
      try {
        const raw = fs.readFileSync(NODES_FILE, 'utf-8');
        this.nodes = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse world_nodes.json, using defaults', err);
        this.nodes = [...DEFAULT_WORLD_NODES];
      }
    } else {
      this.nodes = [...DEFAULT_WORLD_NODES];
      this.saveWorldNodes(this.nodes);
    }

    // 3. NPCs
    if (fs.existsSync(NPCS_FILE)) {
      try {
        const raw = fs.readFileSync(NPCS_FILE, 'utf-8');
        this.npcs = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse npcs.json, using defaults', err);
        this.npcs = [...DEFAULT_NPCS];
      }
    } else {
      this.npcs = [...DEFAULT_NPCS];
      this.saveNpcs(this.npcs);
    }

    // 4. Quests
    if (fs.existsSync(QUESTS_FILE)) {
      try {
        const raw = fs.readFileSync(QUESTS_FILE, 'utf-8');
        this.quests = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse quests.json, using defaults', err);
        this.quests = [...DEFAULT_QUESTS];
      }
    } else {
      this.quests = [...DEFAULT_QUESTS];
      this.saveQuests(this.quests);
    }

    // 5. Collisions
    if (fs.existsSync(COLLISIONS_FILE)) {
      try {
        const raw = fs.readFileSync(COLLISIONS_FILE, 'utf-8');
        const arr = JSON.parse(raw);
        this.collisions = new Set<string>(arr);
      } catch (err) {
        console.error('Failed to parse collisions.json, using defaults', err);
        this.collisions = new Set<string>(DEFAULT_COLLISIONS);
      }
    } else {
      this.collisions = new Set<string>(DEFAULT_COLLISIONS);
      this.saveCollisions(DEFAULT_COLLISIONS);
    }

    // Graceful process exit auto-save
    process.on('SIGINT', () => {
      this.saveAll();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.saveAll();
      process.exit(0);
    });
  }

  // --- Players ---
  public savePlayers() {
    try {
      const obj: Record<string, PlayerData> = {};
      for (const [id, player] of this.players.entries()) {
        obj[id] = player;
      }
      fs.writeFileSync(PLAYERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save players to disk', err);
    }
  }

  public isPlayerAdmin(player: PlayerData): boolean {
    if (!player) return false;
    if (player.id && ADMIN_USER_IDS.includes(player.id.toLowerCase())) return true;
    if (player.username && ADMIN_USERNAMES.includes(player.username.toLowerCase())) return true;
    return player.role === 'admin';
  }

  public getAdminUsernames(): string[] {
    return ADMIN_USERNAMES;
  }

  public getPlayer(id: string): PlayerData | undefined {
    const p = this.players.get(id);
    if (p) {
      if (this.isPlayerAdmin(p)) {
        p.role = 'admin';
      }
    }
    return p;
  }

  public savePlayer(player: PlayerData) {
    if (this.isPlayerAdmin(player)) {
      player.role = 'admin';
    }
    this.players.set(player.id, player);
    this.savePlayers();
  }

  public createGuestPlayer(desiredUsername?: string): PlayerData {
    const id = 'guest_' + crypto.randomBytes(6).toString('hex');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = desiredUsername ? desiredUsername.trim().slice(0, 16) : `Wanderer_${randomSuffix}`;
    const isAdmin = ADMIN_USERNAMES.includes(username.toLowerCase()) || ADMIN_USER_IDS.includes(id.toLowerCase());

    const newPlayer: PlayerData = {
      id,
      username,
      role: isAdmin ? 'admin' : 'player',
      isGuest: true,
      x: 8, // Hearth Town Square (Level_0)
      y: 24,
      gold: 50,
      gems: 0,
      anima: 0,
      activeTitle: 'Novice of Eldoria',
      skills: JSON.parse(JSON.stringify(INITIAL_SKILLS)),
      inventory: [
        { itemId: 'rune_pickaxe_dawnburn', quantity: 1, rarity: 'plain', plus: 0 },
        { itemId: 'smoked_prawn', quantity: 10, rarity: 'plain', plus: 0 },
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

  // --- World Nodes ---
  public getWorldNodes(): WorldNode[] {
    return this.nodes;
  }

  public saveWorldNodes(nodes: WorldNode[]) {
    this.nodes = nodes;
    try {
      fs.writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save world nodes to disk', err);
    }
  }

  public upsertWorldNode(node: WorldNode) {
    const idx = this.nodes.findIndex(n => n.id === node.id);
    if (idx >= 0) {
      this.nodes[idx] = node;
    } else {
      this.nodes.push(node);
    }
    this.saveWorldNodes(this.nodes);
  }

  public deleteWorldNode(nodeId: string) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.saveWorldNodes(this.nodes);
  }

  // --- NPCs ---
  public getNpcs(): NpcDefinition[] {
    return this.npcs;
  }

  public saveNpcs(npcs: NpcDefinition[]) {
    this.npcs = npcs;
    try {
      fs.writeFileSync(NPCS_FILE, JSON.stringify(npcs, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save NPCs to disk', err);
    }
  }

  public upsertNpc(npc: NpcDefinition) {
    const idx = this.npcs.findIndex(n => n.id === npc.id);
    if (idx >= 0) {
      this.npcs[idx] = npc;
    } else {
      this.npcs.push(npc);
    }
    this.saveNpcs(this.npcs);
  }

  public deleteNpc(npcId: string) {
    this.npcs = this.npcs.filter(n => n.id !== npcId);
    this.saveNpcs(this.npcs);
  }

  // --- Quests ---
  public getQuests(): QuestDefinition[] {
    return this.quests;
  }

  public saveQuests(quests: QuestDefinition[]) {
    this.quests = quests;
    try {
      fs.writeFileSync(QUESTS_FILE, JSON.stringify(quests, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save quests to disk', err);
    }
  }

  public upsertQuest(quest: QuestDefinition) {
    const idx = this.quests.findIndex(q => q.id === quest.id);
    if (idx >= 0) {
      this.quests[idx] = quest;
    } else {
      this.quests.push(quest);
    }
    this.saveQuests(this.quests);
  }

  public deleteQuest(questId: string) {
    this.quests = this.quests.filter(q => q.id !== questId);
    this.saveQuests(this.quests);
  }

  // --- Collisions ---
  public getCollisions(): Set<string> {
    return this.collisions;
  }

  public isCollidable(x: number, y: number): boolean {
    return this.collisions.has(`${x},${y}`);
  }

  public saveCollisions(cols: string[] | Set<string>) {
    const arr = Array.from(cols);
    this.collisions = new Set<string>(arr);
    try {
      fs.writeFileSync(COLLISIONS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save collisions to disk', err);
    }
  }

  // --- Admin Verification ---
  public verifyAdminSecret(secret: string): boolean {
    if (!secret) return false;
    return secret.trim() === ADMIN_SECRET;
  }

  // --- Save All ---
  public saveAll() {
    this.savePlayers();
    this.saveWorldNodes(this.nodes);
    this.saveNpcs(this.npcs);
    this.saveQuests(this.quests);
    this.saveCollisions(this.collisions);
  }
}

export const storage = new StorageManager();
