export interface MonsterSpriteCoord {
  col: number;
  row: number;
  name: string;
  size?: number; // scale multiplier (default 1.0 = 1x1 tile)
  recolor?: {
    filter?: string; // CSS filter for recoloring (e.g. grayscale, sepia, hue-rotate)
  };
}

export const MONSTER_SPRITES: Record<string, MonsterSpriteCoord> = {
  mire_rat: { col: 0, row: 0, name: 'Mire-Rat', size: 0.9 },
  stone_carapace: {
    col: 1,
    row: 0,
    name: 'Stone Carapace',
    size: 1.0,
    recolor: {
      filter: 'grayscale(1) contrast(1.3) brightness(0.85)',
    },
  },
  fen_creeper: { col: 2, row: 0, name: 'Fen Creeper' },
  mire_ghoul: { col: 3, row: 0, name: 'Mire Ghoul' },
  carrion_scarab: { col: 4, row: 0, name: 'Carrion Scarab', size: 0.9 },

  trench_skulker: { col: 0, row: 1, name: 'Trench Skulker' },
  dust_revenant: { col: 1, row: 1, name: 'Dust Revenant' },
  lithophage: { col: 2, row: 1, name: 'Lithophage' },
  grim_hound: { col: 3, row: 1, name: 'Grim Hound', size: 1.1 },
  marble_wight: { col: 4, row: 1, name: 'Marble Wight', size: 1.2 },

  barrow_wight: { col: 0, row: 2, name: 'Barrow Wight' },
  dune_spectre: { col: 1, row: 2, name: 'Dune Spectre' },
  frost_worg: { col: 2, row: 2, name: 'Frost Worg', size: 1.2 },
  mirage_stalker: { col: 3, row: 2, name: 'Mirage Stalker' },
  flameborn_fiend: { col: 4, row: 2, name: 'Flameborn Fiend', size: 1.2 },

  glacial_jarl: { col: 0, row: 3, name: 'Glacial Jarl', size: 1.5 },
  void_eldritch: { col: 1, row: 3, name: 'Void Eldritch', size: 1.6 },
  frost_monarch: { col: 2, row: 3, name: 'Frost Monarch', size: 1.5 },
  ashen_drake: { col: 3, row: 3, name: 'Ashen Drake', size: 1.7 },
  magma_titan: { col: 4, row: 3, name: 'Magma Titan', size: 1.8 },

  mimic: { col: 0, row: 4, name: 'Mimic' },
  cyclops: { col: 1, row: 4, name: 'Cyclops', size: 1.5 },
  bat: { col: 2, row: 4, name: 'Bat', size: 0.85 },
  spider: { col: 3, row: 4, name: 'Spider' },
  cultist: { col: 4, row: 4, name: 'Cultist' },
  crypt_lord: {
    col: 1,
    row: 3,
    name: 'The Crypt Lord',
    size: 1.8,
    recolor: {
      filter: 'sepia(0.6) hue-rotate(220deg) saturate(1.8) brightness(1.2)',
    },
  },

  // --- Vanity Companion Pets (Rendered in world following their owner) ---
  pet_rocky: {
    col: 1,
    row: 0,
    name: 'Rocky',
    size: 0.72,
    recolor: {
      filter: 'grayscale(1) contrast(1.4) brightness(1.1)',
    },
  },
  pet_treant: {
    col: 2,
    row: 0,
    name: 'Twiggy Treant',
    size: 0.75,
    recolor: {
      filter: 'sepia(0.8) hue-rotate(50deg) saturate(1.8) brightness(0.95)',
    },
  },
  pet_otter: {
    col: 0,
    row: 0,
    name: 'River Whiskers',
    size: 0.70,
    recolor: {
      filter: 'sepia(0.6) hue-rotate(-15deg) saturate(2.0) brightness(1.05)',
    },
  },
  pet_sprout: {
    col: 2,
    row: 0,
    name: 'Sproutling',
    size: 0.68,
    recolor: {
      filter: 'hue-rotate(90deg) saturate(2.4) brightness(1.15)',
    },
  },
  pet_crypt_beetle: {
    col: 4,
    row: 0,
    name: 'Crypt Scarab',
    size: 0.72,
    recolor: {
      filter: 'sepia(0.8) hue-rotate(15deg) contrast(1.5) brightness(1.1)',
    },
  },
};
