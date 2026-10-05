import { ItemDefinition, InventorySlot } from './types.js';
import { Rarity } from './constants.js';

export const ITEMS: Record<string, ItemDefinition> = {
  // --- Ores & Minerals ---
  pyrite_ore: { id: 'pyrite_ore', name: 'Pyrite Ore', category: 'ore', tier: 1, vendorFloorPrice: 2 },
  galena_ore: { id: 'galena_ore', name: 'Galena Ore', category: 'ore', tier: 1, vendorFloorPrice: 2 },
  cold_iron_ore: { id: 'cold_iron_ore', name: 'Cold Iron Ore', category: 'ore', tier: 2, vendorFloorPrice: 5 },
  quicksilver_ore: { id: 'quicksilver_ore', name: 'Quicksilver Ore', category: 'ore', tier: 3, vendorFloorPrice: 12 },
  nethercoal: { id: 'nethercoal', name: 'Nethercoal', category: 'ore', tier: 3, vendorFloorPrice: 8 },
  solar_aurum_ore: { id: 'solar_aurum_ore', name: 'Solar Aurum Ore', category: 'ore', tier: 4, vendorFloorPrice: 25 },
  azurite_ore: { id: 'azurite_ore', name: 'Azurite Ore', category: 'ore', tier: 5, vendorFloorPrice: 50 },
  starfall_ore: { id: 'starfall_ore', name: 'Starfall Ore', category: 'ore', tier: 6, vendorFloorPrice: 150 },
  titan_shard: { id: 'titan_shard', name: 'Titan Shard', category: 'ore', tier: 6, vendorFloorPrice: 800 },

  // --- Refined Ingots ---
  dawnburn_ingot: { id: 'dawnburn_ingot', name: 'Dawnburn Ingot', category: 'bar', tier: 1, vendorFloorPrice: 6 },
  cold_iron_ingot: { id: 'cold_iron_ingot', name: 'Cold Iron Ingot', category: 'bar', tier: 2, vendorFloorPrice: 14 },
  steel_ingot: { id: 'steel_ingot', name: 'Steel Ingot', category: 'bar', tier: 3, vendorFloorPrice: 40 },
  azurite_ingot: { id: 'azurite_ingot', name: 'Azurite Ingot', category: 'bar', tier: 5, vendorFloorPrice: 180 },
  astralite_ingot: { id: 'astralite_ingot', name: 'Astralite Ingot', category: 'bar', tier: 6, vendorFloorPrice: 550 },

  // --- Timbers ---
  ashwood_timber: { id: 'ashwood_timber', name: 'Ashwood Timber', category: 'log', tier: 1, vendorFloorPrice: 2 },
  whispering_oak: { id: 'whispering_oak', name: 'Whispering Oak', category: 'log', tier: 2, vendorFloorPrice: 5 },
  weeping_willow: { id: 'weeping_willow', name: 'Weeping Willow', category: 'log', tier: 3, vendorFloorPrice: 12 },
  bloodwood_timber: { id: 'bloodwood_timber', name: 'Bloodwood Timber', category: 'log', tier: 4, vendorFloorPrice: 28 },
  ghostwood_timber: { id: 'ghostwood_timber', name: 'Ghostwood Timber', category: 'log', tier: 5, vendorFloorPrice: 70 },
  starlight_timber: { id: 'starlight_timber', name: 'Starlight Timber', category: 'log', tier: 6, vendorFloorPrice: 180 },

  // --- Marine Fish (Raw) ---
  tide_prawn: { id: 'tide_prawn', name: 'Tide Prawn', category: 'raw_food', tier: 1, vendorFloorPrice: 2 },
  glimmer_minnow: { id: 'glimmer_minnow', name: 'Glimmer Minnow', category: 'raw_food', tier: 1, vendorFloorPrice: 3 },
  silverspeck_trout: { id: 'silverspeck_trout', name: 'Silverspeck Trout', category: 'raw_food', tier: 2, vendorFloorPrice: 7 },
  solar_crest_salmon: { id: 'solar_crest_salmon', name: 'Solar Crest Salmon', category: 'raw_food', tier: 3, vendorFloorPrice: 15 },
  deepsea_albacore: { id: 'deepsea_albacore', name: 'Deepsea Albacore', category: 'raw_food', tier: 4, vendorFloorPrice: 30 },
  ironpincer_crustacean: { id: 'ironpincer_crustacean', name: 'Ironpincer Crustacean', category: 'raw_food', tier: 5, vendorFloorPrice: 65 },
  bladefin_sovereign: { id: 'bladefin_sovereign', name: 'Bladefin Sovereign', category: 'raw_food', tier: 6, vendorFloorPrice: 140 },
  abyssal_mawshark: { id: 'abyssal_mawshark', name: 'Abyssal Mawshark', category: 'raw_food', tier: 6, vendorFloorPrice: 320 },

  // --- Cooked Provisions ---
  crusty_bread: { id: 'crusty_bread', name: 'Crusty Bread', category: 'cooked_food', tier: 1, vendorFloorPrice: 4, baseStats: { healing: 6 } },
  smoked_prawn: { id: 'smoked_prawn', name: 'Smoked Prawn', category: 'cooked_food', tier: 1, vendorFloorPrice: 4, baseStats: { healing: 4 } },
  crisped_minnow: { id: 'crisped_minnow', name: 'Crisped Minnow', category: 'cooked_food', tier: 1, vendorFloorPrice: 6, baseStats: { healing: 7 } },
  seared_trout: { id: 'seared_trout', name: 'Seared Trout', category: 'cooked_food', tier: 2, vendorFloorPrice: 14, baseStats: { healing: 14 } },
  poached_solar_crest: { id: 'poached_solar_crest', name: 'Poached Solar Crest', category: 'cooked_food', tier: 3, vendorFloorPrice: 30, baseStats: { healing: 24 } },
  glazed_albacore: { id: 'glazed_albacore', name: 'Glazed Albacore', category: 'cooked_food', tier: 4, vendorFloorPrice: 60, baseStats: { healing: 38 } },
  broiled_ironpincer: { id: 'broiled_ironpincer', name: 'Broiled Ironpincer', category: 'cooked_food', tier: 5, vendorFloorPrice: 130, baseStats: { healing: 58 } },
  roast_bladefin: { id: 'roast_bladefin', name: 'Roast Bladefin', category: 'cooked_food', tier: 6, vendorFloorPrice: 280, baseStats: { healing: 85 } },
  feast_of_the_maw: { id: 'feast_of_the_maw', name: 'Feast of the Maw', category: 'cooked_food', tier: 6, vendorFloorPrice: 640, baseStats: { healing: 130 } },

  // --- Crops & Flora ---
  earthtuber: { id: 'earthtuber', name: 'Earthtuber', category: 'crop', tier: 1, vendorFloorPrice: 5 },
  glowshroom: { id: 'glowshroom', name: 'Glowshroom', category: 'crop', tier: 2, vendorFloorPrice: 15 },
  deep_radish: { id: 'deep_radish', name: 'Deep Radish', category: 'crop', tier: 3, vendorFloorPrice: 35 },
  bramble_mandrake: { id: 'bramble_mandrake', name: 'Bramble Mandrake', category: 'crop', tier: 4, vendorFloorPrice: 80 },
  nether_gourd: { id: 'nether_gourd', name: 'Nether Gourd', category: 'crop', tier: 5, vendorFloorPrice: 180 },
  sunfire_pepper: { id: 'sunfire_pepper', name: 'Sunfire Pepper', category: 'crop', tier: 6, vendorFloorPrice: 400 },

  // --- Seeds ---
  earthtuber_seed: { id: 'earthtuber_seed', name: 'Earthtuber Seed', category: 'seed', tier: 1, vendorFloorPrice: 2 },
  glowshroom_spore: { id: 'glowshroom_spore', name: 'Glowshroom Spore', category: 'seed', tier: 2, vendorFloorPrice: 6 },
  deep_radish_seed: { id: 'deep_radish_seed', name: 'Deep Radish Seed', category: 'seed', tier: 3, vendorFloorPrice: 14 },
  bramble_mandrake_seed: { id: 'bramble_mandrake_seed', name: 'Bramble Mandrake Seed', category: 'seed', tier: 4, vendorFloorPrice: 35 },
  nether_gourd_seed: { id: 'nether_gourd_seed', name: 'Nether Gourd Seed', category: 'seed', tier: 5, vendorFloorPrice: 85 },
  sunfire_pod: { id: 'sunfire_pod', name: 'Sunfire Pod', category: 'seed', tier: 6, vendorFloorPrice: 200 },

  // --- Herbs & Reagents ---
  silverleaf: { id: 'silverleaf', name: 'Silverleaf', category: 'herb', tier: 1, vendorFloorPrice: 8 },
  nightshade_bell: { id: 'nightshade_bell', name: 'Nightshade Bell', category: 'herb', tier: 3, vendorFloorPrice: 30 },
  wyrmfrond: { id: 'wyrmfrond', name: 'Wyrmfrond', category: 'herb', tier: 5, vendorFloorPrice: 120 },
  silverleaf_seed: { id: 'silverleaf_seed', name: 'Silverleaf Seed', category: 'seed', tier: 1, vendorFloorPrice: 5 },
  nightshade_seed: { id: 'nightshade_seed', name: 'Nightshade Seed', category: 'seed', tier: 3, vendorFloorPrice: 20 },
  wyrmfrond_seed: { id: 'wyrmfrond_seed', name: 'Wyrmfrond Seed', category: 'seed', tier: 5, vendorFloorPrice: 75 },

  // --- Draughts & Alchemy ---
  artisans_draught: { id: 'artisans_draught', name: "Artisan's Draught", category: 'potion', tier: 1, vendorFloorPrice: 30 },
  zephyr_phial: { id: 'zephyr_phial', name: 'Zephyr Phial', category: 'potion', tier: 2, vendorFloorPrice: 70 },
  predators_elixir: { id: 'predators_elixir', name: "Predator's Elixir", category: 'potion', tier: 3, vendorFloorPrice: 150 },
  restorative_draught: { id: 'restorative_draught', name: 'Restorative Draught', category: 'potion', tier: 4, vendorFloorPrice: 250 },
  warmasters_draught: { id: 'warmasters_draught', name: "Warmaster's Draught", category: 'potion', tier: 5, vendorFloorPrice: 400 },
  celerity_flask: { id: 'celerity_flask', name: 'Celerity Flask', category: 'potion', tier: 5, vendorFloorPrice: 550 },
  elixir_of_the_eldervault: { id: 'elixir_of_the_eldervault', name: 'Elixir of the Eldervault', category: 'potion', tier: 6, vendorFloorPrice: 900 },
  abyssal_gold_phial: { id: 'abyssal_gold_phial', name: 'Abyssal Gold Phial', category: 'potion', tier: 6, vendorFloorPrice: 1800 },

  // --- Gems, Currencies & Relics ---
  uncut_celestial_gem: { id: 'uncut_celestial_gem', name: 'Uncut Celestial Gem', category: 'relic', tier: 2, vendorFloorPrice: 40 },
  cut_celestial_gem: { id: 'cut_celestial_gem', name: 'Cut Celestial Gem', category: 'relic', tier: 2, vendorFloorPrice: 60 },
  anima: { id: 'anima', name: 'Anima', category: 'relic', tier: 3, vendorFloorPrice: 600, description: 'Ethereal catalyst used for Soul Attunement' },
  ward_scroll: { id: 'ward_scroll', name: 'Ward Scroll', category: 'relic', tier: 5, vendorFloorPrice: 2000, description: 'Protects an item from resetting on failed enhancement' },

  // --- Boss Relics ---
  titan_core: { id: 'titan_core', name: 'Titan Core', category: 'relic', tier: 6, vendorFloorPrice: 15000 },
  leviathan_scale: { id: 'leviathan_scale', name: 'Leviathan Scale', category: 'relic', tier: 6, vendorFloorPrice: 15000 },
  wyrm_ember: { id: 'wyrm_ember', name: 'Wyrm Ember', category: 'relic', tier: 6, vendorFloorPrice: 15000 },

  // --- Monster Trophies (Hides & Parts) ---
  mire_rat_pelt: { id: 'mire_rat_pelt', name: 'Mire-Rat Pelt', category: 'trophy', tier: 1, vendorFloorPrice: 5 },
  gnawed_talisman: { id: 'gnawed_talisman', name: 'Gnawed Talisman', category: 'relic', tier: 1, vendorFloorPrice: 50 },
  bogling_hide: { id: 'bogling_hide', name: 'Bogling Hide', category: 'trophy', tier: 2, vendorFloorPrice: 12 },
  bog_pearl: { id: 'bog_pearl', name: 'Bog Pearl', category: 'relic', tier: 2, vendorFloorPrice: 120 },
  crypt_carapace: { id: 'crypt_carapace', name: 'Crypt Carapace', category: 'trophy', tier: 3, vendorFloorPrice: 60 },
  dry_sigil: { id: 'dry_sigil', name: 'Dry Sigil', category: 'relic', tier: 3, vendorFloorPrice: 250 },
  ossuary_bone: { id: 'ossuary_bone', name: 'Ossuary Bone', category: 'trophy', tier: 3, vendorFloorPrice: 120 },
  cairn_sigil: { id: 'cairn_sigil', name: 'Cairn Sigil', category: 'relic', tier: 3, vendorFloorPrice: 400 },
  spectre_ash: { id: 'spectre_ash', name: 'Spectre Ash', category: 'trophy', tier: 4, vendorFloorPrice: 200 },
  solar_remnant: { id: 'solar_remnant', name: 'Solar Remnant', category: 'relic', tier: 4, vendorFloorPrice: 700 },
  frost_worg_fur: { id: 'frost_worg_fur', name: 'Frost-Worg Fur', category: 'trophy', tier: 5, vendorFloorPrice: 500 },
  rimefang: { id: 'rimefang', name: 'Rimefang', category: 'relic', tier: 5, vendorFloorPrice: 1100 },
  dreadclaw: { id: 'dreadclaw', name: 'Dreadclaw', category: 'trophy', tier: 5, vendorFloorPrice: 700 },
  venomfang: { id: 'venomfang', name: 'Venomfang', category: 'relic', tier: 5, vendorFloorPrice: 1500 },
  ember_scale: { id: 'ember_scale', name: 'Ember Scale', category: 'trophy', tier: 6, vendorFloorPrice: 1200 },
  cinder_core: { id: 'cinder_core', name: 'Cinder Core', category: 'relic', tier: 6, vendorFloorPrice: 2500 },
  jarls_hide: { id: 'jarls_hide', name: "Jarl's Hide", category: 'trophy', tier: 6, vendorFloorPrice: 2000 },
  void_ichor: { id: 'void_ichor', name: 'Void-Ichor', category: 'trophy', tier: 6, vendorFloorPrice: 3500 },
  rime_shard: { id: 'rime_shard', name: 'Rime Shard', category: 'trophy', tier: 6, vendorFloorPrice: 5000 },
  drake_leather: { id: 'drake_leather', name: 'Drake Leather', category: 'trophy', tier: 6, vendorFloorPrice: 7500 },

  // --- Stolen Cloth Bolts ---
  homespun_bolt: { id: 'homespun_bolt', name: 'Homespun Bolt', category: 'relic', tier: 1, vendorFloorPrice: 10 },
  silk_bolt: { id: 'silk_bolt', name: 'Silk Bolt', category: 'relic', tier: 2, vendorFloorPrice: 40 },
  gilded_bolt: { id: 'gilded_bolt', name: 'Gilded Bolt', category: 'relic', tier: 3, vendorFloorPrice: 110 },
  voidweave_bolt: { id: 'voidweave_bolt', name: 'Voidweave Bolt', category: 'relic', tier: 5, vendorFloorPrice: 320 },

  // --- Weapons: Blades (Melee 1-Hand) ---
  dawnburn_blade: { id: 'dawnburn_blade', name: 'Dawnburn Blade', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 6, strength: 5, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 10 },
  cold_iron_blade: { id: 'cold_iron_blade', name: 'Cold Iron Blade', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 14, strength: 12, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 35 },
  steel_blade: { id: 'steel_blade', name: 'Steel Blade', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 24, strength: 21, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 120 },
  azurite_blade: { id: 'azurite_blade', name: 'Azurite Blade', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 38, strength: 34, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 450 },
  astralite_blade: { id: 'astralite_blade', name: 'Astralite Blade', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 1600 },
  primordial_titan_blade: { id: 'primordial_titan_blade', name: 'Primordial Titan Blade', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 70, strength: 63, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 5000 },

  // --- Weapons: Greatswords (Melee 2-Hand) ---
  dawnburn_greatsword: { id: 'dawnburn_greatsword', name: 'Dawnburn Greatsword', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 7, strength: 5, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 20 },
  cold_iron_greatsword: { id: 'cold_iron_greatsword', name: 'Cold Iron Greatsword', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 16, strength: 15, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 70 },
  steel_greatsword: { id: 'steel_greatsword', name: 'Steel Greatsword', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 27, strength: 24, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 240 },
  azurite_greatsword: { id: 'azurite_greatsword', name: 'Azurite Greatsword', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 53, strength: 48, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 900 },
  astralite_greatsword: { id: 'astralite_greatsword', name: 'Astralite Greatsword', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 72, strength: 65, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 3200 },
  primordial_greatsword: { id: 'primordial_greatsword', name: 'Primordial Greatsword', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 80, strength: 72, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 9500 },

  // --- Weapons: Shortbows (Marksmanship) ---
  ashwood_shortbow: { id: 'ashwood_shortbow', name: 'Ashwood Shortbow', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 5, strength: 4, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 10 },
  oak_shortbow: { id: 'oak_shortbow', name: 'Oak Shortbow', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 12, strength: 10, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 35 },
  willow_shortbow: { id: 'willow_shortbow', name: 'Willow Shortbow', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 20, strength: 17, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 120 },
  bloodwood_shortbow: { id: 'bloodwood_shortbow', name: 'Bloodwood Shortbow', category: 'weapon', tier: 4, slot: 'weapon', equipReq: { skill: 'ranged', level: 45 }, baseStats: { accuracy: 30, strength: 26, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 280 },
  ghostwood_shortbow: { id: 'ghostwood_shortbow', name: 'Ghostwood Shortbow', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 42, strength: 37, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 700 },
  starlight_shortbow: { id: 'starlight_shortbow', name: 'Starlight Shortbow', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'ranged', level: 75 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 1800 },

  // --- Weapons: Evocation Staves (Arcane Sorcery) ---
  ashwood_staff: { id: 'ashwood_staff', name: 'Ashwood Staff', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 5, strength: 4, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 12 },
  oak_staff: { id: 'oak_staff', name: 'Oak Staff', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'magic', level: 15 }, baseStats: { accuracy: 12, strength: 10, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 40 },
  willow_staff: { id: 'willow_staff', name: 'Willow Staff', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'magic', level: 30 }, baseStats: { accuracy: 20, strength: 17, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 140 },
  bloodwood_staff: { id: 'bloodwood_staff', name: 'Bloodwood Staff', category: 'weapon', tier: 4, slot: 'weapon', equipReq: { skill: 'magic', level: 45 }, baseStats: { accuracy: 30, strength: 26, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 320 },
  ghostwood_staff: { id: 'ghostwood_staff', name: 'Ghostwood Staff', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'magic', level: 60 }, baseStats: { accuracy: 42, strength: 37, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 800 },
  starlight_staff: { id: 'starlight_staff', name: 'Starlight Staff', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'magic', level: 75 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 2100 },

  // --- Shields & Offhands ---
  dawnburn_shield: { id: 'dawnburn_shield', name: 'Dawnburn Shield', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'melee', level: 1 }, baseStats: { strength: 3, defence: 4 }, vendorFloorPrice: 15 },
  cold_iron_shield: { id: 'cold_iron_shield', name: 'Cold Iron Shield', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'melee', level: 15 }, baseStats: { strength: 9, defence: 9 }, vendorFloorPrice: 50 },
  steel_shield: { id: 'steel_shield', name: 'Steel Shield', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'melee', level: 30 }, baseStats: { strength: 14, defence: 16 }, vendorFloorPrice: 180 },
  azurite_shield: { id: 'azurite_shield', name: 'Azurite Shield', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'melee', level: 60 }, baseStats: { strength: 35, defence: 25 }, vendorFloorPrice: 650 },
  astralite_shield: { id: 'astralite_shield', name: 'Astralite Shield', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'melee', level: 85 }, baseStats: { strength: 43, defence: 37 }, vendorFloorPrice: 2200 },
  primordial_shield: { id: 'primordial_shield', name: 'Primordial Shield', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'melee', level: 99 }, baseStats: { strength: 43, defence: 46 }, vendorFloorPrice: 6500 },

  // --- Quivers (Ranged Offhand) ---
  pelt_quiver: { id: 'pelt_quiver', name: 'Pelt Quiver', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 15 },
  bogskin_quiver: { id: 'bogskin_quiver', name: 'Bogskin Quiver', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 4, strength: 3 }, vendorFloorPrice: 45 },
  chitin_quiver: { id: 'chitin_quiver', name: 'Chitin Quiver', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 7, strength: 5 }, vendorFloorPrice: 150 },
  fur_quiver: { id: 'fur_quiver', name: 'Fur Quiver', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 11, strength: 8 }, vendorFloorPrice: 500 },
  scale_quiver: { id: 'scale_quiver', name: 'Scale Quiver', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'ranged', level: 85 }, baseStats: { accuracy: 16, strength: 12 }, vendorFloorPrice: 1600 },

  // --- Grimoires (Magic Offhand) ---
  linen_grimoire: { id: 'linen_grimoire', name: 'Linen Grimoire', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 20 },
  silk_grimoire: { id: 'silk_grimoire', name: 'Silk Grimoire', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'magic', level: 25 }, baseStats: { accuracy: 5, strength: 4 }, vendorFloorPrice: 90 },
  gilded_grimoire: { id: 'gilded_grimoire', name: 'Gilded Grimoire', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'magic', level: 50 }, baseStats: { accuracy: 9, strength: 7 }, vendorFloorPrice: 300 },
  voidweave_grimoire: { id: 'voidweave_grimoire', name: 'Voidweave Grimoire', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'magic', level: 75 }, baseStats: { accuracy: 14, strength: 11 }, vendorFloorPrice: 950 },

  // --- Heavy Plate Armours (Body) ---
  tunic_cloth: { id: 'tunic_cloth', name: 'Adventurer Tunic', category: 'armour', tier: 1, slot: 'body', baseStats: { defence: 2 }, vendorFloorPrice: 5 },
  pelt_jerkin: { id: 'pelt_jerkin', name: 'Leather Tunic', category: 'armour', tier: 1, slot: 'body', baseStats: { defence: 4 }, vendorFloorPrice: 20 },
  dawnburn_plate: { id: 'dawnburn_plate', name: 'Dawnburn Plate', category: 'armour', tier: 1, slot: 'body', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 2, defence: 6 }, vendorFloorPrice: 30 },
  cold_iron_plate: { id: 'cold_iron_plate', name: 'Cold Iron Plate', category: 'armour', tier: 2, slot: 'body', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 5, defence: 14 }, vendorFloorPrice: 90 },
  steel_plate: { id: 'steel_plate', name: 'Steel Plate', category: 'armour', tier: 3, slot: 'body', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 8, defence: 24 }, vendorFloorPrice: 300 },
  azurite_plate: { id: 'azurite_plate', name: 'Azurite Plate', category: 'armour', tier: 5, slot: 'body', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 13, defence: 38 }, vendorFloorPrice: 1100 },
  astralite_plate: { id: 'astralite_plate', name: 'Astralite Plate', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 20, defence: 56 }, vendorFloorPrice: 3500 },
  primordial_plate: { id: 'primordial_plate', name: 'Primordial Plate', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 24, defence: 70 }, vendorFloorPrice: 11000 },

  // --- Leg Armours (Legs) ---
  tunic_pants: { id: 'tunic_pants', name: 'Adventurer Trousers', category: 'armour', tier: 1, slot: 'legs', baseStats: { defence: 2 }, vendorFloorPrice: 5 },
  leather_chaps: { id: 'leather_chaps', name: 'Leather Chaps', category: 'armour', tier: 1, slot: 'legs', baseStats: { defence: 3 }, vendorFloorPrice: 15 },
  dawnburn_legs: { id: 'dawnburn_legs', name: 'Dawnburn Greaves', category: 'armour', tier: 1, slot: 'legs', equipReq: { skill: 'melee', level: 1 }, baseStats: { defence: 4 }, vendorFloorPrice: 20 },
  cold_iron_legs: { id: 'cold_iron_legs', name: 'Cold Iron Greaves', category: 'armour', tier: 2, slot: 'legs', equipReq: { skill: 'melee', level: 15 }, baseStats: { defence: 10 }, vendorFloorPrice: 60 },
  steel_legs: { id: 'steel_legs', name: 'Steel Greaves', category: 'armour', tier: 3, slot: 'legs', equipReq: { skill: 'melee', level: 30 }, baseStats: { defence: 18 }, vendorFloorPrice: 200 },
  azurite_legs: { id: 'azurite_legs', name: 'Azurite Greaves', category: 'armour', tier: 5, slot: 'legs', equipReq: { skill: 'melee', level: 60 }, baseStats: { defence: 30 }, vendorFloorPrice: 800 },
  astralite_legs: { id: 'astralite_legs', name: 'Astralite Greaves', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'melee', level: 85 }, baseStats: { defence: 44 }, vendorFloorPrice: 2600 },
  primordial_legs: { id: 'primordial_legs', name: 'Primordial Greaves', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'melee', level: 99 }, baseStats: { defence: 56 }, vendorFloorPrice: 8500 },

  // --- Helmets & Headgear (Helmet) ---
  wizard_hat: { id: 'wizard_hat', name: 'Apprentice Wizard Hat', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 3 }, vendorFloorPrice: 25 },
  ranger_hood: { id: 'ranger_hood', name: 'Ranger Cowl', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 3 }, vendorFloorPrice: 25 },
  dawnburn_helm: { id: 'dawnburn_helm', name: 'Dawnburn Open Helm', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'melee', level: 1 }, baseStats: { defence: 3 }, vendorFloorPrice: 20 },
  steel_helm: { id: 'steel_helm', name: 'Steel Full Helm', category: 'armour', tier: 3, slot: 'helmet', equipReq: { skill: 'melee', level: 30 }, baseStats: { defence: 12 }, vendorFloorPrice: 220 },
  azurite_helm: { id: 'azurite_helm', name: 'Azurite Visor Helm', category: 'armour', tier: 5, slot: 'helmet', equipReq: { skill: 'melee', level: 60 }, baseStats: { defence: 22 }, vendorFloorPrice: 750 },
  astralite_helm: { id: 'astralite_helm', name: 'Astralite Crown', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'melee', level: 85 }, baseStats: { defence: 32 }, vendorFloorPrice: 2500 },
  primordial_helm: { id: 'primordial_helm', name: 'Primordial Horned Mask', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'melee', level: 99 }, baseStats: { defence: 40 }, vendorFloorPrice: 7500 },

  // --- Cosmetic Hair (Hair) ---
  hair_adventurer: { id: 'hair_adventurer', name: 'Adventurer Hair', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'Classic styled adventurer crop' },
  hair_maiden: { id: 'hair_maiden', name: 'Maiden Locks', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'Flowing auburn tresses' },
  hair_elder: { id: 'hair_elder', name: 'Sage Beard & Mane', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'Wispy silver hair and majestic beard' },

  // --- Tools (Equippable to Skilling Toolbelt) ---
  rune_pickaxe_dawnburn: { id: 'rune_pickaxe_dawnburn', name: 'Dawnburn Rune Pickaxe', category: 'tool', tier: 1, slot: 'tool_pickaxe', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15 },
  rune_pickaxe_cold_iron: { id: 'rune_pickaxe_cold_iron', name: 'Cold Iron Rune Pickaxe', category: 'tool', tier: 2, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 15 }, baseStats: { toolSpeedBonus: 0.16 }, vendorFloorPrice: 50 },
  rune_pickaxe_steel: { id: 'rune_pickaxe_steel', name: 'Steel Rune Pickaxe', category: 'tool', tier: 3, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 30 }, baseStats: { toolSpeedBonus: 0.25 }, vendorFloorPrice: 160 },
  rune_pickaxe_azurite: { id: 'rune_pickaxe_azurite', name: 'Azurite Rune Pickaxe', category: 'tool', tier: 5, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 60 }, baseStats: { toolSpeedBonus: 0.38 }, vendorFloorPrice: 600 },
  rune_pickaxe_astralite: { id: 'rune_pickaxe_astralite', name: 'Astralite Rune Pickaxe', category: 'tool', tier: 6, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 85 }, baseStats: { toolSpeedBonus: 0.50 }, vendorFloorPrice: 2000 },

  rune_axe_dawnburn: { id: 'rune_axe_dawnburn', name: 'Dawnburn Wood Axe', category: 'tool', tier: 1, slot: 'tool_axe', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15 },
  rune_axe_cold_iron: { id: 'rune_axe_cold_iron', name: 'Cold Iron Wood Axe', category: 'tool', tier: 2, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 15 }, baseStats: { toolSpeedBonus: 0.16 }, vendorFloorPrice: 50 },
  rune_axe_steel: { id: 'rune_axe_steel', name: 'Steel Wood Axe', category: 'tool', tier: 3, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 30 }, baseStats: { toolSpeedBonus: 0.25 }, vendorFloorPrice: 160 },
  rune_axe_azurite: { id: 'rune_axe_azurite', name: 'Azurite Wood Axe', category: 'tool', tier: 5, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 60 }, baseStats: { toolSpeedBonus: 0.38 }, vendorFloorPrice: 600 },
  rune_axe_astralite: { id: 'rune_axe_astralite', name: 'Astralite Wood Axe', category: 'tool', tier: 6, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 85 }, baseStats: { toolSpeedBonus: 0.50 }, vendorFloorPrice: 2000 },

  fishing_rod_willow: { id: 'fishing_rod_willow', name: 'Willow Fishing Rod', category: 'tool', tier: 1, slot: 'tool_rod', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15 },
  fishing_rod_oak: { id: 'fishing_rod_oak', name: 'Oak Fishing Rod', category: 'tool', tier: 2, slot: 'tool_rod', equipReq: { skill: 'fishing', level: 20 }, baseStats: { toolSpeedBonus: 0.18 }, vendorFloorPrice: 60 },
  fishing_rod_yew: { id: 'fishing_rod_yew', name: 'Yew Deep-Sea Rod', category: 'tool', tier: 4, slot: 'tool_rod', equipReq: { skill: 'fishing', level: 50 }, baseStats: { toolSpeedBonus: 0.32 }, vendorFloorPrice: 350 },

  // --- Steeds (Mounts) ---
  steed_courser: { id: 'steed_courser', name: 'Eldorian Courser', category: 'steed', tier: 2, slot: 'steed', vendorFloorPrice: 20000, description: 'Grants walking speed haste on the road' }
};

export type StackingLocation = 'inventory' | 'bank' | 'storage';

export function isItemStackable(item?: ItemDefinition, location: StackingLocation = 'inventory'): boolean {
  if (!item) return false;
  const isBank = location === 'bank' || location === 'storage';

  if (isBank) {
    if (item.stackableInBank !== undefined) return item.stackableInBank;
  } else {
    if (item.stackableInInventory !== undefined) return item.stackableInInventory;
  }

  if (item.stackable !== undefined) {
    if (!item.stackable) return isBank ? true : false;
    return item.stackable;
  }

  // Cooked food stacks in bank, but occupies 1 slot per item in inventory
  if (item.category === 'cooked_food') {
    return isBank;
  }

  // Non-stackable by default: weapon, armour, tool, steed
  if (['weapon', 'armour', 'tool', 'steed'].includes(item.category)) {
    return false;
  }
  return true;
}

export function getItemMaxStack(item?: ItemDefinition, location: StackingLocation = 'inventory'): number {
  if (!item) return 1;
  if (!isItemStackable(item, location)) return 1;
  const isBank = location === 'bank' || location === 'storage';

  if (isBank) {
    if (item.maxStackBank && item.maxStackBank > 0) return item.maxStackBank;
  } else {
    if (item.maxStackInventory && item.maxStackInventory > 0) return item.maxStackInventory;
  }

  if (item.maxStack && item.maxStack > 0) return item.maxStack;
  return 999999;
}

export function addItemToSlots(
  slots: InventorySlot[],
  maxSlots: number,
  itemId: string,
  quantity: number,
  rarity: Rarity = 'plain',
  plus: number = 0,
  itemDef?: ItemDefinition,
  location: StackingLocation = 'inventory'
): { added: number; remainder: number } {
  if (quantity <= 0) return { added: 0, remainder: 0 };
  const stackable = isItemStackable(itemDef, location);
  const maxStack = getItemMaxStack(itemDef, location);

  let remaining = quantity;

  // 1. Try filling existing slots if stackable
  if (stackable) {
    for (const slot of slots) {
      if (
        slot.itemId === itemId &&
        (slot.rarity || 'plain') === (rarity || 'plain') &&
        (slot.plus || 0) === (plus || 0) &&
        slot.quantity < maxStack
      ) {
        const canTake = maxStack - slot.quantity;
        const toAdd = Math.min(canTake, remaining);
        slot.quantity += toAdd;
        remaining -= toAdd;
        if (remaining <= 0) break;
      }
    }
  }

  // 2. Open new slots while space permits
  while (remaining > 0 && slots.length < maxSlots) {
    const toAdd = stackable ? Math.min(remaining, maxStack) : 1;
    slots.push({
      itemId,
      quantity: toAdd,
      rarity,
      plus,
    });
    remaining -= toAdd;
  }

  return {
    added: quantity - remaining,
    remainder: remaining,
  };
}
