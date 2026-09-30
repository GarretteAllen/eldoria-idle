export interface WorldNode {
  id: string;
  name: string;
  type: 'hearth_counter' | 'forge' | 'fire' | 'mine' | 'tree' | 'water' | 'farm' | 'monster' | 'boss_arena';
  x: number;
  y: number;
  recipeId?: string;
  monsterId?: string;
}

export const WORLD_NODES: WorldNode[] = [
  // --- The Hearth Square (Central Town - Level_0) ---
  { id: 'hearth_bank', name: 'The Hearth Storage Counter', type: 'hearth_counter', x: 8, y: 22 },
  { id: 'hearth_forge', name: 'Ancestral Runeforge', type: 'forge', x: 6, y: 24 },
  { id: 'hearth_fire', name: 'Hearth Firepit', type: 'fire', x: 10, y: 24 },
  { id: 'farm_plot_1', name: 'Verdant Allotment (Plot I)', type: 'farm', x: 13, y: 22 },
  { id: 'farm_plot_2', name: 'Verdant Allotment (Plot II)', type: 'farm', x: 14, y: 24 },

  // --- Quarry (North - Level_3) ---
  { id: 'quarry_pyrite', name: 'Pyrite Deposit', type: 'mine', x: 6, y: 5, recipeId: 'mine_pyrite' },
  { id: 'quarry_galena', name: 'Galena Deposit', type: 'mine', x: 9, y: 5, recipeId: 'mine_galena' },
  { id: 'quarry_cold_iron', name: 'Cold Iron Seam', type: 'mine', x: 5, y: 9, recipeId: 'mine_cold_iron' },
  { id: 'quarry_quicksilver', name: 'Quicksilver Lode', type: 'mine', x: 8, y: 9, recipeId: 'mine_quicksilver' },
  { id: 'quarry_nethercoal', name: 'Nethercoal Fissure', type: 'mine', x: 11, y: 9, recipeId: 'mine_nethercoal' },
  { id: 'quarry_azurite', name: 'Azurite Vein', type: 'mine', x: 4, y: 13, recipeId: 'mine_azurite' },
  { id: 'quarry_starfall', name: 'Starfall Core', type: 'mine', x: 10, y: 13, recipeId: 'mine_starfall' },

  // --- Timberland (East - Level_2) ---
  { id: 'forest_ashwood', name: 'Ashwood Copse', type: 'tree', x: 19, y: 18, recipeId: 'chop_ashwood' },
  { id: 'forest_oak', name: 'Whispering Oak', type: 'tree', x: 23, y: 18, recipeId: 'chop_oak' },
  { id: 'forest_willow', name: 'Weeping Willow', type: 'tree', x: 27, y: 18, recipeId: 'chop_willow' },
  { id: 'forest_bloodwood', name: 'Bloodwood Grove', type: 'tree', x: 20, y: 24, recipeId: 'chop_bloodwood' },
  { id: 'forest_ghostwood', name: 'Ghostwood Spirit Yew', type: 'tree', x: 24, y: 24, recipeId: 'chop_ghostwood' },
  { id: 'forest_starlight', name: 'Aetherial Starlight Tree', type: 'tree', x: 28, y: 24, recipeId: 'chop_starlight' },

  // --- Shoreline & Frontier (South - Level_1) ---
  { id: 'shore_prawn', name: 'Tide Prawn Shallows', type: 'water', x: 4, y: 35, recipeId: 'fish_prawn' },
  { id: 'shore_minnow', name: 'Glimmer Pool', type: 'water', x: 8, y: 35, recipeId: 'fish_minnow' },
  { id: 'shore_trout', name: 'Silverspeck River', type: 'water', x: 12, y: 35, recipeId: 'fish_trout' },
  { id: 'shore_salmon', name: 'Solar Crest Rapids', type: 'water', x: 6, y: 40, recipeId: 'fish_salmon' },
  { id: 'shore_mawshark', name: 'Abyssal Depth', type: 'water', x: 10, y: 42, recipeId: 'fish_mawshark' },

  // --- Monster Hunting Grounds & Habitats ---
  // Zone 1: The Murkwarrens (Mire-Rats · Lv 2)
  { id: 'mob_mire_rat_1', name: 'Mire-Rat', type: 'monster', x: 3, y: 44, monsterId: 'mire_rat' },
  { id: 'mob_mire_rat_2', name: 'Mire-Rat', type: 'monster', x: 5, y: 43, monsterId: 'mire_rat' },
  { id: 'mob_mire_rat_3', name: 'Mire-Rat', type: 'monster', x: 4, y: 46, monsterId: 'mire_rat' },

  // Zone 2: Cragridge (Stone Carapaces · Lv 3)
  { id: 'mob_stone_carapace_1', name: 'Stone Carapace', type: 'monster', x: 8, y: 43, monsterId: 'stone_carapace' },
  { id: 'mob_stone_carapace_2', name: 'Stone Carapace', type: 'monster', x: 9, y: 45, monsterId: 'stone_carapace' },
  { id: 'mob_stone_carapace_3', name: 'Stone Carapace', type: 'monster', x: 7, y: 46, monsterId: 'stone_carapace' },

  // Zone 3: Dread Marsh (Fen Creepers · Lv 5)
  { id: 'mob_fen_creeper_1', name: 'Fen Creeper', type: 'monster', x: 12, y: 43, monsterId: 'fen_creeper' },
  { id: 'mob_fen_creeper_2', name: 'Fen Creeper', type: 'monster', x: 14, y: 44, monsterId: 'fen_creeper' },
  { id: 'mob_fen_creeper_3', name: 'Fen Creeper', type: 'monster', x: 11, y: 46, monsterId: 'fen_creeper' },

  // Zone 4: Blackbog (Mire Ghouls · Lv 8)
  { id: 'mob_mire_ghoul_1', name: 'Mire Ghoul', type: 'monster', x: 17, y: 43, monsterId: 'mire_ghoul' },
  { id: 'mob_mire_ghoul_2', name: 'Mire Ghoul', type: 'monster', x: 18, y: 45, monsterId: 'mire_ghoul' },
  { id: 'mob_mire_ghoul_3', name: 'Mire Ghoul', type: 'monster', x: 16, y: 46, monsterId: 'mire_ghoul' },

  // Zone 5: Sunken Barrow (Carrion Scarabs · Lv 12)
  { id: 'mob_carrion_scarab_1', name: 'Carrion Scarab', type: 'monster', x: 21, y: 43, monsterId: 'carrion_scarab' },
  { id: 'mob_carrion_scarab_2', name: 'Carrion Scarab', type: 'monster', x: 22, y: 45, monsterId: 'carrion_scarab' },
  { id: 'mob_carrion_scarab_3', name: 'Carrion Scarab', type: 'monster', x: 20, y: 46, monsterId: 'carrion_scarab' },

  // --- World Boss Arena ---
  { id: 'boss_arena', name: 'Astral Primordial Crater', type: 'boss_arena', x: 24, y: 28 },
];
