import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PlayerData, SkillType } from '@eldoria/shared';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'players.json');

const INITIAL_SKILLS: Record<SkillType, { xp: number; level: number }> = {
  earth_delving: { xp: 0, level: 1 },
  timbercraft: { xp: 0, level: 1 },
  tidecalling: { xp: 0, level: 1 },
  flora_husbandry: { xp: 0, level: 1 },
  shadowcraft: { xp: 0, level: 1 },
  rune_forging: { xp: 0, level: 1 },
  hearthcraft: { xp: 0, level: 1 },
  bow_fletching: { xp: 0, level: 1 },
  apothecary: { xp: 0, level: 1 },
  artificing: { xp: 0, level: 1 },
  soul_attunement: { xp: 0, level: 1 },
  bladesmanship: { xp: 0, level: 1 },
  marksmanship: { xp: 0, level: 1 },
  arcane_sorcery: { xp: 0, level: 1 },
  bulwark: { xp: 0, level: 1 },
  vitality: { xp: 0, level: 10 },
};

class StorageManager {
  private players = new Map<string, PlayerData>();

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [id, player] of Object.entries(data)) {
          this.players.set(id, player as PlayerData);
        }
      } catch (err) {
        console.error('Failed to parse players.json, starting fresh', err);
      }
    }
  }

  public save() {
    try {
      const obj: Record<string, PlayerData> = {};
      for (const [id, player] of this.players.entries()) {
        obj[id] = player;
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save players to disk', err);
    }
  }

  public getPlayer(id: string): PlayerData | undefined {
    return this.players.get(id);
  }

  public savePlayer(player: PlayerData) {
    this.players.set(player.id, player);
    this.save();
  }

  public createGuestPlayer(): PlayerData {
    const id = 'guest_' + crypto.randomBytes(6).toString('hex');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = `Wanderer_${randomSuffix}`;

    const newPlayer: PlayerData = {
      id,
      username,
      isGuest: true,
      x: 25, // Hearth Town Square
      y: 25,
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
        skill: 'earth_delving',
        startedAtTick: 0,
        targetQuantity: Infinity,
        completedQuantity: 0,
        targetNodeX: 20,
        targetNodeY: 15,
      },
      taskQueue: [],
      eatsAtHpPercent: 50,
      currentHp: 10,
      lastActiveTimestamp: Date.now(),
    };

    this.savePlayer(newPlayer);
    return newPlayer;
  }
}

export const storage = new StorageManager();
