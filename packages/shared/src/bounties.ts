import { DailyBounty, PlayerData } from './types.js';

export interface BountyTemplate {
  id: string;
  category: 'gathering' | 'refining' | 'combat';
  title: string;
  description: string;
  targetId: string;
  targetName: string;
  minLevel: number;
  count: number;
  rewardGold: number;
  rewardGems: number;
  rewardAnima: number;
}

export const GATHERING_BOUNTY_TEMPLATES: BountyTemplate[] = [
  // Mining
  {
    id: 'bounty_mine_pyrite',
    category: 'gathering',
    title: 'Glint of Fools',
    description: 'Quarry 25 Pyrite ore from the northern mineral crags.',
    targetId: 'pyrite_ore',
    targetName: 'Pyrite Ore',
    minLevel: 1,
    count: 25,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_mine_galena',
    category: 'gathering',
    title: 'Heavy Veins',
    description: 'Mine 25 Galena ore to supply the town smelters.',
    targetId: 'galena_ore',
    targetName: 'Galena Ore',
    minLevel: 1,
    count: 25,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_mine_cold_iron',
    category: 'gathering',
    title: 'Chilled Ore',
    description: 'Extract 20 Cold Iron ore from the deep quarry seams.',
    targetId: 'cold_iron_ore',
    targetName: 'Cold Iron Ore',
    minLevel: 15,
    count: 20,
    rewardGold: 650,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_mine_quicksilver',
    category: 'gathering',
    title: 'Shifting Mercury',
    description: 'Excavate 15 Quicksilver ore from subterranean fissures.',
    targetId: 'quicksilver_ore',
    targetName: 'Quicksilver Ore',
    minLevel: 30,
    count: 15,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 50,
  },
  {
    id: 'bounty_mine_nethercoal',
    category: 'gathering',
    title: 'Smoldering Embers',
    description: 'Mine 15 Nethercoal chunks to stoke the ancestral hearth.',
    targetId: 'nethercoal',
    targetName: 'Nethercoal',
    minLevel: 40,
    count: 15,
    rewardGold: 1400,
    rewardGems: 6,
    rewardAnima: 65,
  },
  {
    id: 'bounty_mine_azurite',
    category: 'gathering',
    title: 'Deep Azure',
    description: 'Mine 10 Azurite gems from the crystal cavern veins.',
    targetId: 'azurite_ore',
    targetName: 'Azurite Ore',
    minLevel: 65,
    count: 10,
    rewardGold: 2200,
    rewardGems: 8,
    rewardAnima: 90,
  },

  // Woodcutting
  {
    id: 'bounty_chop_ashwood',
    category: 'gathering',
    title: 'Hearth Kindling',
    description: 'Fell 25 Ashwood timber logs from the frontier groves.',
    targetId: 'ashwood_log',
    targetName: 'Ashwood Log',
    minLevel: 1,
    count: 25,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_chop_oak',
    category: 'gathering',
    title: 'Stout Oak Timber',
    description: 'Chop 20 Whispering Oak logs to shore up tavern rafters.',
    targetId: 'oak_log',
    targetName: 'Whispering Oak Log',
    minLevel: 15,
    count: 20,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
  {
    id: 'bounty_chop_willow',
    category: 'gathering',
    title: 'Weeping Boughs',
    description: 'Fell 20 Weeping Willow logs along the misty riverbanks.',
    targetId: 'willow_log',
    targetName: 'Weeping Willow Log',
    minLevel: 30,
    count: 20,
    rewardGold: 950,
    rewardGems: 5,
    rewardAnima: 45,
  },
  {
    id: 'bounty_chop_bloodwood',
    category: 'gathering',
    title: 'Crimson Timber',
    description: 'Harvest 15 Bloodwood logs from the deep crimson thicket.',
    targetId: 'bloodwood_log',
    targetName: 'Bloodwood Log',
    minLevel: 45,
    count: 15,
    rewardGold: 1500,
    rewardGems: 6,
    rewardAnima: 60,
  },

  // Fishing
  {
    id: 'bounty_fish_prawn',
    category: 'gathering',
    title: 'Shallow Waters',
    description: 'Catch 25 Tide Prawns from the coastal shallows.',
    targetId: 'raw_prawn',
    targetName: 'Raw Tide Prawn',
    minLevel: 1,
    count: 25,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_fish_trout',
    category: 'gathering',
    title: 'River Angler',
    description: 'Haul in 20 Shimmering Trout from the clear river bends.',
    targetId: 'raw_trout',
    targetName: 'Raw Shimmering Trout',
    minLevel: 20,
    count: 20,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_fish_salmon',
    category: 'gathering',
    title: 'Solar Swarm',
    description: 'Catch 15 Solar Crest fish swimming against the rapids.',
    targetId: 'raw_salmon',
    targetName: 'Raw Solar Crest',
    minLevel: 30,
    count: 15,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 50,
  },

  // Farming & Herbalism
  {
    id: 'bounty_farm_earthtuber',
    category: 'gathering',
    title: 'Bountiful Harvest',
    description: 'Harvest 20 Earthtubers from fertile garden allotments.',
    targetId: 'earthtuber',
    targetName: 'Earthtuber',
    minLevel: 1,
    count: 20,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_gather_silverleaf',
    category: 'gathering',
    title: 'Moonlit Foliage',
    description: 'Harvest 15 Silverleaf herbs from verdant woodland patches.',
    targetId: 'silverleaf',
    targetName: 'Silverleaf',
    minLevel: 10,
    count: 15,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
];

export const REFINING_BOUNTY_TEMPLATES: BountyTemplate[] = [
  // Smelting
  {
    id: 'bounty_smelt_dawnburn',
    category: 'refining',
    title: 'First Cast',
    description: 'Smelt 20 Dawnburn Ingots at the Ancestral Runeforge.',
    targetId: 'dawnburn_ingot',
    targetName: 'Dawnburn Ingot',
    minLevel: 1,
    count: 20,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_smelt_cold_iron',
    category: 'refining',
    title: 'Chilled Metallurgy',
    description: 'Smelt 15 Cold Iron Ingots at the Ancestral Runeforge.',
    targetId: 'cold_iron_ingot',
    targetName: 'Cold Iron Ingot',
    minLevel: 15,
    count: 15,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 40,
  },
  {
    id: 'bounty_smelt_steel',
    category: 'refining',
    title: 'Tempered Steel',
    description: 'Refine 12 Steel Ingots using iron and nethercoal flux.',
    targetId: 'steel_ingot',
    targetName: 'Steel Ingot',
    minLevel: 30,
    count: 12,
    rewardGold: 1100,
    rewardGems: 5,
    rewardAnima: 55,
  },

  // Cooking
  {
    id: 'bounty_cook_prawn',
    category: 'refining',
    title: 'Campfire Smoke',
    description: 'Smoke 20 Tide Prawns over hearth crackling embers.',
    targetId: 'smoked_prawn',
    targetName: 'Smoked Prawn',
    minLevel: 1,
    count: 20,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_cook_trout',
    category: 'refining',
    title: 'Crisp Seared Fish',
    description: 'Prepare 15 Seared Trout for traveling wardens.',
    targetId: 'seared_trout',
    targetName: 'Seared Trout',
    minLevel: 20,
    count: 15,
    rewardGold: 750,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_cook_bread',
    category: 'refining',
    title: 'Warm Hearth Loaves',
    description: 'Bake 15 Crusty Bread loaves to fill adventurer satchels.',
    targetId: 'crusty_bread',
    targetName: 'Crusty Bread',
    minLevel: 1,
    count: 15,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },

  // Fletching & Crafting
  {
    id: 'bounty_fletch_shafts',
    category: 'refining',
    title: 'Arrow Fletching',
    description: 'Whittle 50 Arrow Shafts from seasoned ash timber.',
    targetId: 'arrow_shaft',
    targetName: 'Arrow Shaft',
    minLevel: 1,
    count: 50,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_fletch_bow',
    category: 'refining',
    title: 'Frontier Bowyer',
    description: 'Fletch 10 Ash Shortbows at the artisan workbench.',
    targetId: 'ash_shortbow',
    targetName: 'Ash Shortbow',
    minLevel: 5,
    count: 10,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
];

export const COMBAT_BOUNTY_TEMPLATES: BountyTemplate[] = [
  {
    id: 'bounty_slay_mire_rat',
    category: 'combat',
    title: 'Murkwarren Scourge',
    description: 'Exterminate 15 Mire-Rats in the western wetlands.',
    targetId: 'mire_rat',
    targetName: 'Mire-Rat',
    minLevel: 1,
    count: 15,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_slay_stone_carapace',
    category: 'combat',
    title: 'Crag Behemoths',
    description: 'Shatter 12 Stone Carapaces along the rocky trails.',
    targetId: 'stone_carapace',
    targetName: 'Stone Carapace',
    minLevel: 1,
    count: 12,
    rewardGold: 550,
    rewardGems: 4,
    rewardAnima: 30,
  },
  {
    id: 'bounty_slay_fen_creeper',
    category: 'combat',
    title: 'Dread Marsh Patrol',
    description: 'Hunt down 12 Fen Creepers lurking beneath swamp reeds.',
    targetId: 'fen_creeper',
    targetName: 'Fen Creeper',
    minLevel: 5,
    count: 12,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_slay_mire_ghoul',
    category: 'combat',
    title: 'Restless Bogdead',
    description: 'Vanquish 10 Mire Ghouls haunting the Blackbog waters.',
    targetId: 'mire_ghoul',
    targetName: 'Mire Ghoul',
    minLevel: 10,
    count: 10,
    rewardGold: 900,
    rewardGems: 5,
    rewardAnima: 45,
  },
  {
    id: 'bounty_slay_carrion_scarab',
    category: 'combat',
    title: 'Burrowing Swarm',
    description: 'Slay 10 Carrion Scarabs in the ruins fringe.',
    targetId: 'carrion_scarab',
    targetName: 'Carrion Scarab',
    minLevel: 15,
    count: 10,
    rewardGold: 1100,
    rewardGems: 5,
    rewardAnima: 50,
  },
  {
    id: 'bounty_slay_trench_skulker',
    category: 'combat',
    title: 'Shadow Skulkers',
    description: 'Defeat 8 Trench Skulkers probing the frontier perimeter.',
    targetId: 'trench_skulker',
    targetName: 'Trench Skulker',
    minLevel: 20,
    count: 8,
    rewardGold: 1350,
    rewardGems: 6,
    rewardAnima: 60,
  },
  {
    id: 'bounty_slay_grim_hound',
    category: 'combat',
    title: 'Feral Pack',
    description: 'Cull 8 Grim Hounds prowling the misty crags.',
    targetId: 'grim_hound',
    targetName: 'Grim Hound',
    minLevel: 25,
    count: 8,
    rewardGold: 1600,
    rewardGems: 6,
    rewardAnima: 70,
  },
];

/**
 * Returns a stable pseudo-random integer in [0, max) for a given seed string
 */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Generates 3 daily bounties for the player: 1 gathering, 1 refining, 1 combat.
 * Seeded by player ID + UTC date key so results are consistent and reset daily at 00:00 UTC.
 */
export function generateDailyBountiesForPlayer(player: PlayerData, dateKey: string): DailyBounty[] {
  // Determine relevant skill levels to pick appropriate tasks
  const miningLvl = player.skills?.mining?.level || 1;
  const woodLvl = player.skills?.woodcutting?.level || 1;
  const fishLvl = player.skills?.fishing?.level || 1;
  const farmLvl = player.skills?.farming?.level || 1;
  const maxGatherLvl = Math.max(miningLvl, woodLvl, fishLvl, farmLvl);

  const smithLvl = player.skills?.smithing?.level || 1;
  const cookLvl = player.skills?.cooking?.level || 1;
  const fletchLvl = player.skills?.fletching?.level || 1;
  const maxRefineLvl = Math.max(smithLvl, cookLvl, fletchLvl);

  const meleeLvl = player.skills?.melee?.level || 1;
  const rangedLvl = player.skills?.ranged?.level || 1;
  const magicLvl = player.skills?.magic?.level || 1;
  const maxCombatLvl = Math.max(meleeLvl, rangedLvl, magicLvl);

  // Filter templates eligible by level
  const validGather = GATHERING_BOUNTY_TEMPLATES.filter(t => t.minLevel <= maxGatherLvl);
  const validRefine = REFINING_BOUNTY_TEMPLATES.filter(t => t.minLevel <= maxRefineLvl);
  const validCombat = COMBAT_BOUNTY_TEMPLATES.filter(t => t.minLevel <= maxCombatLvl);

  const gatherPool = validGather.length > 0 ? validGather : GATHERING_BOUNTY_TEMPLATES;
  const refinePool = validRefine.length > 0 ? validRefine : REFINING_BOUNTY_TEMPLATES;
  const combatPool = validCombat.length > 0 ? validCombat : COMBAT_BOUNTY_TEMPLATES;

  const gatherIdx = hashSeed(`${player.id}_${dateKey}_gather`) % gatherPool.length;
  const refineIdx = hashSeed(`${player.id}_${dateKey}_refine`) % refinePool.length;
  const combatIdx = hashSeed(`${player.id}_${dateKey}_combat`) % combatPool.length;

  const tGather = gatherPool[gatherIdx];
  const tRefine = refinePool[refineIdx];
  const tCombat = combatPool[combatIdx];

  const bounties: DailyBounty[] = [
    {
      id: `${tGather.id}_${dateKey}`,
      category: tGather.category,
      title: tGather.title,
      description: tGather.description,
      targetId: tGather.targetId,
      targetName: tGather.targetName,
      requiredCount: tGather.count,
      currentCount: 0,
      completed: false,
      claimed: false,
      rewardGold: tGather.rewardGold,
      rewardGems: tGather.rewardGems,
      rewardAnima: tGather.rewardAnima,
    },
    {
      id: `${tRefine.id}_${dateKey}`,
      category: tRefine.category,
      title: tRefine.title,
      description: tRefine.description,
      targetId: tRefine.targetId,
      targetName: tRefine.targetName,
      requiredCount: tRefine.count,
      currentCount: 0,
      completed: false,
      claimed: false,
      rewardGold: tRefine.rewardGold,
      rewardGems: tRefine.rewardGems,
      rewardAnima: tRefine.rewardAnima,
    },
    {
      id: `${tCombat.id}_${dateKey}`,
      category: tCombat.category,
      title: tCombat.title,
      description: tCombat.description,
      targetId: tCombat.targetId,
      targetName: tCombat.targetName,
      requiredCount: tCombat.count,
      currentCount: 0,
      completed: false,
      claimed: false,
      rewardGold: tCombat.rewardGold,
      rewardGems: tCombat.rewardGems,
      rewardAnima: tCombat.rewardAnima,
    },
  ];

  return bounties;
}

export function getCurrentDateKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
