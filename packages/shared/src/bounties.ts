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

/**
 * Gathering bounties capped strictly at Tier 1 - Tier 3.
 * All target IDs correspond 1:1 to valid in-game item definitions in ITEMS.
 */
export const GATHERING_BOUNTY_TEMPLATES: BountyTemplate[] = [
  // Mining (Tier 1 - 3)
  {
    id: 'bounty_mine_pyrite',
    category: 'gathering',
    title: 'Glint of Pyrite',
    description: 'Quarry 20 Pyrite Ore from the northern rock faces.',
    targetId: 'pyrite_ore',
    targetName: 'Pyrite Ore',
    minLevel: 1,
    count: 20,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_mine_galena',
    category: 'gathering',
    title: 'Galena Extraction',
    description: 'Mine 20 Galena Ore to supply local forge reserves.',
    targetId: 'galena_ore',
    targetName: 'Galena Ore',
    minLevel: 1,
    count: 20,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_mine_cold_iron',
    category: 'gathering',
    title: 'Cold Iron Seam',
    description: 'Mine 15 Cold Iron Ore from the quarry depths.',
    targetId: 'cold_iron_ore',
    targetName: 'Cold Iron Ore',
    minLevel: 15,
    count: 15,
    rewardGold: 650,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_mine_quicksilver',
    category: 'gathering',
    title: 'Quicksilver Lode',
    description: 'Extract 12 Quicksilver Ore from the subterranean fissures.',
    targetId: 'quicksilver_ore',
    targetName: 'Quicksilver Ore',
    minLevel: 30,
    count: 12,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 50,
  },
  {
    id: 'bounty_mine_nethercoal',
    category: 'gathering',
    title: 'Nethercoal Fissure',
    description: 'Quarry 12 Nethercoal to stoke the town smelting furnaces.',
    targetId: 'nethercoal',
    targetName: 'Nethercoal',
    minLevel: 40,
    count: 12,
    rewardGold: 1200,
    rewardGems: 5,
    rewardAnima: 55,
  },

  // Woodcutting (Tier 1 - 3)
  {
    id: 'bounty_chop_ashwood',
    category: 'gathering',
    title: 'Ashwood Copse',
    description: 'Fell 20 Ashwood Timber from the frontier trees.',
    targetId: 'ashwood_timber',
    targetName: 'Ashwood Timber',
    minLevel: 1,
    count: 20,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_chop_oak',
    category: 'gathering',
    title: 'Whispering Oak',
    description: 'Chop 15 Whispering Oak from the woodland grove.',
    targetId: 'whispering_oak',
    targetName: 'Whispering Oak',
    minLevel: 15,
    count: 15,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
  {
    id: 'bounty_chop_willow',
    category: 'gathering',
    title: 'Weeping Willow',
    description: 'Fell 15 Weeping Willow logs along the misty riverbanks.',
    targetId: 'weeping_willow',
    targetName: 'Weeping Willow',
    minLevel: 30,
    count: 15,
    rewardGold: 950,
    rewardGems: 5,
    rewardAnima: 45,
  },

  // Fishing (Tier 1 - 3)
  {
    id: 'bounty_fish_prawn',
    category: 'gathering',
    title: 'Tide Prawn Catch',
    description: 'Catch 20 Tide Prawns from the shallow waters.',
    targetId: 'tide_prawn',
    targetName: 'Tide Prawn',
    minLevel: 1,
    count: 20,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_fish_trout',
    category: 'gathering',
    title: 'Silverspeck Trout',
    description: 'Haul in 15 Silverspeck Trout from the river bends.',
    targetId: 'silverspeck_trout',
    targetName: 'Silverspeck Trout',
    minLevel: 20,
    count: 15,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_fish_salmon',
    category: 'gathering',
    title: 'Solar Crest Salmon',
    description: 'Catch 12 Solar Crest Salmon swimming through the sunlit rapids.',
    targetId: 'solar_crest_salmon',
    targetName: 'Solar Crest Salmon',
    minLevel: 30,
    count: 12,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 50,
  },

  // Farming & Herbalism (Tier 1 - 3)
  {
    id: 'bounty_farm_earthtuber',
    category: 'gathering',
    title: 'Earthtuber Allotment',
    description: 'Harvest 15 Earthtubers from town garden plots.',
    targetId: 'earthtuber',
    targetName: 'Earthtuber',
    minLevel: 1,
    count: 15,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_gather_silverleaf',
    category: 'gathering',
    title: 'Silverleaf Harvest',
    description: 'Gather 12 Silverleaf from wild patches or garden plots.',
    targetId: 'silverleaf',
    targetName: 'Silverleaf',
    minLevel: 10,
    count: 12,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
  {
    id: 'bounty_farm_glowshroom',
    category: 'gathering',
    title: 'Glowshroom Cluster',
    description: 'Harvest 10 Glowshrooms from damp garden allotments.',
    targetId: 'glowshroom',
    targetName: 'Glowshroom',
    minLevel: 25,
    count: 10,
    rewardGold: 850,
    rewardGems: 4,
    rewardAnima: 40,
  },
];

/**
 * Refining bounties capped strictly at Tier 1 - Tier 3.
 * All target IDs correspond 1:1 to valid in-game item definitions in ITEMS.
 */
export const REFINING_BOUNTY_TEMPLATES: BountyTemplate[] = [
  // Smelting (Tier 1 - 3)
  {
    id: 'bounty_smelt_dawnburn',
    category: 'refining',
    title: 'Dawnburn Smelting',
    description: 'Smelt 15 Dawnburn Ingots at the Ancestral Runeforge.',
    targetId: 'dawnburn_ingot',
    targetName: 'Dawnburn Ingot',
    minLevel: 1,
    count: 15,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_smelt_cold_iron',
    category: 'refining',
    title: 'Cold Iron Ingot',
    description: 'Smelt 12 Cold Iron Ingots at the Ancestral Runeforge.',
    targetId: 'cold_iron_ingot',
    targetName: 'Cold Iron Ingot',
    minLevel: 15,
    count: 12,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 40,
  },
  {
    id: 'bounty_smelt_steel',
    category: 'refining',
    title: 'Steel Smelting',
    description: 'Refine 10 Steel Ingots using iron and nethercoal at the forge.',
    targetId: 'steel_ingot',
    targetName: 'Steel Ingot',
    minLevel: 30,
    count: 10,
    rewardGold: 1100,
    rewardGems: 5,
    rewardAnima: 55,
  },

  // Cooking (Tier 1 - 3)
  {
    id: 'bounty_cook_prawn',
    category: 'refining',
    title: 'Smoked Prawns',
    description: 'Smoke 15 Smoked Prawns over the campfire.',
    targetId: 'smoked_prawn',
    targetName: 'Smoked Prawn',
    minLevel: 1,
    count: 15,
    rewardGold: 350,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_cook_trout',
    category: 'refining',
    title: 'Seared Trout',
    description: 'Cook 12 Seared Trout over campfire embers.',
    targetId: 'seared_trout',
    targetName: 'Seared Trout',
    minLevel: 20,
    count: 12,
    rewardGold: 750,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_cook_salmon',
    category: 'refining',
    title: 'Poached Solar Crest',
    description: 'Prepare 10 Poached Solar Crest rations over the campfire.',
    targetId: 'poached_solar_crest',
    targetName: 'Poached Solar Crest',
    minLevel: 30,
    count: 10,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 50,
  },

  // Fletching (Tier 1 - 3)
  {
    id: 'bounty_fletch_ash_bow',
    category: 'refining',
    title: 'Ashwood Bowyer',
    description: 'Craft 5 Ashwood Shortbows at the artisan workbench.',
    targetId: 'ashwood_shortbow',
    targetName: 'Ashwood Shortbow',
    minLevel: 1,
    count: 5,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_fletch_oak_bow',
    category: 'refining',
    title: 'Oak Shortbow',
    description: 'Craft 4 Oak Shortbows at the artisan workbench.',
    targetId: 'oak_shortbow',
    targetName: 'Oak Shortbow',
    minLevel: 15,
    count: 4,
    rewardGold: 700,
    rewardGems: 4,
    rewardAnima: 35,
  },
  {
    id: 'bounty_fletch_willow_bow',
    category: 'refining',
    title: 'Willow Shortbow',
    description: 'Craft 3 Willow Shortbows at the artisan workbench.',
    targetId: 'willow_shortbow',
    targetName: 'Willow Shortbow',
    minLevel: 30,
    count: 3,
    rewardGold: 1000,
    rewardGems: 5,
    rewardAnima: 45,
  },
];

/**
 * Combat bounties capped strictly at Zone 1 - 3 monsters (Level <= 26).
 * All target IDs correspond 1:1 to valid definitions in MONSTERS.
 */
export const COMBAT_BOUNTY_TEMPLATES: BountyTemplate[] = [
  {
    id: 'bounty_slay_mire_rat',
    category: 'combat',
    title: 'Mire-Rat Infestation',
    description: 'Exterminate 12 Mire-Rats in The Murkwarrens.',
    targetId: 'mire_rat',
    targetName: 'Mire-Rat',
    minLevel: 1,
    count: 12,
    rewardGold: 400,
    rewardGems: 3,
    rewardAnima: 20,
  },
  {
    id: 'bounty_slay_stone_carapace',
    category: 'combat',
    title: 'Cragridge Beetles',
    description: 'Shatter 10 Stone Carapaces along Cragridge.',
    targetId: 'stone_carapace',
    targetName: 'Stone Carapace',
    minLevel: 1,
    count: 10,
    rewardGold: 450,
    rewardGems: 3,
    rewardAnima: 25,
  },
  {
    id: 'bounty_slay_fen_creeper',
    category: 'combat',
    title: 'Dread Marsh Patrol',
    description: 'Hunt down 10 Fen Creepers lurking in Dread Marsh.',
    targetId: 'fen_creeper',
    targetName: 'Fen Creeper',
    minLevel: 5,
    count: 10,
    rewardGold: 600,
    rewardGems: 4,
    rewardAnima: 30,
  },
  {
    id: 'bounty_slay_mire_ghoul',
    category: 'combat',
    title: 'Blackbog Ghouls',
    description: 'Vanquish 8 Mire Ghouls haunting Blackbog.',
    targetId: 'mire_ghoul',
    targetName: 'Mire Ghoul',
    minLevel: 10,
    count: 8,
    rewardGold: 800,
    rewardGems: 4,
    rewardAnima: 40,
  },
  {
    id: 'bounty_slay_carrion_scarab',
    category: 'combat',
    title: 'Crypt Scarabs',
    description: 'Slay 8 Carrion Scarabs in Crypt Fields.',
    targetId: 'carrion_scarab',
    targetName: 'Carrion Scarab',
    minLevel: 15,
    count: 8,
    rewardGold: 950,
    rewardGems: 5,
    rewardAnima: 45,
  },
  {
    id: 'bounty_slay_trench_skulker',
    category: 'combat',
    title: 'Grotto Skulkers',
    description: 'Defeat 6 Trench Skulkers in Sunken Grotto.',
    targetId: 'trench_skulker',
    targetName: 'Trench Skulker',
    minLevel: 20,
    count: 6,
    rewardGold: 1100,
    rewardGems: 5,
    rewardAnima: 50,
  },
  {
    id: 'bounty_slay_grim_hound',
    category: 'combat',
    title: 'Barrow Hounds',
    description: 'Cull 6 Grim Hounds prowling Shadowed Barrow.',
    targetId: 'grim_hound',
    targetName: 'Grim Hound',
    minLevel: 25,
    count: 6,
    rewardGold: 1300,
    rewardGems: 5,
    rewardAnima: 55,
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
 * Strictly capped at Tier 1 - Tier 3.
 * Seeded by player ID + UTC date key so results are consistent and reset daily at 00:00 UTC.
 */
export function generateDailyBountiesForPlayer(player: PlayerData, dateKey: string): DailyBounty[] {
  // Determine relevant skill levels to pick appropriate tier 1 - 3 tasks
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
