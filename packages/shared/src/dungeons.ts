import { DungeonDefinition } from './types.js';

export const DUNGEONS: Record<string, DungeonDefinition> = {
  whispering_crypt: {
    id: 'whispering_crypt',
    name: 'The Whispering Crypt',
    description: 'A crumbling labyrinth of forgotten catacombs beneath Eldoria, guarded by relentless skeletal warriors and the Crypt Lord.',
    requiredKeyItemId: 'item_crypt_key',
    minLevel: 15,
    maxPartySize: 4,
    gateNodeId: 'node_dungeon_crypt_gate',
    gateX: 18,
    gateY: 28,
    returnX: 18,
    returnY: 29,
    bossMonsterId: 'crypt_lord',
    rooms: [
      {
        roomIndex: 0,
        name: 'The Bone Antechamber',
        description: 'Dusty stone corridors lined with restless tomb skeletons.',
        startX: 502,
        startY: 504,
        mobs: [
          { monsterId: 'mire_ghoul', name: 'Crypt Ghoul', count: 2, x: 505, y: 504 },
          { monsterId: 'carrion_scarab', name: 'Tomb Beetle', count: 1, x: 506, y: 503 },
        ],
      },
      {
        roomIndex: 1,
        name: 'Hall of Fallen Warriors',
        description: 'Ancient sarcophagi and fierce animated guardians barring the gate.',
        startX: 512,
        startY: 504,
        mobs: [
          { monsterId: 'mire_ghoul', name: 'Restless Vanguard', count: 3, x: 515, y: 504 },
        ],
      },
      {
        roomIndex: 2,
        name: 'The Crypt Lord Sarcophagus',
        description: 'The inner sanctuary of the Crypt Lord and the ancient treasure chest.',
        startX: 522,
        startY: 504,
        mobs: [
          { monsterId: 'crypt_lord', name: 'The Crypt Lord', count: 1, x: 526, y: 504 },
        ],
        chestX: 527,
        chestY: 504,
      },
    ],
  },
};
