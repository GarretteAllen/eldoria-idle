export interface MonsterSpriteCoord {
  col: number;
  row: number;
  name: string;
}

export const MONSTER_SPRITES: Record<string, MonsterSpriteCoord> = {
  mire_rat: { col: 0, row: 0, name: 'Mire-Rat' },
  stone_carapace: { col: 1, row: 0, name: 'Stone Carapace' },
  fen_creeper: { col: 2, row: 0, name: 'Fen Creeper' },
  mire_ghoul: { col: 3, row: 0, name: 'Mire Ghoul' },
  carrion_scarab: { col: 4, row: 0, name: 'Carrion Scarab' },

  trench_skulker: { col: 0, row: 1, name: 'Trench Skulker' },
  dust_revenant: { col: 1, row: 1, name: 'Dust Revenant' },
  lithophage: { col: 2, row: 1, name: 'Lithophage' },
  grim_hound: { col: 3, row: 1, name: 'Grim Hound' },
  marble_wight: { col: 4, row: 1, name: 'Marble Wight' },

  barrow_wight: { col: 0, row: 2, name: 'Barrow Wight' },
  dune_spectre: { col: 1, row: 2, name: 'Dune Spectre' },
  frost_worg: { col: 2, row: 2, name: 'Frost Worg' },
  mirage_stalker: { col: 3, row: 2, name: 'Mirage Stalker' },
  flameborn_fiend: { col: 4, row: 2, name: 'Flameborn Fiend' },

  glacial_jarl: { col: 0, row: 3, name: 'Glacial Jarl' },
  void_eldritch: { col: 1, row: 3, name: 'Void Eldritch' },
  frost_monarch: { col: 2, row: 3, name: 'Frost Monarch' },
  ashen_drake: { col: 3, row: 3, name: 'Ashen Drake' },
  magma_titan: { col: 4, row: 3, name: 'Magma Titan' },

  mimic: { col: 0, row: 4, name: 'Mimic' },
  cyclops: { col: 1, row: 4, name: 'Cyclops' },
  bat: { col: 2, row: 4, name: 'Bat' },
  spider: { col: 3, row: 4, name: 'Spider' },
  cultist: { col: 4, row: 4, name: 'Cultist' },
};
