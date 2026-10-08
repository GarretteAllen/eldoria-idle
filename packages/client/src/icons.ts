/**
 * Sourced Vector SVG Icons for Eldoria Idle
 * Powered by Lucide (open-source vector icon library)
 * Provides crisp, clean, appropriately scaled 24x24 vector icons.
 */

import {
  Coins,
  Gem,
  Sparkles,
  BookOpen,
  Backpack,
  Shield,
  MessageSquare,
  Skull,
  Zap,
  Compass,
  Heart,
  Square,
  Home,
  Package,
  Lock,
  Check,
  X,
  Volume2,
  VolumeX,
  Map,
  Scroll,
  Sparkle,
  Landmark,
  Sword,
  Swords,
  HardHat,
  Scissors,
  Shirt,
  Footprints,
  CircleDot,
  ChevronUp,
  ChevronDown,
  Pickaxe,
  Axe,
  Fish,
  Leaf,
  Sprout,
  VenetianMask,
  Hammer,
  UtensilsCrossed,
  Target,
  FlaskConical,
  Wand2,
  Crosshair,
  User,
  Users,
  Crown,
  Wrench,
  Grid,
  MapPin,
  Anvil,
  Flame,
  ChevronRight,
  ArrowLeft,
  MoonStar,
  Gift,
  Trash2,
  IconNode,
} from 'lucide';

/**
 * Converts a Lucide IconNode definition into a clean, responsive SVG string.
 */
function toSvg(iconNode: IconNode, customClass = ''): string {
  if (!iconNode) return '';
  const inner = iconNode
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
  const cls = customClass ? ` class="lucide-icon ${customClass}"` : ` class="lucide-icon"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${cls}>${inner}</svg>`;
}

/**
 * Converts a Lucide IconNode definition with explicit stroke color.
 */
function toColoredSvg(iconNode: IconNode, strokeColor: string, customClass = ''): string {
  if (!iconNode) return '';
  const inner = iconNode
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
  const cls = customClass ? ` class="lucide-icon ${customClass}"` : ` class="lucide-icon"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${cls}>${inner}</svg>`;
}

export const ICONS: Record<string, string> = {
  // === Currencies & Core Resources ===
  gold: toSvg(Coins),
  gems: toSvg(Gem),
  anima: toSvg(Sparkles),

  // === Navigation & Drawer Tabs ===
  skills: toSvg(BookOpen),
  inventory: toSvg(Backpack),
  equipment: toSvg(Shield),
  chat: toSvg(MessageSquare),
  boss: toSvg(Skull),
  speed: toSvg(Zap),
  mount: toSvg(Compass),
  heart: toSvg(Heart),
  stop: toSvg(Square),
  hearth: toSvg(Home),
  storage: toSvg(Package),
  lock: toSvg(Lock),
  check: toSvg(Check),
  close: toSvg(X),
  trash: toSvg(Trash2),

  // === Audio & Top Utilities ===
  soundOn: toSvg(Volume2),
  soundOff: toSvg(VolumeX),
  compass: toSvg(Compass),
  worldMap: toSvg(Map),
  scroll: toSvg(Scroll),
  gift: toSvg(Gift),
  changelog: toSvg(BookOpen),
  bestiary: toSvg(BookOpen),
  star: toSvg(Sparkles),
  levelUp: toSvg(Sparkles),
  spark: toSvg(Sparkle),
  crate: toSvg(Package),
  satchel: toSvg(Backpack),
  vault: toSvg(Landmark),

  // === Equipment Slots & Combat ===
  sword: toSvg(Sword),
  shield: toSvg(Shield),
  helmet: toSvg(HardHat),
  hair: toSvg(Scissors),
  body: toSvg(Shirt),
  legs: toSvg(Footprints),
  amulet: toSvg(Gem),
  ring: toSvg(CircleDot),
  chevronUp: toSvg(ChevronUp),
  chevronDown: toSvg(ChevronDown),
  chevronRight: toSvg(ChevronRight),
  arrowLeft: toSvg(ArrowLeft),
  anvil: toSvg(Anvil),
  flame: toSvg(Flame),

  // === All 16 Skills ===
  mining: toSvg(Pickaxe),
  woodcutting: toSvg(Axe),
  fishing: toSvg(Fish),
  herbalism: toSvg(Leaf),
  farming: toSvg(Sprout),
  thieving: toSvg(VenetianMask),
  smithing: toSvg(Hammer),
  cooking: toSvg(UtensilsCrossed),
  fletching: toSvg(Target),
  alchemy: toSvg(FlaskConical),
  crafting: toSvg(Scissors),
  attunement: toSvg(Wand2),
  melee: toSvg(Swords),
  ranged: toSvg(Crosshair),
  magic: toSvg(Sparkles),
  defence: toSvg(Shield),
  hitpoints: toSvg(Heart),

  // === Logo & UI Widgets ===
  logo: toSvg(Shield),
  admin: toSvg(Crown),
  editor: toSvg(Wrench),
  leaderboard: toSvg(Crown),
  character: toSvg(User),
  npc: toSvg(Users),
  quest: toSvg(Scroll),
  collision: toSvg(Grid),
  mapPin: toSvg(MapPin),
  slumber: toSvg(MoonStar),
};

/**
 * Returns clean SVG markup for a requested icon.
 */
export function getIconSvg(name: string, extraClass: string = ''): string {
  const icon = ICONS[name] || ICONS['skills'];
  return `<span class="rpg-icon-wrap rpg-icon-${name} ${extraClass}">${icon.trim()}</span>`;
}

/**
 * Returns authentic sourced pixel art icons for any item.
 * Sourced from OpenGameArt CC0 / CC-BY retro RPG icon collections.
 */
export function getItemIconSvg(itemId: string, _category?: string): string {
  if (!itemId) {
    return toColoredSvg(Package, '#b45309', 'dv-slot-svg');
  }
  let safeId = itemId.trim().toLowerCase();
  if (safeId === 'pelt_jerkin') safeId = 'leather_tunic';
  if (safeId === 'pelt_quiver') safeId = 'leather_quiver';

  // Fallbacks for cloth mage robes to base wizard/tunic icons
  if (safeId.includes('robe_top')) safeId = 'tunic_cloth';
  else if (safeId.includes('robe_bottom') || safeId.includes('skirt')) safeId = 'tunic_pants';
  else if (safeId.includes('mage_hat') || safeId.includes('mystic_hat') || safeId === 'celestial_crown') safeId = 'wizard_hat';

  // Fallbacks for ranger armor to base leather/hood icons
  else if (safeId.endsWith('_tunic') || safeId.endsWith('_vest') || safeId.endsWith('_jerkin') || safeId.endsWith('_hauberk')) safeId = 'leather_tunic';
  else if (safeId.endsWith('_chaps') || safeId.endsWith('_leggings')) safeId = 'leather_chaps';
  else if (safeId.endsWith('_hood') || safeId.endsWith('_cowl')) safeId = 'ranger_hood';

  return `<img src="/icons/items/${safeId}.png" class="dv-slot-svg item-icon-img" alt="${safeId}" loading="lazy" onerror="if(!this.dataset.triedFallback){this.dataset.triedFallback='true';if('${safeId}'==='leather_tunic'){this.src='/icons/items/pelt_jerkin.png';return;}if('${safeId}'==='leather_quiver'){this.src='/icons/items/pelt_quiver.png';return;}}this.onerror=null;this.style.display='none';" />`;
}

