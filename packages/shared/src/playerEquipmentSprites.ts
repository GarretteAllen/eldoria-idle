export interface EquipmentSpriteCoord {
  col: number;
  row: number;
  slot: 'base' | 'hair' | 'body' | 'legs' | 'helmet' | 'weapon' | 'shield' | 'steed' | 'tool';
  w?: number;
  h?: number;
  pixelW?: number;
  pixelH?: number;
}

export const PLAYER_EQUIPMENT_SPRITES: Record<string, EquipmentSpriteCoord> = {
  // Bases & Hair & Steed (Row 0)
  base_male: { col: 0, row: 0, slot: 'base' },
  base_female: { col: 1, row: 0, slot: 'base' },
  base_tan: { col: 2, row: 0, slot: 'base' },
  hair_adventurer: { col: 3, row: 0, slot: 'hair' },
  hair_maiden: { col: 4, row: 0, slot: 'hair' },
  hair_elder: { col: 5, row: 0, slot: 'hair' },
  steed_courser: { col: 8, row: 0, slot: 'steed', pixelW: 27, pixelH: 23 },

  // Body Armor (Row 1)
  tunic_cloth: { col: 0, row: 1, slot: 'body' },
  leather_tunic: { col: 1, row: 1, slot: 'body' },
  pelt_jerkin: { col: 1, row: 1, slot: 'body' },
  ghoulskin_tunic: { col: 1, row: 1, slot: 'body' },
  bogskin_tunic: { col: 1, row: 1, slot: 'body' },
  dawnburn_plate: { col: 2, row: 1, slot: 'body' },
  cold_iron_plate: { col: 3, row: 1, slot: 'body' },
  steel_plate: { col: 4, row: 1, slot: 'body' },
  azurite_plate: { col: 5, row: 1, slot: 'body' },
  astralite_plate: { col: 6, row: 1, slot: 'body' },
  primordial_plate: { col: 7, row: 1, slot: 'body' },

  // Leg Armor (Row 2)
  tunic_pants: { col: 0, row: 2, slot: 'legs' },
  leather_chaps: { col: 1, row: 2, slot: 'legs' },
  ghoulskin_chaps: { col: 1, row: 2, slot: 'legs' },
  bogskin_chaps: { col: 1, row: 2, slot: 'legs' },
  dawnburn_legs: { col: 2, row: 2, slot: 'legs' },
  cold_iron_legs: { col: 3, row: 2, slot: 'legs' },
  steel_legs: { col: 4, row: 2, slot: 'legs' },
  azurite_legs: { col: 5, row: 2, slot: 'legs' },
  astralite_legs: { col: 6, row: 2, slot: 'legs' },
  primordial_legs: { col: 7, row: 2, slot: 'legs' },

  // Helmets & Headgear (Row 3)
  wizard_hat: { col: 0, row: 3, slot: 'helmet' },
  ranger_hood: { col: 1, row: 3, slot: 'helmet' },
  ghoulskin_hood: { col: 1, row: 3, slot: 'helmet' },
  bogskin_hood: { col: 1, row: 3, slot: 'helmet' },
  steel_helm: { col: 2, row: 3, slot: 'helmet' },
  dawnburn_helm: { col: 3, row: 3, slot: 'helmet' },
  azurite_helm: { col: 4, row: 3, slot: 'helmet' },
  astralite_helm: { col: 5, row: 3, slot: 'helmet' },
  primordial_helm: { col: 6, row: 3, slot: 'helmet' },

  // Weapons - Blades & Greatswords (Row 4)
  dawnburn_blade: { col: 0, row: 4, slot: 'weapon' },
  cold_iron_blade: { col: 1, row: 4, slot: 'weapon' },
  steel_blade: { col: 2, row: 4, slot: 'weapon' },
  azurite_blade: { col: 3, row: 4, slot: 'weapon' },
  astralite_blade: { col: 4, row: 4, slot: 'weapon' },
  primordial_titan_blade: { col: 5, row: 4, slot: 'weapon' },
  dawnburn_greatsword: { col: 6, row: 4, slot: 'weapon' },
  cold_iron_greatsword: { col: 7, row: 4, slot: 'weapon' },
  steel_greatsword: { col: 8, row: 4, slot: 'weapon' },
  azurite_greatsword: { col: 9, row: 4, slot: 'weapon' },
  astralite_greatsword: { col: 10, row: 4, slot: 'weapon' },
  primordial_greatsword: { col: 11, row: 4, slot: 'weapon' },

  // Weapons - Shortbows & Tools (Row 5)
  ashwood_shortbow: { col: 0, row: 5, slot: 'weapon' },
  oak_shortbow: { col: 1, row: 5, slot: 'weapon' },
  willow_shortbow: { col: 2, row: 5, slot: 'weapon' },
  bloodwood_shortbow: { col: 3, row: 5, slot: 'weapon' },
  ghostwood_shortbow: { col: 4, row: 5, slot: 'weapon' },
  starlight_shortbow: { col: 5, row: 5, slot: 'weapon' },
  rune_pickaxe_dawnburn: { col: 6, row: 5, slot: 'tool' },
  rune_pickaxe_cold_iron: { col: 7, row: 5, slot: 'tool' },
  rune_pickaxe_steel: { col: 8, row: 5, slot: 'tool' },
  rune_pickaxe_azurite: { col: 9, row: 5, slot: 'tool' },
  rune_pickaxe_astralite: { col: 10, row: 5, slot: 'tool' },
  rune_axe_dawnburn: { col: 11, row: 5, slot: 'tool' },
  rune_axe_cold_iron: { col: 12, row: 5, slot: 'tool' },
  rune_axe_steel: { col: 13, row: 5, slot: 'tool' },
  rune_axe_azurite: { col: 14, row: 5, slot: 'tool' },
  rune_axe_astralite: { col: 15, row: 5, slot: 'tool' },

  // Weapons - Staves & Fishing Rods (Row 6)
  ashwood_staff: { col: 0, row: 6, slot: 'weapon' },
  oak_staff: { col: 1, row: 6, slot: 'weapon' },
  willow_staff: { col: 2, row: 6, slot: 'weapon' },
  bloodwood_staff: { col: 3, row: 6, slot: 'weapon' },
  ghostwood_staff: { col: 4, row: 6, slot: 'weapon' },
  starlight_staff: { col: 5, row: 6, slot: 'weapon' },
  fishing_rod_willow: { col: 6, row: 6, slot: 'tool' },
  fishing_rod_oak: { col: 7, row: 6, slot: 'tool' },
  fishing_rod_yew: { col: 8, row: 6, slot: 'tool' },
  tool_hammer: { col: 9, row: 6, slot: 'tool' },
  crafting_hammer: { col: 9, row: 6, slot: 'tool' },
  smithing_hammer: { col: 9, row: 6, slot: 'tool' },
  tool_knife: { col: 10, row: 6, slot: 'tool' },
  fletching_knife: { col: 10, row: 6, slot: 'tool' },
  tool_sickle: { col: 11, row: 6, slot: 'tool' },
  herbalism_sickle: { col: 11, row: 6, slot: 'tool' },
  tool_watering_can: { col: 12, row: 6, slot: 'tool' },
  farming_can: { col: 12, row: 6, slot: 'tool' },
  tool_flask: { col: 13, row: 6, slot: 'tool' },
  alchemy_flask: { col: 13, row: 6, slot: 'tool' },
  tool_skillet: { col: 14, row: 6, slot: 'tool' },
  cooking_skillet: { col: 14, row: 6, slot: 'tool' },
  tool_lockpick: { col: 15, row: 6, slot: 'tool' },
  thieving_lockpick: { col: 15, row: 6, slot: 'tool' },


  // Shields & Offhands (Row 7)
  dawnburn_shield: { col: 0, row: 7, slot: 'shield' },
  cold_iron_shield: { col: 1, row: 7, slot: 'shield' },
  steel_shield: { col: 2, row: 7, slot: 'shield' },
  azurite_shield: { col: 3, row: 7, slot: 'shield' },
  astralite_shield: { col: 4, row: 7, slot: 'shield' },
  primordial_shield: { col: 5, row: 7, slot: 'shield' },
  leather_quiver: { col: 6, row: 7, slot: 'shield' },
  pelt_quiver: { col: 6, row: 7, slot: 'shield' },
  ghoulskin_quiver: { col: 6, row: 7, slot: 'shield' },
  bogskin_quiver: { col: 6, row: 7, slot: 'shield' },
  chitin_quiver: { col: 6, row: 7, slot: 'shield' },
  fur_quiver: { col: 6, row: 7, slot: 'shield' },
  scale_quiver: { col: 6, row: 7, slot: 'shield' },
  linen_grimoire: { col: 7, row: 7, slot: 'shield' },
  silk_grimoire: { col: 8, row: 7, slot: 'shield' },
  gilded_grimoire: { col: 9, row: 7, slot: 'shield' },
  voidweave_grimoire: { col: 10, row: 7, slot: 'shield' },

  // Mounted Riding Legs (draped across horse flank, knee bent, boot in stirrup)
  mounted_tunic_pants: { col: 0, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_leather_chaps: { col: 2, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_ghoulskin_chaps: { col: 2, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_bogskin_chaps: { col: 2, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_dawnburn_legs: { col: 4, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_cold_iron_legs: { col: 6, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_steel_legs: { col: 8, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_azurite_legs: { col: 10, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_astralite_legs: { col: 12, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_primordial_legs: { col: 14, row: 8, slot: 'legs', pixelW: 27, pixelH: 23 },
  mounted_bare_legs: { col: 0, row: 10, slot: 'legs', pixelW: 27, pixelH: 23 },
};
