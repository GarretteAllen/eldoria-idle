export interface FarmingCropDefinition {
  seedId: string;
  cropId: string;
  name: string;
  levelReq: number;
  baseDurationSeconds: number; // Low level 5 min (300s), scaling with level
  xp: number;
  minYield: number;
  maxYield: number;
  seedReturnChance: number; // Chance to harvest a bonus seed
  description: string;
  isHighXpMethod?: boolean;
}

export const ONLINE_GROWTH_MULTIPLIER = 2.0;

export const FARMING_CROPS: Record<string, FarmingCropDefinition> = {
  earthtuber_seed: {
    seedId: 'earthtuber_seed',
    cropId: 'earthtuber',
    name: 'Earthtuber',
    levelReq: 1,
    baseDurationSeconds: 300, // 5 minutes (2.5m online)
    xp: 45,
    minYield: 3,
    maxYield: 5,
    seedReturnChance: 0.5,
    description: 'Hearty starchy tubers that thrive in fertile soil. Fast and reliable crop for novice farmers.',
  },
  silverleaf_seed: {
    seedId: 'silverleaf_seed',
    cropId: 'silverleaf',
    name: 'Silverleaf',
    levelReq: 10,
    baseDurationSeconds: 480, // 8 minutes (4m online)
    xp: 95,
    minYield: 3,
    maxYield: 5,
    seedReturnChance: 0.45,
    description: 'A luminescent herb with silver-tipped leaves prized by apothecaries and potion crafters.',
  },
  glowshroom_spore: {
    seedId: 'glowshroom_spore',
    cropId: 'glowshroom',
    name: 'Glowshroom',
    levelReq: 20,
    baseDurationSeconds: 720, // 12 minutes (6m online)
    xp: 180,
    minYield: 4,
    maxYield: 6,
    seedReturnChance: 0.4,
    description: 'Bioluminescent subterranean fungus that blooms with a soft radiant sapphire hue.',
  },
  deep_radish_seed: {
    seedId: 'deep_radish_seed',
    cropId: 'deep_radish',
    name: 'Deep Radish',
    levelReq: 35,
    baseDurationSeconds: 1080, // 18 minutes (9m online)
    xp: 340,
    minYield: 4,
    maxYield: 7,
    seedReturnChance: 0.4,
    description: 'Thick, mineral-dense taproots that absorb underground leyline nutrients.',
  },
  nightshade_seed: {
    seedId: 'nightshade_seed',
    cropId: 'nightshade_bell',
    name: 'Nightshade Bell',
    levelReq: 45,
    baseDurationSeconds: 1800, // 30 minutes (15m online)
    xp: 850, // High XP method!
    minYield: 4,
    maxYield: 8,
    seedReturnChance: 0.35,
    isHighXpMethod: true,
    description: 'Potent nocturnal flora requiring prolonged patient growth. High Farming XP method.',
  },
  bramble_mandrake_seed: {
    seedId: 'bramble_mandrake_seed',
    cropId: 'bramble_mandrake',
    name: 'Bramble Mandrake',
    levelReq: 55,
    baseDurationSeconds: 1500, // 25 minutes (12.5m online)
    xp: 680,
    minYield: 5,
    maxYield: 8,
    seedReturnChance: 0.35,
    description: 'Twisted roots harvested for powerful defensive elixirs and protective decoctions.',
  },
  wyrmfrond_seed: {
    seedId: 'wyrmfrond_seed',
    cropId: 'wyrmfrond',
    name: 'Wyrmfrond',
    levelReq: 70,
    baseDurationSeconds: 2700, // 45 minutes (22.5m online)
    xp: 1950, // Colossal High XP method!
    minYield: 5,
    maxYield: 9,
    seedReturnChance: 0.3,
    isHighXpMethod: true,
    description: 'Legendary draconic fern that drinks primal aether. Generates colossal Farming XP.',
  },
  nether_gourd_seed: {
    seedId: 'nether_gourd_seed',
    cropId: 'nether_gourd',
    name: 'Nether Gourd',
    levelReq: 80,
    baseDurationSeconds: 2400, // 40 minutes (20m online)
    xp: 1550,
    minYield: 6,
    maxYield: 10,
    seedReturnChance: 0.3,
    description: 'Fiery volcanic squash that smolders with thermal heat, used in high-tier feasts.',
  },
  sunfire_pod: {
    seedId: 'sunfire_pod',
    cropId: 'sunfire_pepper',
    name: 'Sunfire Pepper',
    levelReq: 90,
    baseDurationSeconds: 3600, // 60 minutes (30m online)
    xp: 3600,
    minYield: 6,
    maxYield: 12,
    seedReturnChance: 0.25,
    description: 'Master pinnacle crop burning with eternal dawn energy. Culmination of agronomic mastery.',
  },
};
