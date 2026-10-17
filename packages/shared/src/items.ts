import { ItemDefinition, InventorySlot } from './types.js';
import { Rarity } from './constants.js';

export const ITEMS: Record<string, ItemDefinition> = {
  // --- Currency ---
  gold: { id: 'gold', name: 'Gold', category: 'currency', tier: 1, vendorFloorPrice: 1, description: 'Gleaming gold coins of the realm.' },

  // --- Ores & Minerals ---
  pyrite_ore: { id: 'pyrite_ore', name: 'Pyrite Ore', category: 'ore', tier: 1, vendorFloorPrice: 2, description: "Common fool's gold ore chipped from surface stone. Smelts into dawnburn ingots." },
  galena_ore: { id: 'galena_ore', name: 'Galena Ore', category: 'ore', tier: 1, vendorFloorPrice: 2, description: 'Heavy lead-gray ore found in shallow quarries. Useful for basic metalwork.' },
  cold_iron_ore: { id: 'cold_iron_ore', name: 'Cold Iron Ore', category: 'ore', tier: 2, vendorFloorPrice: 5, description: 'Dense ore that stays freezing to the touch. Refines into cold iron ingots.' },
  quicksilver_ore: { id: 'quicksilver_ore', name: 'Quicksilver Ore', category: 'ore', tier: 3, vendorFloorPrice: 12, description: 'Lustrous, silvery stone that shimmers faintly under torchlight.' },
  nethercoal: { id: 'nethercoal', name: 'Nethercoal', category: 'ore', tier: 3, vendorFloorPrice: 8, description: 'Dark volcanic fuel that burns far hotter and longer than standard coal.' },
  solar_aurum_ore: { id: 'solar_aurum_ore', name: 'Solar Aurum Ore', category: 'ore', tier: 4, vendorFloorPrice: 25, description: 'Rare golden ore found deep in sunlit veins. Highly prized by blacksmiths.' },
  azurite_ore: { id: 'azurite_ore', name: 'Azurite Ore', category: 'ore', tier: 5, vendorFloorPrice: 50, description: 'Deep cobalt ore laced with raw arcane currents.' },
  starfall_ore: { id: 'starfall_ore', name: 'Starfall Ore', category: 'ore', tier: 6, vendorFloorPrice: 150, description: 'Meteoric metal fragments with an unnatural celestial sheen.' },
  titan_shard: { id: 'titan_shard', name: 'Titan Shard', category: 'ore', tier: 6, vendorFloorPrice: 800, description: 'A jagged fragment chipped from the bones of primordial giants.' },

  // --- Refined Ingots ---
  dawnburn_ingot: { id: 'dawnburn_ingot', name: 'Dawnburn Ingot', category: 'bar', tier: 1, vendorFloorPrice: 6, description: 'A solid bronze-tinted bar forged from pyrite and galena.' },
  cold_iron_ingot: { id: 'cold_iron_ingot', name: 'Cold Iron Ingot', category: 'bar', tier: 2, vendorFloorPrice: 14, description: 'A tempered cold iron bar used for sturdy early gear.' },
  steel_ingot: { id: 'steel_ingot', name: 'Steel Ingot', category: 'bar', tier: 3, vendorFloorPrice: 40, description: 'A hard steel bar smelted from iron and nethercoal flux.' },
  azurite_ingot: { id: 'azurite_ingot', name: 'Azurite Ingot', category: 'bar', tier: 5, vendorFloorPrice: 180, description: 'A glowing blue alloy prized for lightweight, durable armor.' },
  solar_aurum_ingot: { id: 'solar_aurum_ingot', name: 'Solar Aurum Ingot', category: 'bar', tier: 4, vendorFloorPrice: 90, description: 'A radiant bar of refined solar gold, essential for crafting fine jewelry.' },
  astralite_ingot: { id: 'astralite_ingot', name: 'Astralite Ingot', category: 'bar', tier: 6, vendorFloorPrice: 550, description: 'An enchanted metallic bar that hums with starlight energy.' },

  // --- Timbers ---
  ashwood_timber: { id: 'ashwood_timber', name: 'Ashwood Timber', category: 'log', tier: 1, vendorFloorPrice: 2, description: 'Sturdy logs chopped from common ash trees.' },
  whispering_oak: { id: 'whispering_oak', name: 'Whispering Oak', category: 'log', tier: 2, vendorFloorPrice: 5, description: 'Hearty hardwood harvested from older forest groves.' },
  weeping_willow: { id: 'weeping_willow', name: 'Weeping Willow', category: 'log', tier: 3, vendorFloorPrice: 12, description: 'Flexible timber popular for lightweight bows and tool handles.' },
  bloodwood_timber: { id: 'bloodwood_timber', name: 'Bloodwood Timber', category: 'log', tier: 4, vendorFloorPrice: 28, description: 'Tough, red-grained logs favored for military recurve bows.' },
  ghostwood_timber: { id: 'ghostwood_timber', name: 'Ghostwood Timber', category: 'log', tier: 5, vendorFloorPrice: 70, description: 'Pale, ghostly timber that remains unusually light and rigid.' },
  starlight_timber: { id: 'starlight_timber', name: 'Starlight Timber', category: 'log', tier: 6, vendorFloorPrice: 180, description: 'Iridescent wood cut from celestial trees under clear skies.' },

  // --- Marine Fish (Raw) ---
  tide_prawn: { id: 'tide_prawn', name: 'Tide Prawn', category: 'raw_food', tier: 1, vendorFloorPrice: 2, description: 'A small freshwater prawn caught along tidal pools.' },
  glimmer_minnow: { id: 'glimmer_minnow', name: 'Glimmer Minnow', category: 'raw_food', tier: 1, vendorFloorPrice: 3, description: 'A tiny minnow with iridescent scales. Needs cooking before eating.' },
  silverspeck_trout: { id: 'silverspeck_trout', name: 'Silverspeck Trout', category: 'raw_food', tier: 2, vendorFloorPrice: 7, description: 'A plump river trout with silvery speckles.' },
  solar_crest_salmon: { id: 'solar_crest_salmon', name: 'Solar Crest Salmon', category: 'raw_food', tier: 3, vendorFloorPrice: 15, description: 'A golden salmon that swims against fast rapids.' },
  deepsea_albacore: { id: 'deepsea_albacore', name: 'Deepsea Albacore', category: 'raw_food', tier: 4, vendorFloorPrice: 30, description: 'A firm coastal fish hauled from deeper waters.' },
  ironpincer_crustacean: { id: 'ironpincer_crustacean', name: 'Ironpincer Crustacean', category: 'raw_food', tier: 5, vendorFloorPrice: 65, description: 'A thick-shelled crab caught in rocky surf.' },
  bladefin_sovereign: { id: 'bladefin_sovereign', name: 'Bladefin Sovereign', category: 'raw_food', tier: 6, vendorFloorPrice: 140, description: 'A prize catch with sharp fins and tender meat.' },
  abyssal_mawshark: { id: 'abyssal_mawshark', name: 'Abyssal Mawshark', category: 'raw_food', tier: 6, vendorFloorPrice: 320, description: 'A ferocious deep-sea predator hauled up from dark waters.' },

  // --- Cooked Food ---
  crusty_bread: { id: 'crusty_bread', name: 'Crusty Bread', category: 'cooked_food', tier: 1, vendorFloorPrice: 4, baseStats: { healing: 6 }, description: 'A warm baked loaf with a crisp crust. Restores 6 health.' },
  smoked_prawn: { id: 'smoked_prawn', name: 'Smoked Prawn', category: 'cooked_food', tier: 1, vendorFloorPrice: 4, baseStats: { healing: 4 }, description: 'Crispy smoked prawns skewered over coals. Restores 4 health.' },
  crisped_minnow: { id: 'crisped_minnow', name: 'Crisped Minnow', category: 'cooked_food', tier: 1, vendorFloorPrice: 6, baseStats: { healing: 7 }, description: 'Lightly salted and pan-fried whole. Restores 7 health.' },
  seared_trout: { id: 'seared_trout', name: 'Seared Trout', category: 'cooked_food', tier: 2, vendorFloorPrice: 14, baseStats: { healing: 14 }, description: 'Flaky freshwater trout cooked over an open fire. Restores 14 health.' },
  poached_solar_crest: { id: 'poached_solar_crest', name: 'Poached Solar Crest', category: 'cooked_food', tier: 3, vendorFloorPrice: 30, baseStats: { healing: 24 }, description: 'Tender salmon poached in herb butter. Restores 24 health.' },
  glazed_albacore: { id: 'glazed_albacore', name: 'Glazed Albacore', category: 'cooked_food', tier: 4, vendorFloorPrice: 60, baseStats: { healing: 38 }, description: 'Sweet honey-glazed albacore steaks. Restores 38 health.' },
  broiled_ironpincer: { id: 'broiled_ironpincer', name: 'Broiled Ironpincer', category: 'cooked_food', tier: 5, vendorFloorPrice: 130, baseStats: { healing: 58 }, description: 'Broiled crab meat basted in garlic and herbs. Restores 58 health.' },
  roast_bladefin: { id: 'roast_bladefin', name: 'Roast Bladefin', category: 'cooked_food', tier: 6, vendorFloorPrice: 280, baseStats: { healing: 85 }, description: 'Rich roasted bladefin fillet packed with protein. Restores 85 health.' },
  feast_of_the_maw: { id: 'feast_of_the_maw', name: 'Feast of the Maw', category: 'cooked_food', tier: 6, vendorFloorPrice: 640, baseStats: { healing: 130 }, description: 'A hearty multi-course seafood meal. Restores 130 health.' },

  // --- Crops & Flora ---
  earthtuber: { id: 'earthtuber', name: 'Earthtuber', category: 'crop', tier: 1, vendorFloorPrice: 5, description: 'A hearty root vegetable dug up from damp garden soil.' },
  glowshroom: { id: 'glowshroom', name: 'Glowshroom', category: 'crop', tier: 2, vendorFloorPrice: 15, description: 'A bioluminescent forest mushroom that glows soft teal.' },
  deep_radish: { id: 'deep_radish', name: 'Deep Radish', category: 'crop', tier: 3, vendorFloorPrice: 35, description: 'A crisp spicy radish grown in dark nutrient-rich loam.' },
  bramble_mandrake: { id: 'bramble_mandrake', name: 'Bramble Mandrake', category: 'crop', tier: 4, vendorFloorPrice: 80, description: 'A twisted aromatic root prized by herbalists and cooks.' },
  nether_gourd: { id: 'nether_gourd', name: 'Nether Gourd', category: 'crop', tier: 5, vendorFloorPrice: 180, description: 'A dark, thick-skinned gourd packed with savory pulp.' },
  sunfire_pepper: { id: 'sunfire_pepper', name: 'Sunfire Pepper', category: 'crop', tier: 6, vendorFloorPrice: 400, description: 'An intensely spicy pepper that warms you from head to toe.' },

  // --- Seeds ---
  earthtuber_seed: { id: 'earthtuber_seed', name: 'Earthtuber Seed', category: 'seed', tier: 1, vendorFloorPrice: 2, description: 'Small dried tubers ready to plant in a farm plot.' },
  glowshroom_spore: { id: 'glowshroom_spore', name: 'Glowshroom Spore', category: 'seed', tier: 2, vendorFloorPrice: 6, description: 'Fine luminescent spores that sprout in fertile beds.' },
  deep_radish_seed: { id: 'deep_radish_seed', name: 'Deep Radish Seed', category: 'seed', tier: 3, vendorFloorPrice: 14, description: 'Tiny black seeds that produce hearty deep radishes.' },
  bramble_mandrake_seed: { id: 'bramble_mandrake_seed', name: 'Bramble Mandrake Seed', category: 'seed', tier: 4, vendorFloorPrice: 35, description: 'Rough seed pods that sprout into mandrake root.' },
  nether_gourd_seed: { id: 'nether_gourd_seed', name: 'Nether Gourd Seed', category: 'seed', tier: 5, vendorFloorPrice: 85, description: 'Large seeds harvested from a ripe nether gourd.' },
  sunfire_pod: { id: 'sunfire_pod', name: 'Sunfire Pod', category: 'seed', tier: 6, vendorFloorPrice: 200, description: 'Warm dried pepper seeds ready to be sown.' },

  // --- Herbs & Reagents ---
  silverleaf: { id: 'silverleaf', name: 'Silverleaf', category: 'herb', tier: 1, vendorFloorPrice: 8, description: 'Fragrant silver-tipped leaves gathered from wild glades.' },
  nightshade_bell: { id: 'nightshade_bell', name: 'Nightshade Bell', category: 'herb', tier: 3, vendorFloorPrice: 30, description: 'A dark purple bell flower with potent brewing qualities.' },
  wyrmfrond: { id: 'wyrmfrond', name: 'Wyrmfrond', category: 'herb', tier: 5, vendorFloorPrice: 120, description: 'A fiery fern leaf that thrives near volcanic vents.' },
  silverleaf_seed: { id: 'silverleaf_seed', name: 'Silverleaf Seed', category: 'seed', tier: 1, vendorFloorPrice: 5, description: 'Wild herb seeds that sprout into fragrant silverleaf.' },
  nightshade_seed: { id: 'nightshade_seed', name: 'Nightshade Seed', category: 'seed', tier: 3, vendorFloorPrice: 20, description: 'Cultivated seeds of the nightshade bell plant.' },
  wyrmfrond_seed: { id: 'wyrmfrond_seed', name: 'Wyrmfrond Seed', category: 'seed', tier: 5, vendorFloorPrice: 75, description: 'Rare heat-tolerant seeds that sprout into wyrmfrond.' },

  // --- Draughts & Alchemy ---
  artisans_draught: { id: 'artisans_draught', name: "Artisan's Draught", category: 'potion', tier: 1, vendorFloorPrice: 30, description: 'A mild brew that steadies the hands for refining tasks.' },
  zephyr_phial: { id: 'zephyr_phial', name: 'Zephyr Phial', category: 'potion', tier: 2, vendorFloorPrice: 70, description: 'An airy elixir that puts a spring in your step.' },
  predators_elixir: { id: 'predators_elixir', name: "Predator's Elixir", category: 'potion', tier: 3, vendorFloorPrice: 150, description: 'Sharpened senses brew that enhances combat focus.' },
  restorative_draught: { id: 'restorative_draught', name: 'Restorative Draught', category: 'potion', tier: 4, vendorFloorPrice: 250, description: 'A soothing tonic that rapidly mends bruises and cuts.' },
  warmasters_draught: { id: 'warmasters_draught', name: "Warmaster's Draught", category: 'potion', tier: 5, vendorFloorPrice: 400, description: 'A stout combat tonic favored by frontline fighters.' },
  celerity_flask: { id: 'celerity_flask', name: 'Celerity Flask', category: 'potion', tier: 5, vendorFloorPrice: 550, description: 'A sparkling concoction that increases attack cadence.' },
  elixir_of_the_eldervault: { id: 'elixir_of_the_eldervault', name: 'Elixir of the Eldervault', category: 'potion', tier: 6, vendorFloorPrice: 900, description: 'An ancient concoction that bolsters your defensive prowess.' },
  abyssal_gold_phial: { id: 'abyssal_gold_phial', name: 'Abyssal Gold Phial', category: 'potion', tier: 6, vendorFloorPrice: 1800, description: 'A shimmering golden tonic brewed from abyssal reagents.' },

  // --- Gems, Currencies & Relics ---
  uncut_celestial_gem: { id: 'uncut_celestial_gem', name: 'Uncut Celestial Gem', category: 'relic', tier: 2, vendorFloorPrice: 40, description: 'A rough celestial gemstone waiting to be faceted at a workbench.' },
  cut_celestial_gem: { id: 'cut_celestial_gem', name: 'Cut Celestial Gem', category: 'relic', tier: 2, vendorFloorPrice: 60, description: 'A cleanly cut star gemstone used in high-tier crafting and trades.' },
  anima: { id: 'anima', name: 'Anima', category: 'relic', tier: 3, vendorFloorPrice: 600, description: 'Concentrated soul energy used for upgrading equipment at the runeforge.' },
  ward_scroll: { id: 'ward_scroll', name: 'Ward Scroll', category: 'relic', tier: 5, vendorFloorPrice: 2000, description: 'An inscribed parchment that shields gear from resetting if an enhancement fails.' },

  // --- Boss Relics ---
  titan_core: { id: 'titan_core', name: 'Titan Core', category: 'relic', tier: 6, vendorFloorPrice: 15000, description: 'The pulsing heart of an astral colossus, radiating primordial heat.' },
  leviathan_scale: { id: 'leviathan_scale', name: 'Leviathan Scale', category: 'relic', tier: 6, vendorFloorPrice: 15000, description: 'An iridescent scale shed by the sovereign of the deep trenches.' },
  wyrm_ember: { id: 'wyrm_ember', name: 'Wyrm Ember', category: 'relic', tier: 6, vendorFloorPrice: 15000, description: 'A persistent smoldering coal left behind by an ancient dragon.' },

  // --- Monster Trophies (Hides & Parts) ---
  mire_rat_pelt: { id: 'mire_rat_pelt', name: 'Mire-Rat Pelt', category: 'trophy', tier: 1, vendorFloorPrice: 5, description: 'A coarse pelt stripped from a sewer or bog rodent.' },
  gnawed_talisman: { id: 'gnawed_talisman', name: 'Gnawed Talisman', category: 'relic', tier: 1, vendorFloorPrice: 50, description: 'A weathered bone charm carried by denizens of the marsh.' },
  ghoul_hide: { id: 'ghoul_hide', name: 'Ghoul Hide', category: 'trophy', tier: 2, vendorFloorPrice: 12, description: 'Withered, leathery hide flayed from mire ghouls and marsh horrors.' },
  bogling_hide: { id: 'bogling_hide', name: 'Ghoul Hide', category: 'trophy', tier: 2, vendorFloorPrice: 12, description: 'Withered, leathery hide flayed from mire ghouls and marsh horrors.' },
  bog_pearl: { id: 'bog_pearl', name: 'Bog Pearl', category: 'relic', tier: 2, vendorFloorPrice: 120, description: 'A murky freshwater pearl pried from a marsh mollusk.' },
  crypt_carapace: { id: 'crypt_carapace', name: 'Crypt Carapace', category: 'trophy', tier: 3, vendorFloorPrice: 60, description: 'The hard chitinous shell of an ancient crypt crawler.' },
  dry_sigil: { id: 'dry_sigil', name: 'Dry Sigil', category: 'relic', tier: 3, vendorFloorPrice: 250, description: 'An engraved sandstone talisman recovered from barrow grounds.' },
  ossuary_bone: { id: 'ossuary_bone', name: 'Ossuary Bone', category: 'trophy', tier: 3, vendorFloorPrice: 120, description: 'A bleached bone artifact taken from the ancient catacombs.' },
  cairn_sigil: { id: 'cairn_sigil', name: 'Cairn Sigil', category: 'relic', tier: 3, vendorFloorPrice: 400, description: 'A heavy slate marker taken from a forgotten burial cairn.' },
  spectre_ash: { id: 'spectre_ash', name: 'Spectre Ash', category: 'trophy', tier: 4, vendorFloorPrice: 200, description: 'Cold, weightless dust collected where a shade dissipated.' },
  solar_remnant: { id: 'solar_remnant', name: 'Solar Remnant', category: 'relic', tier: 4, vendorFloorPrice: 700, description: 'A warm fragment left behind by a fallen solar manifestation.' },
  frost_worg_fur: { id: 'frost_worg_fur', name: 'Frost-Worg Fur', category: 'trophy', tier: 5, vendorFloorPrice: 500, description: 'Thick insulated pelt harvested from a northern frost worg.' },
  rimefang: { id: 'rimefang', name: 'Rimefang', category: 'relic', tier: 5, vendorFloorPrice: 1100, description: 'A razor-sharp fang coated in permafrost.' },
  dreadclaw: { id: 'dreadclaw', name: 'Dreadclaw', category: 'trophy', tier: 5, vendorFloorPrice: 700, description: 'A vicious talon shed by a high-level predator.' },
  venomfang: { id: 'venomfang', name: 'Venomfang', category: 'relic', tier: 5, vendorFloorPrice: 1500, description: 'A hollow canine tooth dripping with concentrated venom.' },
  ember_scale: { id: 'ember_scale', name: 'Ember Scale', category: 'trophy', tier: 6, vendorFloorPrice: 1200, description: 'A heat-tempered scale stripped from a fire drake.' },
  cinder_core: { id: 'cinder_core', name: 'Cinder Core', category: 'relic', tier: 6, vendorFloorPrice: 2500, description: 'A crystalline lump of heat harvested from volcanic beasts.' },
  jarls_hide: { id: 'jarls_hide', name: "Jarl's Hide", category: 'trophy', tier: 6, vendorFloorPrice: 2000, description: 'The thick battle-scarred pelt of a savage frost chieftain.' },
  void_ichor: { id: 'void_ichor', name: 'Void-Ichor', category: 'trophy', tier: 6, vendorFloorPrice: 3500, description: 'Thick dark fluid drawn from creatures of the void.' },
  rime_shard: { id: 'rime_shard', name: 'Rime Shard', category: 'trophy', tier: 6, vendorFloorPrice: 5000, description: 'An ever-frozen shard that chills anything it touches.' },
  frost_tusk: { id: 'frost_tusk', name: 'Frost Tusk', category: 'relic', tier: 6, vendorFloorPrice: 2800, description: 'A massive curved tusk harvested from a frost jarl behemoth.' },
  gazing_eye: { id: 'gazing_eye', name: 'Gazing Eye', category: 'relic', tier: 6, vendorFloorPrice: 3800, description: 'An unblinking eye extracted from an abyssal void horror.' },
  glacial_crown: { id: 'glacial_crown', name: 'Glacial Crown', category: 'relic', tier: 6, vendorFloorPrice: 5500, description: 'A crystalline diadem of unmelting ice worn by the Frost Monarch.' },
  drake_leather: { id: 'drake_leather', name: 'Drake Leather', category: 'trophy', tier: 6, vendorFloorPrice: 7500, description: 'Extremely tough leather suited for high-tier archer gear.' },
  draconic_scale: { id: 'draconic_scale', name: 'Draconic Scale', category: 'relic', tier: 6, vendorFloorPrice: 8000, description: 'An indestructible chromatic scale shed by the Ashen Drake.' },
  primordial_ember: { id: 'primordial_ember', name: 'Primordial Ember', category: 'relic', tier: 6, vendorFloorPrice: 12000, description: 'A timeless spark from the core of the Magma Titan, burning eternally.' },

  // --- Stolen Cloth Bolts ---
  homespun_bolt: { id: 'homespun_bolt', name: 'Homespun Bolt', category: 'relic', tier: 1, vendorFloorPrice: 10, description: 'A bolt of coarse linen lifted from town market stalls.' },
  silk_bolt: { id: 'silk_bolt', name: 'Silk Bolt', category: 'relic', tier: 2, vendorFloorPrice: 40, description: 'Smooth woven silk swiped from wealthy merchant caravans.' },
  gilded_bolt: { id: 'gilded_bolt', name: 'Gilded Bolt', category: 'relic', tier: 3, vendorFloorPrice: 110, description: 'Expensive cloth embroidered with fine gold filament.' },
  voidweave_bolt: { id: 'voidweave_bolt', name: 'Voidweave Bolt', category: 'relic', tier: 5, vendorFloorPrice: 320, description: 'Otherworldly dark fabric that absorbs room lighting.' },

  // --- Weapons: Blades (Melee 1-Hand) ---
  dawnburn_blade: { id: 'dawnburn_blade', name: 'Dawnburn Blade', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 6, strength: 5, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 10, description: 'A simple short sword forged from bronze-tinted dawnburn metal.' },
  cold_iron_blade: { id: 'cold_iron_blade', name: 'Cold Iron Blade', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 14, strength: 12, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 35, description: 'A well-balanced one-handed sword with a biting cold edge.' },
  steel_blade: { id: 'steel_blade', name: 'Steel Blade', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 24, strength: 21, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 120, description: 'A reliable military steel longsword with a keen cutting edge.' },
  azurite_blade: { id: 'azurite_blade', name: 'Azurite Blade', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 38, strength: 34, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 450, description: 'A lightweight cobalt blade that slices smoothly through chainmail.' },
  astralite_blade: { id: 'astralite_blade', name: 'Astralite Blade', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 1600, description: 'An ornate star-forged blade that gleams with heavenly silver light.' },
  primordial_titan_blade: { id: 'primordial_titan_blade', name: 'Primordial Titan Blade', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 70, strength: 63, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 5000, description: 'A colossal one-handed broadsword forged from titan metal.' },

  // --- Weapons: Greatswords (Melee 2-Hand) ---
  dawnburn_greatsword: { id: 'dawnburn_greatsword', name: 'Dawnburn Greatsword', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 7, strength: 5, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 20, description: 'A hefty two-handed bronze sword designed for heavy cleaving.' },
  cold_iron_greatsword: { id: 'cold_iron_greatsword', name: 'Cold Iron Greatsword', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 16, strength: 15, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 70, description: 'A long two-handed blade weighted for crushing blows.' },
  steel_greatsword: { id: 'steel_greatsword', name: 'Steel Greatsword', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 27, strength: 24, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 240, description: 'A massive two-handed sword with double fullers.' },
  azurite_greatsword: { id: 'azurite_greatsword', name: 'Azurite Greatsword', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 53, strength: 48, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 900, description: 'A majestic blue broadsword with surprising balance and reach.' },
  astralite_greatsword: { id: 'astralite_greatsword', name: 'Astralite Greatsword', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 72, strength: 65, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 3200, description: 'A towering greatsword infused with astral magic.' },
  primordial_greatsword: { id: 'primordial_greatsword', name: 'Primordial Greatsword', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 80, strength: 72, swingSpeedSeconds: 2.4 }, vendorFloorPrice: 9500, description: 'A massive weapon capable of splitting boulders in half.' },

  // --- Weapons: Shortbows (Marksmanship) ---
  ashwood_shortbow: { id: 'ashwood_shortbow', name: 'Ashwood Shortbow', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 5, strength: 4, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 10, description: 'A flexible bow carved from seasoned ashwood. Good for starters.' },
  oak_shortbow: { id: 'oak_shortbow', name: 'Oak Shortbow', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 12, strength: 10, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 35, description: 'A sturdy hunting bow with a respectable draw weight.' },
  willow_shortbow: { id: 'willow_shortbow', name: 'Willow Shortbow', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 20, strength: 17, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 120, description: 'A rapid-firing shortbow carved from supple weeping willow.' },
  bloodwood_shortbow: { id: 'bloodwood_shortbow', name: 'Bloodwood Shortbow', category: 'weapon', tier: 4, slot: 'weapon', equipReq: { skill: 'ranged', level: 45 }, baseStats: { accuracy: 30, strength: 26, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 280, description: 'A reinforced recurve bow that shoots with punishing punch.' },
  ghostwood_shortbow: { id: 'ghostwood_shortbow', name: 'Ghostwood Shortbow', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 42, strength: 37, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 700, description: 'A pale silent bow with almost zero string recoil.' },
  starlight_shortbow: { id: 'starlight_shortbow', name: 'Starlight Shortbow', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'ranged', level: 75 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 1.8 }, vendorFloorPrice: 1800, description: 'A composite bow strung with radiant astral cord.' },

  // --- Weapons: Evocation Staves (Arcane Sorcery) ---
  ashwood_staff: { id: 'ashwood_staff', name: 'Ashwood Staff', category: 'weapon', tier: 1, slot: 'weapon', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 5, strength: 4, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 12, description: 'A carved walking staff that helps channel minor spells.' },
  oak_staff: { id: 'oak_staff', name: 'Oak Staff', category: 'weapon', tier: 2, slot: 'weapon', equipReq: { skill: 'magic', level: 15 }, baseStats: { accuracy: 12, strength: 10, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 40, description: 'A solid hardwood staff tipped with a quartz focus.' },
  willow_staff: { id: 'willow_staff', name: 'Willow Staff', category: 'weapon', tier: 3, slot: 'weapon', equipReq: { skill: 'magic', level: 30 }, baseStats: { accuracy: 20, strength: 17, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 140, description: 'A flexible wand-staff that balances elemental energy.' },
  bloodwood_staff: { id: 'bloodwood_staff', name: 'Bloodwood Staff', category: 'weapon', tier: 4, slot: 'weapon', equipReq: { skill: 'magic', level: 45 }, baseStats: { accuracy: 30, strength: 26, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 320, description: 'A dark crimson staff that amplifies evocation magic.' },
  ghostwood_staff: { id: 'ghostwood_staff', name: 'Ghostwood Staff', category: 'weapon', tier: 5, slot: 'weapon', equipReq: { skill: 'magic', level: 60 }, baseStats: { accuracy: 42, strength: 37, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 800, description: 'A pale spirit staff that whispers when channeling spells.' },
  starlight_staff: { id: 'starlight_staff', name: 'Starlight Staff', category: 'weapon', tier: 6, slot: 'weapon', equipReq: { skill: 'magic', level: 75 }, baseStats: { accuracy: 56, strength: 50, swingSpeedSeconds: 3.6 }, vendorFloorPrice: 2100, description: 'A crystalline focal staff that calls down star power.' },

  // --- Shields & Offhands ---
  dawnburn_shield: { id: 'dawnburn_shield', name: 'Dawnburn Shield', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'melee', level: 1 }, baseStats: { strength: 3, defence: 4 }, vendorFloorPrice: 15, description: 'A rounded wooden buckler faced with dawnburn bronze plates.' },
  cold_iron_shield: { id: 'cold_iron_shield', name: 'Cold Iron Shield', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'melee', level: 15 }, baseStats: { strength: 9, defence: 9 }, vendorFloorPrice: 50, description: 'A reinforced heater shield that deflects heavy melee strikes.' },
  steel_shield: { id: 'steel_shield', name: 'Steel Shield', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'melee', level: 30 }, baseStats: { strength: 14, defence: 16 }, vendorFloorPrice: 180, description: 'A standard issue military kite shield with heavy bossing.' },
  azurite_shield: { id: 'azurite_shield', name: 'Azurite Shield', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'melee', level: 60 }, baseStats: { strength: 35, defence: 25 }, vendorFloorPrice: 650, description: 'A beautiful cobalt shield that dampens incoming kinetic force.' },
  astralite_shield: { id: 'astralite_shield', name: 'Astralite Shield', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'melee', level: 85 }, baseStats: { strength: 43, defence: 37 }, vendorFloorPrice: 2200, description: 'A luminous tower shield that deflects spells and arrows.' },
  primordial_shield: { id: 'primordial_shield', name: 'Primordial Shield', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'melee', level: 99 }, baseStats: { strength: 43, defence: 46 }, vendorFloorPrice: 6500, description: 'A colossal aegis carved from ancient stone and titan alloy.' },

  // --- Quivers (Ranged Offhand) ---
  leather_quiver: { id: 'leather_quiver', name: 'Leather Quiver', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 15, description: 'A simple stitched leather arrow pouch worn at the hip.' },
  pelt_quiver: { id: 'pelt_quiver', name: 'Leather Quiver', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 15, description: 'A simple stitched leather arrow pouch worn at the hip.' },
  ghoulskin_quiver: { id: 'ghoulskin_quiver', name: 'Ghoulskin Quiver', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 4, strength: 3 }, vendorFloorPrice: 45, description: 'A supple quiver fashioned from cured ghoul hide.' },
  bogskin_quiver: { id: 'bogskin_quiver', name: 'Ghoulskin Quiver', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 4, strength: 3 }, vendorFloorPrice: 45, description: 'A supple quiver fashioned from cured ghoul hide.' },
  chitin_quiver: { id: 'chitin_quiver', name: 'Chitin Quiver', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 7, strength: 5 }, vendorFloorPrice: 150, description: 'A rigid quiver made from interlocking insect carapaces.' },
  fur_quiver: { id: 'fur_quiver', name: 'Fur Quiver', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 11, strength: 8 }, vendorFloorPrice: 500, description: 'A warm fur-lined quiver that keeps arrows dry in bad weather.' },
  scale_quiver: { id: 'scale_quiver', name: 'Scale Quiver', category: 'armour', tier: 6, slot: 'shield', equipReq: { skill: 'ranged', level: 85 }, baseStats: { accuracy: 16, strength: 12 }, vendorFloorPrice: 1600, description: 'A dragon-scale quiver offering quick draw access and protection.' },

  // --- Grimoires (Magic Offhand) ---
  linen_grimoire: { id: 'linen_grimoire', name: 'Linen Grimoire', category: 'armour', tier: 1, slot: 'shield', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 20, description: 'A beginner spellbook containing basic magical formulas.' },
  silk_grimoire: { id: 'silk_grimoire', name: 'Silk Grimoire', category: 'armour', tier: 2, slot: 'shield', equipReq: { skill: 'magic', level: 25 }, baseStats: { accuracy: 5, strength: 4 }, vendorFloorPrice: 90, description: 'An illuminated tome bound in dyed silk ribbons.' },
  gilded_grimoire: { id: 'gilded_grimoire', name: 'Gilded Grimoire', category: 'armour', tier: 3, slot: 'shield', equipReq: { skill: 'magic', level: 50 }, baseStats: { accuracy: 9, strength: 7 }, vendorFloorPrice: 300, description: 'A gold-leafed grimoire with advanced arcane incantations.' },
  voidweave_grimoire: { id: 'voidweave_grimoire', name: 'Voidweave Grimoire', category: 'armour', tier: 5, slot: 'shield', equipReq: { skill: 'magic', level: 75 }, baseStats: { accuracy: 14, strength: 11 }, vendorFloorPrice: 950, description: 'A dark, forbidding tome that holds cosmic secrets.' },

  // --- Heavy Plate Armours (Body) ---
  tunic_cloth: { id: 'tunic_cloth', name: 'Adventurer Tunic', category: 'armour', tier: 1, slot: 'body', baseStats: { defence: 2 }, vendorFloorPrice: 5, description: 'A plain traveler tunic woven from coarse flax fiber.' },
  leather_tunic: { id: 'leather_tunic', name: 'Leather Tunic', category: 'armour', tier: 1, slot: 'body', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 2, rangedStrength: 2, defence: 4 }, vendorFloorPrice: 20, description: 'A fitted leather jerkin that offers modest protection and ranged mobility.' },
  ghoulskin_tunic: { id: 'ghoulskin_tunic', name: 'Ghoulskin Tunic', category: 'armour', tier: 2, slot: 'body', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 5, rangedStrength: 4, defence: 10 }, vendorFloorPrice: 90, description: 'A resilient leather tunic cured from tough ghoul hide.' },
  bogskin_tunic: { id: 'bogskin_tunic', name: 'Ghoulskin Tunic', category: 'armour', tier: 2, slot: 'body', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 5, rangedStrength: 4, defence: 10 }, vendorFloorPrice: 90, description: 'A resilient leather tunic cured from tough ghoul hide.' },
  chitin_vest: { id: 'chitin_vest', name: 'Chitin Vest', category: 'armour', tier: 3, slot: 'body', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 8, rangedStrength: 7, defence: 18 }, vendorFloorPrice: 300, description: 'A lightweight carapace vest made of interlocking insect chitin plates.' },
  ranger_tunic: { id: 'ranger_tunic', name: 'Ranger Tunic', category: 'armour', tier: 4, slot: 'body', equipReq: { skill: 'ranged', level: 45 }, baseStats: { accuracy: 11, rangedStrength: 10, defence: 23 }, vendorFloorPrice: 650, description: 'A tailored archer tunic lined with ashweave and solar clasps.' },
  fur_jerkin: { id: 'fur_jerkin', name: 'Frost-Fur Jerkin', category: 'armour', tier: 5, slot: 'body', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 13, rangedStrength: 12, defence: 28 }, vendorFloorPrice: 1100, description: 'An insulated marksman jerkin tailored from thick frost-worg pelt.' },
  drake_hauberk: { id: 'drake_hauberk', name: 'Drake-Scale Hauberk', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'ranged', level: 85 }, baseStats: { accuracy: 20, rangedStrength: 18, defence: 42 }, vendorFloorPrice: 3500, description: 'A masterwork archer hauberk sewn from resilient dragon leather and scales.' },

  apprentice_robe_top: { id: 'apprentice_robe_top', name: 'Apprentice Robe Top', category: 'armour', tier: 1, slot: 'body', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 2, magicStrength: 2, defence: 2 }, vendorFloorPrice: 20, description: 'Simple homespun mage robes that facilitate free spell channeling.' },
  silk_robe_top: { id: 'silk_robe_top', name: 'Silk Robe Top', category: 'armour', tier: 2, slot: 'body', equipReq: { skill: 'magic', level: 15 }, baseStats: { accuracy: 5, magicStrength: 4, defence: 6 }, vendorFloorPrice: 90, description: 'Fine dyed silk robes tailored to amplify mental focus.' },
  gilded_robe_top: { id: 'gilded_robe_top', name: 'Gilded Mystic Robe', category: 'armour', tier: 3, slot: 'body', equipReq: { skill: 'magic', level: 30 }, baseStats: { accuracy: 8, magicStrength: 7, defence: 12 }, vendorFloorPrice: 300, description: 'Arcane vestments embroidered with gold filament that conducts raw magical power.' },
  voidweave_robe_top: { id: 'voidweave_robe_top', name: 'Voidweave Robe', category: 'armour', tier: 5, slot: 'body', equipReq: { skill: 'magic', level: 60 }, baseStats: { accuracy: 13, magicStrength: 12, defence: 20 }, vendorFloorPrice: 1100, description: 'Shadowy robes woven from cosmic void-threads that pulse with dark energy.' },
  celestial_robe_top: { id: 'celestial_robe_top', name: 'Celestial Archmage Robe', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'magic', level: 85 }, baseStats: { accuracy: 20, magicStrength: 18, defence: 30 }, vendorFloorPrice: 3500, description: 'Resplendent celestial robes woven with star essence, empowering supreme sorcery.' },

  dawnburn_plate: { id: 'dawnburn_plate', name: 'Dawnburn Plate', category: 'armour', tier: 1, slot: 'body', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 2, meleeStrength: 2, defence: 6 }, vendorFloorPrice: 30, description: 'A forged bronze chestplate with riveted shoulder guards.' },
  cold_iron_plate: { id: 'cold_iron_plate', name: 'Cold Iron Plate', category: 'armour', tier: 2, slot: 'body', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 5, meleeStrength: 4, defence: 14 }, vendorFloorPrice: 90, description: 'Heavy interlocking cold iron plates for serious vanguard duty.' },
  steel_plate: { id: 'steel_plate', name: 'Steel Plate', category: 'armour', tier: 3, slot: 'body', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 8, meleeStrength: 7, defence: 24 }, vendorFloorPrice: 300, description: 'A polished steel cuirass built to stop arrows and slashing blades.' },
  azurite_plate: { id: 'azurite_plate', name: 'Azurite Plate', category: 'armour', tier: 5, slot: 'body', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 13, meleeStrength: 12, defence: 38 }, vendorFloorPrice: 1100, description: 'Lightweight cobalt body armor offering exceptional defense.' },
  astralite_plate: { id: 'astralite_plate', name: 'Astralite Plate', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 20, meleeStrength: 18, defence: 56 }, vendorFloorPrice: 3500, description: 'Gleaming armor crafted by celestial artisans.' },
  primordial_plate: { id: 'primordial_plate', name: 'Primordial Plate', category: 'armour', tier: 6, slot: 'body', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 24, meleeStrength: 22, defence: 70 }, vendorFloorPrice: 11000, description: 'An impervious chestplate forged from the core of fallen titans.' },

  // --- Leg Armours (Legs) ---
  tunic_pants: { id: 'tunic_pants', name: 'Adventurer Trousers', category: 'armour', tier: 1, slot: 'legs', baseStats: { defence: 2 }, vendorFloorPrice: 5, description: 'Simple woven trousers suited for life on the open road.' },
  leather_chaps: { id: 'leather_chaps', name: 'Leather Chaps', category: 'armour', tier: 1, slot: 'legs', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 1, rangedStrength: 1, defence: 3 }, vendorFloorPrice: 15, description: 'Hard leather leg guards that turn aside stray briars and provide ranged mobility.' },
  ghoulskin_chaps: { id: 'ghoulskin_chaps', name: 'Ghoulskin Chaps', category: 'armour', tier: 2, slot: 'legs', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 3, rangedStrength: 3, defence: 7 }, vendorFloorPrice: 60, description: 'Supple ghoul-hide leg guards engineered for silent stalkers.' },
  bogskin_chaps: { id: 'bogskin_chaps', name: 'Ghoulskin Chaps', category: 'armour', tier: 2, slot: 'legs', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 3, rangedStrength: 3, defence: 7 }, vendorFloorPrice: 60, description: 'Supple ghoul-hide leg guards engineered for silent stalkers.' },
  chitin_chaps: { id: 'chitin_chaps', name: 'Chitin Chaps', category: 'armour', tier: 3, slot: 'legs', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 5, rangedStrength: 5, defence: 13 }, vendorFloorPrice: 200, description: 'Interlocking chitin plates that safeguard the lower limbs without restricting movement.' },
  ranger_chaps: { id: 'ranger_chaps', name: 'Ranger Chaps', category: 'armour', tier: 4, slot: 'legs', equipReq: { skill: 'ranged', level: 45 }, baseStats: { accuracy: 7, rangedStrength: 7, defence: 17 }, vendorFloorPrice: 480, description: 'Supple leather chaps tailored for swift wilderness marksmen.' },
  fur_leggings: { id: 'fur_leggings', name: 'Frost-Fur Leggings', category: 'armour', tier: 5, slot: 'legs', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 9, rangedStrength: 9, defence: 22 }, vendorFloorPrice: 800, description: 'Cold-insulated ranger trousers lined with thick frost-worg hide.' },
  drake_chaps: { id: 'drake_chaps', name: 'Drake-Scale Chaps', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'ranged', level: 85 }, baseStats: { accuracy: 14, rangedStrength: 14, defence: 32 }, vendorFloorPrice: 2600, description: 'Legendary marksman chaps reinforced with molten drake scales.' },

  apprentice_robe_bottom: { id: 'apprentice_robe_bottom', name: 'Apprentice Robe Bottom', category: 'armour', tier: 1, slot: 'legs', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 1, magicStrength: 1, defence: 1 }, vendorFloorPrice: 15, description: 'Coarse woven skirt worn by novice magical apprentices.' },
  silk_robe_bottom: { id: 'silk_robe_bottom', name: 'Silk Robe Bottom', category: 'armour', tier: 2, slot: 'legs', equipReq: { skill: 'magic', level: 15 }, baseStats: { accuracy: 3, magicStrength: 3, defence: 4 }, vendorFloorPrice: 60, description: 'Flowing silk legwear enhancing magical stability.' },
  gilded_robe_bottom: { id: 'gilded_robe_bottom', name: 'Gilded Mystic Bottom', category: 'armour', tier: 3, slot: 'legs', equipReq: { skill: 'magic', level: 30 }, baseStats: { accuracy: 5, magicStrength: 5, defence: 8 }, vendorFloorPrice: 200, description: 'Fine golden-threaded robes for high-tier incantations.' },
  voidweave_skirt: { id: 'voidweave_skirt', name: 'Voidweave Skirt', category: 'armour', tier: 5, slot: 'legs', equipReq: { skill: 'magic', level: 60 }, baseStats: { accuracy: 9, magicStrength: 9, defence: 15 }, vendorFloorPrice: 800, description: 'Dark voidweave skirt that ripples with ethereal shadows.' },
  celestial_skirt: { id: 'celestial_skirt', name: 'Celestial Archmage Skirt', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'magic', level: 85 }, baseStats: { accuracy: 14, magicStrength: 14, defence: 22 }, vendorFloorPrice: 2600, description: 'Star-woven archmage skirt that harmonizes with celestial currents.' },

  dawnburn_legs: { id: 'dawnburn_legs', name: 'Dawnburn Greaves', category: 'armour', tier: 1, slot: 'legs', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 1, meleeStrength: 1, defence: 4 }, vendorFloorPrice: 20, description: 'Fitted greaves forged from basic dawnburn alloy.' },
  cold_iron_legs: { id: 'cold_iron_legs', name: 'Cold Iron Greaves', category: 'armour', tier: 2, slot: 'legs', equipReq: { skill: 'melee', level: 15 }, baseStats: { accuracy: 3, meleeStrength: 3, defence: 10 }, vendorFloorPrice: 60, description: 'Sturdy iron greaves that protect shins and knees.' },
  steel_legs: { id: 'steel_legs', name: 'Steel Greaves', category: 'armour', tier: 3, slot: 'legs', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 5, meleeStrength: 5, defence: 18 }, vendorFloorPrice: 200, description: 'Heavy articulated steel plate legs.' },
  azurite_legs: { id: 'azurite_legs', name: 'Azurite Greaves', category: 'armour', tier: 5, slot: 'legs', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 9, meleeStrength: 9, defence: 30 }, vendorFloorPrice: 800, description: 'Reinforced azure greaves that offer solid defense without extra weight.' },
  astralite_legs: { id: 'astralite_legs', name: 'Astralite Greaves', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 14, meleeStrength: 14, defence: 44 }, vendorFloorPrice: 2600, description: 'Radiant leg plates that deflect crushing strikes.' },
  primordial_legs: { id: 'primordial_legs', name: 'Primordial Greaves', category: 'armour', tier: 6, slot: 'legs', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 18, meleeStrength: 18, defence: 56 }, vendorFloorPrice: 8500, description: 'Immovable greaves forged from primordial titan remnants.' },

  // --- Helmets & Headgear (Helmet) ---
  wizard_hat: { id: 'wizard_hat', name: 'Apprentice Wizard Hat', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'magic', level: 1 }, baseStats: { accuracy: 2, magicStrength: 2, defence: 1 }, vendorFloorPrice: 25, description: 'A pointed fabric hat favored by novice spellcasters that sharpens spellcraft.' },
  silk_mage_hat: { id: 'silk_mage_hat', name: 'Silk Mage Hat', category: 'armour', tier: 2, slot: 'helmet', equipReq: { skill: 'magic', level: 15 }, baseStats: { accuracy: 4, magicStrength: 4, defence: 3 }, vendorFloorPrice: 75, description: 'A tailored silk hood that heightens arcane awareness.' },
  gilded_mystic_hat: { id: 'gilded_mystic_hat', name: 'Gilded Mystic Hat', category: 'armour', tier: 3, slot: 'helmet', equipReq: { skill: 'magic', level: 30 }, baseStats: { accuracy: 7, magicStrength: 7, defence: 6 }, vendorFloorPrice: 220, description: 'An ornate pointed hat lined with golden runic stitching.' },
  voidweave_cowl: { id: 'voidweave_cowl', name: 'Voidweave Cowl', category: 'armour', tier: 5, slot: 'helmet', equipReq: { skill: 'magic', level: 60 }, baseStats: { accuracy: 11, magicStrength: 12, defence: 12 }, vendorFloorPrice: 750, description: 'An enigmatic hood drawn from the void, infusing the mind with mystical lethality.' },
  celestial_crown: { id: 'celestial_crown', name: 'Celestial Archmage Crown', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'magic', level: 85 }, baseStats: { accuracy: 16, magicStrength: 18, defence: 18 }, vendorFloorPrice: 2500, description: 'A coronet forged from raw starlight and cut celestial gems.' },

  ranger_hood: { id: 'ranger_hood', name: 'Ranger Cowl', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'ranged', level: 1 }, baseStats: { accuracy: 2, rangedStrength: 2, defence: 2 }, vendorFloorPrice: 25, description: 'A deep cowl that shades the eyes and grants steady marksmanship.' },
  ghoulskin_hood: { id: 'ghoulskin_hood', name: 'Ghoulskin Hood', category: 'armour', tier: 2, slot: 'helmet', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 4, rangedStrength: 4, defence: 5 }, vendorFloorPrice: 75, description: 'A camouflaged hood cured from tough ghoul hide.' },
  bogskin_hood: { id: 'bogskin_hood', name: 'Ghoulskin Hood', category: 'armour', tier: 2, slot: 'helmet', equipReq: { skill: 'ranged', level: 15 }, baseStats: { accuracy: 4, rangedStrength: 4, defence: 5 }, vendorFloorPrice: 75, description: 'A camouflaged hood cured from tough ghoul hide.' },
  chitin_cowl: { id: 'chitin_cowl', name: 'Chitin Cowl', category: 'armour', tier: 3, slot: 'helmet', equipReq: { skill: 'ranged', level: 30 }, baseStats: { accuracy: 7, rangedStrength: 7, defence: 9 }, vendorFloorPrice: 220, description: 'A hardened carapace mask with precise visual slits.' },
  ranger_hat: { id: 'ranger_hat', name: 'Ranger Hat', category: 'armour', tier: 4, slot: 'helmet', equipReq: { skill: 'ranged', level: 45 }, baseStats: { accuracy: 9, rangedStrength: 9, defence: 12 }, vendorFloorPrice: 450, description: 'A wide-brimmed feathered hat providing keen focus and shade.' },
  fur_cowl: { id: 'fur_cowl', name: 'Frost-Fur Cowl', category: 'armour', tier: 5, slot: 'helmet', equipReq: { skill: 'ranged', level: 60 }, baseStats: { accuracy: 11, rangedStrength: 12, defence: 16 }, vendorFloorPrice: 750, description: 'A winter hunting hood that focuses the archer gaze.' },
  drake_cowl: { id: 'drake_cowl', name: 'Drake-Scale Cowl', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'ranged', level: 85 }, baseStats: { accuracy: 16, rangedStrength: 18, defence: 24 }, vendorFloorPrice: 2500, description: 'A fearsome dragon-leather cowl giving unyielding focus and devastating power.' },

  dawnburn_helm: { id: 'dawnburn_helm', name: 'Dawnburn Open Helm', category: 'armour', tier: 1, slot: 'helmet', equipReq: { skill: 'melee', level: 1 }, baseStats: { accuracy: 2, meleeStrength: 2, defence: 3 }, vendorFloorPrice: 20, description: 'An open-faced bronze helmet with nose guard.' },
  steel_helm: { id: 'steel_helm', name: 'Steel Full Helm', category: 'armour', tier: 3, slot: 'helmet', equipReq: { skill: 'melee', level: 30 }, baseStats: { accuracy: 7, meleeStrength: 7, defence: 12 }, vendorFloorPrice: 220, description: 'A heavy enclosed steel helmet with visor ventilation.' },
  azurite_helm: { id: 'azurite_helm', name: 'Azurite Visor Helm', category: 'armour', tier: 5, slot: 'helmet', equipReq: { skill: 'melee', level: 60 }, baseStats: { accuracy: 11, meleeStrength: 12, defence: 22 }, vendorFloorPrice: 750, description: 'A stylish blue plate helm with polished visor slits.' },
  astralite_helm: { id: 'astralite_helm', name: 'Astralite Crown', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'melee', level: 85 }, baseStats: { accuracy: 16, meleeStrength: 18, defence: 32 }, vendorFloorPrice: 2500, description: 'A radiant circlet that shields the mind and forehead.' },
  primordial_helm: { id: 'primordial_helm', name: 'Primordial Horned Mask', category: 'armour', tier: 6, slot: 'helmet', equipReq: { skill: 'melee', level: 99 }, baseStats: { accuracy: 20, meleeStrength: 22, defence: 40 }, vendorFloorPrice: 7500, description: 'An intimidating horned mask made of prehistoric titan bone.' },

  // --- Cosmetic Hair (Hair) ---
  hair_adventurer: { id: 'hair_adventurer', name: 'Adventurer Hair', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'A practical, short crop popular with wandering adventurers.' },
  hair_maiden: { id: 'hair_maiden', name: 'Maiden Locks', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'Neatly kept long locks tied back with leather cord.' },
  hair_elder: { id: 'hair_elder', name: 'Sage Beard & Mane', category: 'misc', tier: 1, slot: 'hair', vendorFloorPrice: 10, description: 'A dignified silver mane and seasoned traveler beard.' },

  // --- Tools (Equippable to Skilling Toolbelt) ---
  rune_pickaxe_dawnburn: { id: 'rune_pickaxe_dawnburn', name: 'Dawnburn Rune Pickaxe', category: 'tool', tier: 1, slot: 'tool_pickaxe', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15, description: 'A reliable starter pickaxe forged from dawnburn bronze.' },
  rune_pickaxe_cold_iron: { id: 'rune_pickaxe_cold_iron', name: 'Cold Iron Rune Pickaxe', category: 'tool', tier: 2, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 15 }, baseStats: { toolSpeedBonus: 0.16 }, vendorFloorPrice: 50, description: 'A sharp cold iron pick that cuts into rock seams 16% faster.' },
  rune_pickaxe_steel: { id: 'rune_pickaxe_steel', name: 'Steel Rune Pickaxe', category: 'tool', tier: 3, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 30 }, baseStats: { toolSpeedBonus: 0.25 }, vendorFloorPrice: 160, description: 'A tempered steel pickaxe providing a 25% mining speed bonus.' },
  rune_pickaxe_azurite: { id: 'rune_pickaxe_azurite', name: 'Azurite Rune Pickaxe', category: 'tool', tier: 5, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 60 }, baseStats: { toolSpeedBonus: 0.38 }, vendorFloorPrice: 600, description: 'A high-grade azurite pick providing a 38% mining speed bonus.' },
  rune_pickaxe_astralite: { id: 'rune_pickaxe_astralite', name: 'Astralite Rune Pickaxe', category: 'tool', tier: 6, slot: 'tool_pickaxe', equipReq: { skill: 'mining', level: 85 }, baseStats: { toolSpeedBonus: 0.50 }, vendorFloorPrice: 2000, description: 'A masterwork pickaxe providing a 50% mining speed bonus.' },

  rune_axe_dawnburn: { id: 'rune_axe_dawnburn', name: 'Dawnburn Wood Axe', category: 'tool', tier: 1, slot: 'tool_axe', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15, description: 'A basic woodsman axe made from dawnburn bronze.' },
  rune_axe_cold_iron: { id: 'rune_axe_cold_iron', name: 'Cold Iron Wood Axe', category: 'tool', tier: 2, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 15 }, baseStats: { toolSpeedBonus: 0.16 }, vendorFloorPrice: 50, description: 'A balanced cold iron axe providing a 16% chopping speed bonus.' },
  rune_axe_steel: { id: 'rune_axe_steel', name: 'Steel Wood Axe', category: 'tool', tier: 3, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 30 }, baseStats: { toolSpeedBonus: 0.25 }, vendorFloorPrice: 160, description: 'A sturdy steel wood axe providing a 25% chopping speed bonus.' },
  rune_axe_azurite: { id: 'rune_axe_azurite', name: 'Azurite Wood Axe', category: 'tool', tier: 5, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 60 }, baseStats: { toolSpeedBonus: 0.38 }, vendorFloorPrice: 600, description: 'A keen-edged azurite axe providing a 38% chopping speed bonus.' },
  rune_axe_astralite: { id: 'rune_axe_astralite', name: 'Astralite Wood Axe', category: 'tool', tier: 6, slot: 'tool_axe', equipReq: { skill: 'woodcutting', level: 85 }, baseStats: { toolSpeedBonus: 0.50 }, vendorFloorPrice: 2000, description: 'A masterwork woodsman axe providing a 50% chopping speed bonus.' },

  fishing_rod_willow: { id: 'fishing_rod_willow', name: 'Willow Fishing Rod', category: 'tool', tier: 1, slot: 'tool_rod', baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 15, description: 'A flexible willow rod equipped with basic twine line.' },
  fishing_rod_oak: { id: 'fishing_rod_oak', name: 'Oak Fishing Rod', category: 'tool', tier: 2, slot: 'tool_rod', equipReq: { skill: 'fishing', level: 20 }, baseStats: { toolSpeedBonus: 0.18 }, vendorFloorPrice: 60, description: 'A sturdy oak fishing rod providing an 18% catch speed bonus.' },
  fishing_rod_yew: { id: 'fishing_rod_yew', name: 'Yew Deep-Sea Rod', category: 'tool', tier: 4, slot: 'tool_rod', equipReq: { skill: 'fishing', level: 50 }, baseStats: { toolSpeedBonus: 0.32 }, vendorFloorPrice: 350, description: 'A heavy-duty yew rod providing a 32% catch speed bonus.' },

  // --- Steeds (Mounts) ---
  steed_courser: { id: 'steed_courser', name: 'Eldorian Courser', category: 'steed', tier: 2, slot: 'steed', vendorFloorPrice: 15000, description: 'A trusty Eldorian riding horse that hastens travel across the world.' },
  steed_chicken: { id: 'steed_chicken', name: 'Rooster Strider', category: 'steed', tier: 2, slot: 'steed', vendorFloorPrice: 15000, description: 'A sturdy brown battle-chicken mount that clucks proudly and hastens travel across Eldoria.' },
  steed_chorse: { id: 'steed_chorse', name: 'Chorse', category: 'steed', tier: 3, slot: 'steed', vendorFloorPrice: 35000, description: 'A legendary hybrid bred from a rooster strider and an Eldorian courser. Moves with double the speed of an ordinary mount.' },

  // --- Tradeable Gem Packs (Paypal / In-game Economy) ---
  gem_pack_small: { id: 'gem_pack_small', name: 'Small Gem Pack', category: 'misc', tier: 1, vendorFloorPrice: 0, stackable: true, description: 'Contains 50 Celestial Gems. Open to redeem, or trade to players in the market.' },
  gem_pack_medium: { id: 'gem_pack_medium', name: 'Medium Gem Pack', category: 'misc', tier: 2, vendorFloorPrice: 0, stackable: true, description: 'Contains 120 Celestial Gems. Open to redeem, or trade to players in the market.' },
  gem_pack_large: { id: 'gem_pack_large', name: 'Large Gem Pack', category: 'misc', tier: 3, vendorFloorPrice: 0, stackable: true, description: 'Contains 350 Celestial Gems. Open to redeem, or trade to players in the market.' },
  gem_pack_founder: { id: 'gem_pack_founder', name: 'Founder Pack', category: 'misc', tier: 3, vendorFloorPrice: 0, stackable: false, description: 'An exclusive Founder coffer containing 600 Celestial Gems and permanently bestowing the prestigious aqua [FOUNDER] chat badge. Open to redeem.' },
  gem_pack_grand: { id: 'gem_pack_grand', name: 'Grand Gem Pack', category: 'misc', tier: 4, vendorFloorPrice: 0, stackable: true, description: 'Contains 900 Celestial Gems. Open to redeem, or trade to players in the market.' },
  gem_pack_colossal: { id: 'gem_pack_colossal', name: 'Colossal Gem Pack', category: 'misc', tier: 5, vendorFloorPrice: 0, stackable: true, description: 'Contains 2,000 Celestial Gems. Open to redeem, or trade to players in the market.' },

  // --- Jewelry: Rings ---
  dawnburn_ring: { id: 'dawnburn_ring', name: 'Dawnburn Band', category: 'armour', tier: 1, slot: 'ring', equipReq: { skill: 'defence', level: 1 }, baseStats: { accuracy: 2, strength: 1 }, vendorFloorPrice: 15, description: 'A simple bronze-hued band forged from dawnburn metal.' },
  gnawed_bone_ring: { id: 'gnawed_bone_ring', name: 'Gnawed Bone Ring', category: 'armour', tier: 1, slot: 'ring', equipReq: { skill: 'defence', level: 5 }, baseStats: { accuracy: 3, strength: 3 }, vendorFloorPrice: 85, description: 'A savage marsh talisman bound into a sturdy bronze ring.' },
  cold_iron_ring: { id: 'cold_iron_ring', name: 'Cold Iron Ring', category: 'armour', tier: 2, slot: 'ring', equipReq: { skill: 'defence', level: 15 }, baseStats: { accuracy: 4, strength: 3 }, vendorFloorPrice: 40, description: 'A heavy iron band that feels icy against the skin.' },
  prospector_ring: { id: 'prospector_ring', name: 'Ring of the Prospector', category: 'armour', tier: 2, slot: 'ring', equipReq: { skill: 'defence', level: 20 }, baseStats: { toolSpeedBonus: 0.08 }, vendorFloorPrice: 120, description: 'A specialized miner band that increases gathering tool speed by 8%.' },
  celestial_ring: { id: 'celestial_ring', name: 'Celestial Star Ring', category: 'armour', tier: 2, slot: 'ring', equipReq: { skill: 'defence', level: 25 }, baseStats: { accuracy: 7, strength: 5 }, vendorFloorPrice: 180, description: 'A shimmering star gem mounted on an iron band, guiding your strikes.' },
  steel_ring: { id: 'steel_ring', name: 'Tempered Steel Band', category: 'armour', tier: 3, slot: 'ring', equipReq: { skill: 'defence', level: 30 }, baseStats: { accuracy: 8, strength: 7 }, vendorFloorPrice: 110, description: 'A polished military steel signet ring bearing royal seals.' },
  dry_sigil_ring: { id: 'dry_sigil_ring', name: 'Dune Sigil Band', category: 'armour', tier: 3, slot: 'ring', equipReq: { skill: 'defence', level: 40 }, baseStats: { accuracy: 10, strength: 9 }, vendorFloorPrice: 380, description: 'An ancient desert seal set into steel, empowering heavy blows.' },
  quicksilver_ring: { id: 'quicksilver_ring', name: 'Quicksilver Band', category: 'armour', tier: 3, slot: 'ring', equipReq: { skill: 'defence', level: 35 }, baseStats: { accuracy: 5, attackSpeedBonus: 0.06 }, vendorFloorPrice: 220, description: 'A fluid silver alloy band that lightens your hand, increasing attack speed by 6%.' },
  solar_ring: { id: 'solar_ring', name: 'Solar Aurum Band', category: 'armour', tier: 4, slot: 'ring', equipReq: { skill: 'defence', level: 50 }, baseStats: { accuracy: 12, strength: 11 }, vendorFloorPrice: 240, description: 'A gleaming golden ring that captures and refracts sunlight.' },
  azurite_ring: { id: 'azurite_ring', name: 'Azurite Signet Ring', category: 'armour', tier: 5, slot: 'ring', equipReq: { skill: 'defence', level: 60 }, baseStats: { accuracy: 16, strength: 14 }, vendorFloorPrice: 480, description: 'A lustrous cobalt ring forged from fine azurite metal.' },
  venomfang_ring: { id: 'venomfang_ring', name: 'Venomfang Band', category: 'armour', tier: 5, slot: 'ring', equipReq: { skill: 'defence', level: 70 }, baseStats: { accuracy: 20, strength: 18 }, vendorFloorPrice: 2100, description: 'A deadly viper tooth curved into a cobalt band, sharpening every strike.' },
  astralite_ring: { id: 'astralite_ring', name: 'Astralite Star Ring', category: 'armour', tier: 6, slot: 'ring', equipReq: { skill: 'defence', level: 85 }, baseStats: { accuracy: 24, strength: 22 }, vendorFloorPrice: 1400, description: 'A celestial silver ring set with a faceted star gem.' },
  frost_tusk_ring: { id: 'frost_tusk_ring', name: "Frost Jarl's Tusk Ring", category: 'armour', tier: 6, slot: 'ring', equipReq: { skill: 'defence', level: 85 }, baseStats: { accuracy: 25, strength: 24, defence: 10 }, vendorFloorPrice: 3600, description: 'A ring sculpted from frost behemoth ivory, bound in astral silver.' },
  draconic_ring: { id: 'draconic_ring', name: 'Draconic Scale Band', category: 'armour', tier: 6, slot: 'ring', equipReq: { skill: 'defence', level: 90 }, baseStats: { accuracy: 28, strength: 26, defence: 15 }, vendorFloorPrice: 9200, description: 'A ring forged from the molten scale of an ancient Ashen Drake.' },
  titan_ring: { id: 'titan_ring', name: 'Ring of the Earth Titan', category: 'armour', tier: 6, slot: 'ring', equipReq: { skill: 'defence', level: 95 }, baseStats: { strength: 32, defence: 35 }, vendorFloorPrice: 18500, description: 'Mythic ring infused with the core of the Earth Titan, granting colossal endurance.' },

  // --- Jewelry: Amulets ---
  dawnburn_amulet: { id: 'dawnburn_amulet', name: 'Dawnburn Talisman', category: 'armour', tier: 1, slot: 'amulet', equipReq: { skill: 'defence', level: 1 }, baseStats: { accuracy: 3, defence: 2 }, vendorFloorPrice: 25, description: 'A modest pendant cast from dawnburn bronze hung from a leather cord.' },
  cold_iron_amulet: { id: 'cold_iron_amulet', name: 'Cold Iron Pendant', category: 'armour', tier: 2, slot: 'amulet', equipReq: { skill: 'defence', level: 15 }, baseStats: { accuracy: 5, defence: 5 }, vendorFloorPrice: 60, description: 'A cold-forged amulet that fortifies the wearer resolve against blows.' },
  bog_pearl_amulet: { id: 'bog_pearl_amulet', name: 'Bog Pearl Necklace', category: 'armour', tier: 2, slot: 'amulet', equipReq: { skill: 'defence', level: 20 }, baseStats: { accuracy: 6, strength: 5, defence: 4 }, vendorFloorPrice: 220, description: 'An iridescent freshwater marsh pearl set in a cold iron locket.' },
  steel_amulet: { id: 'steel_amulet', name: 'Steel Gorget Amulet', category: 'armour', tier: 3, slot: 'amulet', equipReq: { skill: 'defence', level: 30 }, baseStats: { accuracy: 8, defence: 10 }, vendorFloorPrice: 160, description: 'A protective steel choker that deflects stray arrows and blows.' },
  quicksilver_amulet: { id: 'quicksilver_amulet', name: 'Quicksilver Pendant', category: 'armour', tier: 3, slot: 'amulet', equipReq: { skill: 'defence', level: 40 }, baseStats: { accuracy: 8, attackSpeedBonus: 0.10 }, vendorFloorPrice: 420, description: 'A luminous quicksilver amulet on a woven cord, quickening attack cadence by 10%.' },
  ossuary_amulet: { id: 'ossuary_amulet', name: 'Ossuary Bone Choker', category: 'armour', tier: 3, slot: 'amulet', equipReq: { skill: 'defence', level: 40 }, baseStats: { accuracy: 11, strength: 8, defence: 9 }, vendorFloorPrice: 620, description: 'Bleached catacomb bone and burial slate inscribed with ancestral protection.' },
  solar_amulet: { id: 'solar_amulet', name: 'Amulet of the Sun', category: 'armour', tier: 4, slot: 'amulet', equipReq: { skill: 'defence', level: 50 }, baseStats: { accuracy: 14, strength: 12, defence: 11 }, vendorFloorPrice: 950, description: 'Radiant solar essence suspended in a brilliant golden sunburst pendant.' },
  rimefang_amulet: { id: 'rimefang_amulet', name: 'Rimefang Choker', category: 'armour', tier: 5, slot: 'amulet', equipReq: { skill: 'defence', level: 60 }, baseStats: { accuracy: 18, strength: 15, defence: 14 }, vendorFloorPrice: 1600, description: 'A permafrost wolf tooth bound with intricate azurite filigree.' },
  cinder_amulet: { id: 'cinder_amulet', name: 'Cinder Core Talisman', category: 'armour', tier: 5, slot: 'amulet', equipReq: { skill: 'defence', level: 70 }, baseStats: { accuracy: 22, strength: 20, defence: 16 }, vendorFloorPrice: 3200, description: 'A volcanic coal pulsing with eternal flame, invigorating the wearer.' },
  anima_amulet: { id: 'anima_amulet', name: 'Anima Soul Pendant', category: 'armour', tier: 6, slot: 'amulet', equipReq: { skill: 'defence', level: 85 }, baseStats: { accuracy: 26, strength: 24, defence: 20 }, vendorFloorPrice: 2600, description: 'Pure crystallized soul energy suspended from an astral silver chain.' },
  glacial_amulet: { id: 'glacial_amulet', name: 'Glacial Crown Pendant', category: 'armour', tier: 6, slot: 'amulet', equipReq: { skill: 'defence', level: 90 }, baseStats: { accuracy: 30, strength: 26, defence: 25 }, vendorFloorPrice: 7800, description: 'A miniature unmelting crown fragment worn close to the heart.' },
  wyrm_amulet: { id: 'wyrm_amulet', name: 'Heart of the Pyro-Wyrm', category: 'armour', tier: 6, slot: 'amulet', equipReq: { skill: 'defence', level: 95 }, baseStats: { accuracy: 35, strength: 34, defence: 20 }, vendorFloorPrice: 22000, description: 'An awe-inspiring pendant burning with primordial dragonfire.' },
  leviathan_amulet: { id: 'leviathan_amulet', name: 'Eye of the Leviathan', category: 'armour', tier: 6, slot: 'amulet', equipReq: { skill: 'defence', level: 95 }, baseStats: { accuracy: 38, strength: 28, defence: 28 }, vendorFloorPrice: 22000, description: 'A legendary oceanic talisman peering through reality, bestowing peerless sight.' },

  // --- Dungeon Keys & Relics ---
  item_crypt_key: {
    id: 'item_crypt_key',
    name: 'Whispering Crypt Key',
    category: 'relic',
    tier: 2,
    vendorFloorPrice: 150,
    stackable: true,
    stackableInInventory: true,
    maxStackInventory: 10,
    description: 'An ancient tarnished keystone that resonates with subterranean power. Unlocks entry into the Whispering Crypts.',
  },
  crypt_relic_fragment: {
    id: 'crypt_relic_fragment',
    name: 'Crypt Relic Fragment',
    category: 'relic',
    tier: 3,
    vendorFloorPrice: 200,
    stackable: true,
    stackableInInventory: true,
    description: 'A glowing archaic talisman piece recovered from deep inside the crypt vault.',
  },
  crypt_lord_signet: {
    id: 'crypt_lord_signet',
    name: "Crypt Lord's Signet",
    category: 'armour',
    tier: 3,
    slot: 'ring',
    equipReq: { skill: 'defence', level: 25 },
    baseStats: { accuracy: 12, strength: 10, defence: 8 },
    vendorFloorPrice: 750,
    description: 'A prized runic seal retrieved from the Crypt Lord sarcophagus. Grants balanced offensive power.',
  },

  // --- Skilling & Boss Vanity Companion Pets ---
  pet_rocky: {
    id: 'pet_rocky',
    name: 'Rocky',
    category: 'pet',
    tier: 4,
    slot: 'pet',
    vendorFloorPrice: 25000,
    description: 'A loyal miniature stone golem born from deep ore veins. Hums with mineral energy as it toddles behind you.',
  },
  pet_treant: {
    id: 'pet_treant',
    name: 'Twiggy Treant',
    category: 'pet',
    tier: 4,
    slot: 'pet',
    vendorFloorPrice: 25000,
    description: 'A sentient wooden sapling with rustling leaves and soulful root feet. A rare companion found while chopping timber.',
  },
  pet_otter: {
    id: 'pet_otter',
    name: 'River Whiskers',
    category: 'pet',
    tier: 4,
    slot: 'pet',
    vendorFloorPrice: 25000,
    description: 'A playful river otter who loves fresh fish and splashes happily behind you on your adventures.',
  },
  pet_sprout: {
    id: 'pet_sprout',
    name: 'Sproutling',
    category: 'pet',
    tier: 4,
    slot: 'pet',
    vendorFloorPrice: 25000,
    description: 'A chirping green botanical sprout that emerged from fertile farmland soil.',
  },
  pet_crypt_beetle: {
    id: 'pet_crypt_beetle',
    name: 'Crypt Scarab',
    category: 'pet',
    tier: 5,
    slot: 'pet',
    vendorFloorPrice: 50000,
    description: 'An ancient obsidian scarab with gilded wings, recovered from the deepest sanctum of the Whispering Crypts.',
  },

  // --- Attunement XP Auras ---
  lesser_aura_quarry: { id: 'lesser_aura_quarry', name: 'Lesser Aura of Deep Quarry', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'mining', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Mining XP for 30 minutes while equipped.' },
  greater_aura_quarry: { id: 'greater_aura_quarry', name: 'Greater Aura of Deep Quarry', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'mining', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Mining XP for 45 minutes while equipped.' },
  celestial_aura_quarry: { id: 'celestial_aura_quarry', name: 'Celestial Aura of Deep Quarry', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'mining', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Mining XP for 60 minutes while equipped.' },
  lesser_aura_woods: { id: 'lesser_aura_woods', name: 'Lesser Aura of Whispering Woods', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'woodcutting', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Woodcutting XP for 30 minutes while equipped.' },
  greater_aura_woods: { id: 'greater_aura_woods', name: 'Greater Aura of Whispering Woods', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'woodcutting', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Woodcutting XP for 45 minutes while equipped.' },
  celestial_aura_woods: { id: 'celestial_aura_woods', name: 'Celestial Aura of Whispering Woods', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'woodcutting', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Woodcutting XP for 60 minutes while equipped.' },
  lesser_aura_tide: { id: 'lesser_aura_tide', name: 'Lesser Aura of Abyssal Tide', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'fishing', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Fishing XP for 30 minutes while equipped.' },
  greater_aura_tide: { id: 'greater_aura_tide', name: 'Greater Aura of Abyssal Tide', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'fishing', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Fishing XP for 45 minutes while equipped.' },
  celestial_aura_tide: { id: 'celestial_aura_tide', name: 'Celestial Aura of Abyssal Tide', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'fishing', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Fishing XP for 60 minutes while equipped.' },
  lesser_aura_bloom: { id: 'lesser_aura_bloom', name: 'Lesser Aura of Verdant Bloom', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'farming', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Farming XP for 30 minutes while equipped.' },
  greater_aura_bloom: { id: 'greater_aura_bloom', name: 'Greater Aura of Verdant Bloom', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'farming', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Farming XP for 45 minutes while equipped.' },
  celestial_aura_bloom: { id: 'celestial_aura_bloom', name: 'Celestial Aura of Verdant Bloom', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'farming', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Farming XP for 60 minutes while equipped.' },
  lesser_aura_herbarium: { id: 'lesser_aura_herbarium', name: 'Lesser Aura of Wild Herbarium', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'herbalism', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Herbalism XP for 30 minutes while equipped.' },
  greater_aura_herbarium: { id: 'greater_aura_herbarium', name: 'Greater Aura of Wild Herbarium', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'herbalism', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Herbalism XP for 45 minutes while equipped.' },
  celestial_aura_herbarium: { id: 'celestial_aura_herbarium', name: 'Celestial Aura of Wild Herbarium', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'herbalism', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Herbalism XP for 60 minutes while equipped.' },
  lesser_aura_shadow: { id: 'lesser_aura_shadow', name: 'Lesser Aura of Shadow Step', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'thieving', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Thieving XP for 30 minutes while equipped.' },
  greater_aura_shadow: { id: 'greater_aura_shadow', name: 'Greater Aura of Shadow Step', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'thieving', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Thieving XP for 45 minutes while equipped.' },
  celestial_aura_shadow: { id: 'celestial_aura_shadow', name: 'Celestial Aura of Shadow Step', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'thieving', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Thieving XP for 60 minutes while equipped.' },
  lesser_aura_forge: { id: 'lesser_aura_forge', name: 'Lesser Aura of Eternal Flame', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'smithing', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Smithing XP for 30 minutes while equipped.' },
  greater_aura_forge: { id: 'greater_aura_forge', name: 'Greater Aura of Eternal Flame', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'smithing', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Smithing XP for 45 minutes while equipped.' },
  celestial_aura_forge: { id: 'celestial_aura_forge', name: 'Celestial Aura of Eternal Flame', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'smithing', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Smithing XP for 60 minutes while equipped.' },
  lesser_aura_hearth: { id: 'lesser_aura_hearth', name: 'Lesser Aura of Hearthfire', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'cooking', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Cooking XP for 30 minutes while equipped.' },
  greater_aura_hearth: { id: 'greater_aura_hearth', name: 'Greater Aura of Hearthfire', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'cooking', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Cooking XP for 45 minutes while equipped.' },
  celestial_aura_hearth: { id: 'celestial_aura_hearth', name: 'Celestial Aura of Hearthfire', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'cooking', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Cooking XP for 60 minutes while equipped.' },
  lesser_aura_fletcher: { id: 'lesser_aura_fletcher', name: 'Lesser Aura of Master Fletcher', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'fletching', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Fletching XP for 30 minutes while equipped.' },
  greater_aura_fletcher: { id: 'greater_aura_fletcher', name: 'Greater Aura of Master Fletcher', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'fletching', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Fletching XP for 45 minutes while equipped.' },
  celestial_aura_fletcher: { id: 'celestial_aura_fletcher', name: 'Celestial Aura of Master Fletcher', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'fletching', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Fletching XP for 60 minutes while equipped.' },
  lesser_aura_alchemy: { id: 'lesser_aura_alchemy', name: 'Lesser Aura of Philosopher', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'alchemy', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Alchemy XP for 30 minutes while equipped.' },
  greater_aura_alchemy: { id: 'greater_aura_alchemy', name: 'Greater Aura of Philosopher', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'alchemy', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Alchemy XP for 45 minutes while equipped.' },
  celestial_aura_alchemy: { id: 'celestial_aura_alchemy', name: 'Celestial Aura of Philosopher', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'alchemy', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Alchemy XP for 60 minutes while equipped.' },
  lesser_aura_sculptor: { id: 'lesser_aura_sculptor', name: 'Lesser Aura of Rune Sculptor', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'crafting', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Crafting XP for 30 minutes while equipped.' },
  greater_aura_sculptor: { id: 'greater_aura_sculptor', name: 'Greater Aura of Rune Sculptor', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'crafting', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Crafting XP for 45 minutes while equipped.' },
  celestial_aura_sculptor: { id: 'celestial_aura_sculptor', name: 'Celestial Aura of Rune Sculptor', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'crafting', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Crafting XP for 60 minutes while equipped.' },
  lesser_aura_cosmos: { id: 'lesser_aura_cosmos', name: 'Lesser Aura of Cosmic Resonance', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'attunement', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Attunement XP for 30 minutes while equipped.' },
  greater_aura_cosmos: { id: 'greater_aura_cosmos', name: 'Greater Aura of Cosmic Resonance', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'attunement', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Attunement XP for 45 minutes while equipped.' },
  celestial_aura_cosmos: { id: 'celestial_aura_cosmos', name: 'Celestial Aura of Cosmic Resonance', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'attunement', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Attunement XP for 60 minutes while equipped.' },
  lesser_aura_vanguard: { id: 'lesser_aura_vanguard', name: 'Lesser Aura of Vanguard', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'melee', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Melee XP for 30 minutes while equipped.' },
  greater_aura_vanguard: { id: 'greater_aura_vanguard', name: 'Greater Aura of Vanguard', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'melee', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Melee XP for 45 minutes while equipped.' },
  celestial_aura_vanguard: { id: 'celestial_aura_vanguard', name: 'Celestial Aura of Vanguard', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'melee', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Melee XP for 60 minutes while equipped.' },
  lesser_aura_windrunner: { id: 'lesser_aura_windrunner', name: 'Lesser Aura of Windrunner', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'ranged', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Ranged XP for 30 minutes while equipped.' },
  greater_aura_windrunner: { id: 'greater_aura_windrunner', name: 'Greater Aura of Windrunner', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'ranged', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Ranged XP for 45 minutes while equipped.' },
  celestial_aura_windrunner: { id: 'celestial_aura_windrunner', name: 'Celestial Aura of Windrunner', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'ranged', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Ranged XP for 60 minutes while equipped.' },
  lesser_aura_arcane: { id: 'lesser_aura_arcane', name: 'Lesser Aura of Arcane Weave', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'magic', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Magic XP for 30 minutes while equipped.' },
  greater_aura_arcane: { id: 'greater_aura_arcane', name: 'Greater Aura of Arcane Weave', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'magic', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Magic XP for 45 minutes while equipped.' },
  celestial_aura_arcane: { id: 'celestial_aura_arcane', name: 'Celestial Aura of Arcane Weave', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'magic', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Magic XP for 60 minutes while equipped.' },
  lesser_aura_aegis: { id: 'lesser_aura_aegis', name: 'Lesser Aura of Aegis', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'defence', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Defence XP for 30 minutes while equipped.' },
  greater_aura_aegis: { id: 'greater_aura_aegis', name: 'Greater Aura of Aegis', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'defence', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Defence XP for 45 minutes while equipped.' },
  celestial_aura_aegis: { id: 'celestial_aura_aegis', name: 'Celestial Aura of Aegis', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'defence', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Defence XP for 60 minutes while equipped.' },
  lesser_aura_vitality: { id: 'lesser_aura_vitality', name: 'Lesser Aura of Vitality', category: 'aura', tier: 1, slot: 'aura', equipReq: { skill: 'attunement', level: 15 }, auraBuff: { skill: 'hitpoints', xpMultiplier: 0.05, durationSeconds: 1800 }, vendorFloorPrice: 250, description: 'A celestial attunement aura that radiates power. Grants +5% Hitpoints XP for 30 minutes while equipped.' },
  greater_aura_vitality: { id: 'greater_aura_vitality', name: 'Greater Aura of Vitality', category: 'aura', tier: 2, slot: 'aura', equipReq: { skill: 'attunement', level: 45 }, auraBuff: { skill: 'hitpoints', xpMultiplier: 0.1, durationSeconds: 2700 }, vendorFloorPrice: 750, description: 'A celestial attunement aura that radiates power. Grants +10% Hitpoints XP for 45 minutes while equipped.' },
  celestial_aura_vitality: { id: 'celestial_aura_vitality', name: 'Celestial Aura of Vitality', category: 'aura', tier: 3, slot: 'aura', equipReq: { skill: 'attunement', level: 75 }, auraBuff: { skill: 'hitpoints', xpMultiplier: 0.15, durationSeconds: 3600 }, vendorFloorPrice: 2500, description: 'A celestial attunement aura that radiates power. Grants +15% Hitpoints XP for 60 minutes while equipped.' },
};

export type StackingLocation = 'inventory' | 'bank' | 'storage';

export function isItemStackable(item?: ItemDefinition, location: StackingLocation = 'inventory'): boolean {
  if (!item) return false;
  const isBank = location === 'bank' || location === 'storage';

  if (isBank) {
    if (item.stackableInBank !== undefined) return item.stackableInBank;
    // All items stack in Hearth vault / bank by default
    return true;
  }

  if (item.stackableInInventory !== undefined) return item.stackableInInventory;

  if (item.stackable !== undefined) {
    return item.stackable;
  }

  // Cooked food occupies 1 slot per item in inventory
  if (item.category === 'cooked_food') {
    return false;
  }

  // Non-stackable by default in satchel inventory: weapon, armour, tool, steed, pet, aura
  if (['weapon', 'armour', 'tool', 'steed', 'pet', 'aura'].includes(item.category)) {
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
  quantity = Math.floor(Number(quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) return { added: 0, remainder: 0 };

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

export interface VendorGood {
  itemId: string;
  price: number;
}

export const VENDOR_GOODS: VendorGood[] = [
  { itemId: 'steed_courser', price: 15000 },
  { itemId: 'steed_chicken', price: 15000 },
];
