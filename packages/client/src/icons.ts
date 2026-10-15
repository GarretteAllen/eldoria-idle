/**
 * Sourced Vector SVG Icons for Eldoria Idle
 * Powered by Lucide (open-source vector icon library)
 * Provides crisp, clean, appropriately scaled 24x24 vector icons.
 */

import {
  Coins,
  Gem,
  Sparkles,
  Sun,
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
  Vote,
  Star,
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
  pet: toSvg(Sparkle),
  aura: toSvg(Sun || Sparkles),
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
  founder: toSvg(Star),
  editor: toSvg(Wrench),
  leaderboard: toSvg(Crown),
  character: toSvg(User),
  npc: toSvg(Users),
  quest: toSvg(Scroll),
  collision: toSvg(Grid),
  mapPin: toSvg(MapPin),
  slumber: toSvg(MoonStar),
  poll: toSvg(Vote),
  dungeon: toSvg(Skull),
  key: toSvg(Lock),
  party: toSvg(Users),
  discord: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" class="lucide-icon"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
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
  if (safeId === 'bogling_hide') safeId = 'ghoul_hide';
  if (safeId === 'bogskin_quiver') safeId = 'ghoulskin_quiver';

  // Fallbacks for cloth mage robes to base wizard/tunic icons
  if (safeId.includes('robe_top')) safeId = 'tunic_cloth';
  else if (safeId.includes('robe_bottom') || safeId.includes('skirt')) safeId = 'tunic_pants';
  else if (safeId.includes('mage_hat') || safeId.includes('mystic_hat') || safeId === 'celestial_crown') safeId = 'wizard_hat';

  // Fallbacks for ranger armor to base leather/hood icons
  else if (safeId.endsWith('_tunic') || safeId.endsWith('_vest') || safeId.endsWith('_jerkin') || safeId.endsWith('_hauberk')) safeId = 'leather_tunic';
  else if (safeId.endsWith('_chaps') || safeId.endsWith('_leggings')) safeId = 'leather_chaps';
  else if (safeId.endsWith('_hood') || safeId.endsWith('_cowl') || safeId.endsWith('_hat')) safeId = 'ranger_hood';

  return `<img src="/icons/items/${safeId}.png" class="dv-slot-svg item-icon-img" alt="${safeId}" loading="lazy" onerror="if(!this.dataset.triedFallback){this.dataset.triedFallback='true';if('${safeId}'==='leather_tunic'){this.src='/icons/items/pelt_jerkin.png';return;}if('${safeId}'==='leather_quiver'){this.src='/icons/items/pelt_quiver.png';return;}if('${safeId}'==='ghoul_hide'){this.src='/icons/items/bogling_hide.png';return;}if('${safeId}'==='ghoulskin_quiver'){this.src='/icons/items/bogskin_quiver.png';return;}}this.onerror=null;this.style.display='none';" />`;
}

