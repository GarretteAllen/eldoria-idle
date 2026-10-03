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

  // === Audio & Top Utilities ===
  soundOn: toSvg(Volume2),
  soundOff: toSvg(VolumeX),
  compass: toSvg(Compass),
  worldMap: toSvg(Map),
  scroll: toSvg(Scroll),
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
  character: toSvg(User),
  npc: toSvg(Users),
  quest: toSvg(Scroll),
  collision: toSvg(Grid),
  mapPin: toSvg(MapPin),
};

/**
 * Returns clean SVG markup for a requested icon.
 */
export function getIconSvg(name: string, extraClass: string = ''): string {
  const icon = ICONS[name] || ICONS['skills'];
  return `<span class="rpg-icon-wrap rpg-icon-${name} ${extraClass}">${icon.trim()}</span>`;
}

/**
 * Returns clean, properly scaled Lucide SVG icons for any item by category or ID.
 */
export function getItemIconSvg(itemId: string, category?: string): string {
  const id = itemId.toLowerCase();
  const cat = (category || '').toLowerCase();

  // Ores & Raw Minerals
  if (cat === 'ore' || id.includes('ore') || id.includes('shard')) {
    const isGold = id.includes('solar') || id.includes('pyrite');
    const isBlue = id.includes('azurite') || id.includes('starfall');
    const color = isGold ? '#f59e0b' : isBlue ? '#38bdf8' : '#94a3b8';
    return toColoredSvg(Pickaxe, color, 'dv-slot-svg');
  }

  // Refined Ingots
  if (cat === 'bar' || id.includes('ingot')) {
    const isGold = id.includes('dawn') || id.includes('aurum');
    const isBlue = id.includes('azurite') || id.includes('astralite');
    const color = isGold ? '#fbbf24' : isBlue ? '#60a5fa' : '#cbd5e1';
    return toColoredSvg(Landmark, color, 'dv-slot-svg');
  }

  // Timbers & Logs
  if (cat === 'log' || id.includes('timber') || id.includes('wood') || id.includes('oak') || id.includes('willow')) {
    const isMagic = id.includes('ghost') || id.includes('starlight');
    const color = isMagic ? '#c084fc' : '#d97706';
    return toColoredSvg(Axe, color, 'dv-slot-svg');
  }

  // Raw Fish & Crustaceans
  if (cat === 'raw_food' || id.includes('prawn') || id.includes('minnow') || id.includes('trout') || id.includes('salmon') || id.includes('albacore') || id.includes('crustacean') || id.includes('sovereign') || id.includes('mawshark')) {
    return toColoredSvg(Fish, '#38bdf8', 'dv-slot-svg');
  }

  // Cooked Provisions & Feasts
  if (cat === 'cooked_food' || id.includes('smoked') || id.includes('crisped') || id.includes('seared') || id.includes('poached') || id.includes('glazed') || id.includes('broiled') || id.includes('roast') || id.includes('feast')) {
    return toColoredSvg(UtensilsCrossed, '#f59e0b', 'dv-slot-svg');
  }

  // Crops & Mushrooms
  if (cat === 'crop' || id.includes('tuber') || id.includes('shroom') || id.includes('radish') || id.includes('mandrake') || id.includes('gourd') || id.includes('pepper')) {
    return toColoredSvg(Sprout, '#48bb78', 'dv-slot-svg');
  }

  // Seeds & Spores
  if (cat === 'seed' || id.includes('seed') || id.includes('spore') || id.includes('pod')) {
    return toColoredSvg(Leaf, '#38a169', 'dv-slot-svg');
  }

  // Herbs & Reagents
  if (cat === 'herb' || id.includes('leaf') || id.includes('bell') || id.includes('frond')) {
    return toColoredSvg(Leaf, '#22c55e', 'dv-slot-svg');
  }

  // Potions & Elixirs
  if (cat === 'potion' || id.includes('draught') || id.includes('phial') || id.includes('elixir') || id.includes('flask')) {
    return toColoredSvg(FlaskConical, '#c084fc', 'dv-slot-svg');
  }

  // Tools
  if (cat === 'tool' || id.includes('pickaxe') || id.includes('axe') || id.includes('hatchet')) {
    if (id.includes('pickaxe')) return toColoredSvg(Pickaxe, '#38bdf8', 'dv-slot-svg');
    if (id.includes('axe') || id.includes('hatchet')) return toColoredSvg(Axe, '#38bdf8', 'dv-slot-svg');
    return toColoredSvg(Hammer, '#38bdf8', 'dv-slot-svg');
  }

  // Weapons & Bows
  if (cat === 'weapon' || id.includes('bow') || id.includes('sword') || id.includes('blade')) {
    if (id.includes('bow')) {
      return toColoredSvg(Target, '#d97706', 'dv-slot-svg');
    }
    return toColoredSvg(Sword, '#e2e8f0', 'dv-slot-svg');
  }

  // Shields & Gear
  if (cat === 'shield' || id.includes('shield')) {
    return toColoredSvg(Shield, '#60a5fa', 'dv-slot-svg');
  }

  // Relics & Gems
  if (cat === 'relic' || id.includes('gem') || id.includes('anima') || id.includes('scroll') || id.includes('core') || id.includes('scale') || id.includes('ember')) {
    return toColoredSvg(Sparkles, '#ec4899', 'dv-slot-svg');
  }

  // Monster Trophies & Hides
  if (cat === 'trophy' || id.includes('pelt') || id.includes('hide') || id.includes('talisman') || id.includes('carapace')) {
    return toColoredSvg(Skull, '#d97706', 'dv-slot-svg');
  }

  // Default Pouch / Crate
  return toColoredSvg(Package, '#b45309', 'dv-slot-svg');
}
