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
  // --- The Hearth Square (Central Town) ---
  { id: 'hearth_bank', name: 'The Hearth Storage Counter', type: 'hearth_counter', x: 25, y: 23 },
  { id: 'hearth_forge', name: 'Ancestral Runeforge', type: 'forge', x: 23, y: 25, recipeId: 'smelt_dawnburn_ingot' },
  { id: 'hearth_fire', name: 'Hearth Firepit', type: 'fire', x: 27, y: 25, recipeId: 'cook_prawn' },

  // --- Quarry (West) ---
  { id: 'quarry_pyrite', name: 'Pyrite Deposit', type: 'mine', x: 18, y: 15, recipeId: 'mine_pyrite' },
  { id: 'quarry_galena', name: 'Galena Deposit', type: 'mine', x: 16, y: 15, recipeId: 'mine_galena' },
  { id: 'quarry_cold_iron', name: 'Cold Iron Seam', type: 'mine', x: 14, y: 13, recipeId: 'mine_cold_iron' },
  { id: 'quarry_quicksilver', name: 'Quicksilver Lode', type: 'mine', x: 12, y: 12, recipeId: 'mine_quicksilver' },
  { id: 'quarry_nethercoal', name: 'Nethercoal Fissure', type: 'mine', x: 10, y: 10, recipeId: 'mine_nethercoal' },
  { id: 'quarry_azurite', name: 'Azurite Vein', type: 'mine', x: 8, y: 8, recipeId: 'mine_azurite' },
  { id: 'quarry_starfall', name: 'Starfall Core', type: 'mine', x: 6, y: 6, recipeId: 'mine_starfall' },

  // --- Timberland (North-East) ---
  { id: 'forest_ashwood', name: 'Ashwood Copse', type: 'tree', x: 35, y: 15, recipeId: 'chop_ashwood' },
  { id: 'forest_oak', name: 'Whispering Oak', type: 'tree', x: 38, y: 14, recipeId: 'chop_oak' },
  { id: 'forest_willow', name: 'Weeping Willow', type: 'tree', x: 42, y: 12, recipeId: 'chop_willow' },
  { id: 'forest_bloodwood', name: 'Bloodwood Grove', type: 'tree', x: 45, y: 10, recipeId: 'chop_bloodwood' },
  { id: 'forest_ghostwood', name: 'Ghostwood Spirit Yew', type: 'tree', x: 48, y: 8, recipeId: 'chop_ghostwood' },
  { id: 'forest_starlight', name: 'Aetherial Starlight Tree', type: 'tree', x: 52, y: 6, recipeId: 'chop_starlight' },

  // --- Shoreline (East / South-East) ---
  { id: 'shore_prawn', name: 'Tide Prawn Shallows', type: 'water', x: 48, y: 35, recipeId: 'fish_prawn' },
  { id: 'shore_minnow', name: 'Glimmer Pool', type: 'water', x: 50, y: 37, recipeId: 'fish_minnow' },
  { id: 'shore_trout', name: 'Silverspeck River', type: 'water', x: 52, y: 40, recipeId: 'fish_trout' },
  { id: 'shore_salmon', name: 'Solar Crest Rapids', type: 'water', x: 54, y: 44, recipeId: 'fish_salmon' },
  { id: 'shore_mawshark', name: 'Abyssal Depth', type: 'water', x: 56, y: 50, recipeId: 'fish_mawshark' },

  // --- Monster Hunting Grounds (South / South-West) ---
  { id: 'mob_mire_rat', name: 'Mire-Rat Burrow', type: 'monster', x: 18, y: 38, monsterId: 'mire_rat' },
  { id: 'mob_stone_carapace', name: 'Cragridge Carapaces', type: 'monster', x: 15, y: 42, monsterId: 'stone_carapace' },
  { id: 'mob_fen_creeper', name: 'Dread Marsh Creepers', type: 'monster', x: 12, y: 46, monsterId: 'fen_creeper' },
  { id: 'mob_mire_ghoul', name: 'Blackbog Ghouls', type: 'monster', x: 10, y: 50, monsterId: 'mire_ghoul' },

  // --- World Boss Arena ---
  { id: 'boss_arena', name: 'Astral Primordial Crater', type: 'boss_arena', x: 10, y: 28 },
];
