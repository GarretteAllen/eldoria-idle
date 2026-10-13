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
        startX: -316,
        startY: 63,
        exitBarrierCoords: [
          { x: -303, y: 62 },
          { x: -303, y: 63 },
          { x: -303, y: 64 },
        ],
        mobs: [
          { monsterId: 'mire_ghoul', name: 'Crypt Ghoul', count: 2, x: -310, y: 63 },
          { monsterId: 'carrion_scarab', name: 'Tomb Beetle', count: 1, x: -308, y: 62 },
        ],
      },
      {
        roomIndex: 1,
        name: 'Hall of Fallen Warriors',
        description: 'Ancient sarcophagi and fierce animated guardians barring the gate.',
        startX: -300,
        startY: 63,
        exitBarrierCoords: [
          { x: -296, y: 54 },
          { x: -295, y: 54 },
          { x: -294, y: 54 },
          { x: -293, y: 54 },
        ],
        mobs: [
          { monsterId: 'mire_ghoul', name: 'Restless Vanguard', count: 3, x: -295, y: 62 },
        ],
      },
      {
        roomIndex: 2,
        name: 'The Crypt Lord Sarcophagus',
        description: 'The inner sanctuary of the Crypt Lord and the ancient treasure chest.',
        startX: -295,
        startY: 50,
        mobs: [
          { monsterId: 'crypt_lord', name: 'The Crypt Lord', count: 1, x: -295, y: 45 },
        ],
        chestX: -295,
        chestY: 41,
      },
    ],
  },
};
