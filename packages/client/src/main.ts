import {
  PlayerData,
  RECIPES,
  ITEMS,
  MONSTERS,
  EquipSlot,
  SkillType,
  getXpToNextLevel,
  getXpForLevel,
  NpcDefinition,
  QuestDefinition,
  ItemDefinition,
  RecipeDefinition,
  isItemStackable,
  getItemMaxStack,
  isTileInAnyLevel,
  MonsterSpawnZone,
  QUEUE_SLOT_CONFIG,
  OFFLINE_TIME_CONFIG,
  formatOfflineDuration,
  GEM_PACKS,
  GemPackDef,
  QueuedTask,
  MarketListing,
} from '@eldoria/shared';
import { WorldRenderer, WorldNodeDisplay, TILE_SIZE } from './canvas.js';
import { loadLdtkWorld } from './ldtkLoader.js';
import { ICONS, getItemIconSvg } from './icons.js';
import { sound } from './sound.js';

const SKILL_FLAVOR: Record<string, string> = {
  mining: 'Excavate raw veins of pyrite, galena, cold iron, quicksilver and starfall from the ancient crags.',
  fishing: 'Cast into shimmering waters, quiet streams and abyssal tides for bountiful catches.',
  woodcutting: 'Fell whispering oaks, willows, bloodwood and ancient elders across the frontier.',
  herbalism: 'Tend fertile soil, forage earth roots, ghost moss and mystical blooms for alchemy.',
  farming: 'Till fertile allotments, sow ancient seeds, and nurture bountiful harvests across Eldoria.',
  thieving: 'Lurk in shadowy alcoves to pickpocket citizens, merchants and opulent nobles.',
  smithing: 'Smelt ores into ingots and hammer weapons and armor at the forge.',
  cooking: 'Cook fresh fish, bake bread, and prepare meals over the firepit.',
  fletching: 'Carve seasoned wood into bows and craft arrows.',
  alchemy: 'Distill enchanted herbs and pure solvents into potent elixirs of haste and warding.',
  crafting: 'Cut celestial gems, stitch tough hides and fashion rings and talismans of power.',
  attunement: 'Channel primordial soul anima into cosmic blessings and celestial wards.',
  melee: 'Master the edge of the blade, crushing blows and close-quarters swordplay.',
  ranged: 'Pinpoint weak spots from afar with recurve bows and deadly flight.',
  magic: 'Unleash celestial sorcery, elemental tempests and arcane mysteries.',
  defence: 'Turn aside savage strikes with heavy bulwarks, deflection and fortified plate.',
  hitpoints: 'Endure mortal wounds through constitution, vigor and restorative feasts.',
};

const GATHERING_SKILLS: SkillType[] = ['mining', 'fishing', 'woodcutting', 'herbalism', 'farming', 'thieving'];
const CRAFTING_SKILLS: SkillType[] = ['cooking', 'smithing', 'fletching', 'alchemy', 'crafting', 'attunement'];
const COMBAT_SKILLS: SkillType[] = ['melee', 'ranged', 'magic', 'defence', 'hitpoints'];

const LEADERBOARD_CATEGORIES: { id: 'total' | SkillType; name: string }[] = [
  { id: 'total', name: 'Total Level' },
  { id: 'mining', name: 'Mining' },
  { id: 'fishing', name: 'Fishing' },
  { id: 'woodcutting', name: 'Woodcutting' },
  { id: 'herbalism', name: 'Herbalism' },
  { id: 'farming', name: 'Farming' },
  { id: 'thieving', name: 'Thieving' },
  { id: 'cooking', name: 'Cooking' },
  { id: 'smithing', name: 'Smithing' },
  { id: 'fletching', name: 'Fletching' },
  { id: 'alchemy', name: 'Alchemy' },
  { id: 'crafting', name: 'Crafting' },
  { id: 'attunement', name: 'Attunement' },
  { id: 'melee', name: 'Melee' },
  { id: 'ranged', name: 'Ranged' },
  { id: 'magic', name: 'Magic' },
  { id: 'defence', name: 'Defence' },
  { id: 'hitpoints', name: 'Hitpoints' },
];

class EldoriaClient {
  private ws: WebSocket | null = null;
  private player: PlayerData | null = null;
  private activeLeaderboardCategory: 'total' | SkillType = 'total';
  private renderer: WorldRenderer;
  private activeChannel = 'All';
  private selectedInventoryIndex: number | null = null;
  private worldNodes: WorldNodeDisplay[] = [];
  private npcs: NpcDefinition[] = [];
  private quests: QuestDefinition[] = [];
  private monsterZones: MonsterSpawnZone[] = [];

  // Deep Vein UI State
  private activeDrawer: 'skills' | 'inventory' | 'equipment' | 'storage' | 'editor' = 'skills';
  private selectedSkillKey: SkillType = 'mining';
  private selectedRecipeId: string = 'mine_pyrite';
  private selectedSkillCategory: string | null = null;
  private selectedJobQuantity: number = Infinity;
  private isPopupOpen: boolean = false;
  private chatCollapsed: boolean = false;

  // Storage Modal State
  private selectedTransferAmount: number | 'all' = 1;
  private storageFilterQuery: string = '';
  private activeStorageTab: 'storage' | 'vendor' | 'market' = 'storage';
  private marketListings: MarketListing[] = [];
  private marketSearchQuery: string = '';
  private marketFilterCategory: string = 'all';

  // Editor State
  private activeEditorTab: 'nodes' | 'monsters' | 'npcs' | 'quests' | 'collisions' | 'giveitems' | 'items' = 'nodes';
  private collisionBrush: 'paint' | 'erase' = 'paint';
  private adminNodeSearchQuery: string = '';
  private adminNodeTypeFilter: string = 'all';

  // Interaction State
  private pendingNpcTarget: NpcDefinition | null = null;
  private pendingMonsterTarget: WorldNodeDisplay | null = null;
  private pendingMonsterQuantity?: number;
  private pendingHearthTarget: WorldNodeDisplay | null = null;
  private pendingDoorTarget: WorldNodeDisplay | null = null;
  private pendingStationTarget: { type: 'fire' | 'forge' | 'farm' | 'workbench' | 'cauldron' | 'monolith'; node: WorldNodeDisplay } | null = null;
  private selectedStationNode: WorldNodeDisplay | null = null;
  private activeCombatMonster: {
    id: string;
    name: string;
    level?: number;
    currentHp: number;
    maxHp: number;
    combatStyle: string;
  } | null = null;
  private previousSkillLevels: Map<string, number> = new Map();
  private previousCompletedQty: number = 0;

  // Chat History & Filtering
  private chatHistory: Array<{ time: string; senderName?: string; text: string; channel: 'Combat' | 'Loot' | 'Global' | 'System'; isAdmin?: boolean }> = [];

  // Pinned Quests State
  private acceptedQuests: Set<string> = new Set();
  private completedQuests: Set<string> = new Set();

  private levelUpTimer: any = null;
  private lastToastText: string = '';
  private lastToastTime: number = 0;

  // Gem Store & Payment State
  private currentGemStoreTab: 'queue' | 'packs' | 'offline' = 'queue';
  private gemPacksData: GemPackDef[] = Object.values(GEM_PACKS);

  // AFK Resource Saving State (15 minutes threshold)
  private readonly AFK_TIMEOUT_MS = 15 * 60 * 1000;
  private isAfk = false;
  private lastUserActivity = Date.now();
  private hiddenSince: number | null = null;
  private afkCheckTimer: any = null;
  private heartbeatTimer: any = null;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new WorldRenderer(canvas);

    this.initStaticIcons();
    this.setupRightToolbar();
    this.setupTasksCard();
    this.setupChat();
    this.setupSkillJobPopup();
    this.setupModals();
    this.setupStorageModal();
    this.setupLeaderboardModal();
    this.setupCombatSustenance();
    this.setupAdminEditor();
    this.setupSoundAndMinimap();
    this.setupWorldMapModal();
    this.setupQuestTracker();
    this.setupKeyboardControls();
    this.setupLevelUpCelebration();
    this.setupBestiary();
    this.setupItemTooltips();
    this.setupAfkSystem();
    this.fetchNodesAndInit();
  }

  private initStaticIcons() {
    // Top Bar
    document.getElementById('brand-crest')!.innerHTML = ICONS.logo;
    const totalLvlIcon = document.getElementById('total-lvl-icon');
    if (totalLvlIcon) totalLvlIcon.innerHTML = ICONS.equipment;
    document.getElementById('hp-icon')!.innerHTML = ICONS.heart;
    document.getElementById('speed-icon')!.innerHTML = ICONS.speed;
    document.getElementById('icon-gold')!.innerHTML = ICONS.gold;
    document.getElementById('icon-gems')!.innerHTML = ICONS.gems;
    document.getElementById('icon-anima')!.innerHTML = ICONS.anima;
    document.getElementById('boss-icon')!.innerHTML = ICONS.boss;

    // Currency and Queue Gem Store triggers
    const gemChip = document.querySelector('.currency-chip.gems');
    if (gemChip) {
      gemChip.addEventListener('click', () => this.openGemStoreModal('packs'));
    }
    const queueChip = document.getElementById('queue-slots-chip');
    if (queueChip) {
      queueChip.addEventListener('click', () => this.openGemStoreModal('queue'));
    }
    const gemStoreCloseBtn = document.getElementById('gem-store-close-btn');
    if (gemStoreCloseBtn) {
      gemStoreCloseBtn.innerHTML = ICONS.close;
      gemStoreCloseBtn.onclick = () => this.closeGemStoreModal();
    }
    document.getElementById('tab-gem-queue')?.addEventListener('click', () => this.renderGemStoreTab('queue'));
    document.getElementById('tab-gem-offline')?.addEventListener('click', () => this.renderGemStoreTab('offline'));
    document.getElementById('tab-gem-packs')?.addEventListener('click', () => this.renderGemStoreTab('packs'));
    this.fetchGemPacks();

    // Tasks Card
    document.getElementById('task-home-btn')!.innerHTML = ICONS.hearth;
    document.getElementById('task-stop-btn')!.innerHTML = ICONS.stop;

    // Top Controls & Radar
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) soundBtn.innerHTML = ICONS.soundOn;
    const minimapBtn = document.getElementById('btn-minimap-toggle');
    if (minimapBtn) minimapBtn.innerHTML = ICONS.compass;
    const worldmapBtn = document.getElementById('btn-worldmap-toggle');
    if (worldmapBtn) worldmapBtn.innerHTML = ICONS.worldMap;
    const minimapGlyph = document.getElementById('minimap-compass-glyph');
    if (minimapGlyph) minimapGlyph.innerHTML = ICONS.compass;

    // Quest Tracker & Chat
    const questTrackerHeaderIcon = document.getElementById('quest-tracker-header-icon');
    if (questTrackerHeaderIcon) questTrackerHeaderIcon.innerHTML = ICONS.scroll;
    const questTrackerToggleBtn = document.getElementById('quest-tracker-toggle-btn');
    if (questTrackerToggleBtn) questTrackerToggleBtn.innerHTML = ICONS.chevronDown;
    const chatCollapseBtn = document.getElementById('chat-collapse-btn');
    if (chatCollapseBtn) chatCollapseBtn.innerHTML = ICONS.chevronDown;

    // Toolbar
    document.getElementById('tool-btn-skills')!.innerHTML = ICONS.skills;
    document.getElementById('tool-btn-inventory')!.innerHTML = ICONS.inventory;
    document.getElementById('tool-btn-equipment')!.innerHTML = ICONS.equipment;
    document.getElementById('tool-btn-storage')!.innerHTML = ICONS.storage;
    const toolLeaderboardBtn = document.getElementById('tool-btn-leaderboard');
    if (toolLeaderboardBtn) toolLeaderboardBtn.innerHTML = ICONS.leaderboard;
    const toolSoundBtn = document.getElementById('tool-btn-sound');
    if (toolSoundBtn) toolSoundBtn.innerHTML = ICONS.soundOn;
    document.getElementById('tool-btn-chat')!.innerHTML = ICONS.chat;
    const editorToolBtn = document.getElementById('tool-btn-editor');
    if (editorToolBtn) editorToolBtn.innerHTML = ICONS.editor;

    // Leaderboard Modal Icons
    const leaderboardHeaderIcon = document.getElementById('leaderboard-header-icon');
    if (leaderboardHeaderIcon) leaderboardHeaderIcon.innerHTML = ICONS.leaderboard;
    const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
    if (leaderboardCloseBtn) leaderboardCloseBtn.innerHTML = ICONS.close;

    // Editor Header Crown
    const crownIcon = document.getElementById('editor-crown-icon');
    if (crownIcon) crownIcon.innerHTML = ICONS.admin;

    // Drawer Buttons
    document.getElementById('btn-fight-icon')!.innerHTML = ICONS.melee;
    const bestiaryBtnIcon = document.getElementById('btn-bestiary-icon');
    if (bestiaryBtnIcon) bestiaryBtnIcon.innerHTML = ICONS.bestiary;
    document.getElementById('btn-home-icon')!.innerHTML = ICONS.hearth;

    // Storage Modal Controls
    const dvStorageClose = document.getElementById('dv-storage-close-btn');
    if (dvStorageClose) dvStorageClose.innerHTML = ICONS.close;
    const dvDepotIcon = document.getElementById('dv-depot-check-icon');
    if (dvDepotIcon) dvDepotIcon.innerHTML = ICONS.check;

    // Stacking Behavior Icons
    const stackBehaviorIcon = document.getElementById('stack-behavior-icon');
    if (stackBehaviorIcon) stackBehaviorIcon.innerHTML = ICONS.crate;
    const satchelStackIcon = document.getElementById('satchel-stack-icon');
    if (satchelStackIcon) satchelStackIcon.innerHTML = ICONS.satchel;
    const vaultStackIcon = document.getElementById('vault-stack-icon');
    if (vaultStackIcon) vaultStackIcon.innerHTML = ICONS.vault;

    // Modals Close & Headers
    const levelUpClose = document.getElementById('level-up-close-btn');
    if (levelUpClose) levelUpClose.innerHTML = ICONS.close;
    const bestiaryModalIcon = document.getElementById('bestiary-modal-icon');
    if (bestiaryModalIcon) bestiaryModalIcon.innerHTML = ICONS.bestiary;
    const bestiaryClose = document.getElementById('bestiary-close-btn');
    if (bestiaryClose) bestiaryClose.innerHTML = ICONS.close;
    const worldMapModalIcon = document.getElementById('world-map-modal-icon');
    if (worldMapModalIcon) worldMapModalIcon.innerHTML = ICONS.worldMap;
    const worldMapClose = document.getElementById('world-map-close-btn');
    if (worldMapClose) worldMapClose.innerHTML = ICONS.close;

    // Popup Close
    document.getElementById('popup-close-btn')!.innerHTML = ICONS.close;
    const oldActionClose = document.getElementById('item-action-close-btn');
    if (oldActionClose) oldActionClose.innerHTML = ICONS.close;
    document.getElementById('away-close-btn')!.innerHTML = ICONS.close;

    const editorDrawerClose = document.getElementById('editor-drawer-close-btn');
    if (editorDrawerClose) editorDrawerClose.innerHTML = ICONS.close;
    const npcModalClose = document.getElementById('npc-modal-close-btn');
    if (npcModalClose) npcModalClose.innerHTML = ICONS.close;
    const topCharIcon = document.getElementById('top-char-icon');
    if (topCharIcon) topCharIcon.innerHTML = ICONS.character;
    const authCrestIcon = document.getElementById('auth-crest-icon');
    if (authCrestIcon) authCrestIcon.innerHTML = ICONS.logo;
    const profileCrestIcon = document.getElementById('profile-crest-icon');
    if (profileCrestIcon) profileCrestIcon.innerHTML = ICONS.logo;
    const authClose = document.getElementById('auth-close-btn');
    if (authClose) authClose.innerHTML = ICONS.close;
    const profileClose = document.getElementById('profile-close-btn');
    if (profileClose) profileClose.innerHTML = ICONS.close;
  }

  private async fetchNodesAndInit() {
    try {
      const world = await loadLdtkWorld();
      if (world) {
        this.renderer.setStitchedWorld(world);
      }

      this.renderer.onGroundClick = (tileX, tileY) => {
        const world = this.renderer.getStitchedWorld();
        if (world && !isTileInAnyLevel(tileX, tileY, world.levels)) {
          return; // The Void is impassable!
        }
        this.pendingNpcTarget = null;
        this.pendingMonsterTarget = null;
        this.pendingHearthTarget = null;
        this.pendingStationTarget = null;
        this.sendWs({ type: 'MOVE_TO', x: tileX, y: tileY });
      };

      this.renderer.onNpcClick = (npc: NpcDefinition) => {
        if (!this.player) return;
        this.pendingMonsterTarget = null;
        this.pendingHearthTarget = null;
        this.pendingStationTarget = null;
        const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
        if (dist <= 1.5) {
          // Already adjacent / at NPC: talk immediately
          this.pendingNpcTarget = null;
          this.openNpcDialogue(npc);
        } else {
          // Player MUST walk to the NPC before talking to it!
          this.pendingNpcTarget = npc;
          const target = this.getAdjacentWalkableTile(npc.x, npc.y);
          this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
          this.showToast(`Walking to ${npc.name}...`);
        }
      };

      this.renderer.onNodeClick = (node: WorldNodeDisplay) => {
        this.pendingNpcTarget = null;
        this.pendingHearthTarget = null;
        this.pendingStationTarget = null;

        // MONSTER / ENEMY: Stop one tile before the enemy, and then attack it!
        if (node.type === 'monster') {
          if (!this.player) return;
          const maxRange = this.getCombatMaxRange();
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= maxRange) {
            // Within attack range: attack immediately!
            this.pendingMonsterTarget = null;
            this.sendWs({
              type: 'START_COMBAT',
              nodeId: node.id,
              monsterId: node.monsterId || 'mire_rat',
              targetX: node.x,
              targetY: node.y,
            });
            this.showToast(`Attacking ${node.name}!`);
          } else {
            // Approach enemy: stop within range (1 tile before for melee, at distance for bow/staff)
            this.pendingMonsterTarget = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking into range of ${node.name}...`);
          }
          return;
        }

        this.pendingMonsterTarget = null;

        // HEARTH COUNTER: Walk adjacent to the counter, then open bank modal!
        if (node.type === 'hearth_counter') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingHearthTarget = null;
            this.openStorageModal();
          } else {
            this.pendingHearthTarget = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // DOOR / WARP PORTAL: Walk to door, then trigger warp!
        if (node.type === 'door' || node.type === 'portal') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingDoorTarget = null;
            this.triggerDoorWarp(node);
          } else {
            this.pendingDoorTarget = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            const label = node.targetLabel || node.name || 'Door';
            this.showToast(`Walking to ${label}...`);
          }
          return;
        }

        // UNIVERSAL FIREPIT: Walk adjacent to firepit, then open Cooking Skill Job Directory!
        if (node.type === 'fire') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('cooking');
          } else {
            this.pendingStationTarget = { type: 'fire', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // UNIVERSAL FORGE: Walk adjacent to forge, then open Smithing Skill Job Directory!
        if (node.type === 'forge') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('smithing');
          } else {
            this.pendingStationTarget = { type: 'forge', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // UNIVERSAL FARM PLOT: Walk adjacent to farm plot, then open Farming Skill Job Directory!
        if (node.type === 'farm') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('farming');
          } else {
            this.pendingStationTarget = { type: 'farm', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // ARTISAN WORKBENCH: Crafting & Fletching
        if (node.type === 'workbench') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('crafting');
          } else {
            this.pendingStationTarget = { type: 'workbench', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // APOTHECARY CAULDRON: Alchemy
        if (node.type === 'cauldron') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('alchemy');
          } else {
            this.pendingStationTarget = { type: 'cauldron', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        // AETHER MONOLITH: Attunement
        if (node.type === 'monolith') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            this.pendingStationTarget = null;
            this.selectedStationNode = node;
            this.openSkillJobPopup('attunement');
          } else {
            this.pendingStationTarget = { type: 'monolith', node };
            this.selectedStationNode = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        if (node.recipeId) {
          const rec = RECIPES[node.recipeId];
          const dist = this.player ? Math.hypot(this.player.x - node.x, this.player.y - node.y) : 999;
          // Stop 1 tile outside the spot on walkable ground (or remain in place if already adjacent)
          const target = (dist <= 1.5 && this.player)
            ? { x: Math.round(this.player.x), y: Math.round(this.player.y) }
            : this.getAdjacentWalkableTile(node.x, node.y);

          this.sendWs({
            type: 'START_TASK',
            recipeId: node.recipeId,
            quantity: this.selectedJobQuantity,
            targetX: target.x,
            targetY: target.y,
            nodeX: node.x,
            nodeY: node.y,
          });
          const qtyStr = this.selectedJobQuantity === Infinity ? '(∞)' : `(${this.selectedJobQuantity}x)`;
          this.showToast(rec ? `Gathering ${rec.name} ${qtyStr}...` : `Working at ${node.name}...`);
        } else {
          this.sendWs({ type: 'MOVE_TO', x: node.x, y: node.y });
        }
      };

      // Initial REST fetch for world entities
      try {
        const [nodesRes, npcsRes, questsRes, collRes] = await Promise.all([
          fetch('/api/world/nodes').then(r => r.json()).catch(() => ({})),
          fetch('/api/world/npcs').then(r => r.json()).catch(() => ({})),
          fetch('/api/world/quests').then(r => r.json()).catch(() => ({})),
          fetch('/api/world/collisions').then(r => r.json()).catch(() => ({})),
        ]);

        if (nodesRes && nodesRes.nodes) {
          this.worldNodes = nodesRes.nodes;
          this.renderer.setNodes(this.worldNodes);
          this.renderEditorNodes();
          this.renderEditorMonsterZones();
        }
        if (npcsRes && npcsRes.npcs) {
          this.npcs = npcsRes.npcs;
          this.renderer.setNpcs(this.npcs);
          this.renderEditorNpcs();
          this.updateQuestNpcDropdown();
        }
        if (questsRes && questsRes.quests) {
          this.quests = questsRes.quests;
          this.renderEditorQuests();
        }
        if (collRes && collRes.collisions) {
          this.renderer.setCollisions(collRes.collisions);
          this.updateCollisionCount();
        }
      } catch (err) {
        console.warn('Initial REST load error:', err);
      }

      await this.initAuth();
    } catch (err) {
      console.error('Failed to init client', err);
    }
  }

  private async initAuth() {
    this.setupAuthModal();
    this.setupProfileModal();

    const token = localStorage.getItem('eldoria_session_token');

    if (token) {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          const data = await res.json();
          this.player = data.player;
          this.connectWs();
          return;
        } else {
          localStorage.removeItem('eldoria_session_token');
        }
      } catch (err) {
        console.warn('Session verification failed, falling back', err);
      }
    }

    // Auto-resume active guest session if token not present
    const guestId = localStorage.getItem('eldoria_guest_id');
    if (guestId) {
      try {
        const res = await fetch('/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.player) {
            this.player = data.player;
            this.connectWs();
            return;
          }
        }
      } catch (err) {
        console.warn('Guest session verification failed, falling back', err);
      }
    }

    // No persistent registered session or guest -> Present realm entry / login gate modal
    this.openAuthModal('login', false);
  }

  private connectWs() {
    if (!this.player) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?playerId=${this.player.id}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to Eldoria server');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (err) {
        console.error('Error handling WS message', err);
      }
    };

    this.ws.onclose = (event) => {
      console.log('Disconnected from server.', event.code, event.reason);
      if (this.isAfk || event.code === 4001) {
        if (!this.isAfk) {
          this.enterAfkMode('server_disconnect');
        }
        return;
      }
      setTimeout(() => {
        if (this.player && !this.isAfk) this.connectWs();
      }, 3000);
    };
  }

  private reconnectWs() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.connectWs();
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'INIT':
        this.player = msg.player;
        if (this.player) {
          for (const [sk, data] of Object.entries(this.player.skills)) {
            this.previousSkillLevels.set(sk, (data as any).level);
          }
        }
        this.renderer.setLocalPlayer(this.player!);
        this.updateUI();

        if (msg.nodes) {
          this.worldNodes = msg.nodes;
          this.renderer.setNodes(this.worldNodes);
          this.renderEditorNodes();
          this.renderEditorMonsterZones();
        }
        if (msg.monsterZones) {
          this.monsterZones = msg.monsterZones;
          this.renderer.setMonsterZones(this.monsterZones);
          this.renderEditorMonsterZones();
        }
        if (msg.npcs) {
          this.npcs = msg.npcs;
          this.renderer.setNpcs(this.npcs);
          this.renderEditorNpcs();
          this.updateQuestNpcDropdown();
        }
        if (msg.quests) {
          this.quests = msg.quests;
          this.renderEditorQuests();
        }
        if (msg.collisions) {
          this.renderer.setCollisions(msg.collisions);
          this.updateCollisionCount();
        }
        if (msg.items) {
          Object.assign(ITEMS, msg.items);
          this.renderInventoryDrawer();
          this.renderStorageDrawer();
          this.renderEditorItems();
        }

        if (msg.boss) this.updateBossBanner(msg.boss);
        if (msg.onlineCount !== undefined) {
          this.updateOnlineCount(msg.onlineCount);
        }

        if (msg.catchUp && msg.catchUp.completedCycles > 0) {
          this.showCatchUpModal(msg.catchUp);
        }
        break;

      case 'PLAYER_UPDATE':
        this.player = msg.player;
        this.renderer.setLocalPlayer(this.player!);
        if (this.player) {
          this.checkSkillLevelUps(this.player);
          if (this.player.currentTask) {
            const curQty = this.player.currentTask.completedQuantity || 0;
            if (curQty > this.previousCompletedQty) {
              const skill = this.player.currentTask.skill;
              if (skill === 'mining') {
                sound.play('mine');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'ore');
              } else if (skill === 'woodcutting') {
                sound.play('woodcut');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'wood');
              } else if (skill === 'fishing') {
                sound.play('water');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'water');
              } else if (skill === 'smithing') {
                sound.play('hammer');
                this.renderer.spawnParticles(this.player.x, this.player.y, 8, 'spark');
              } else if (skill === 'crafting') {
                sound.play('hammer');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'spark');
              } else if (skill === 'cooking') {
                sound.play('sizzle');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'smoke');
              } else if (skill === 'herbalism') {
                sound.play('herb');
                this.renderer.spawnParticles(this.player.x, this.player.y, 7, 'herb');
              } else if (skill === 'thieving') {
                sound.play('coin');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'gold_crit');
              } else if (skill === 'farming') {
                sound.play('water');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'water');
              } else if (skill === 'fletching') {
                sound.play('woodcut');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, 'wood');
              } else if (skill === 'alchemy') {
                sound.play('arcane');
                this.renderer.spawnParticles(this.player.x, this.player.y, 8, 'arcane');
              } else if (skill === 'attunement') {
                sound.play('arcane');
                this.renderer.spawnParticles(this.player.x, this.player.y, 10, 'arcane');
              }
              this.updateQuestTracker();
            }
            this.previousCompletedQty = curQty;
          } else {
            this.previousCompletedQty = 0;
          }
          this.updateQuestTracker();
        }
        this.updateUI();

        // Check if arrived adjacent to clicked NPC
        if (this.pendingNpcTarget && this.player) {
          const dist = Math.hypot(this.player.x - this.pendingNpcTarget.x, this.player.y - this.pendingNpcTarget.y);
          if (dist <= 1.5) {
            const target = this.pendingNpcTarget;
            this.pendingNpcTarget = null;
            this.openNpcDialogue(target);
          }
        }

        // Check if arrived within attack range of clicked Monster
        if (this.pendingMonsterTarget && this.player) {
          const maxRange = this.getCombatMaxRange();
          const dist = Math.hypot(this.player.x - this.pendingMonsterTarget.x, this.player.y - this.pendingMonsterTarget.y);
          if (dist <= maxRange) {
            const target = this.pendingMonsterTarget;
            const qty = this.pendingMonsterQuantity;
            this.pendingMonsterTarget = null;
            this.pendingMonsterQuantity = undefined;
            this.sendWs({
              type: 'START_COMBAT',
              nodeId: target.id,
              monsterId: target.monsterId || 'mire_rat',
              targetX: target.x,
              targetY: target.y,
              quantity: (typeof qty === 'number' && qty > 0 && qty !== Infinity) ? qty : undefined,
            });
            this.showToast(`Attacking ${target.name}!`);
          }
        }

        // Check if arrived adjacent to clicked Hearth Bank
        if (this.pendingHearthTarget && this.player) {
          const dist = Math.hypot(this.player.x - this.pendingHearthTarget.x, this.player.y - this.pendingHearthTarget.y);
          if (dist <= 1.5) {
            this.pendingHearthTarget = null;
            this.openStorageModal();
          }
        }

        // Check if arrived adjacent to clicked Door / Portal
        if (this.pendingDoorTarget && this.player) {
          const dist = Math.hypot(this.player.x - this.pendingDoorTarget.x, this.player.y - this.pendingDoorTarget.y);
          if (dist <= 1.5) {
            const doorNode = this.pendingDoorTarget;
            this.pendingDoorTarget = null;
            this.triggerDoorWarp(doorNode);
          }
        }

        // Check if arrived adjacent to clicked Firepit, Forge, Farm Plot, Workbench, Cauldron, or Monolith
        if (this.pendingStationTarget && this.player) {
          const dist = Math.hypot(this.player.x - this.pendingStationTarget.node.x, this.player.y - this.pendingStationTarget.node.y);
          if (dist <= 1.5) {
            const st = this.pendingStationTarget;
            this.pendingStationTarget = null;
            this.selectedStationNode = st.node;
            const skillMap: Record<string, SkillType> = {
              fire: 'cooking',
              forge: 'smithing',
              farm: 'farming',
              workbench: 'crafting',
              cauldron: 'alchemy',
              monolith: 'attunement',
            };
            this.openSkillJobPopup(skillMap[st.type] || 'crafting');
          }
        }
        break;

      case 'WORLD_STATE':
        this.renderer.updateOtherPlayers(msg.players);
        if (msg.onlineCount !== undefined) {
          this.updateOnlineCount(msg.onlineCount);
        }
        break;

      case 'WORLD_NODES_UPDATE':
        this.worldNodes = msg.nodes || [];
        this.renderer.setNodes(this.worldNodes);
        if (this.activeDrawer === 'editor') {
          this.renderEditorNodes();
          this.renderEditorMonsterZones();
        }
        break;

      case 'WORLD_MONSTER_ZONES_UPDATE':
        this.monsterZones = msg.monsterZones || [];
        this.renderer.setMonsterZones(this.monsterZones);
        this.renderEditorMonsterZones();
        break;

      case 'NPCS_UPDATE':
        this.npcs = msg.npcs || [];
        this.renderer.setNpcs(this.npcs);
        this.renderEditorNpcs();
        this.updateQuestNpcDropdown();
        break;

      case 'QUESTS_UPDATE':
        this.quests = msg.quests || [];
        this.renderEditorQuests();
        break;

      case 'COLLISIONS_UPDATE':
        this.renderer.setCollisions(msg.collisions || []);
        this.updateCollisionCount();
        break;

      case 'ITEMS_UPDATE':
        if (msg.items) {
          Object.assign(ITEMS, msg.items);
          this.renderInventoryDrawer();
          this.renderStorageDrawer();
          this.renderEditorItems();
          this.showToast('Item registry updated in real time.');
        }
        break;

      case 'CHAT_BROADCAST':
        this.appendChatMessage(msg);
        if (msg.senderId) {
          this.renderer.addChatBubble(msg.senderId, msg.text);
        }
        break;

      case 'BOSS_UPDATE':
        this.updateBossBanner(msg.boss);
        break;

      case 'COMBAT_HIT': {
        const isMe = msg.target === 'monster'
          ? (!msg.attackerId || msg.attackerId === this.player?.id)
          : (!msg.targetPlayerId || msg.targetPlayerId === this.player?.id);

        if (msg.target === 'monster') {
          const targetKey = msg.nodeId || (typeof msg.targetX === 'number' && typeof msg.targetY === 'number' ? `mob_${msg.targetX}_${msg.targetY}` : msg.monsterId);
          if (targetKey && msg.monsterHp !== undefined && msg.monsterMaxHp !== undefined) {
            this.renderer.monsterHpMap.set(targetKey, { currentHp: msg.monsterHp, maxHp: msg.monsterMaxHp });
          }
          const style = (msg.combatStyle || this.getPlayerCombatStyle()) as 'melee' | 'ranged' | 'magic';
          const myX = this.player?.x ?? 0;
          const myY = this.player?.y ?? 0;
          const hasCoords = typeof msg.targetX === 'number' && typeof msg.targetY === 'number';
          const targetX = typeof msg.targetX === 'number' ? msg.targetX : (this.worldNodes.find(n => n.id === targetKey)?.x ?? myX);
          const targetY = typeof msg.targetY === 'number' ? msg.targetY : (this.worldNodes.find(n => n.id === targetKey)?.y ?? myY);
          const isNearby = isMe || (hasCoords && Math.hypot(targetX - myX, targetY - myY) <= 25);

          if (typeof msg.playerX === 'number' && typeof msg.targetX === 'number' && isNearby) {
            this.renderer.addCombatProjectile(msg.playerX, msg.playerY, msg.targetX, msg.targetY, style);
          }
          // Trigger attack animation on the specific attacking player (local or remote if nearby)
          const attackerId = msg.attackerId || this.player?.id || 'self';
          if (isNearby) {
            this.renderer.triggerPlayerAttack(style, attackerId);
          }

          // Audio: weapon swing - ONLY for local player
          if (isMe) {
            if (style === 'melee') sound.play('sword');
            else if (style === 'ranged') sound.play('bow');
            else if (style === 'magic') sound.play('spell');
          }

          const dmg = typeof msg.damage === 'number' ? msg.damage : (msg.hit ? 1 : 0);

          if (dmg > 0) {
            if (isMe) {
              sound.play('impact');
              if (dmg >= 12) {
                this.renderer.triggerCameraShake(4);
              } else {
                this.renderer.triggerCameraShake(1.5);
              }
            }
            if (isNearby) {
              if (dmg >= 12) {
                this.renderer.addFloatingText(targetX, targetY, `CRIT! -${dmg}`, 'crit');
                this.renderer.spawnParticles(targetX, targetY, 8, 'gold_crit');
              } else {
                this.renderer.addFloatingText(targetX, targetY, `-${dmg}`, 'damage');
                this.renderer.spawnParticles(targetX, targetY, 5, 'blood');
              }
              if (targetKey) this.renderer.triggerMonsterFlinch(targetKey);
            }
          } else if (!msg.isRespawn) {
            if (isMe) {
              sound.play('splash');
            }
            if (isNearby) {
              this.renderer.addFloatingText(targetX, targetY, '0', 'splash');
            }
          }

          if (msg.isRespawn && targetKey) {
            this.renderer.monsterHpMap.set(targetKey, { currentHp: msg.monsterMaxHp, maxHp: msg.monsterMaxHp });
          } else if (msg.monsterHp !== undefined && msg.monsterHp <= 0) {
            if (isMe) {
              sound.play('kill');
              sound.play('coin');
            }
            if (isNearby) {
              this.renderer.addDeathEffect(targetX, targetY);
              this.renderer.spawnParticles(targetX, targetY, 15, 'gold_crit');
            }
            if (msg.xp && isMe) {
              this.renderer.addFloatingText(targetX, targetY - 0.5, `+${msg.xp} XP`, 'xp');
              this.appendChatMessage({
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                senderName: 'Victory',
                channel: 'Combat',
                text: `Defeated ${msg.monsterName || 'enemy'}! Gained ${msg.xp} XP.`,
              });
              this.updateQuestTracker();
            }
          }

          // Update active combat HUD only if local player is the attacker
          if (isMe) {
            this.activeCombatMonster = {
              id: msg.monsterId,
              name: msg.monsterName || MONSTERS[msg.monsterId]?.name || 'Target',
              level: MONSTERS[msg.monsterId]?.level,
              currentHp: msg.monsterHp !== undefined ? msg.monsterHp : (this.activeCombatMonster?.currentHp ?? 10),
              maxHp: msg.monsterMaxHp !== undefined ? msg.monsterMaxHp : (this.activeCombatMonster?.maxHp ?? 10),
              combatStyle: style,
            };
            this.updateCombatHud();
          }
        } else if (msg.target === 'player') {
          const isMe = !msg.targetPlayerId || msg.targetPlayerId === this.player?.id;
          const myX = this.player?.x ?? 0;
          const myY = this.player?.y ?? 0;
          const px = typeof msg.playerX === 'number' ? msg.playerX : myX;
          const py = typeof msg.playerY === 'number' ? msg.playerY : myY;
          const isNearby = isMe || Math.hypot(px - myX, py - myY) <= 25;
          const dmg = typeof msg.damage === 'number' ? msg.damage : 0;

          if (isMe && typeof msg.playerHp === 'number' && this.player) {
            this.player.currentHp = msg.playerHp;
            this.updateCombatHud();
          }

          if (dmg > 0) {
            if (isMe) {
              sound.play('hurt');
              this.renderer.triggerCameraShake(2);
            }
            if (isNearby) {
              this.renderer.addFloatingText(px, py, `-${dmg}`, 'damage');
              this.renderer.spawnParticles(px, py, 4, 'blood');
            }
          } else {
            if (isMe) {
              sound.play('splash');
            }
            if (isNearby) {
              this.renderer.addFloatingText(px, py, '0', 'splash');
            }
          }
        }
        break;
      }

      case 'COMBAT_HEAL': {
        const isMe = !msg.playerId || msg.playerId === this.player?.id;
        const myX = this.player?.x ?? 0;
        const myY = this.player?.y ?? 0;
        const px = typeof msg.playerX === 'number' ? msg.playerX : myX;
        const py = typeof msg.playerY === 'number' ? msg.playerY : myY;
        const isNearby = isMe || Math.hypot(px - myX, py - myY) <= 25;
        if (isMe && this.player) {
          if (typeof msg.currentHp === 'number') this.player.currentHp = msg.currentHp;
          this.updateCombatHud();
        }
        if (typeof msg.heal === 'number' && msg.heal > 0 && isNearby) {
          this.renderer.addFloatingText(px, py, `+${msg.heal}`, 'heal');
          this.renderer.spawnParticles(px, py, 7, 'herb');
        }
        break;
      }

      case 'LEVEL_UP':
        this.showLevelUpModal(msg.skill, msg.newLevel);
        break;

      case 'MARKET_LISTINGS':
        this.marketListings = Array.isArray(msg.listings) ? msg.listings : [];
        if (this.activeStorageTab === 'market') {
          this.renderMarketView();
        }
        break;

      case 'NOTIFICATION': {
        const text = msg.message || '';
        const isLoot = (text.includes('Loot') || text.includes('DROP') || (text.includes('found') && !text.includes('not found')) || /^Raid reward:.*Gold/i.test(text)) && !text.includes('Rare swipe');
        const isTravelOrTransient = /^(Traveling|Walking|Riding|Navigating|Returning|Hearth reached|Withdrew materials|Bag materials|Seeds depleted|Satchel full|Harvested|Sowed|Working|Gathering|Attacking|Ate|Bonus yield|Rare swipe|Pilfered)/i.test(text);

        // Always show on-screen floating toast
        this.showToast(text, false);

        if (isLoot) {
          this.appendChatMessage({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: 'Loot',
            channel: 'Loot',
            text: text,
          });
          this.updateQuestTracker();
        } else if (!isTravelOrTransient) {
          // Only log major system, admin, or world alerts to chat
          this.appendChatMessage({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            senderName: 'System',
            channel: 'System',
            text: text,
          });
        }
        break;
      }
    }
  }

  private sendWs(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private updateOnlineCount(count: number) {
    const el1 = document.getElementById('online-count');
    const el2 = document.getElementById('chat-online-count');
    if (el1) el1.textContent = count.toString();
    if (el2) el2.textContent = count.toString();
  }

  private updateUI() {
    if (!this.player) return;

    // 1. Currencies & Core Stats
    const nameEl = document.getElementById('top-player-name');
    const charPill = document.getElementById('top-character-pill');
    if (nameEl) {
      if (this.player.isGuest) {
        nameEl.textContent = `${this.player.username} (Guest)`;
        if (charPill) charPill.title = 'Guest Adventurer: Click to register permanent account';
      } else {
        nameEl.textContent = this.player.role === 'admin' 
          ? `[ADMIN] ${this.player.username || 'Admin'}` 
          : (this.player.username || 'Adventurer');
        if (charPill) charPill.title = this.player.role === 'admin'
          ? 'Administrator Account: Click for profile'
          : 'Registered Adventurer: Click for profile';
      }
    }

    document.getElementById('val-gold')!.textContent = this.player.gold.toLocaleString();
    document.getElementById('val-gems')!.textContent = this.player.gems.toLocaleString();
    document.getElementById('val-anima')!.textContent = this.player.anima.toLocaleString();

    // Total Level
    let totalLevel = 0;
    for (const rec of Object.values(this.player.skills)) {
      totalLevel += rec.level;
    }
    document.getElementById('val-total-level')!.textContent = totalLevel.toString();
    document.getElementById('skills-total-badge')!.textContent = totalLevel.toString();

    // Hitpoints
    const maxHp = Math.max(10, this.player.skills.hitpoints?.level || 10);
    document.getElementById('hp-text')!.textContent = `${this.player.currentHp} / ${maxHp}`;
    const hpPct = Math.min(100, Math.floor((this.player.currentHp / maxHp) * 100));
    document.getElementById('hp-bar-fill')!.style.width = `${hpPct}%`;

    // Speed
    const speed = this.player.moveSpeedTilesPerTick || 1.0;
    const bonusPct = Math.round((speed - 1.0) * 100);
    document.getElementById('speed-text')!.textContent = `${speed.toFixed(2)} t/t ${bonusPct > 0 ? '(+' + bonusPct + '%)' : ''}`;

    // Minimap coordinates
    const coordsEl = document.getElementById('minimap-coords');
    if (coordsEl) {
      const vc = this.renderer.getVisualCoords();
      coordsEl.textContent = `${vc.x}, ${vc.y}`;
    }

    // 2. Tasks Card (Top-Left)
    this.updateTasksCard();

    // 3. Render Drawers (ensure all drawers and counters stay perfectly updated)
    this.renderSkillsDrawer();
    this.renderInventoryDrawer();
    this.renderEquipmentDrawer();
    this.renderStorageDrawer();
    this.renderStorageModal();
    const gemModal = document.getElementById('gem-store-modal');
    if (gemModal && !gemModal.classList.contains('hidden')) {
      this.renderGemStoreTab(this.currentGemStoreTab);
    }
    if (this.activeDrawer === 'editor') {
      this.renderEditorNodes();
      this.renderEditorMonsterZones();
    }

    // If popup is open, update its display
    if (this.isPopupOpen) {
      this.updateSkillJobPopup();
    }

    // Editor button visible only to admins
    const editorToolBtn = document.getElementById('tool-btn-editor');
    if (editorToolBtn) {
      editorToolBtn.style.display = this.player.role === 'admin' ? 'flex' : 'none';
    }

    // Top Logout Button Visibility
    const topLogoutBtn = document.getElementById('btn-top-logout');
    if (topLogoutBtn) {
      topLogoutBtn.style.display = 'inline-flex';
    }

    // 4. Update Combat Encounter HUD
    this.updateCombatHud();
  }

  private updateCombatHud() {
    const hud = document.getElementById('combat-encounter-hud');
    if (!hud) return;

    const task = this.player?.currentTask;
    const isCombatTask = task && (task.skill === 'melee' || task.skill === 'ranged' || task.skill === 'magic');

    if (!isCombatTask || !this.player) {
      hud.classList.add('hidden');
      this.activeCombatMonster = null;
      return;
    }

    // Ensure activeCombatMonster is initialized from current combat task if not set
    if (!this.activeCombatMonster && task.recipeId && MONSTERS[task.recipeId]) {
      const def = MONSTERS[task.recipeId];
      const cached = this.renderer.monsterHpMap.get(def.id) || (task.targetNodeX !== undefined ? this.renderer.monsterHpMap.get(`mob_${task.targetNodeX}_${task.targetNodeY}`) : undefined);
      this.activeCombatMonster = {
        id: def.id,
        name: def.name,
        level: def.level,
        currentHp: cached ? cached.currentHp : def.hp,
        maxHp: cached ? cached.maxHp : def.hp,
        combatStyle: task.skill,
      };
    }

    if (!this.activeCombatMonster) {
      hud.classList.add('hidden');
      return;
    }

    hud.classList.remove('hidden');

    // Player stats
    const pMaxHp = Math.max(10, this.player.skills.hitpoints?.level || 10);
    const pCurHp = Math.max(0, Math.min(pMaxHp, this.player.currentHp));
    const pPct = Math.max(0, Math.min(100, Math.round((pCurHp / pMaxHp) * 100)));

    const pNameEl = document.getElementById('combat-hud-player-name');
    const pHpTextEl = document.getElementById('combat-hud-player-hp-text');
    const pHpFillEl = document.getElementById('combat-hud-player-hp-fill');

    if (pNameEl) pNameEl.textContent = this.player.username || 'Adventurer';
    if (pHpTextEl) pHpTextEl.textContent = `${pCurHp} / ${pMaxHp} HP`;
    if (pHpFillEl) pHpFillEl.style.width = `${pPct}%`;

    // Monster stats
    const m = this.activeCombatMonster;
    const mMaxHp = Math.max(1, m.maxHp);
    const mCurHp = Math.max(0, Math.min(mMaxHp, m.currentHp));
    const mPct = Math.max(0, Math.min(100, Math.round((mCurHp / mMaxHp) * 100)));

    const mNameEl = document.getElementById('combat-hud-monster-name');
    const mHpTextEl = document.getElementById('combat-hud-monster-hp-text');
    const mHpFillEl = document.getElementById('combat-hud-monster-hp-fill');

    if (mNameEl) mNameEl.textContent = m.level ? `${m.name} [Lvl ${m.level}]` : m.name;
    if (mHpTextEl) mHpTextEl.textContent = `${mCurHp} / ${mMaxHp} HP`;
    if (mHpFillEl) mHpFillEl.style.width = `${mPct}%`;

    const styleIconEl = document.getElementById('combat-hud-style-icon');
    if (styleIconEl) {
      const style = m.combatStyle || this.getPlayerCombatStyle();
      const svg = ICONS[style] || ICONS.melee;
      if (styleIconEl.innerHTML !== svg) {
        styleIconEl.innerHTML = svg;
      }
    }

    const autoEatEl = document.getElementById('combat-hud-autoeat-text');
    if (autoEatEl) {
      const eatPct = this.player.eatsAtHpPercent ?? 50;
      const foodName = this.player.selectedFoodItemId && ITEMS[this.player.selectedFoodItemId]
        ? ITEMS[this.player.selectedFoodItemId].name
        : 'Any Food';
      autoEatEl.textContent = `${eatPct}% HP (${foodName})`;
    }
  }

  private updateTasksCard() {
    if (!this.player) return;
    const taskNameEl = document.getElementById('task-name')!;
    const taskSubEl = document.getElementById('task-subtext')!;
    const progressFillEl = document.getElementById('task-progress-fill')!;
    const taskIconEl = document.getElementById('task-icon')!;
    const statusTagEl = document.getElementById('task-status-tag')!;

    if (this.player.bankingState === 'walking_to_bank') {
      const isSatchelFull = this.player.inventory.length >= 28;
      taskNameEl.textContent = 'Banking: Riding to Hearth';
      taskSubEl.textContent = isSatchelFull
        ? `Satchel full (28/28) • Depositing spoils...`
        : `Riding to Hearth Storage Counter • Depositing spoils...`;
      progressFillEl.style.width = '100%';
      taskIconEl.innerHTML = ICONS.mount;
      statusTagEl.textContent = 'BANKING';
      statusTagEl.className = 'status-tag';
    } else if (this.player.bankingState === 'returning_to_work') {
      taskNameEl.textContent = 'Returning to Work';
      taskSubEl.textContent = `Riding back to node at ${this.player.moveSpeedTilesPerTick || 1.0} t/t...`;
      progressFillEl.style.width = '100%';
      taskIconEl.innerHTML = ICONS.mount;
      statusTagEl.textContent = 'RIDING';
      statusTagEl.className = 'status-tag';
    } else if (this.player.isMoving && this.player.path && this.player.path.length > 0) {
      taskNameEl.textContent = 'Traveling on Road';
      taskSubEl.textContent = `${this.player.path.length} tiles remaining (${(this.player.moveSpeedTilesPerTick || 1.0)} t/t)`;
      progressFillEl.style.width = '100%';
      taskIconEl.innerHTML = ICONS.mount;
      statusTagEl.textContent = 'TRAVEL';
      statusTagEl.className = 'status-tag';
    } else if (this.player.currentTask) {
      const monsterDef = MONSTERS[this.player.currentTask.recipeId];
      if (monsterDef) {
        const style = (this.player.currentTask.skill || this.getPlayerCombatStyle()) as SkillType;
        const cSkill = this.player.skills[style] || { level: 1, xp: 0 };
        const { percent } = getXpToNextLevel(cSkill.level, cSkill.xp);
        taskNameEl.textContent = `Combat (${style.toUpperCase()}): ${monsterDef.name} (Lv ${monsterDef.level})`;
        taskSubEl.textContent = `${style.toUpperCase()} ${cSkill.level} (${percent.toFixed(1)}%) • Auto-retaliating in ${monsterDef.zone}`;
        progressFillEl.style.width = `${Math.max(5, percent)}%`;
        taskIconEl.innerHTML = ICONS[style] || ICONS.melee || ICONS.skills;
        statusTagEl.textContent = 'COMBAT';
        statusTagEl.className = 'status-tag combat';
      } else {
        const rec = RECIPES[this.player.currentTask.recipeId];
        const skill = this.player.currentTask.skill;
        taskNameEl.textContent = rec ? `${rec.name}` : skill;

        const pSkill = this.player.skills[skill as SkillType] || { level: 1, xp: 0 };
        const { percent } = getXpToNextLevel(pSkill.level, pSkill.xp);
        const rawTarget = this.player.currentTask.targetQuantity;
        const targetQty = (typeof rawTarget === 'number' && rawTarget > 0) ? rawTarget : Infinity;
        const completedQty = this.player.currentTask.completedQuantity || 0;

        if (targetQty !== Infinity) {
          const quotaPct = Math.min(100, Math.round((completedQty / targetQty) * 100));
          taskSubEl.textContent = `${skill.toUpperCase()} ${pSkill.level} • Progress: ${completedQty} / ${targetQty} (${quotaPct}%) • Auto-banking`;
          progressFillEl.style.width = `${Math.max(5, quotaPct)}%`;
        } else {
          taskSubEl.textContent = `${skill.toUpperCase()} ${pSkill.level} · ${percent.toFixed(1)}% to ${pSkill.level + 1} • Auto-banks non-stop (∞)`;
          progressFillEl.style.width = `${Math.max(5, percent)}%`;
        }
        taskIconEl.innerHTML = ICONS[skill] || ICONS.skills;
        statusTagEl.textContent = 'WORKING';
        statusTagEl.className = 'status-tag';
      }
    } else {
      taskNameEl.textContent = 'Idle: Choose a trade';
      taskSubEl.textContent = 'Select a trade from the skills menu or click the map';
      progressFillEl.style.width = '0%';
      taskIconEl.innerHTML = ICONS.skills;
      statusTagEl.textContent = 'IDLE';
      statusTagEl.className = 'status-tag idle';
    }

    // Update Action Queue UI
    const unlockedSlots = Math.min(QUEUE_SLOT_CONFIG.MAX_SLOTS, Math.max(QUEUE_SLOT_CONFIG.BASE_SLOTS, this.player.unlockedQueueSlots || 2));
    const taskQueue: QueuedTask[] = Array.isArray(this.player.taskQueue) ? this.player.taskQueue : [];
    const queueSlotsCountEl = document.getElementById('queue-slots-count');
    if (queueSlotsCountEl) {
      queueSlotsCountEl.textContent = `${taskQueue.length}/${unlockedSlots}`;
    }

    const skipBtn = document.getElementById('task-skip-btn');
    if (skipBtn) {
      skipBtn.style.display = taskQueue.length > 0 ? 'inline-block' : 'none';
      skipBtn.onclick = (e) => {
        e.stopPropagation();
        this.sendWs({ type: 'STOP_TASK', skipToNext: true });
      };
    }

    const clearQueueBtn = document.getElementById('btn-clear-queue');
    if (clearQueueBtn) {
      clearQueueBtn.style.display = taskQueue.length > 0 ? 'inline-block' : 'none';
      clearQueueBtn.onclick = () => {
        this.sendWs({ type: 'CANCEL_QUEUED_TASK', clearAll: true });
      };
    }

    const queueListEl = document.getElementById('task-queue-list');
    if (queueListEl) {
      queueListEl.innerHTML = '';
      for (let i = 0; i < QUEUE_SLOT_CONFIG.MAX_SLOTS; i++) {
        const slotNum = i + 1;
        if (i < taskQueue.length) {
          // Queued task item
          const qTask = taskQueue[i];
          const itemEl = document.createElement('div');
          itemEl.className = 'task-queue-item';
          const recName = qTask.targetLabel || (qTask.recipeId ? (RECIPES[qTask.recipeId]?.name || qTask.recipeId) : (qTask.monsterId ? MONSTERS[qTask.monsterId]?.name : 'Task'));
          const targetQtyStr = (typeof qTask.targetQuantity === 'number' && qTask.targetQuantity > 0 && qTask.targetQuantity !== Infinity)
            ? `(${qTask.targetQuantity}x)`
            : '(∞)';

          itemEl.innerHTML = `
            <div class="task-queue-item-left">
              <span class="task-queue-slot-num">${slotNum}.</span>
              <span class="task-queue-name" title="${recName}">${recName}</span>
              <span class="task-queue-qty">${targetQtyStr}</span>
            </div>
            <div class="task-queue-actions">
              <button class="btn-queue-remove" title="Remove from queue">✕</button>
            </div>
          `;
          itemEl.querySelector('.btn-queue-remove')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sendWs({ type: 'CANCEL_QUEUED_TASK', index: i });
          });
          queueListEl.appendChild(itemEl);
        } else if (i < unlockedSlots) {
          // Empty unlocked slot
          const itemEl = document.createElement('div');
          itemEl.className = 'task-queue-item task-queue-item-empty';
          itemEl.innerHTML = `
            <div class="task-queue-item-left">
              <span class="task-queue-slot-num">${slotNum}.</span>
              <span class="task-queue-empty-label">Empty Slot</span>
            </div>
            <span class="task-queue-ready-tag">Ready</span>
          `;
          queueListEl.appendChild(itemEl);
        } else {
          // Locked slot
          const cost = QUEUE_SLOT_CONFIG.COSTS[slotNum] || 500;
          const isNextToUnlock = slotNum === unlockedSlots + 1;
          const itemEl = document.createElement('div');
          itemEl.className = 'task-queue-slot-locked';
          if (isNextToUnlock) itemEl.classList.add('next-unlock');
          
          itemEl.innerHTML = `
            <div class="task-queue-item-left">
              <span class="task-queue-slot-num" style="color: #718096;">${slotNum}.</span>
              <span class="task-queue-locked-label">
                <span class="svg-icon-inline icon-sm">${ICONS.lock}</span>
                <span>Slot ${slotNum} Locked</span>
              </span>
            </div>
            <button class="btn-queue-slot-unlock" title="Unlock Slot ${slotNum}">
              Unlock (${cost} 💎)
            </button>
          `;
          itemEl.querySelector('.btn-queue-slot-unlock')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openGemStoreModal('queue');
          });
          queueListEl.appendChild(itemEl);
        }
      }
    }
  }

  private getAdjacentWalkableTile(targetX: number, targetY: number): { x: number; y: number } {
    const collisions = this.renderer.getCollisions();
    const candidates = [
      { x: targetX, y: targetY + 1 },
      { x: targetX, y: targetY - 1 },
      { x: targetX + 1, y: targetY },
      { x: targetX - 1, y: targetY },
      { x: targetX + 1, y: targetY + 1 },
      { x: targetX - 1, y: targetY + 1 },
      { x: targetX + 1, y: targetY - 1 },
      { x: targetX - 1, y: targetY - 1 },
    ].filter(pt => !collisions.has(`${pt.x},${pt.y}`));

    if (candidates.length > 0 && this.player) {
      candidates.sort((a, b) =>
        Math.hypot(a.x - this.player!.x, a.y - this.player!.y) -
        Math.hypot(b.x - this.player!.x, b.y - this.player!.y)
      );
      return candidates[0];
    }
    return { x: targetX, y: targetY };
  }

  private getPlayerCombatStyle(): 'melee' | 'ranged' | 'magic' {
    if (!this.player) return 'melee';
    const weapon = this.player.equipment?.weapon;
    if (weapon) {
      const def = ITEMS[weapon.itemId];
      if (def?.equipReq?.skill === 'ranged' || def?.id.includes('bow')) return 'ranged';
      if (def?.equipReq?.skill === 'magic' || def?.id.includes('staff') || def?.id.includes('wand')) return 'magic';
    }
    return 'melee';
  }

  private getCombatMaxRange(): number {
    const style = this.getPlayerCombatStyle();
    return (style === 'ranged' || style === 'magic') ? 4.5 : 1.5;
  }

  private getHearthLocation(playerX?: number, playerY?: number): { x: number; y: number } {
    const hearthNodes = this.worldNodes.filter(n =>
      n.type === 'hearth_counter' ||
      n.id === 'hearth_bank' ||
      (n.name && (n.name.toLowerCase().includes('storage counter') || n.name.toLowerCase().includes('bank counter')))
    );

    if (hearthNodes.length === 0) {
      return { x: 8, y: 22 };
    }

    if (playerX !== undefined && playerY !== undefined) {
      let nearest = hearthNodes[0];
      let minDist = Math.hypot(playerX - nearest.x, playerY - nearest.y);
      for (let i = 1; i < hearthNodes.length; i++) {
        const d = Math.hypot(playerX - hearthNodes[i].x, playerY - hearthNodes[i].y);
        if (d < minDist) {
          minDist = d;
          nearest = hearthNodes[i];
        }
      }
      return { x: nearest.x, y: nearest.y };
    }

    return { x: hearthNodes[0].x, y: hearthNodes[0].y };
  }

  private setupTasksCard() {
    document.getElementById('task-stop-btn')!.onclick = () => {
      this.sendWs({ type: 'STOP_TASK' });
    };

    document.getElementById('task-home-btn')!.onclick = () => {
      this.sendWs({ type: 'STOP_TASK' });
      const hearth = this.getHearthLocation(this.player?.x, this.player?.y);
      this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
      this.openStorageModal();
    };
  }

  private setupRightToolbar() {
    const buttons = document.querySelectorAll('.tool-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.getAttribute('data-panel');
        if (panel === 'chat') {
          this.toggleChat();
          return;
        }

        if (panel === 'editor') {
          if (this.player && this.player.role === 'admin') {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.switchDrawer('editor');
          } else {
            this.showToast('World Editor is restricted to server administrators.');
          }
          return;
        }

        if (panel === 'storage') {
          this.openStorageModal();
          return;
        }

        if (panel === 'leaderboard') {
          this.openLeaderboardModal();
          return;
        }

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (panel === 'skills' || panel === 'inventory' || panel === 'equipment') {
          this.switchDrawer(panel);
        }
      });
    });

    document.getElementById('btn-quick-fight')!.onclick = () => {
      this.openCombatDirectory();
    };

    document.getElementById('btn-quick-home')!.onclick = () => {
      const hearth = this.getHearthLocation(this.player?.x, this.player?.y);
      this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
      this.openStorageModal();
    };
  }

  private switchDrawer(drawer: 'skills' | 'inventory' | 'equipment' | 'storage' | 'editor') {
    if (drawer === 'storage') {
      this.openStorageModal();
      return;
    }

    this.activeDrawer = drawer;

    const drawers = [
      { id: 'skills', el: document.getElementById('skills-drawer') },
      { id: 'inventory', el: document.getElementById('inventory-drawer') },
      { id: 'equipment', el: document.getElementById('equipment-drawer') },
      { id: 'storage', el: document.getElementById('storage-drawer') },
      { id: 'editor', el: document.getElementById('admin-editor-drawer') },
    ];
    for (const d of drawers) {
      if (d.el) {
        if (d.id === drawer) d.el.classList.remove('hidden');
        else d.el.classList.add('hidden');
      }
    }

    // Update active icon on toolbar
    const buttons = document.querySelectorAll('.tool-btn');
    buttons.forEach(b => {
      if (b.getAttribute('data-panel') === drawer) b.classList.add('active');
      else if (b.getAttribute('data-panel') !== 'chat') b.classList.remove('active');
    });

    this.updatePopupPosition();

    if (drawer !== 'editor') {
      this.renderer.editorMode = 'none';
      this.renderer.showCollisions = false;
      this.renderer.selectedNodeId = null;
      this.renderer.onEditorNodeClick = undefined;
      const chk = document.getElementById('chk-show-collisions') as HTMLInputElement | null;
      if (chk) chk.checked = false;
      const btnPaint = document.getElementById('btn-brush-paint');
      const btnErase = document.getElementById('btn-brush-erase');
      if (btnPaint) btnPaint.classList.remove('active');
      if (btnErase) btnErase.classList.remove('active');
    } else {
      this.renderer.onEditorNodeClick = (node) => this.selectNodeForEditing(node);
    }

    if (this.player) {
      if (drawer === 'skills') this.renderSkillsDrawer();
      else if (drawer === 'inventory') this.renderInventoryDrawer();
      else if (drawer === 'equipment') this.renderEquipmentDrawer();
    }
  }

  private renderSkillsDrawer() {
    if (!this.player) return;

    this.renderSkillCategoryGroup('skills-gathering', GATHERING_SKILLS);
    this.renderSkillCategoryGroup('skills-crafting', CRAFTING_SKILLS);
    this.renderSkillCategoryGroup('skills-combat', COMBAT_SKILLS);
  }

  private renderSkillCategoryGroup(containerId: string, skills: SkillType[]) {
    const container = document.getElementById(containerId);
    if (!container || !this.player) return;
    container.innerHTML = '';

    for (const skillKey of skills) {
      const record = this.player.skills[skillKey] || { level: 1, xp: 0 };
      const { percent } = getXpToNextLevel(record.level, record.xp);

      const card = document.createElement('div');
      card.className = `skill-card-compact ${this.selectedSkillKey === skillKey && this.isPopupOpen ? 'active' : ''}`;

      const cleanName = skillKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

      card.innerHTML = `
        <div class="skill-card-row">
          <div class="skill-card-title-group">
            <span class="skill-card-icon">${ICONS[skillKey] || ICONS.skills}</span>
            <span class="skill-card-name">${cleanName}</span>
          </div>
          <span class="skill-card-lvl">${record.level}</span>
        </div>
        <div class="skill-groove">
          <div class="skill-groove-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="skill-card-row">
          <span class="skill-card-pct">${percent.toFixed(2)}%</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (COMBAT_SKILLS.includes(skillKey)) {
          this.openCombatDirectory(skillKey);
        } else {
          this.openSkillJobPopup(skillKey);
        }
      });

      this.attachSkillTooltip(card, skillKey);

      container.appendChild(card);
    }
  }

  private setupSkillJobPopup() {
    document.getElementById('popup-close-btn')!.onclick = () => {
      this.closeSkillJobPopup();
    };

    // HOW MANY quantity buttons
    const qtyPills = document.querySelectorAll('.qty-pill');
    const customInput = document.getElementById('qty-custom-input') as HTMLInputElement | null;

    qtyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        qtyPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const q = pill.getAttribute('data-qty');
        if (q === 'custom') {
          if (customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
            const val = parseInt(customInput.value, 10);
            this.selectedJobQuantity = !isNaN(val) && val > 0 ? val : 50;
            if (!customInput.value) customInput.value = '50';
          }
        } else {
          if (customInput) {
            customInput.classList.add('hidden');
          }
          this.selectedJobQuantity = q === 'Infinity' ? Infinity : parseInt(q || '1', 10);
        }
        this.syncJobQuantityUI();
      });
    });

    if (customInput) {
      customInput.addEventListener('input', () => {
        const val = parseInt(customInput.value, 10);
        this.selectedJobQuantity = !isNaN(val) && val > 0 ? val : 1;
        qtyPills.forEach(p => p.classList.remove('active'));
        document.getElementById('qty-pill-custom')?.classList.add('active');
        this.syncJobQuantityUI();
      });
    }

    // Start button
    document.getElementById('btn-job-start')!.onclick = () => {
      if (!this.selectedRecipeId) return;
      const rec = RECIPES[this.selectedRecipeId];
      if (!rec) return;

      const playerLvl = this.player?.skills[rec.skill]?.level || 1;
      if (playerLvl < rec.levelReq) {
        this.showToast(`Requires ${rec.skill} Lv ${rec.levelReq}!`);
        return;
      }

      let matchingNode: WorldNodeDisplay | undefined;
      if (rec.skill === 'cooking') {
        matchingNode = this.worldNodes.find(n => n.type === 'fire');
        if (!matchingNode) {
          this.showToast('No Firepit found in the realm. Place one via Admin Editor.');
          return;
        }
      } else if (rec.skill === 'smithing') {
        matchingNode = this.worldNodes.find(n => n.type === 'forge');
        if (!matchingNode) {
          this.showToast('No Runeforge found in the realm. Place one via Admin Editor.');
          return;
        }
      } else if (rec.skill === 'farming' || rec.skill === 'herbalism') {
        const farmNodes = this.worldNodes.filter(n => n.type === 'farm');
        if (farmNodes.length === 0) {
          this.showToast('No farm plot found in the realm. Place one via Admin Editor.');
          return;
        }
        if (this.selectedStationNode && this.selectedStationNode.type === 'farm') {
          matchingNode = this.selectedStationNode;
        } else {
          farmNodes.sort((a, b) => Math.hypot(this.player!.x - a.x, this.player!.y - a.y) - Math.hypot(this.player!.x - b.x, this.player!.y - b.y));
          matchingNode = farmNodes[0];
        }
      } else if (rec.skill === 'crafting' || rec.skill === 'fletching') {
        const wbNodes = this.worldNodes.filter(n => n.type === 'workbench');
        if (wbNodes.length === 0) {
          this.showToast("No Artisan's Workbench found in the realm. Place one via Admin Editor.");
          return;
        }
        if (this.selectedStationNode && this.selectedStationNode.type === 'workbench') {
          matchingNode = this.selectedStationNode;
        } else {
          wbNodes.sort((a, b) => Math.hypot(this.player!.x - a.x, this.player!.y - a.y) - Math.hypot(this.player!.x - b.x, this.player!.y - b.y));
          matchingNode = wbNodes[0];
        }
      } else if (rec.skill === 'alchemy') {
        const cauldronNodes = this.worldNodes.filter(n => n.type === 'cauldron');
        if (cauldronNodes.length === 0) {
          this.showToast('No Apothecary Cauldron found in the realm. Place one via Admin Editor.');
          return;
        }
        if (this.selectedStationNode && this.selectedStationNode.type === 'cauldron') {
          matchingNode = this.selectedStationNode;
        } else {
          cauldronNodes.sort((a, b) => Math.hypot(this.player!.x - a.x, this.player!.y - a.y) - Math.hypot(this.player!.x - b.x, this.player!.y - b.y));
          matchingNode = cauldronNodes[0];
        }
      } else if (rec.skill === 'attunement') {
        const monoNodes = this.worldNodes.filter(n => n.type === 'monolith');
        if (monoNodes.length === 0) {
          this.showToast('No Aether Monolith found in the realm. Place one via Admin Editor.');
          return;
        }
        if (this.selectedStationNode && this.selectedStationNode.type === 'monolith') {
          matchingNode = this.selectedStationNode;
        } else {
          monoNodes.sort((a, b) => Math.hypot(this.player!.x - a.x, this.player!.y - a.y) - Math.hypot(this.player!.x - b.x, this.player!.y - b.y));
          matchingNode = monoNodes[0];
        }
      } else if (rec.skill === 'thieving') {
        matchingNode = this.worldNodes.find(n => n.recipeId === rec.id || (n.type === 'stall' && n.id.includes(rec.id.replace('thieve_', ''))));
      } else {
        matchingNode = this.worldNodes.find(n => n.recipeId === rec.id);
      }

      let targetX = this.player!.x;
      let targetY = this.player!.y;
      let nodeX = targetX;
      let nodeY = targetY;

      if (matchingNode) {
        nodeX = matchingNode.x;
        nodeY = matchingNode.y;
        const dist = Math.hypot(this.player!.x - matchingNode.x, this.player!.y - matchingNode.y);
        const walkable = dist <= 1.5
          ? { x: Math.round(this.player!.x), y: Math.round(this.player!.y) }
          : this.getAdjacentWalkableTile(matchingNode.x, matchingNode.y);
        targetX = walkable.x;
        targetY = walkable.y;
      }

      this.sendWs({
        type: 'START_TASK',
        recipeId: rec.id,
        quantity: this.selectedJobQuantity === Infinity ? -1 : this.selectedJobQuantity,
        targetX,
        targetY,
        nodeX,
        nodeY,
      });

      this.closeSkillJobPopup();
    };

    // Queue button
    const btnEnqueue = document.getElementById('btn-job-enqueue');
    if (btnEnqueue) {
      btnEnqueue.onclick = () => {
        if (!this.selectedRecipeId) return;
        const rec = RECIPES[this.selectedRecipeId];
        if (!rec) return;

        const playerLvl = this.player?.skills[rec.skill]?.level || 1;
        if (playerLvl < rec.levelReq) {
          this.showToast(`Requires ${rec.skill} Lv ${rec.levelReq}!`);
          return;
        }

        let targetX = this.player!.x;
        let targetY = this.player!.y;
        let nodeX = targetX;
        let nodeY = targetY;

        let matchingNode: WorldNodeDisplay | undefined;
        if (rec.skill === 'cooking') {
          matchingNode = this.worldNodes.find(n => n.type === 'fire');
        } else if (rec.skill === 'smithing') {
          matchingNode = this.worldNodes.find(n => n.type === 'forge');
        } else if (rec.skill === 'crafting' || rec.skill === 'fletching') {
          matchingNode = this.worldNodes.find(n => n.type === 'workbench');
        } else if (rec.skill === 'alchemy') {
          matchingNode = this.worldNodes.find(n => n.type === 'cauldron');
        } else if (rec.skill === 'attunement') {
          matchingNode = this.worldNodes.find(n => n.type === 'monolith');
        } else {
          matchingNode = this.worldNodes.find(n => n.recipeId === rec.id);
        }

        if (matchingNode) {
          nodeX = matchingNode.x;
          nodeY = matchingNode.y;
          const dist = Math.hypot(this.player!.x - matchingNode.x, this.player!.y - matchingNode.y);
          const walkable = dist <= 1.5
            ? { x: Math.round(this.player!.x), y: Math.round(this.player!.y) }
            : this.getAdjacentWalkableTile(matchingNode.x, matchingNode.y);
          targetX = walkable.x;
          targetY = walkable.y;
        }

        this.sendWs({
          type: 'ENQUEUE_TASK',
          recipeId: rec.id,
          quantity: this.selectedJobQuantity === Infinity ? -1 : this.selectedJobQuantity,
          targetX,
          targetY,
          nodeX,
          nodeY,
          targetLabel: rec.name,
        });

        this.closeSkillJobPopup();
      };
    }

    // Stop button
    document.getElementById('btn-job-stop')!.onclick = () => {
      this.pendingMonsterTarget = null;
      this.sendWs({ type: 'STOP_TASK' });
    };

    window.addEventListener('resize', () => this.updatePopupPosition());
    const drawerObserver = new MutationObserver(() => this.updatePopupPosition());
    document.querySelectorAll('.drawer-panel').forEach(panel => {
      drawerObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
    });
  }

  private getRecipeCategory(recipe: RecipeDefinition): { id: string; name: string; icon: string } {
    const item = ITEMS[recipe.outputItemId];

    if (recipe.skill === 'smithing') {
      if (item?.category === 'bar') return { id: 'ingots', name: 'Ingots', icon: 'anvil' };
      if (item?.category === 'weapon') return { id: 'weapons', name: 'Weapons', icon: 'sword' };
      if (item?.category === 'armour') {
        if (item.slot === 'helmet') return { id: 'helmets', name: 'Helmets', icon: 'helmet' };
        if (item.slot === 'body') return { id: 'chestplates', name: 'Chestplates', icon: 'body' };
        if (item.slot === 'legs') return { id: 'greaves', name: 'Greaves', icon: 'legs' };
        if (item.slot === 'shield') return { id: 'shields', name: 'Shields', icon: 'shield' };
      }
      if (item?.category === 'tool') return { id: 'tools', name: 'Tools', icon: 'pickaxe' };
      return { id: 'forging', name: 'Forging', icon: 'smithing' };
    }

    if (recipe.skill === 'crafting') {
      if (item?.id.includes('grimoire') || item?.slot === 'shield') return { id: 'grimoires', name: 'Grimoires', icon: 'magic' };
      if (item?.id.includes('gem') || item?.category === 'relic') return { id: 'gems', name: 'Gems', icon: 'gems' };
      if (item?.category === 'armour') return { id: 'leather', name: 'Armour', icon: 'body' };
      return { id: 'artisan', name: 'Artisan', icon: 'crafting' };
    }

    if (recipe.skill === 'fletching') {
      if (item?.category === 'weapon' && item.id.includes('shortbow')) return { id: 'bows', name: 'Bows', icon: 'ranged' };
      if (item?.category === 'weapon' && item.id.includes('staff')) return { id: 'staves', name: 'Staves', icon: 'magic' };
      if (item?.category === 'armour' || item?.slot === 'shield' || item?.id.includes('quiver')) return { id: 'quivers', name: 'Quivers', icon: 'shield' };
      if (item?.category === 'tool' || item?.id.includes('rod')) return { id: 'rods', name: 'Rods', icon: 'fishing' };
      return { id: 'woodworking', name: 'Fletching', icon: 'fletching' };
    }

    if (recipe.skill === 'cooking') {
      if (['cook_prawn', 'cook_minnow', 'cook_trout', 'cook_salmon'].includes(recipe.id)) {
        return { id: 'freshwater', name: 'Freshwater', icon: 'fishing' };
      }
      return { id: 'abyssal', name: 'Deep Sea', icon: 'cooking' };
    }

    if (recipe.skill === 'alchemy') {
      if (recipe.id.includes('predator') || recipe.id.includes('warmaster')) return { id: 'combat', name: 'Combat', icon: 'sword' };
      if (recipe.id.includes('zephyr') || recipe.id.includes('restorative')) return { id: 'vitality', name: 'Potions', icon: 'alchemy' };
      return { id: 'specialty', name: 'Elixirs', icon: 'alchemy' };
    }

    if (recipe.skill === 'attunement') {
      if (recipe.levelReq <= 30) return { id: 'foci', name: 'Foci', icon: 'sparkles' };
      return { id: 'sigils', name: 'Sigils', icon: 'attunement' };
    }

    if (recipe.skill === 'farming') {
      if (['farm_earthtuber', 'farm_deep_radish', 'farm_nether_gourd'].includes(recipe.id)) {
        return { id: 'crops', name: 'Crops', icon: 'farming' };
      }
      return { id: 'herbs', name: 'Herbs', icon: 'herbalism' };
    }

    if (recipe.skill === 'herbalism') {
      if (recipe.levelReq <= 45) return { id: 'medicinal', name: 'Medicinal', icon: 'herbalism' };
      return { id: 'arcane', name: 'Arcane', icon: 'sparkles' };
    }

    if (recipe.skill === 'thieving') {
      if (['thieve_bakery', 'thieve_produce'].includes(recipe.id)) return { id: 'produce', name: 'Produce Stalls', icon: 'farming' };
      return { id: 'vaults', name: 'Vaults', icon: 'lock' };
    }

    if (recipe.skill === 'mining') {
      if (recipe.levelReq <= 30) return { id: 'common_ores', name: 'Common Ores', icon: 'mining' };
      return { id: 'rare_ores', name: 'Rare Veins', icon: 'mining' };
    }

    if (recipe.skill === 'woodcutting') {
      if (recipe.levelReq <= 30) return { id: 'common_timber', name: 'Common Timber', icon: 'woodcutting' };
      return { id: 'spirit_timber', name: 'Spirit Timber', icon: 'woodcutting' };
    }

    if (recipe.skill === 'fishing') {
      if (recipe.levelReq <= 30) return { id: 'shallows', name: 'Shallows', icon: 'fishing' };
      return { id: 'deep_sea', name: 'Deep Sea', icon: 'fishing' };
    }

    return { id: 'general', name: 'General', icon: 'smithing' };
  }

  private openSkillJobPopup(skillKey: SkillType, selectRecipeId?: string) {
    if (COMBAT_SKILLS.includes(skillKey)) {
      this.openCombatDirectory(skillKey);
      return;
    }

    this.selectedSkillKey = skillKey;
    this.isPopupOpen = true;

    const popup = document.getElementById('skill-job-popup')!;
    popup.classList.remove('hidden');
    this.updatePopupPosition();

    if (selectRecipeId) {
      this.selectedRecipeId = selectRecipeId;
      const rec = RECIPES[selectRecipeId];
      if (rec) {
        this.selectedSkillCategory = this.getRecipeCategory(rec).id;
      }
    } else {
      this.selectedSkillCategory = null;
      // Default to first available unlocked recipe
      const available = Object.values(RECIPES).filter(r => r.skill === skillKey);
      if (available.length > 0) {
        this.selectedRecipeId = available[0].id;
      }
    }

    this.updateSkillJobPopup();
    this.renderSkillsDrawer();
  }

  private openCombatDirectory(focusedSkill: SkillType = 'melee') {
    this.selectedSkillKey = focusedSkill;
    this.isPopupOpen = true;

    const popup = document.getElementById('skill-job-popup')!;
    popup.classList.remove('hidden');
    this.updatePopupPosition();

    this.updateCombatDirectory(focusedSkill);
    this.renderSkillsDrawer();
  }

  private updateCombatDirectory(focusedSkill: SkillType = 'melee') {
    if (!this.player) return;
    this.updatePopupPosition();
    const cleanName = focusedSkill.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    const record = this.player.skills[focusedSkill] || { level: 1, xp: 0 };
    const { percent } = getXpToNextLevel(record.level, record.xp);

    const isFighting = Boolean(this.player.currentTask && (this.player.currentTask.skill as string) === 'combat');
    const activeMobId = isFighting ? this.player.currentTask?.recipeId : null;

    // Header & Titles
    document.getElementById('popup-selected-title')!.textContent = `${cleanName} ${record.level}`;
    document.getElementById('popup-header-sub')!.textContent = `${cleanName} ${record.level} · ${percent.toFixed(2)}% to ${record.level + 1}`;
    document.getElementById('popup-skill-heading')!.textContent = `Monster Habitats & Hunting`;
    document.getElementById('popup-skill-desc')!.textContent = `Travel to wild creature territories across Eldoria. Engage quarry in combat to gain combat experience, pelts, and rare treasures.`;

    const statusPill = document.getElementById('popup-status-pill')!;
    if (isFighting) {
      statusPill.textContent = 'fighting';
      statusPill.className = 'status-pill';
      statusPill.style.background = '#9b2c2c';
    } else {
      statusPill.textContent = 'idle';
      statusPill.className = 'status-pill';
      statusPill.style.background = '#4a2f1a';
    }

    const nextGoalEl = document.getElementById('popup-next-text')!;
    nextGoalEl.textContent = `Habitats: The Murkwarrens (Lv 2) to Sunken Barrow (Lv 12)`;

    const jobsHeading = document.getElementById('popup-jobs-heading')!;
    if (jobsHeading) jobsHeading.textContent = `Huntable Foes & Habitats`;

    // Footer adjustments for combat
    const howManyRow = document.querySelector('.how-many-row') as HTMLElement | null;
    if (howManyRow) howManyRow.style.display = 'flex';

    const btnStart = document.getElementById('btn-job-start') as HTMLElement | null;
    if (btnStart) btnStart.style.display = 'none';

    const btnStop = document.getElementById('btn-job-stop') as HTMLElement | null;
    if (btnStop) {
      btnStop.style.display = isFighting ? 'inline-block' : 'none';
      btnStop.textContent = 'Flee Combat';
    }

    const popupNote = document.getElementById('popup-job-note');
    if (popupNote) {
      if (this.selectedJobQuantity === Infinity) {
        popupNote.textContent = 'Continuous idle (∞): automatically hunts in territory and auto-banks spoils at the Hearth.';
      } else {
        popupNote.textContent = `Will slay exactly ${this.selectedJobQuantity} foe${this.selectedJobQuantity === 1 ? '' : 's'} (auto-banking if full), then stop.`;
      }
    }

    // Foes list
    const jobsContainer = document.getElementById('popup-jobs-list')!;
    jobsContainer.innerHTML = '';

    const monstersList = Object.values(MONSTERS).sort((a, b) => a.level - b.level);
    for (const mob of monstersList) {
      const matchingNodes = this.worldNodes.filter(n => n.type === 'monster' && n.monsterId === mob.id);
      const hasNodes = matchingNodes.length > 0;
      const isTargeted = Boolean(activeMobId === mob.id);

      const itemEl = document.createElement('div');
      itemEl.className = `popup-job-item combat-job-item ${isTargeted ? 'selected' : ''}`;

      let dropsSummary = '';
      if (mob.guaranteedDropItemId) {
        dropsSummary += ITEMS[mob.guaranteedDropItemId]?.name || mob.guaranteedDropItemId;
      }
      dropsSummary += (dropsSummary ? ' · ' : '') + `${mob.minCoins}-${mob.maxCoins} coins`;
      if (mob.rareDrop && ITEMS[mob.rareDrop.itemId]) {
        dropsSummary += ` · Rare: ${ITEMS[mob.rareDrop.itemId].name}`;
      }

      const fightLabel = isTargeted
        ? 'Engaged'
        : (this.selectedJobQuantity === Infinity ? 'Fight (∞)' : `Fight (${this.selectedJobQuantity})`);

      itemEl.innerHTML = `
        <div class="job-item-icon-box" style="background: #1c0e08; border-color: ${isTargeted ? '#e53e3e' : '#844c27'}; color: #feb2b2;">
          ${ICONS.sword}
        </div>
        <div class="job-item-body">
          <div class="job-name-wrap">
            <span style="font-weight: 700; color: #ffd699;">${mob.name}</span>
            <span style="font-size: 0.7rem; font-weight: 700; color: #feb2b2; background: rgba(155, 44, 44, 0.4); padding: 1px 5px; border-radius: 3px; border: 1px solid #742a2a;">Lv ${mob.level}</span>
            <span style="font-size: 0.7rem; color: #a0aec0; margin-left: 2px;">· ${mob.zone}</span>
          </div>
          <div class="job-details" style="color: #cbd5e0; margin-top: 2px;">
            <span style="color: #68d391; font-weight: 600;">${mob.hp} HP</span> · Max Hit: <b style="color: #fc8181;">${mob.maxHit}</b> · Spd: ${mob.swingSpeedSeconds}s · <span style="color: #f6ad55;">+${mob.xp} XP</span>
          </div>
          <div class="job-details" style="color: #9c8a79; font-size: 0.68rem; margin-top: 2px;">
            Drops: <span style="color: #e2e8f0;">${dropsSummary}</span>
          </div>
        </div>
        <div class="job-item-side" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 4px;">
          <button class="btn-start btn-fight-foe" type="button" style="padding: 4px 10px; font-size: 0.74rem; white-space: nowrap; ${isTargeted ? 'background: #9b2c2c;' : ''}">
            ${fightLabel}
          </button>
          <button class="btn-queue btn-queue-foe" type="button" style="padding: 2px 8px; font-size: 0.68rem; white-space: nowrap;">
            Queue
          </button>
          ${hasNodes ? `<span style="font-size: 0.65rem; color: #718096;">${matchingNodes.length} in habitat</span>` : `<span style="font-size: 0.65rem; color: #718096;">Uncharted</span>`}
        </div>
      `;

      itemEl.querySelector('.btn-queue-foe')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const qty = (typeof this.selectedJobQuantity === 'number' && this.selectedJobQuantity > 0 && this.selectedJobQuantity !== Infinity)
          ? this.selectedJobQuantity
          : 50;
        this.sendWs({
          type: 'ENQUEUE_TASK',
          monsterId: mob.id,
          quantity: qty,
          targetLabel: `Hunt ${mob.name}`,
        });
        this.closeSkillJobPopup();
      });

      itemEl.querySelector('.btn-fight-foe')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const qty = (typeof this.selectedJobQuantity === 'number' && this.selectedJobQuantity > 0 && this.selectedJobQuantity !== Infinity)
          ? this.selectedJobQuantity
          : undefined;
        this.huntMonster(mob.id, qty);
      });

      itemEl.addEventListener('click', () => {
        const qty = (typeof this.selectedJobQuantity === 'number' && this.selectedJobQuantity > 0 && this.selectedJobQuantity !== Infinity)
          ? this.selectedJobQuantity
          : undefined;
        this.huntMonster(mob.id, qty);
      });

      jobsContainer.appendChild(itemEl);
    }
  }

  private huntMonster(monsterId: string, quantity?: number) {
    const mobDef = MONSTERS[monsterId];
    if (!mobDef) return;

    const matchingNodes = this.worldNodes.filter(n => n.type === 'monster' && n.monsterId === monsterId);
    if (matchingNodes.length === 0) {
      this.showToast(`No habitat found for ${mobDef.name} yet.`);
      return;
    }

    // Sort by proximity to player to pick the closest one in the cluster
    const px = this.player?.x ?? 0;
    const py = this.player?.y ?? 0;
    matchingNodes.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    const targetNode = matchingNodes[0];

    const maxRange = this.getCombatMaxRange();
    const dist = Math.hypot(px - targetNode.x, py - targetNode.y);

    if (dist <= maxRange) {
      this.pendingMonsterTarget = null;
      this.pendingMonsterQuantity = undefined;
      this.sendWs({
        type: 'START_COMBAT',
        nodeId: targetNode.id,
        monsterId: targetNode.monsterId || monsterId,
        targetX: targetNode.x,
        targetY: targetNode.y,
        quantity: (typeof quantity === 'number' && quantity > 0 && quantity !== Infinity) ? quantity : undefined,
      });
      const qtyMsg = (typeof quantity === 'number' && quantity > 0 && quantity !== Infinity) ? ` (${quantity}x)` : '';
      this.showToast(`Engaging ${targetNode.name}${qtyMsg} in ${mobDef.zone}!`);
    } else {
      this.pendingMonsterTarget = targetNode;
      this.pendingMonsterQuantity = (typeof quantity === 'number' && quantity > 0 && quantity !== Infinity) ? quantity : undefined;
      const targetTile = this.getAdjacentWalkableTile(targetNode.x, targetNode.y);
      this.sendWs({ type: 'MOVE_TO', x: targetTile.x, y: targetTile.y });
      this.showToast(`Traveling to ${mobDef.zone} to hunt ${targetNode.name}...`);
    }

    this.closeSkillJobPopup();
  }

  private closeSkillJobPopup() {
    this.isPopupOpen = false;
    this.selectedSkillCategory = null;
    document.getElementById('skill-job-popup')!.classList.add('hidden');
    this.renderSkillsDrawer();
  }

  private updatePopupPosition() {
    const popup = document.getElementById('skill-job-popup');
    if (!popup || popup.classList.contains('hidden')) return;

    if (window.innerWidth <= 768) {
      popup.style.right = '';
      popup.style.maxWidth = '';
      return;
    }

    // Find the currently active visible drawer panel
    const visibleDrawer = document.querySelector('.drawer-panel:not(.hidden)') as HTMLElement | null;
    if (visibleDrawer) {
      const rect = visibleDrawer.getBoundingClientRect();
      const rightOffset = Math.round(window.innerWidth - rect.left + 12);
      popup.style.right = `${rightOffset}px`;
      popup.style.maxWidth = `${Math.max(260, Math.min(360, rect.left - 20))}px`;
    } else {
      const toolbar = document.getElementById('right-toolbar');
      if (toolbar) {
        const rect = toolbar.getBoundingClientRect();
        const rightOffset = Math.round(window.innerWidth - rect.left + 12);
        popup.style.right = `${rightOffset}px`;
      } else {
        popup.style.right = '48px';
      }
      popup.style.maxWidth = '360px';
    }
  }

  private syncJobQuantityUI() {
    const btnStart = document.getElementById('btn-job-start');
    if (btnStart) {
      btnStart.textContent = this.selectedJobQuantity === Infinity ? 'Start (∞)' : `Start (${this.selectedJobQuantity})`;
    }
    const isCombat = this.selectedSkillKey && COMBAT_SKILLS.includes(this.selectedSkillKey);
    const popupNote = document.getElementById('popup-job-note');
    if (popupNote) {
      if (isCombat) {
        if (this.selectedJobQuantity === Infinity) {
          popupNote.textContent = 'Continuous idle (∞): automatically hunts in territory and auto-banks spoils at the Hearth.';
        } else {
          popupNote.textContent = `Will slay exactly ${this.selectedJobQuantity} foe${this.selectedJobQuantity === 1 ? '' : 's'} (auto-banking if full), then stop.`;
        }
      } else {
        if (this.selectedJobQuantity === Infinity) {
          popupNote.textContent = 'Continuous idle (∞): automatically banks spoils at the Hearth and resumes non-stop.';
        } else {
          popupNote.textContent = `Will craft/gather exactly ${this.selectedJobQuantity} time${this.selectedJobQuantity === 1 ? '' : 's'} (auto-banking if full), then stop.`;
        }
      }
    }
    if (isCombat) {
      // Refresh combat buttons label if currently showing combat directory
      const fightBtns = document.querySelectorAll('.btn-fight-foe');
      fightBtns.forEach(btn => {
        if (btn.textContent?.trim() !== 'Engaged') {
          btn.textContent = this.selectedJobQuantity === Infinity ? 'Fight (∞)' : `Fight (${this.selectedJobQuantity})`;
        }
      });
    }
  }

  private updateSkillJobPopup() {
    if (!this.player) return;
    this.updatePopupPosition();
    const skillKey = this.selectedSkillKey;
    if (COMBAT_SKILLS.includes(skillKey)) {
      this.updateCombatDirectory(skillKey);
      return;
    }

    // Restore standard crafting/gathering popup UI
    const isWorkingOnThisSkill = !!(this.player.currentTask && this.player.currentTask.skill === skillKey);
    const howManyRow = document.querySelector('.how-many-row') as HTMLElement | null;
    if (howManyRow) howManyRow.style.display = 'flex';
    const btnStart = document.getElementById('btn-job-start') as HTMLElement | null;
    if (btnStart) btnStart.style.display = 'inline-block';
    const btnStop = document.getElementById('btn-job-stop') as HTMLElement | null;
    if (btnStop) {
      btnStop.style.display = isWorkingOnThisSkill ? 'inline-block' : 'none';
      btnStop.textContent = 'Stop';
    }
    this.syncJobQuantityUI();
    const jobsHeading = document.getElementById('popup-jobs-heading')!;
    if (jobsHeading) jobsHeading.textContent = 'Jobs & Veins';

    const record = this.player.skills[skillKey] || { level: 1, xp: 0 };
    const { percent } = getXpToNextLevel(record.level, record.xp);
    const cleanName = skillKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Titles
    document.getElementById('popup-selected-title')!.textContent = `${cleanName} ${record.level}`;
    document.getElementById('popup-header-sub')!.textContent = `${cleanName} ${record.level} · ${percent.toFixed(2)}% to ${record.level + 1}`;
    document.getElementById('popup-skill-heading')!.textContent = `${cleanName} ${record.level}`;
    document.getElementById('popup-skill-desc')!.textContent = SKILL_FLAVOR[skillKey] || 'Hone your craft across the realm.';

    // Status pill
    const statusPill = document.getElementById('popup-status-pill')!;
    if (this.player.currentTask && this.player.currentTask.skill === skillKey) {
      statusPill.textContent = 'working';
      statusPill.className = 'status-pill';
    } else {
      statusPill.textContent = 'idle';
      statusPill.className = 'status-pill';
      statusPill.style.background = '#4a2f1a';
    }

    // Next unlock milestone
    const futureRecipes = Object.values(RECIPES)
      .filter(r => r.skill === skillKey && r.levelReq > record.level)
      .sort((a, b) => a.levelReq - b.levelReq);

    const nextGoalEl = document.getElementById('popup-next-text')!;
    if (futureRecipes.length > 0) {
      nextGoalEl.textContent = `Next: ${futureRecipes[0].name} at Lv ${futureRecipes[0].levelReq}`;
    } else {
      nextGoalEl.textContent = 'All trades unlocked';
    }

    // Jobs list
    const jobsContainer = document.getElementById('popup-jobs-list')!;
    jobsContainer.innerHTML = '';

    const skillRecipes = Object.values(RECIPES)
      .filter(r => r.skill === skillKey)
      .sort((a, b) => a.levelReq - b.levelReq);

    if (skillRecipes.length === 0) {
      jobsContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          Train <b>${cleanName}</b> through combat in the wilds and world bosses!
          <div style="margin-top: 10px;">
            <button class="btn-start" id="btn-popup-hunt">Walk to Monster Grounds</button>
          </div>
        </div>
      `;
      document.getElementById('btn-popup-hunt')?.addEventListener('click', () => {
        this.sendWs({ type: 'MOVE_TO', x: 4, y: 44 });
        this.closeSkillJobPopup();
      });
      return;
    }

    // Group recipes into distinct trade categories
    const categoriesMap: Map<string, { id: string; name: string; icon: string; recipes: RecipeDefinition[] }> = new Map();
    for (const r of skillRecipes) {
      const cat = this.getRecipeCategory(r);
      if (!categoriesMap.has(cat.id)) {
        categoriesMap.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, recipes: [] });
      }
      categoriesMap.get(cat.id)!.recipes.push(r);
    }

    // --- CASE A: CATEGORY SELECTION SCREEN ---
    if (categoriesMap.size > 1 && this.selectedSkillCategory === null) {
      jobsHeading.textContent = `${cleanName} Categories`;

      // Hide quantity row and Start button on category overview
      if (howManyRow) howManyRow.style.display = 'none';
      if (btnStart) btnStart.style.display = 'none';
      if (btnStop) {
        btnStop.style.display = isWorkingOnThisSkill ? 'inline-block' : 'none';
        btnStop.textContent = `Stop Active ${cleanName}`;
      }
      const popupNote = document.getElementById('popup-job-note');
      if (popupNote) {
        popupNote.textContent = isWorkingOnThisSkill
          ? `Currently working in ${cleanName}. Select a category above to view items, or stop below.`
          : 'Select a category above to view available crafting projects.';
      }

      const gridEl = document.createElement('div');
      gridEl.className = 'popup-category-grid';

      for (const [catId, cat] of categoriesMap) {
        const unlockedCount = cat.recipes.filter(r => record.level >= r.levelReq).length;
        const minLvl = Math.min(...cat.recipes.map(r => r.levelReq));

        const card = document.createElement('div');
        card.className = 'popup-category-card';
        card.innerHTML = `
          <div class="popup-category-icon-box">
            ${ICONS[cat.icon] || ICONS.smithing}
          </div>
          <div class="popup-category-info">
            <span class="popup-category-title">${cat.name}</span>
            <span class="popup-category-count">${cat.recipes.length} items · ${unlockedCount > 0 ? `${unlockedCount}/${cat.recipes.length} unlocked` : `Req Lv ${minLvl}`}</span>
          </div>
          <div class="popup-category-arrow">
            ${ICONS.chevronRight}
          </div>
        `;

        card.addEventListener('click', () => {
          this.selectedSkillCategory = catId;
          const firstUnlocked = cat.recipes.find(r => record.level >= r.levelReq) || cat.recipes[0];
          this.selectedRecipeId = firstUnlocked.id;
          this.updateSkillJobPopup();
        });

        gridEl.appendChild(card);
      }

      jobsContainer.appendChild(gridEl);
      return;
    }

    // --- CASE B: CATEGORY DETAIL VIEW ---
    let recipesToDisplay = skillRecipes;
    if (categoriesMap.size > 1 && this.selectedSkillCategory !== null) {
      const currentCat = categoriesMap.get(this.selectedSkillCategory);
      if (currentCat) {
        recipesToDisplay = currentCat.recipes;
        jobsHeading.textContent = `${cleanName} > ${currentCat.name}`;

        const backBar = document.createElement('div');
        backBar.className = 'popup-category-back-bar';
        backBar.innerHTML = `
          <button type="button" class="btn-category-back" id="btn-category-back">
            ${ICONS.arrowLeft} Back to Categories
          </button>
          <span class="popup-category-breadcrumb">${currentCat.name} (${currentCat.recipes.length})</span>
        `;
        backBar.querySelector('#btn-category-back')?.addEventListener('click', () => {
          this.selectedSkillCategory = null;
          this.updateSkillJobPopup();
        });
        jobsContainer.appendChild(backBar);
      } else {
        this.selectedSkillCategory = null;
      }
    }

    const popupNote = document.getElementById('popup-job-note');
    if (popupNote) popupNote.textContent = 'Continuous idle (∞): automatically banks spoils at the Hearth and resumes non-stop.';

    // If currently selected recipe is not in this category, pick the first valid recipe
    if (!recipesToDisplay.some(r => r.id === this.selectedRecipeId)) {
      const firstUnlocked = recipesToDisplay.find(r => record.level >= r.levelReq) || recipesToDisplay[0];
      if (firstUnlocked) {
        this.selectedRecipeId = firstUnlocked.id;
      }
    }

    for (const recipe of recipesToDisplay) {
      const isUnlocked = record.level >= recipe.levelReq;
      const isSelected = this.selectedRecipeId === recipe.id;

      const itemEl = document.createElement('div');
      itemEl.className = `popup-job-item ${isSelected ? 'selected' : ''} ${isUnlocked ? '' : 'locked'}`;

      // Calculate how many player can make from bank + inventory
      let canMakeText = '';
      if (recipe.inputs && recipe.inputs.length > 0) {
        let maxBatches = Infinity;
        for (const inp of recipe.inputs) {
          const inInv = this.player.inventory.find(s => s.itemId === inp.itemId)?.quantity || 0;
          const inBank = this.player.storage.find(s => s.itemId === inp.itemId)?.quantity || 0;
          const totalInp = inInv + inBank;
          const batches = Math.floor(totalInp / inp.quantity);
          if (batches < maxBatches) maxBatches = batches;
        }
        canMakeText = isUnlocked ? `<div class="job-can-make">${maxBatches} to make</div>` : '';
      }

      let detailsText = '';
      if (recipe.inputs && recipe.inputs.length > 0) {
        detailsText = recipe.inputs.map(i => `${i.quantity}x ${ITEMS[i.itemId]?.name || i.itemId}`).join(', ');
      } else {
        detailsText = 'Gathers raw materials from world node';
      }

      const xpHour = Math.round((recipe.xp / Math.max(0.6, recipe.intervalSeconds)) * 3600);
      const rateText = isUnlocked 
        ? `+${recipe.xp} XP (${xpHour.toLocaleString()} xp/h)` 
        : `<span style="color:#e53e3e;">Lv ${recipe.levelReq}</span>`;

      // Find matching world node if one exists for direct recipe, universal station, or its primary input
      let matchingNode: WorldNodeDisplay | undefined;
      if (recipe.skill === 'cooking') {
        matchingNode = this.worldNodes.find(n => n.type === 'fire');
      } else if (recipe.skill === 'smithing') {
        matchingNode = this.worldNodes.find(n => n.type === 'forge');
      } else if (recipe.skill === 'farming' || recipe.skill === 'herbalism') {
        matchingNode = this.worldNodes.find(n => n.type === 'farm');
      } else if (recipe.skill === 'crafting' || recipe.skill === 'fletching') {
        matchingNode = this.worldNodes.find(n => n.type === 'workbench');
      } else if (recipe.skill === 'alchemy') {
        matchingNode = this.worldNodes.find(n => n.type === 'cauldron');
      } else if (recipe.skill === 'attunement') {
        matchingNode = this.worldNodes.find(n => n.type === 'monolith');
      } else if (recipe.skill === 'thieving') {
        matchingNode = this.worldNodes.find(n => n.recipeId === recipe.id || (n.type === 'stall' && n.id.includes(recipe.id.replace('thieve_', ''))));
      } else {
        matchingNode = this.worldNodes.find(n => n.recipeId === recipe.id);
        if (!matchingNode && recipe.inputs && recipe.inputs.length > 0) {
          const inputId = recipe.inputs[0].itemId;
          const sourceRecipe = Object.values(RECIPES).find(r => r.outputItemId === inputId);
          if (sourceRecipe) {
            matchingNode = this.worldNodes.find(n => n.recipeId === sourceRecipe.id);
          }
        }
      }

      const iconSvg = recipe.outputItemId ? getItemIconSvg(recipe.outputItemId, ITEMS[recipe.outputItemId]?.category) : (ICONS[recipe.skill] || ICONS.skills);

      itemEl.innerHTML = `
        <div class="job-item-icon-box">
          ${iconSvg}
        </div>
        <div class="job-item-body">
          <div class="job-name-wrap">
            <span>${recipe.name}</span>
            ${matchingNode ? `<button class="btn-job-where" type="button" title="Walk to node">Where?</button>` : ''}
          </div>
          <div class="job-details">${detailsText}</div>
        </div>
        <div class="job-item-side">
          <span class="job-rate">${rateText}</span>
          ${canMakeText}
        </div>
      `;

      const whereBtn = itemEl.querySelector('.btn-job-where');
      if (whereBtn && matchingNode) {
        const nodeToTarget = matchingNode;
        whereBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sendWs({ type: 'MOVE_TO', x: nodeToTarget.x, y: nodeToTarget.y });
          this.showToast(`Traveling to ${nodeToTarget.name || recipe.name} (${nodeToTarget.x}, ${nodeToTarget.y})`);
          this.closeSkillJobPopup();
        });
      }

      if (isUnlocked) {
        itemEl.addEventListener('click', () => {
          this.selectedRecipeId = recipe.id;
          this.updateSkillJobPopup();
        });
      } else {
        itemEl.addEventListener('click', () => {
          this.showToast(`Locked: Requires ${recipe.skill.replace('_', ' ')} Level ${recipe.levelReq}!`);
        });
      }

      jobsContainer.appendChild(itemEl);
    }
  }

  private renderInventoryDrawer() {
    if (!this.player) return;
    const grid = document.getElementById('inventory-grid')!;
    grid.innerHTML = '';
    document.getElementById('inv-count')!.textContent = this.player.inventory.length.toString();

    const hearth = this.getHearthLocation(this.player.x, this.player.y);
    const isNearHearth = Math.hypot(this.player.x - hearth.x, this.player.y - hearth.y) <= 1.5;
    const btnDepositInv = document.getElementById('btn-inv-deposit-all');
    if (btnDepositInv) {
      btnDepositInv.textContent = isNearHearth ? 'Deposit All Spoils' : 'Deposit All Spoils (Travel to Hearth)';
    }

    for (let i = 0; i < 28; i++) {
      const slot = this.player.inventory[i];
      const slotEl = document.createElement('div');
      slotEl.className = 'rpg-slot';

      if (slot) {
        const def = ITEMS[slot.itemId];
        const name = def ? def.name : slot.itemId;
        if (slot.rarity && slot.rarity !== 'plain') {
          slotEl.classList.add(`rarity-${slot.rarity}`);
        }
        const iconSvg = getItemIconSvg(slot.itemId, def?.category);
        const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();

        slotEl.innerHTML = `
          ${iconSvg}
          <span class="item-qty">${slot.quantity > 1 ? qtyFormatted : ''}</span>
        `;
        slotEl.title = `${name} (${slot.rarity || 'plain'})\nClick for actions`;
        this.attachItemTooltip(slotEl, slot);
        slotEl.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          this.openItemContextMenu(i, e);
        });
      }
      grid.appendChild(slotEl);

    }
  }

  private setupCombatSustenance() {
    const slider = document.getElementById('combat-eat-hp-slider') as HTMLInputElement | null;
    const valText = document.getElementById('combat-eat-hp-val');
    if (slider) {
      slider.oninput = () => {
        if (valText) valText.textContent = `${slider.value}%`;
      };
      slider.onchange = () => {
        const val = parseInt(slider.value, 10);
        if (!isNaN(val)) {
          this.setCombatFoodSettings(val, undefined);
        }
      };
    }

    const foodSelect = document.getElementById('combat-food-select') as HTMLSelectElement | null;
    if (foodSelect) {
      foodSelect.onchange = () => {
        this.setCombatFoodSettings(undefined, foodSelect.value || null);
      };
    }

    const combatHudAutoEat = document.getElementById('combat-hud-autoeat');
    if (combatHudAutoEat) {
      combatHudAutoEat.onclick = () => {
        this.switchDrawer('equipment');
      };
    }
  }

  private setCombatFoodSettings(eatsAtHpPercent?: number, selectedFoodItemId?: string | null) {
    if (!this.player) return;
    if (typeof eatsAtHpPercent === 'number' && !isNaN(eatsAtHpPercent)) {
      this.player.eatsAtHpPercent = Math.max(10, Math.min(95, Math.round(eatsAtHpPercent)));
    }
    if (selectedFoodItemId !== undefined) {
      this.player.selectedFoodItemId = selectedFoodItemId && selectedFoodItemId.trim().length > 0 ? selectedFoodItemId.trim() : null;
    }
    this.sendWs({
      type: 'SET_COMBAT_FOOD_SETTINGS',
      eatsAtHpPercent: this.player.eatsAtHpPercent,
      selectedFoodItemId: this.player.selectedFoodItemId,
    });
    this.syncCombatFoodControls();
    this.updateCombatHud();
  }

  private populateFoodSelect(selectEl: HTMLSelectElement | null, currentSelectedId?: string | null) {
    if (!selectEl || !this.player) return;
    const currentVal = currentSelectedId !== undefined ? (currentSelectedId || '') : (this.player.selectedFoodItemId || '');

    const foodMap = new Map<string, { id: string; name: string; heal: number; bankCount: number; invCount: number }>();

    for (const slot of this.player.storage) {
      const def = ITEMS[slot.itemId];
      if (def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0))) {
        const entry = foodMap.get(slot.itemId) || {
          id: slot.itemId,
          name: def.name,
          heal: def.baseStats?.healing || 5,
          bankCount: 0,
          invCount: 0,
        };
        entry.bankCount += slot.quantity;
        foodMap.set(slot.itemId, entry);
      }
    }

    for (const slot of this.player.inventory) {
      const def = ITEMS[slot.itemId];
      if (def && (def.category === 'cooked_food' || ((def.baseStats?.healing || 0) > 0))) {
        const entry = foodMap.get(slot.itemId) || {
          id: slot.itemId,
          name: def.name,
          heal: def.baseStats?.healing || 5,
          bankCount: 0,
          invCount: 0,
        };
        entry.invCount += slot.quantity;
        foodMap.set(slot.itemId, entry);
      }
    }

    if (currentVal && !foodMap.has(currentVal) && ITEMS[currentVal]) {
      foodMap.set(currentVal, {
        id: currentVal,
        name: ITEMS[currentVal].name,
        heal: ITEMS[currentVal].baseStats?.healing || 5,
        bankCount: 0,
        invCount: 0,
      });
    }

    selectEl.innerHTML = `<option value="">Any Available Cooked Food</option>`;
    const sorted = Array.from(foodMap.values()).sort((a, b) => b.heal - a.heal);
    for (const f of sorted) {
      const opt = document.createElement('option');
      opt.value = f.id;
      let countStr = '';
      if (f.bankCount > 0 && f.invCount > 0) countStr = ` (${f.bankCount} in bank, ${f.invCount} in bag)`;
      else if (f.bankCount > 0) countStr = ` (${f.bankCount} in bank)`;
      else if (f.invCount > 0) countStr = ` (${f.invCount} in bag)`;
      else countStr = ` (0 in bank)`;
      opt.textContent = `${f.name} (+${f.heal} HP)${countStr}`;
      if (f.id === currentVal) opt.selected = true;
      selectEl.appendChild(opt);
    }
    if (!currentVal) {
      selectEl.value = '';
    }
  }

  private syncCombatFoodControls() {
    if (!this.player) return;
    const pct = this.player.eatsAtHpPercent ?? 50;
    const foodId = this.player.selectedFoodItemId || '';

    const slider = document.getElementById('combat-eat-hp-slider') as HTMLInputElement | null;
    const valText = document.getElementById('combat-eat-hp-val');
    const select1 = document.getElementById('combat-food-select') as HTMLSelectElement | null;

    const modalPct = document.getElementById('dv-combat-eat-pct') as HTMLInputElement | null;
    const select2 = document.getElementById('dv-combat-food-select') as HTMLSelectElement | null;

    if (slider && document.activeElement !== slider) slider.value = pct.toString();
    if (valText) valText.textContent = `${pct}%`;
    if (modalPct && document.activeElement !== modalPct) modalPct.value = pct.toString();

    this.populateFoodSelect(select1, foodId);
    this.populateFoodSelect(select2, foodId);
  }

  private renderEquipmentDrawer() {
    if (!this.player) return;

    // 1. Calculate & Update Combat Stats
    let totalAcc = (this.player.skills.melee?.level || 1) * 2;
    let totalStr = (this.player.skills.melee?.level || 1);
    let totalDef = (this.player.skills.defence?.level || 1);
    for (const item of Object.values(this.player.equipment)) {
      if (!item) continue;
      const def = ITEMS[item.itemId];
      if (def?.baseStats) {
        if (def.baseStats.accuracy) totalAcc += def.baseStats.accuracy;
        if (def.baseStats.strength) totalStr += def.baseStats.strength;
        if (def.baseStats.defence) totalDef += def.baseStats.defence;
      }
    }
    const maxHit = Math.max(1, Math.floor(1 + totalStr * 0.4));
    const accEl = document.getElementById('stat-acc');
    const strEl = document.getElementById('stat-str');
    const defEl = document.getElementById('stat-def');
    const maxhitEl = document.getElementById('stat-maxhit');
    if (accEl) accEl.textContent = totalAcc.toString();
    if (strEl) strEl.textContent = totalStr.toString();
    if (defEl) defEl.textContent = totalDef.toString();
    if (maxhitEl) maxhitEl.textContent = maxHit.toString();

    // Sync Auto-Eat Sustenance settings
    this.syncCombatFoodControls();

    // 2. Render Worn Combat & Attire Equipment
    const container = document.getElementById('equipment-slots')!;
    container.innerHTML = '';

    const wornSlots: Array<{ key: EquipSlot; label: string; iconKey: string }> = [
      { key: 'weapon', label: 'Main Weapon', iconKey: 'sword' },
      { key: 'shield', label: 'Shield / Off-Hand', iconKey: 'shield' },
      { key: 'helmet', label: 'Headgear', iconKey: 'helmet' },
      { key: 'hair', label: 'Cosmetic Hair', iconKey: 'hair' },
      { key: 'body', label: 'Body Armour', iconKey: 'body' },
      { key: 'legs', label: 'Leg Greaves', iconKey: 'legs' },
      { key: 'steed', label: 'Mount / Steed', iconKey: 'mount' },
      { key: 'amulet', label: 'Amulet', iconKey: 'amulet' },
      { key: 'ring', label: 'Ring', iconKey: 'ring' },
    ];

    for (const slotDef of wornSlots) {
      const itemSlot = this.player.equipment[slotDef.key];
      const div = document.createElement('div');
      div.className = 'rpg-slot';
      div.style.aspectRatio = 'auto';
      div.style.padding = '8px 10px';
      div.style.flexDirection = 'row';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.style.cursor = itemSlot ? 'pointer' : 'default';

      if (itemSlot) {
        const def = ITEMS[itemSlot.itemId];
        const rarityCol = itemSlot.rarity === 'legendary' ? '#f6ad55' :
                          itemSlot.rarity === 'epic' ? '#b794f4' :
                          itemSlot.rarity === 'rare' ? '#63b3ed' :
                          itemSlot.rarity === 'uncommon' ? '#68d391' : '#e2e8f0';

        const iconSvg = getItemIconSvg(itemSlot.itemId, def?.category);

        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:26px; height:26px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${iconSvg}</div>
            <div>
              <div style="font-weight:700; font-size:0.75rem; color:var(--gold-main);">${slotDef.label}</div>
              <div style="font-size:0.78rem; font-weight:600; color:${rarityCol};">${def ? def.name : itemSlot.itemId}</div>
            </div>
          </div>
          <button class="btn-oak" style="padding:2px 8px; font-size:0.68rem; height:22px;">Unequip</button>
        `;
        div.title = `${def?.name || itemSlot.itemId}\nClick to unequip into satchel`;
        this.attachItemTooltip(div, itemSlot, slotDef.key);
        div.onclick = () => {
          this.sendWs({ type: 'UNEQUIP_ITEM', slot: slotDef.key });
        };
      } else {
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="rpg-slot-empty-icon">${ICONS[slotDef.iconKey] || ICONS.skills}</span>
            <div style="font-weight:600; font-size:0.75rem; color:var(--text-dim);">${slotDef.label}</div>
          </div>
          <div style="font-size:0.7rem; color:var(--text-dim); font-style:italic;">(empty)</div>
        `;
      }
      container.appendChild(div);
    }

    // 3. Render Toolbelt
    const toolbeltContainer = document.getElementById('toolbelt-slots');
    if (toolbeltContainer) {
      toolbeltContainer.innerHTML = '';

      const toolbeltSlots: Array<{
        key: EquipSlot;
        fallbackKey?: EquipSlot;
        label: string;
        iconKey: string;
        matchCategory: string;
      }> = [
        { key: 'tool_pickaxe', fallbackKey: 'tool', label: 'Mining Pickaxe', iconKey: 'mining', matchCategory: 'pickaxe' },
        { key: 'tool_axe', fallbackKey: 'tool', label: 'Woodcutting Axe', iconKey: 'woodcutting', matchCategory: 'axe' },
        { key: 'tool_rod', fallbackKey: 'tool', label: 'Fishing Tackle', iconKey: 'fishing', matchCategory: 'rod' },
      ];

      for (const slotDef of toolbeltSlots) {
        let itemSlot = this.player.equipment[slotDef.key];
        let actualSlotKey = slotDef.key;

        // Check fallback 'tool' slot if matching
        if (!itemSlot && slotDef.fallbackKey && this.player.equipment[slotDef.fallbackKey]) {
          const fallbackItem = this.player.equipment[slotDef.fallbackKey]!;
          if (fallbackItem.itemId.includes(slotDef.matchCategory)) {
            itemSlot = fallbackItem;
            actualSlotKey = slotDef.fallbackKey;
          }
        }

        const div = document.createElement('div');
        div.className = 'rpg-slot';
        div.style.aspectRatio = 'auto';
        div.style.padding = '8px 10px';
        div.style.flexDirection = 'row';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.cursor = itemSlot ? 'pointer' : 'default';

        if (itemSlot) {
          const def = ITEMS[itemSlot.itemId];
          const speedBonus = def?.baseStats?.toolSpeedBonus ? `+${Math.round(def.baseStats.toolSpeedBonus * 100)}% Speed` : 'Equipped';
          const rarityCol = itemSlot.rarity === 'legendary' ? '#f6ad55' :
                            itemSlot.rarity === 'epic' ? '#b794f4' :
                            itemSlot.rarity === 'rare' ? '#63b3ed' :
                            itemSlot.rarity === 'uncommon' ? '#68d391' : '#e2e8f0';

          const iconSvg = getItemIconSvg(itemSlot.itemId, def?.category);

          div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:26px; height:26px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${iconSvg}</div>
              <div>
                <div style="font-weight:700; font-size:0.75rem; color:var(--gold-main);">${slotDef.label}</div>
                <div style="font-size:0.78rem; font-weight:600; color:${rarityCol};">${def ? def.name : itemSlot.itemId} <span style="font-size:0.7rem; color:#48bb78;">(${speedBonus})</span></div>
              </div>
            </div>
            <button class="btn-oak" style="padding:2px 8px; font-size:0.68rem; height:22px;">Unequip</button>
          `;
          div.title = `${def?.name || itemSlot.itemId} (${speedBonus})\nClick to unequip into satchel`;
          this.attachItemTooltip(div, itemSlot, actualSlotKey);
          div.onclick = () => {
            this.sendWs({ type: 'UNEQUIP_ITEM', slot: actualSlotKey });
          };
        } else {
          div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="rpg-slot-empty-icon">${ICONS[slotDef.iconKey] || ICONS.skills}</span>
              <div style="font-weight:600; font-size:0.75rem; color:var(--text-dim);">${slotDef.label}</div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-dim); font-style:italic;">(empty)</div>
          `;
        }
        toolbeltContainer.appendChild(div);
      }
    }
  }


  private renderStorageDrawer() {
    if (!this.player) return;
    const grid = document.getElementById('storage-grid')!;
    grid.innerHTML = '';
    document.getElementById('storage-count')!.textContent = this.player.storage.length.toString();

    const hearth = this.getHearthLocation(this.player.x, this.player.y);
    const isNearHearth = Math.hypot(this.player.x - hearth.x, this.player.y - hearth.y) <= 1.5;
    const btnDepositStorage = document.getElementById('btn-deposit-all');
    if (btnDepositStorage) {
      btnDepositStorage.textContent = isNearHearth ? 'Deposit All Spoils' : 'Deposit All Spoils (Travel to Hearth)';
    }

    for (let index = 0; index < this.player.storage.length; index++) {
      const slot = this.player.storage[index];
      const def = ITEMS[slot.itemId];
      const div = document.createElement('div');
      div.className = 'rpg-slot';
      if (slot.rarity && slot.rarity !== 'plain') {
        div.classList.add(`rarity-${slot.rarity}`);
      }
      const iconSvg = getItemIconSvg(slot.itemId, def?.category);
      const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();

      div.innerHTML = `
        ${iconSvg}
        <span class="item-qty">${qtyFormatted}</span>
      `;
      div.title = isNearHearth 
        ? `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}). Click to withdraw into satchel` 
        : `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}). Travel to Hearth to withdraw`;
      this.attachItemTooltip(div, slot);
      div.onclick = () => {
        if (!isNearHearth) {
          this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
        } else {
          this.sendWs({ type: 'WITHDRAW_ITEM', storageIndex: index });
        }
      };
      grid.appendChild(div);
    }
  }

  private setupStorageModal() {
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal) return;

    // Close button
    const closeBtn = document.getElementById('dv-storage-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeStorageModal();
    }

    // Backdrop click outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeStorageModal();
      }
    };

    // Escape key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.closeStorageModal();
      }
    });

    // Tab buttons
    const tabStorage = document.getElementById('dv-tab-storage');
    const tabVendor = document.getElementById('dv-tab-vendor');
    const tabMarket = document.getElementById('dv-tab-market');
    const viewStorage = document.getElementById('dv-storage-tab-view');
    const viewVendor = document.getElementById('dv-vendor-tab-view');
    const viewMarket = document.getElementById('dv-market-tab-view');
    const subbarStorage = document.querySelector('.dv-storage-subbar') as HTMLElement | null;

    if (tabStorage && tabVendor && tabMarket && viewStorage && viewVendor && viewMarket) {
      tabStorage.onclick = () => {
        this.activeStorageTab = 'storage';
        tabStorage.classList.add('active');
        tabVendor.classList.remove('active');
        tabMarket.classList.remove('active');
        viewStorage.classList.remove('hidden');
        viewVendor.classList.add('hidden');
        viewMarket.classList.add('hidden');
        if (subbarStorage) subbarStorage.style.display = 'flex';
        this.renderStorageModal();
      };

      tabVendor.onclick = () => {
        this.activeStorageTab = 'vendor';
        tabVendor.classList.add('active');
        tabStorage.classList.remove('active');
        tabMarket.classList.remove('active');
        viewVendor.classList.remove('hidden');
        viewStorage.classList.add('hidden');
        viewMarket.classList.add('hidden');
        if (subbarStorage) subbarStorage.style.display = 'none';
        this.renderVendorView();
      };

      tabMarket.onclick = () => {
        this.activeStorageTab = 'market';
        tabMarket.classList.add('active');
        tabStorage.classList.remove('active');
        tabVendor.classList.remove('active');
        viewMarket.classList.remove('hidden');
        viewStorage.classList.add('hidden');
        viewVendor.classList.add('hidden');
        if (subbarStorage) subbarStorage.style.display = 'none';
        this.sendWs({ type: 'GET_MARKET_LISTINGS' });
        this.renderMarketView();
      };
    }

    // Marketplace Search & Filter controls
    const mktSearch = document.getElementById('dv-market-search-input') as HTMLInputElement | null;
    if (mktSearch) {
      mktSearch.oninput = () => {
        this.marketSearchQuery = (mktSearch.value || '').trim().toLowerCase();
        this.renderMarketView();
      };
    }

    const mktType = document.getElementById('dv-market-filter-type') as HTMLSelectElement | null;
    if (mktType) {
      mktType.onchange = () => {
        this.marketFilterCategory = mktType.value;
        this.renderMarketView();
      };
    }

    const mktRefresh = document.getElementById('dv-market-refresh-btn');
    if (mktRefresh) {
      mktRefresh.onclick = () => {
        this.sendWs({ type: 'GET_MARKET_LISTINGS' });
      };
    }

    // Mailbox Claim Buttons
    const btnClaimBag = document.getElementById('dv-btn-claim-bag');
    if (btnClaimBag) {
      btnClaimBag.onclick = () => {
        this.sendWs({ type: 'CLAIM_MARKET_MAILBOX', destination: 'inventory' });
      };
    }

    const btnClaimVault = document.getElementById('dv-btn-claim-vault');
    if (btnClaimVault) {
      btnClaimVault.onclick = () => {
        this.sendWs({ type: 'CLAIM_MARKET_MAILBOX', destination: 'storage' });
      };
    }

    // Filter input
    const filterInput = document.getElementById('dv-filter-input') as HTMLInputElement | null;
    if (filterInput) {
      filterInput.oninput = () => {
        this.storageFilterQuery = (filterInput.value || '').trim().toLowerCase();
        this.renderStorageModal();
      };
    }

    // Buy slot
    const btnBuy = document.getElementById('dv-btn-buy-slot');
    if (btnBuy) {
      btnBuy.onclick = () => {
        this.sendWs({ type: 'BUY_STORAGE_SLOT' });
      };
    }

    // Auto arrange
    const btnArrange = document.getElementById('dv-btn-auto-arrange');
    if (btnArrange) {
      btnArrange.onclick = () => {
        this.sendWs({ type: 'SORT_STORAGE' });
      };
    }

    // Vault Combat Sustenance controls
    const dvEatPct = document.getElementById('dv-combat-eat-pct') as HTMLInputElement | null;
    if (dvEatPct) {
      dvEatPct.onchange = () => {
        const val = parseInt(dvEatPct.value, 10);
        if (!isNaN(val)) {
          this.setCombatFoodSettings(val, undefined);
        }
      };
    }

    const dvFoodSelect = document.getElementById('dv-combat-food-select') as HTMLSelectElement | null;
    if (dvFoodSelect) {
      dvFoodSelect.onchange = () => {
        this.setCombatFoodSettings(undefined, dvFoodSelect.value || null);
      };
    }

    // Home depot / Deposit all buttons
    const btnHomeDepot = document.getElementById('dv-btn-home-depot');
    if (btnHomeDepot) {
      btnHomeDepot.onclick = () => {
        this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
      };
    }

    const btnDepositAll = document.getElementById('dv-btn-deposit-all');
    if (btnDepositAll) {
      btnDepositAll.onclick = () => {
        this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
      };
    }

    // Transfer amount pills
    const pills = document.querySelectorAll('.dv-pill-btn');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const amt = pill.getAttribute('data-amount');
        if (amt === 'all') {
          this.selectedTransferAmount = 'all';
        } else {
          this.selectedTransferAmount = parseInt(amt || '1', 10) || 1;
        }
        this.renderStorageModal();
      });
    });

    // Vendor: Sell all spoils
    const btnSellAll = document.getElementById('dv-btn-sell-all-junk');
    if (btnSellAll) {
      btnSellAll.onclick = () => {
        this.sendWs({ type: 'SELL_ALL_JUNK' });
      };
    }
  }

  private setupLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('leaderboard-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeLeaderboardModal();
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        this.closeLeaderboardModal();
      }
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.closeLeaderboardModal();
      }
    });

    this.renderLeaderboardTabs();
  }

  private renderLeaderboardTabs() {
    const tabsContainer = document.querySelector('.leaderboard-category-tabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '';

    for (const cat of LEADERBOARD_CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'lb-tab-btn' + (this.activeLeaderboardCategory === cat.id ? ' active' : '');
      btn.dataset.category = cat.id;

      const iconSvg = cat.id === 'total' ? ICONS.leaderboard : (ICONS[cat.id] || ICONS.skills);
      btn.innerHTML = `<span class="svg-icon-inline">${iconSvg}</span><span>${cat.name}</span>`;

      btn.onclick = () => {
        if (this.activeLeaderboardCategory === cat.id) return;
        this.activeLeaderboardCategory = cat.id;
        tabsContainer.querySelectorAll('.lb-tab-btn').forEach(b => {
          b.classList.toggle('active', (b as HTMLElement).dataset.category === cat.id);
        });
        this.loadLeaderboard(cat.id);
      };

      tabsContainer.appendChild(btn);
    }
  }

  private openLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    if (!modal) return;
    sound.play('click');
    modal.classList.remove('hidden');
    this.renderLeaderboardTabs();
    this.loadLeaderboard(this.activeLeaderboardCategory);
  }

  private closeLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  private async loadLeaderboard(category: 'total' | SkillType) {
    const tbody = document.getElementById('leaderboard-table-rows');
    const thLevel = document.getElementById('leaderboard-th-level');
    const thXp = document.getElementById('leaderboard-th-xp');
    if (!tbody) return;

    const catDef = LEADERBOARD_CATEGORIES.find(c => c.id === category);
    const catName = catDef ? catDef.name : 'Level';

    if (thLevel) thLevel.textContent = category === 'total' ? 'Total Level' : `${catName} Lvl`;
    if (thXp) thXp.textContent = category === 'total' ? 'Total XP' : `${catName} XP`;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #a0aec0;">Gathering chronicles of Eldoria...</td></tr>`;

    try {
      const res = await fetch(`/api/leaderboard?category=${encodeURIComponent(category)}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries: Array<{ rank: number; username: string; level: number; xp: number; isGuest: boolean }> = data.entries || [];

      tbody.innerHTML = '';
      if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #a0aec0;">No adventurers ranked in this category yet.</td></tr>`;
        return;
      }

      for (const entry of entries) {
        const isMe = !!(this.player && entry.username === this.player.username);
        const tr = document.createElement('tr');
        tr.className = 'lb-row' + (isMe ? ' lb-row-me' : '');

        let rankBadgeClass = 'lb-rank-default';
        if (entry.rank === 1) rankBadgeClass = 'lb-rank-1';
        else if (entry.rank === 2) rankBadgeClass = 'lb-rank-2';
        else if (entry.rank === 3) rankBadgeClass = 'lb-rank-3';

        const guestBadge = entry.isGuest ? `<span class="lb-guest-tag">Guest</span>` : '';
        const youBadge = isMe ? `<span style="color:#ffd700; font-size:0.68rem; font-weight:700;">(You)</span>` : '';

        tr.innerHTML = `
          <td><span class="lb-rank-badge ${rankBadgeClass}">#${entry.rank}</span></td>
          <td>
            <div class="lb-name-cell ${isMe ? 'lb-name-me' : ''}">
              <span>${entry.username}</span>
              ${guestBadge}
              ${youBadge}
            </div>
          </td>
          <td style="text-align: right;"><span class="lb-level-val">${entry.level.toLocaleString()}</span></td>
          <td style="text-align: right;"><span class="lb-xp-val">${entry.xp.toLocaleString()} XP</span></td>
        `;
        tbody.appendChild(tr);
      }
    } catch (err) {
      console.error('Failed to load leaderboard', err);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #f87171;">Failed to load leaderboard rankings.</td></tr>`;
    }
  }

  private openStorageModal() {
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal) return;
    sound.play('chest');
    modal.classList.remove('hidden');
    this.renderStorageModal();
  }

  private closeStorageModal() {
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  private renderStorageModal() {
    if (!this.player) return;
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    if (this.activeStorageTab === 'vendor') {
      this.renderVendorView();
      return;
    }
    if (this.activeStorageTab === 'market') {
      this.renderMarketView();
      return;
    }

    const maxSlots = this.player.storageSlotsMax || 75;
    const counterEl = document.getElementById('dv-slots-counter');
    if (counterEl) {
      counterEl.textContent = `${this.player.storage.length} / ${maxSlots} slots`;
    }

    // Buy slot affordability styling
    const btnBuy = document.getElementById('dv-btn-buy-slot');
    if (btnBuy) {
      const canAfford = (this.player.gold || 0) >= 1000;
      btnBuy.style.opacity = canAfford ? '1' : '0.6';
    }

    // Sync vault combat sustenance controls
    this.syncCombatFoodControls();

    const storageGrid = document.getElementById('dv-storage-grid');
    if (storageGrid) {
      storageGrid.innerHTML = '';

      // Check distance to Hearth
      const hearth = this.getHearthLocation(this.player.x, this.player.y);
      const isNearHearth = Math.hypot(this.player.x - hearth.x, this.player.y - hearth.y) <= 1.5;

      // Filtered items
      const query = this.storageFilterQuery;
      let itemsToRender = this.player.storage.map((slot, index) => ({ slot, originalIndex: index }));
      if (query) {
        itemsToRender = itemsToRender.filter(item => {
          const def = ITEMS[item.slot.itemId];
          const name = (def ? def.name : item.slot.itemId).toLowerCase();
          return name.includes(query);
        });
      }

      for (const item of itemsToRender) {
        const slot = item.slot;
        const def = ITEMS[slot.itemId];
        const div = document.createElement('div');
        div.className = 'dv-slot';
        if (slot.rarity && slot.rarity !== 'plain') {
          div.classList.add(`rarity-${slot.rarity}`);
        }

        const iconSvg = getItemIconSvg(slot.itemId, def?.category);
        const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();

        div.innerHTML = `
          ${iconSvg}
          <span class="dv-slot-qty">${qtyFormatted}</span>
        `;
        div.title = `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}). Click to withdraw ${this.selectedTransferAmount === 'all' ? 'all' : this.selectedTransferAmount}`;
        this.attachItemTooltip(div, slot);

        div.onclick = () => {
          if (!isNearHearth) {
            this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
            this.showToast('Heading to the bank...');
          } else {
            const requestedQty = this.selectedTransferAmount === 'all' ? slot.quantity : this.selectedTransferAmount;
            this.sendWs({
              type: 'WITHDRAW_ITEM',
              storageIndex: item.originalIndex,
              quantity: requestedQty,
            });
          }
        };

        storageGrid.appendChild(div);
      }

      // Fill remaining visible slots up to maxSlots (minimum 70 for 7 full rows)
      const targetSlotCount = Math.max(maxSlots, 70);
      const emptySlotsCount = Math.max(0, targetSlotCount - itemsToRender.length);
      for (let i = 0; i < emptySlotsCount; i++) {
        const div = document.createElement('div');
        div.className = 'dv-slot dv-slot-empty';
        storageGrid.appendChild(div);
      }
    }

    // Render Carrying Section (14 columns x 2 rows = 28 satchel slots)
    const carryingCounter = document.getElementById('dv-carrying-counter');
    if (carryingCounter) {
      carryingCounter.textContent = `${this.player.inventory.length} / 28`;
    }

    const carryingGrid = document.getElementById('dv-carrying-grid');
    if (carryingGrid) {
      carryingGrid.innerHTML = '';
      const hearth = this.getHearthLocation(this.player.x, this.player.y);
      const isNearHearth = Math.hypot(this.player.x - hearth.x, this.player.y - hearth.y) <= 1.5;

      for (let i = 0; i < 28; i++) {
        const slot = this.player.inventory[i];
        const div = document.createElement('div');
        div.className = 'dv-slot';

        if (slot) {
          const def = ITEMS[slot.itemId];
          if (slot.rarity && slot.rarity !== 'plain') {
            div.classList.add(`rarity-${slot.rarity}`);
          }
          const iconSvg = getItemIconSvg(slot.itemId, def?.category);
          const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();

          div.innerHTML = `
            ${iconSvg}
            <span class="dv-slot-qty">${qtyFormatted}</span>
          `;
          div.title = `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}). Click to deposit ${this.selectedTransferAmount === 'all' ? 'all' : this.selectedTransferAmount}`;
          this.attachItemTooltip(div, slot);

          const index = i;
          div.onclick = () => {
            if (!isNearHearth) {
              this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
              this.showToast('Heading to the bank...');
            } else {
              const requestedQty = this.selectedTransferAmount === 'all' ? slot.quantity : this.selectedTransferAmount;
              this.sendWs({
                type: 'DEPOSIT_ITEM',
                inventoryIndex: index,
                quantity: requestedQty,
              });
            }
          };
        } else {
          div.classList.add('dv-slot-empty');
        }

        carryingGrid.appendChild(div);
      }
    }
  }

  private renderVendorView() {
    if (!this.player) return;
    const vendorGrid = document.getElementById('dv-vendor-carrying-grid');
    if (!vendorGrid) return;
    vendorGrid.innerHTML = '';

    for (let i = 0; i < 28; i++) {
      const slot = this.player.inventory[i];
      const div = document.createElement('div');
      div.className = 'dv-slot';

      if (slot) {
        const def = ITEMS[slot.itemId];
        if (slot.rarity && slot.rarity !== 'plain') {
          div.classList.add(`rarity-${slot.rarity}`);
        }
        const iconSvg = getItemIconSvg(slot.itemId, def?.category);
        const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();
        const pricePerUnit = Math.max(1, Math.floor((def?.vendorFloorPrice || 2)));
        const totalPrice = pricePerUnit * slot.quantity;

        div.innerHTML = `
          ${iconSvg}
          <span class="dv-slot-qty">${qtyFormatted}</span>
        `;
        div.title = `${def?.name || slot.itemId} (x${slot.quantity}). Click to sell for ${totalPrice.toLocaleString()} Gold (${pricePerUnit} each)`;
        this.attachItemTooltip(div, slot);

        const index = i;
        div.onclick = () => {
          this.sendWs({
            type: 'SELL_ITEM',
            inventoryIndex: index,
          });
        };
      } else {
        div.classList.add('dv-slot-empty');
      }

      vendorGrid.appendChild(div);
    }
  }

  private renderMarketView() {
    if (!this.player) return;
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const counterEl = document.getElementById('dv-slots-counter');
    if (counterEl) {
      counterEl.textContent = `Coins: ${(this.player.gold || 0).toLocaleString()} G`;
    }

    // Render Mailbox / Claim Box status bar
    const mailboxBar = document.getElementById('dv-market-mailbox-bar');
    const mailboxSummary = document.getElementById('dv-mailbox-summary-text');
    const mailbox = this.player.marketMailbox || [];

    if (mailboxBar && mailboxSummary) {
      if (mailbox.length > 0) {
        mailboxBar.classList.remove('hidden');
        const totalItemsCount = mailbox.reduce((sum, m) => sum + m.quantity, 0);
        const itemNames = mailbox.map(m => {
          const def = ITEMS[m.itemId];
          return `${m.quantity}x ${def?.name || m.itemId}`;
        }).slice(0, 3).join(', ');
        const moreSuffix = mailbox.length > 3 ? ` +${mailbox.length - 3} more` : '';
        mailboxSummary.textContent = `${totalItemsCount} items waiting (${itemNames}${moreSuffix})`;
      } else {
        mailboxBar.classList.add('hidden');
      }
    }

    const listingsContainer = document.getElementById('dv-market-listings-list');
    if (listingsContainer) {
      listingsContainer.innerHTML = '';

      // Filter listings by search query and category
      const query = this.marketSearchQuery;
      const category = this.marketFilterCategory;

      const filtered = this.marketListings.filter(listing => {
        const itemDef = ITEMS[listing.itemId];
        const name = (itemDef?.name || listing.itemId).toLowerCase();

        if (query && !name.includes(query) && !listing.sellerName.toLowerCase().includes(query)) {
          return false;
        }

        if (category === 'my_listings') {
          return listing.sellerId === this.player?.id;
        }

        if (category === 'materials') {
          return itemDef?.category === 'bar' || itemDef?.category === 'ore' || itemDef?.category === 'log' || itemDef?.category === 'herb' || itemDef?.category === 'crop' || itemDef?.category === 'seed';
        }

        if (category === 'equipment') {
          return itemDef?.slot || itemDef?.category === 'weapon' || itemDef?.category === 'armour' || itemDef?.category === 'steed' || itemDef?.category === 'tool';
        }

        if (category === 'consumables') {
          return itemDef?.category === 'cooked_food' || itemDef?.category === 'raw_food' || itemDef?.category === 'potion';
        }

        return true;
      });

      if (filtered.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'dv-market-empty-msg';
        emptyDiv.textContent = this.marketListings.length === 0
          ? 'No active marketplace listings. List an item from your satchel below!'
          : 'No listings match your search criteria.';
        listingsContainer.appendChild(emptyDiv);
      } else {
        filtered.forEach(listing => {
          const itemDef = ITEMS[listing.itemId];
          const isMine = listing.sellerId === this.player?.id;
          const iconSvg = getItemIconSvg(listing.itemId, itemDef?.category);
          const plusLabel = listing.plus > 0 ? ` +${listing.plus}` : '';
          const rarityClass = listing.rarity && listing.rarity !== 'plain' ? `rarity-${listing.rarity}` : '';

          const row = document.createElement('div');
          row.className = `dv-market-listing-row ${isMine ? 'my-listing' : ''}`;

          const itemCell = document.createElement('div');
          itemCell.className = `dv-mkt-item-cell ${rarityClass}`;
          itemCell.innerHTML = `
            ${iconSvg}
            <span class="dv-mkt-item-name" title="${itemDef?.name || listing.itemId}">${itemDef?.name || listing.itemId}${plusLabel}</span>
          `;

          const qtyCell = document.createElement('div');
          qtyCell.textContent = listing.quantity.toLocaleString();

          const priceCell = document.createElement('div');
          priceCell.className = 'dv-mkt-gold-text';
          priceCell.textContent = `${listing.unitPrice.toLocaleString()} G`;

          const totalCell = document.createElement('div');
          totalCell.className = 'dv-mkt-gold-text';
          totalCell.textContent = `${listing.totalPrice.toLocaleString()} G`;

          const sellerCell = document.createElement('div');
          sellerCell.className = 'dv-mkt-seller-name';
          sellerCell.textContent = isMine ? 'You' : listing.sellerName;

          const actionCell = document.createElement('div');
          if (isMine) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'dv-market-btn-cancel';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.title = 'Cancel listing and return items to satchel or vault';
            cancelBtn.onclick = () => {
              this.sendWs({ type: 'CANCEL_MARKET_LISTING', listingId: listing.id });
            };
            actionCell.appendChild(cancelBtn);
          } else {
            const buyBtn = document.createElement('button');
            buyBtn.className = 'dv-market-btn-buy';
            buyBtn.textContent = 'Buy';
            buyBtn.title = `Buy from ${listing.sellerName}`;
            buyBtn.onclick = () => {
              if (listing.quantity > 1) {
                this.showInGamePrompt({
                  title: 'Buy Listing',
                  message: `How many ${itemDef?.name || 'items'} would you like to buy? (1 to ${listing.quantity})`,
                  defaultValue: listing.quantity,
                  min: 1,
                  max: listing.quantity,
                  confirmText: 'Buy',
                  onConfirm: (buyQty) => {
                    this.sendWs({ type: 'BUY_MARKET_LISTING', listingId: listing.id, quantity: Math.min(listing.quantity, buyQty) });
                  },
                });
              } else {
                this.sendWs({ type: 'BUY_MARKET_LISTING', listingId: listing.id, quantity: 1 });
              }
            };
            actionCell.appendChild(buyBtn);
          }

          row.appendChild(itemCell);
          row.appendChild(qtyCell);
          row.appendChild(priceCell);
          row.appendChild(totalCell);
          row.appendChild(sellerCell);
          row.appendChild(actionCell);

          listingsContainer.appendChild(row);
        });
      }
    }

    // Render Satchel grid for listing items
    const satchelGrid = document.getElementById('dv-market-carrying-grid');
    if (satchelGrid) {
      satchelGrid.innerHTML = '';
      for (let i = 0; i < 28; i++) {
        const slot = this.player.inventory[i];
        const div = document.createElement('div');
        div.className = 'dv-slot';

        if (slot) {
          const def = ITEMS[slot.itemId];
          if (slot.rarity && slot.rarity !== 'plain') {
            div.classList.add(`rarity-${slot.rarity}`);
          }
          const iconSvg = getItemIconSvg(slot.itemId, def?.category);
          const qtyFormatted = slot.quantity >= 1000 ? `${(slot.quantity / 1000).toFixed(1)}K` : slot.quantity.toString();

          div.innerHTML = `
            ${iconSvg}
            <span class="dv-slot-qty">${qtyFormatted}</span>
          `;
          div.title = `${def?.name || slot.itemId} (x${slot.quantity}). Click to create a marketplace listing.`;
          this.attachItemTooltip(div, slot);

          const index = i;
          div.onclick = () => {
            if (slot.itemId === 'gold') {
              this.showToast('Cannot list gold coins on the marketplace.');
              return;
            }

            const promptForPrice = (sellQty: number) => {
              const defaultUnitPrice = Math.max(1, Math.floor((def?.vendorFloorPrice || 2) * 1.5));
              this.showInGamePrompt({
                title: 'Set Price',
                message: `Set unit price in Gold for each ${def?.name || slot.itemId}:`,
                defaultValue: defaultUnitPrice,
                min: 1,
                confirmText: 'List Item',
                onConfirm: (parsedPrice) => {
                  this.sendWs({
                    type: 'CREATE_MARKET_LISTING',
                    inventoryIndex: index,
                    quantity: sellQty,
                    unitPrice: parsedPrice,
                  });
                },
              });
            };

            if (slot.quantity > 1) {
              this.showInGamePrompt({
                title: 'List for Sale',
                message: `How many ${def?.name || slot.itemId} to list for sale? (1 to ${slot.quantity})`,
                defaultValue: slot.quantity,
                min: 1,
                max: slot.quantity,
                confirmText: 'Next',
                onConfirm: (sellQty) => {
                  promptForPrice(sellQty);
                },
              });
            } else {
              promptForPrice(1);
            }
          };
        } else {
          div.classList.add('dv-slot-empty');
        }

        satchelGrid.appendChild(div);
      }
    }
  }

  private setupChat() {
    const collapseBtn = document.getElementById('chat-collapse-btn')!;
    const chatCard = document.getElementById('chat-card')!;

    collapseBtn.onclick = () => {
      this.chatCollapsed = !this.chatCollapsed;
      if (this.chatCollapsed) {
        chatCard.style.maxHeight = '34px';
        collapseBtn.innerHTML = ICONS.chevronUp;
      } else {
        chatCard.style.maxHeight = '280px';
        collapseBtn.innerHTML = ICONS.chevronDown;
      }
    };

    const chanBtns = document.querySelectorAll('.chan-btn');
    chanBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        chanBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeChannel = btn.getAttribute('data-chan') || 'All';
        this.renderChatMessages();
      });
    });

    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('chat-input') as HTMLInputElement;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const targetChan = (this.activeChannel === 'System' || this.activeChannel === 'Combat' || this.activeChannel === 'Loot')
        ? 'Global'
        : this.activeChannel;
      this.sendWs({
        type: 'CHAT',
        channel: targetChan,
        text,
      });
      input.value = '';
    });
  }

  private toggleChat() {
    const chatCard = document.getElementById('chat-card')!;
    if (chatCard.style.display === 'none') {
      chatCard.style.display = 'flex';
    } else {
      chatCard.style.display = 'none';
    }
  }

  private appendChatMessage(msg: any) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const sender = msg.senderName || 'Wanderer';
    const channel = msg.channel || 'Global';
    const cleanText = (msg.text || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

    this.chatHistory.push({
      time: timeStr,
      senderName: sender,
      text: cleanText,
      channel: channel as any,
      isAdmin: msg.isAdmin,
    });

    if (this.chatHistory.length > 200) {
      this.chatHistory.shift();
    }

    this.renderChatMessages();
  }

  private renderChatMessages() {
    const log = document.getElementById('chat-messages');
    if (!log) return;
    log.innerHTML = '';

    const filtered = this.chatHistory.filter(m => {
      if (this.activeChannel === 'All') {
        // Show player chat, combat, and loot, but keep routine system messages in the System tab so they don't flood chat
        return m.channel !== 'System' || m.isAdmin;
      }
      if (this.activeChannel === 'Global') return m.channel === 'Global' || m.isAdmin;
      if (this.activeChannel === 'Combat') return m.channel === 'Combat';
      if (this.activeChannel === 'Loot') return m.channel === 'Loot';
      if (this.activeChannel === 'System') return m.channel === 'System';
      return true;
    });

    for (const msg of filtered) {
      const line = document.createElement('div');
      line.className = 'chat-line';

      const adminTag = msg.isAdmin
        ? `<span class="chat-admin-badge"><span style="display:inline-flex; width:12px; height:12px; margin-right:2px; vertical-align:middle;">${ICONS.admin}</span>ADMIN</span>`
        : '';

      let chanColor = '#90cdf4';
      if (msg.channel === 'Combat') chanColor = '#f6ad55';
      else if (msg.channel === 'Loot') chanColor = '#ecc94b';
      else if (msg.channel === 'System') chanColor = '#a0aec0';

      line.innerHTML = `
        <span class="chat-time">${msg.time}</span>
        ${adminTag ? `${adminTag} ` : ''}${msg.senderName ? `<span class="chat-sender" style="color:${chanColor};">${msg.senderName}:</span>` : ''}
        <span>${msg.text}</span>
      `;
      log.appendChild(line);
    }
    log.scrollTop = log.scrollHeight;
  }

  private setupModals() {
    // In-Panel Context Menu (matching contextmenu.png)
    const ctxMenu = document.getElementById('item-context-menu');
    const ctxClose = document.getElementById('ctx-close-btn');
    if (ctxClose && ctxMenu) {
      ctxClose.onclick = (e) => {
        e.stopPropagation();
        ctxMenu.classList.add('hidden');
      };
    }

    // Dismiss context menu when clicking outside or pressing Escape
    document.addEventListener('pointerdown', (e) => {
      if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
        if (!ctxMenu.contains(e.target as Node)) {
          ctxMenu.classList.add('hidden');
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ctxMenu) {
        ctxMenu.classList.add('hidden');
      }
    });

    const ctxBtnEquip = document.getElementById('ctx-btn-equip');
    if (ctxBtnEquip && ctxMenu) {
      ctxBtnEquip.onclick = () => {
        if (this.selectedInventoryIndex !== null) {
          this.sendWs({ type: 'EQUIP_ITEM', inventoryIndex: this.selectedInventoryIndex });
          ctxMenu.classList.add('hidden');
        }
      };
    }

    const ctxBtnEat = document.getElementById('ctx-btn-eat');
    if (ctxBtnEat && ctxMenu) {
      ctxBtnEat.onclick = () => {
        if (this.selectedInventoryIndex !== null && this.player) {
          const slot = this.player.inventory[this.selectedInventoryIndex];
          if (slot) {
            if (slot.itemId.startsWith('gem_pack_')) {
              sound.play('ding');
              this.sendWs({
                type: 'REDEEM_GEM_PACK',
                inventoryIndex: this.selectedInventoryIndex,
                itemId: slot.itemId,
              });
              ctxMenu.classList.add('hidden');
              return;
            }
            const def = ITEMS[slot.itemId];
            if (def?.baseStats?.healing) {
              sound.play('eat');
              this.renderer.addFloatingText(this.player.x, this.player.y, `+${def.baseStats.healing}`, 'heal');
            }
          }
          this.sendWs({ type: 'EAT_FOOD', inventoryIndex: this.selectedInventoryIndex });
          ctxMenu.classList.add('hidden');
        }
      };
    }

    const ctxBtnDep1 = document.getElementById('ctx-btn-deposit-1');
    if (ctxBtnDep1 && ctxMenu) {
      ctxBtnDep1.onclick = () => {
        if (this.selectedInventoryIndex !== null) {
          this.sendWs({ type: 'DEPOSIT_ITEM', inventoryIndex: this.selectedInventoryIndex, quantity: 1 });
          ctxMenu.classList.add('hidden');
        }
      };
    }

    const ctxBtnDepX = document.getElementById('ctx-btn-deposit-x');
    if (ctxBtnDepX && ctxMenu) {
      ctxBtnDepX.onclick = () => {
        if (this.selectedInventoryIndex !== null && this.player) {
          const invIndex = this.selectedInventoryIndex;
          const slot = this.player.inventory[invIndex];
          if (slot) {
            this.showInGamePrompt({
              title: 'Deposit Items',
              message: `How many ${ITEMS[slot.itemId]?.name || 'items'} to deposit?`,
              defaultValue: slot.quantity,
              min: 1,
              max: slot.quantity,
              confirmText: 'Deposit',
              onConfirm: (count) => {
                this.sendWs({ type: 'DEPOSIT_ITEM', inventoryIndex: invIndex, quantity: count });
              },
            });
          }
          ctxMenu.classList.add('hidden');
        }
      };
    }

    const ctxBtnDepAll = document.getElementById('ctx-btn-deposit-all');
    if (ctxBtnDepAll && ctxMenu) {
      ctxBtnDepAll.onclick = () => {
        if (this.selectedInventoryIndex !== null && this.player) {
          const slot = this.player.inventory[this.selectedInventoryIndex];
          const qty = slot ? slot.quantity : undefined;
          this.sendWs({ type: 'DEPOSIT_ITEM', inventoryIndex: this.selectedInventoryIndex, quantity: qty });
          ctxMenu.classList.add('hidden');
        }
      };
    }

    const topLogoutBtn = document.getElementById('btn-top-logout');
    if (topLogoutBtn) {
      topLogoutBtn.onclick = () => {
        this.showInGameConfirm({
          title: 'Log Out',
          message: 'Are you sure you want to log out of Eldoria?',
          confirmText: 'Log Out',
          cancelText: 'Cancel',
          onConfirm: () => {
            this.handleLogout();
          },
        });
      };
    }

    const editorClose = document.getElementById('editor-drawer-close-btn');
    if (editorClose) {
      editorClose.onclick = () => {
        this.switchDrawer('skills');
      };
    }

    const npcClose = document.getElementById('npc-modal-close-btn');
    if (npcClose) {
      npcClose.onclick = () => {
        document.getElementById('npc-dialogue-modal')!.classList.add('hidden');
      };
    }


    const btnActionDeposit = document.getElementById('btn-action-deposit');
    if (btnActionDeposit) {
      btnActionDeposit.onclick = () => {
        if (this.selectedInventoryIndex !== null) {
          this.sendWs({ type: 'DEPOSIT_ITEM', inventoryIndex: this.selectedInventoryIndex });
        }
      };
    }



    document.getElementById('btn-deposit-all')!.onclick = () => {
      this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
    };

    const btnInvDeposit = document.getElementById('btn-inv-deposit-all');
    if (btnInvDeposit) {
      btnInvDeposit.onclick = () => {
        this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
      };
    }

    document.getElementById('btn-drawer-open-hearth')!.onclick = () => {
      this.openStorageModal();
    };

    this.setupProfileModal();
  }

  private setupSoundAndMinimap() {
    // Preload authentic game audio buffers
    sound.preloadCommonSounds();

    const soundBtn = document.getElementById('btn-sound-toggle');
    const toolSoundBtn = document.getElementById('tool-btn-sound');
    const popover = document.getElementById('sound-settings-popover');
    const popoverClose = document.getElementById('btn-sound-popover-close');
    const headerIcon = document.getElementById('sound-header-icon');
    const muteCheckbox = document.getElementById('sound-mute-checkbox') as HTMLInputElement | null;
    const statusBadge = document.getElementById('sound-status-badge');
    const masterSlider = document.getElementById('sound-master-slider') as HTMLInputElement | null;
    const masterVal = document.getElementById('sound-master-val');
    const sfxSlider = document.getElementById('sound-sfx-slider') as HTMLInputElement | null;
    const sfxVal = document.getElementById('sound-sfx-val');

    if (headerIcon) headerIcon.innerHTML = ICONS.soundOn;

    // Toggle popover visibility on sound button click
    if (soundBtn && popover) {
      soundBtn.onclick = (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
        if (!popover.classList.contains('hidden')) {
          sound.preloadCommonSounds();
        }
      };

      // Right-click or shift-click on button does quick mute toggle
      soundBtn.oncontextmenu = (e) => {
        e.preventDefault();
        sound.toggle();
      };
    }

    if (toolSoundBtn && popover) {
      toolSoundBtn.onclick = (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
        if (!popover.classList.contains('hidden')) {
          sound.preloadCommonSounds();
        }
      };

      toolSoundBtn.oncontextmenu = (e) => {
        e.preventDefault();
        sound.toggle();
      };
    }

    if (popoverClose && popover) {
      popoverClose.onclick = (e) => {
        e.stopPropagation();
        popover.classList.add('hidden');
      };
    }

    // Close popover when clicking anywhere outside
    window.addEventListener('click', (e) => {
      if (popover && !popover.classList.contains('hidden')) {
        const target = e.target as HTMLElement;
        if (!popover.contains(target) && target !== soundBtn && !soundBtn?.contains(target) && target !== toolSoundBtn && !toolSoundBtn?.contains(target)) {
          popover.classList.add('hidden');
        }
      }
    });

    // Master Mute Checkbox
    if (muteCheckbox) {
      muteCheckbox.checked = sound.enabled;
      muteCheckbox.onchange = () => {
        sound.setEnabled(muteCheckbox.checked);
      };
    }

    // Master Volume Slider
    if (masterSlider) {
      masterSlider.value = Math.round(sound.masterVolume * 100).toString();
      if (masterVal) masterVal.textContent = `${Math.round(sound.masterVolume * 100)}%`;
      masterSlider.oninput = () => {
        const v = parseInt(masterSlider.value) / 100;
        sound.setMasterVolume(v);
        if (masterVal) masterVal.textContent = `${Math.round(v * 100)}%`;
      };
    }

    // SFX Volume Slider
    if (sfxSlider) {
      sfxSlider.value = Math.round(sound.sfxVolume * 100).toString();
      if (sfxVal) sfxVal.textContent = `${Math.round(sound.sfxVolume * 100)}%`;
      sfxSlider.oninput = () => {
        const v = parseInt(sfxSlider.value) / 100;
        sound.setSfxVolume(v);
        if (sfxVal) sfxVal.textContent = `${Math.round(v * 100)}%`;
      };
    }

    // Presets
    document.querySelectorAll('.btn-sound-preset').forEach((btn) => {
      const b = btn as HTMLButtonElement;
      b.onclick = () => {
        const m = parseInt(b.dataset.master || '35') / 100;
        const s = parseInt(b.dataset.sfx || '60') / 100;
        if (m === 0) {
          sound.setEnabled(false);
        } else {
          sound.setEnabled(true);
          sound.setMasterVolume(m);
          sound.setSfxVolume(s);
        }
        sound.play('click');
      };
    });

    // Test Soundboard
    document.querySelectorAll('.btn-sound-test').forEach((btn) => {
      const b = btn as HTMLButtonElement;
      b.onclick = (e) => {
        e.stopPropagation();
        const soundKey = b.dataset.sound || 'click';
        sound.play(soundKey);
      };
    });

    // Reactive listener syncing SoundManager state with UI
    const updateUIState = (master: number, sfx: number, enabled: boolean) => {
      if (soundBtn) {
        const iconSpan = soundBtn.querySelector('#sound-btn-icon') || soundBtn;
        const textSpan = soundBtn.querySelector('#sound-btn-text');
        iconSpan.innerHTML = enabled ? ICONS.soundOn : ICONS.soundOff;
        if (textSpan) {
          textSpan.textContent = enabled ? `${Math.round(master * 100)}%` : 'Muted';
        }
        soundBtn.classList.toggle('muted', !enabled);
        soundBtn.title = enabled
          ? `Audio: ${Math.round(master * 100)}% (Click for settings, Right-click to mute)`
          : 'Audio: Muted (Click to unmute)';
      }
      if (toolSoundBtn) {
        toolSoundBtn.innerHTML = enabled ? ICONS.soundOn : ICONS.soundOff;
        toolSoundBtn.classList.toggle('muted', !enabled);
        toolSoundBtn.title = enabled
          ? `Audio Controls: ${Math.round(master * 100)}%`
          : 'Audio: Muted (Click to unmute)';
      }
      if (muteCheckbox) muteCheckbox.checked = enabled;
      if (statusBadge) {
        statusBadge.textContent = enabled ? 'Active' : 'Muted';
        statusBadge.className = enabled ? 'badge-status-on' : 'badge-status-off';
      }
      if (masterSlider) masterSlider.value = Math.round(master * 100).toString();
      if (masterVal) masterVal.textContent = `${Math.round(master * 100)}%`;
      if (sfxSlider) sfxSlider.value = Math.round(sfx * 100).toString();
      if (sfxVal) sfxVal.textContent = `${Math.round(sfx * 100)}%`;
    };

    sound.onVolumeChange(updateUIState);
    updateUIState(sound.masterVolume, sound.sfxVolume, sound.enabled);

    const minimapBtn = document.getElementById('btn-minimap-toggle');
    const minimapCard = document.getElementById('minimap-card');
    if (minimapBtn && minimapCard) {
      minimapBtn.onclick = () => {
        minimapCard.classList.toggle('hidden');
      };
    }

    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomInBtn) {
      zoomInBtn.onclick = () => this.renderer.zoomIn();
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => this.renderer.zoomOut();
    }

    const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (minimapCanvas) {
      this.renderer.setMinimapCanvas(minimapCanvas);
      minimapCanvas.addEventListener('click', (e) => {
        if (!this.player) return;
        const rect = minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cx = minimapCanvas.width / 2;
        const cy = minimapCanvas.height / 2;
        const scale = minimapCanvas.width / (17 * 2); // 4px per tile
        const dxTiles = (clickX - cx) / scale;
        const dyTiles = (clickY - cy) / scale;
        const targetX = Math.round(this.player.x + dxTiles);
        const targetY = Math.round(this.player.y + dyTiles);
        this.sendWs({ type: 'MOVE_TO', x: targetX, y: targetY });
      });
    }
  }

  private setupWorldMapModal() {
    const mapBtn = document.getElementById('btn-worldmap-toggle');
    const closeBtn = document.getElementById('world-map-close-btn');
    if (mapBtn) {
      mapBtn.onclick = () => this.toggleWorldMapModal();
    }
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.getElementById('world-map-modal')?.classList.add('hidden');
      };
    }

    const canvas = document.getElementById('world-map-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.addEventListener('click', (e) => {
        if (!this.player) return;
        const stitched = this.renderer.getStitchedWorld();
        if (!stitched) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldWidthPx = (stitched.maxTileX - stitched.minTileX) * TILE_SIZE;
        const worldHeightPx = (stitched.maxTileY - stitched.minTileY) * TILE_SIZE;

        const scaleX = worldWidthPx / canvas.width;
        const scaleY = worldHeightPx / canvas.height;

        const worldPxX = clickX * scaleX;
        const worldPxY = clickY * scaleY;

        const tileX = stitched.minTileX + Math.floor(worldPxX / TILE_SIZE);
        const tileY = stitched.minTileY + Math.floor(worldPxY / TILE_SIZE);

        this.sendWs({ type: 'MOVE_TO', x: tileX, y: tileY });
        this.renderer.setDestinationMarker(tileX, tileY);
        this.showToast(`Navigating to (${tileX}, ${tileY})...`);
        document.getElementById('world-map-modal')?.classList.add('hidden');
      });
    }
  }

  private toggleWorldMapModal() {
    const modal = document.getElementById('world-map-modal');
    if (!modal) return;
    const isOpening = modal.classList.contains('hidden');
    modal.classList.toggle('hidden');
    if (isOpening) {
      this.renderWorldMap();
    }
  }

  private renderWorldMap() {
    const canvas = document.getElementById('world-map-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const terrain = this.renderer.getTerrainCanvas();
    const stitched = this.renderer.getStitchedWorld();
    if (!terrain || !stitched) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw scaled down terrain
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain, 0, 0, canvas.width, canvas.height);

    const worldWidthPx = (stitched.maxTileX - stitched.minTileX) * TILE_SIZE;
    const worldHeightPx = (stitched.maxTileY - stitched.minTileY) * TILE_SIZE;
    const scaleX = canvas.width / worldWidthPx;
    const scaleY = canvas.height / worldHeightPx;

    // Draw Nodes
    for (const node of this.worldNodes) {
      if (node.x < stitched.minTileX || node.x > stitched.maxTileX || node.y < stitched.minTileY || node.y > stitched.maxTileY) continue;
      const nx = ((node.x - stitched.minTileX) * TILE_SIZE + TILE_SIZE / 2) * scaleX;
      const ny = ((node.y - stitched.minTileY) * TILE_SIZE + TILE_SIZE / 2) * scaleY;

      let color = '#ffd700';
      if (node.type === 'monster') color = '#e53e3e';
      else if (node.type === 'tree') color = '#38a169';
      else if (node.type === 'mine') color = '#d97706';
      else if (node.type === 'water') color = '#3182ce';
      else if (node.type === 'hearth_counter') color = '#ffd700';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, node.type === 'hearth_counter' ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw NPCs
    for (const npc of this.npcs) {
      if (npc.x < stitched.minTileX || npc.x > stitched.maxTileX || npc.y < stitched.minTileY || npc.y > stitched.maxTileY) continue;
      const nx = ((npc.x - stitched.minTileX) * TILE_SIZE + TILE_SIZE / 2) * scaleX;
      const ny = ((npc.y - stitched.minTileY) * TILE_SIZE + TILE_SIZE / 2) * scaleY;
      ctx.fillStyle = '#81e6d9';
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Local Player
    if (this.player) {
      if (this.player.x >= stitched.minTileX && this.player.x <= stitched.maxTileX && this.player.y >= stitched.minTileY && this.player.y <= stitched.maxTileY) {
        const px = ((this.player.x - stitched.minTileX) * TILE_SIZE + TILE_SIZE / 2) * scaleX;
        const py = ((this.player.y - stitched.minTileY) * TILE_SIZE + TILE_SIZE / 2) * scaleY;

        // Pulsing ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ecc94b';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private setupQuestTracker() {
    try {
      const savedAccepted = localStorage.getItem('eldoria_accepted_quests');
      if (savedAccepted) {
        this.acceptedQuests = new Set(JSON.parse(savedAccepted));
      }
      const savedCompleted = localStorage.getItem('eldoria_completed_quests');
      if (savedCompleted) {
        this.completedQuests = new Set(JSON.parse(savedCompleted));
      }
    } catch (_) {}

    // Default pin the first available quest only if not completed or repeatable
    if (this.acceptedQuests.size === 0 && this.quests.length > 0) {
      const firstAvailable = this.quests.find(q => !this.completedQuests.has(q.id) || q.repeatable);
      if (firstAvailable) {
        this.acceptedQuests.add(firstAvailable.id);
      }
    }

    const toggleBtn = document.getElementById('quest-tracker-toggle-btn');
    const card = document.getElementById('quest-tracker-card');
    if (toggleBtn && card) {
      toggleBtn.onclick = () => {
        card.classList.toggle('collapsed');
        toggleBtn.innerHTML = card.classList.contains('collapsed') ? ICONS.chevronUp : ICONS.chevronDown;
      };
    }

    this.updateQuestTracker();
  }

  private saveQuestState() {
    try {
      localStorage.setItem('eldoria_accepted_quests', JSON.stringify(Array.from(this.acceptedQuests)));
      localStorage.setItem('eldoria_completed_quests', JSON.stringify(Array.from(this.completedQuests)));
    } catch (_) {}
  }

  private updateQuestTracker() {
    const listEl = document.getElementById('quest-tracker-list');
    if (!listEl) return;

    if (this.player?.completedQuests) {
      for (const qid of this.player.completedQuests) {
        this.completedQuests.add(qid);
        this.acceptedQuests.delete(qid);
      }
    }

    if (this.acceptedQuests.size === 0) {
      listEl.innerHTML = `<div style="font-size:0.68rem; color:var(--parchment-sub); font-style:italic;">No active bounties. Speak to NPCs in town to embark on quests!</div>`;
      return;
    }

    listEl.innerHTML = '';
    for (const qId of this.acceptedQuests) {
      const quest = this.quests.find(q => q.id === qId);
      if (!quest) continue;

      let current = 0;
      const target = quest.objective.count;

      if (quest.objective.type === 'gather') {
        if (this.player) {
          current = this.player.inventory.reduce((acc, slot) => {
            if (slot && slot.itemId === quest.objective.targetId) return acc + slot.quantity;
            return acc;
          }, 0);
        }
      } else if (quest.objective.type === 'kill') {
        current = this.player?.questProgress?.[quest.id] || (this.player?.currentTask?.recipeId === quest.objective.targetId ? this.player.currentTask.completedQuantity || 0 : 0);
      }

      current = Math.min(target, current);
      const isComplete = current >= target;
      const pct = Math.min(100, Math.round((current / target) * 100));

      const itemEl = document.createElement('div');
      itemEl.className = 'quest-tracker-item';
      itemEl.innerHTML = `
        <div class="quest-tracker-name">
          <span>${quest.title}</span>
          <span style="font-size:0.66rem; color:${isComplete ? '#38a169' : '#84613b'}; font-weight:800;">${current}/${target}</span>
        </div>
        <div style="font-size:0.65rem; color:var(--parchment-sub); line-height:1.2; margin-bottom:2px;">
          ${quest.objective.type.toUpperCase()}: ${quest.objective.targetId.replace(/_/g, ' ')}
        </div>
        <div class="quest-tracker-bar">
          <div class="quest-tracker-bar-fill ${isComplete ? 'complete' : ''}" style="width: ${pct}%;"></div>
        </div>
        <div class="quest-tracker-reward">
          <span><span class="svg-icon-inline icon-sm">${ICONS.gold}</span> ${quest.reward.gold || 0}G • <span class="svg-icon-inline icon-sm">${ICONS.star}</span> ${typeof quest.reward.xp === 'number' ? quest.reward.xp : (quest.reward.xp?.amount || 0)} XP</span>
          ${isComplete ? `<button class="btn-claim-quest" data-qid="${quest.id}">Claim!</button>` : ''}
        </div>
      `;

      if (isComplete) {
        const btn = itemEl.querySelector('.btn-claim-quest') as HTMLButtonElement;
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            this.claimQuestReward(quest);
          };
        }
      }

      listEl.appendChild(itemEl);
    }
  }

  private claimQuestReward(quest: QuestDefinition) {
    this.acceptedQuests.delete(quest.id);
    this.completedQuests.add(quest.id);
    this.saveQuestState();

    this.sendWs({ type: 'CLAIM_QUEST_REWARD', questId: quest.id });

    sound.play('coin');
    if (this.player) {
      this.renderer.spawnParticles(this.player.x, this.player.y, 25, 'gold_crit');
    }
    const xpAmt = typeof quest.reward.xp === 'number' ? quest.reward.xp : (quest.reward.xp?.amount || 0);
    this.showToast(`Bounty Complete! Claimed ${quest.reward.gold || 0} Gold & ${xpAmt} XP!`);
    this.appendChatMessage({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'Quest Guild',
      channel: 'Loot',
      text: `Completed "${quest.title}"! Received ${quest.reward.gold || 0} Gold & ${xpAmt} XP.`,
    });
    this.updateQuestTracker();
  }

  private setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      // 1. Ignore if typing in text inputs
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement
      ) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      // Enter key: Focus chat input
      if (e.code === 'Enter') {
        const chatIn = document.getElementById('chat-input') as HTMLInputElement | null;
        if (chatIn) {
          chatIn.focus();
          e.preventDefault();
          return;
        }
      }

      // Ignore auto-repeated events for hotkeys/actions
      if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        return;
      }

      // 2. Escape: Close any open modal or drawer
      if (e.key === 'Escape') {
        const worldMapModal = document.getElementById('world-map-modal');
        if (worldMapModal && !worldMapModal.classList.contains('hidden')) {
          worldMapModal.classList.add('hidden');
          return;
        }
        const storageModal = document.getElementById('deepvein-storage-modal');
        if (storageModal && !storageModal.classList.contains('hidden')) {
          this.closeStorageModal();
          return;
        }
        const npcModal = document.getElementById('npc-dialogue-modal');
        if (npcModal && !npcModal.classList.contains('hidden')) {
          npcModal.classList.add('hidden');
          return;
        }
        const levelUpBanner = document.getElementById('level-up-banner');
        if (levelUpBanner && !levelUpBanner.classList.contains('hidden')) {
          levelUpBanner.classList.add('hidden');
          if (this.levelUpTimer) clearTimeout(this.levelUpTimer);
          return;
        }
        const bestiaryModal = document.getElementById('bestiary-modal');
        if (bestiaryModal && !bestiaryModal.classList.contains('hidden')) {
          bestiaryModal.classList.add('hidden');
          return;
        }
        const combatDir = document.getElementById('combat-directory-modal');
        if (combatDir && !combatDir.classList.contains('hidden')) {
          combatDir.classList.add('hidden');
          return;
        }
        return;
      }

      // 3. Movement with WASD / Arrow Keys
      let dx = 0;
      let dy = 0;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') dy = -1;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') dy = 1;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') dx = -1;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') dx = 1;

      if (dx !== 0 || dy !== 0) {
        if (this.player) {
          const targetX = this.player.x + dx;
          const targetY = this.player.y + dy;
          const world = this.renderer.getStitchedWorld();
          const inVoid = world && !isTileInAnyLevel(targetX, targetY, world.levels);
          if (!inVoid && !this.renderer.getCollisions().has(`${targetX},${targetY}`)) {
            this.pendingNpcTarget = null;
            this.pendingMonsterTarget = null;
            this.pendingHearthTarget = null;
            this.sendWs({ type: 'MOVE_TO', x: targetX, y: targetY });
          }
        }
        e.preventDefault();
        return;
      }

      // 4. Hotkeys
      if (e.code === 'KeyI') {
        const invDrawer = document.getElementById('inventory-drawer');
        if (invDrawer?.classList.contains('open')) {
          this.switchDrawer('skills');
        } else {
          this.switchDrawer('inventory');
        }
        e.preventDefault();
      } else if (e.code === 'KeyK') {
        this.switchDrawer('skills');
        e.preventDefault();
      } else if (e.code === 'KeyC' || e.code === 'KeyE') {
        const eqDrawer = document.getElementById('equipment-drawer');
        if (eqDrawer?.classList.contains('open')) {
          this.switchDrawer('skills');
        } else {
          this.switchDrawer('equipment');
        }
        e.preventDefault();
      } else if (e.code === 'KeyB') {
        const modal = document.getElementById('deepvein-storage-modal');
        if (modal?.classList.contains('hidden')) {
          this.openStorageModal();
        } else {
          this.closeStorageModal();
        }
        e.preventDefault();
      } else if (e.code === 'KeyF') {
        this.openCombatDirectory();
        e.preventDefault();
      } else if (e.code === 'KeyH') {
        const hearth = this.getHearthLocation(this.player?.x, this.player?.y);
        this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
        this.openStorageModal();
        this.showToast('Heading to the bank...');
        e.preventDefault();
      } else if (e.code === 'KeyM') {
        this.toggleWorldMapModal();
        e.preventDefault();
      } else if (e.code === 'KeyU') {
        const popover = document.getElementById('sound-settings-popover');
        if (popover) {
          popover.classList.toggle('hidden');
          if (!popover.classList.contains('hidden')) {
            sound.preloadCommonSounds();
          }
        }
        e.preventDefault();
      } else if (e.code === 'Space') {
        this.quickEatFood();
        e.preventDefault();
      }
    });
  }

  private quickEatFood() {
    if (!this.player) return;
    const foodIdx = this.player.inventory.findIndex(slot => slot && ITEMS[slot.itemId]?.baseStats?.healing);
    if (foodIdx !== -1) {
      const slot = this.player.inventory[foodIdx];
      const def = ITEMS[slot.itemId];
      const heal = def.baseStats?.healing || 10;
      sound.play('eat');
      this.renderer.addFloatingText(this.player.x, this.player.y, `+${heal}`, 'heal');
      this.sendWs({ type: 'EAT_FOOD', inventoryIndex: foodIdx });
      this.showToast(`Ate ${def.name} (+${heal} HP)`);
    } else {
      this.showToast("You don't have any food in your bag!");
    }
  }

  private setupLevelUpCelebration() {
    const closeBtn = document.getElementById('level-up-close-btn');
    const banner = document.getElementById('level-up-banner');
    if (closeBtn && banner) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        banner.classList.add('hidden');
        if (this.levelUpTimer) clearTimeout(this.levelUpTimer);
      };
    }
  }

  private checkSkillLevelUps(player: PlayerData) {
    if (this.previousSkillLevels.size === 0) {
      for (const [sk, data] of Object.entries(player.skills)) {
        this.previousSkillLevels.set(sk, (data as any).level);
      }
      return;
    }

    for (const [sk, data] of Object.entries(player.skills)) {
      const currentLevel = (data as any).level;
      const prev = this.previousSkillLevels.get(sk) ?? currentLevel;
      if (currentLevel > prev) {
        this.showLevelUpModal(sk, currentLevel);
      }
    }
  }

  private showLevelUpModal(skill: string, newLevel: number) {
    const prev = this.previousSkillLevels.get(skill);
    if (prev !== undefined && newLevel <= prev) {
      return;
    }
    this.previousSkillLevels.set(skill, newLevel);

    sound.play('levelup');
    if (this.player) {
      this.renderer.showLevelUpCelebration(this.player.x, this.player.y, skill, newLevel);
    }
    this.appendChatMessage({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: 'System',
      channel: 'System',
      text: `LEVEL UP! You reached ${skill.toUpperCase()} Level ${newLevel}!`,
    });

    const banner = document.getElementById('level-up-banner');
    if (!banner) return;

    const iconEl = document.getElementById('level-up-icon');
    const skillEl = document.getElementById('level-up-skill');
    const levelEl = document.getElementById('level-up-level');
    const unlocksContainer = document.getElementById('level-up-unlocks');
    const listEl = document.getElementById('level-up-unlock-list');

    if (iconEl) iconEl.innerHTML = ICONS[skill] || ICONS.star;
    if (skillEl) skillEl.textContent = skill.charAt(0).toUpperCase() + skill.slice(1);
    if (levelEl) levelEl.textContent = newLevel.toString();

    if (listEl && unlocksContainer) {
      listEl.innerHTML = '';
      const unlocks: string[] = [];

      for (const rec of Object.values(RECIPES)) {
        if (rec.skill === skill && rec.levelReq === newLevel) {
          unlocks.push(rec.name);
        }
      }

      for (const item of Object.values(ITEMS)) {
        if (item.equipReq && item.equipReq.skill === skill && item.equipReq.level === newLevel) {
          unlocks.push(item.name);
        }
      }

      if (skill === 'melee' || skill === 'ranged' || skill === 'magic' || skill === 'defence') {
        for (const mob of Object.values(MONSTERS)) {
          if (mob.level === newLevel) {
            unlocks.push(mob.name);
          }
        }
      }

      if (unlocks.length > 0) {
        unlocksContainer.classList.remove('hidden');
        for (const u of unlocks.slice(0, 3)) {
          const pill = document.createElement('span');
          pill.className = 'unlock-item-pill';
          pill.innerHTML = `<span class="svg-icon-inline icon-sm">${ICONS.spark}</span> ${u}`;
          listEl.appendChild(pill);
        }
        if (unlocks.length > 3) {
          const more = document.createElement('span');
          more.className = 'unlock-item-pill';
          more.textContent = `+${unlocks.length - 3} more`;
          listEl.appendChild(more);
        }
      } else {
        unlocksContainer.classList.add('hidden');
      }
    }

    banner.classList.remove('hidden');

    if (this.levelUpTimer) {
      clearTimeout(this.levelUpTimer);
    }
    this.levelUpTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 4500);
  }

  private setupBestiary() {
    const btnBestiary = document.getElementById('btn-quick-bestiary');
    const bestiaryModal = document.getElementById('bestiary-modal');
    const bestiaryClose = document.getElementById('bestiary-close-btn');
    const searchInput = document.getElementById('bestiary-search-input') as HTMLInputElement;

    if (btnBestiary && bestiaryModal) {
      btnBestiary.onclick = () => {
        bestiaryModal.classList.remove('hidden');
        this.renderBestiaryList(searchInput?.value || '');
      };
    }

    if (bestiaryClose && bestiaryModal) {
      bestiaryClose.onclick = () => bestiaryModal.classList.add('hidden');
    }

    if (searchInput) {
      searchInput.oninput = () => {
        this.renderBestiaryList(searchInput.value);
      };
    }
  }

  private renderBestiaryList(query: string) {
    const list = document.getElementById('bestiary-list');
    if (!list) return;
    list.innerHTML = '';
    const q = query.toLowerCase().trim();

    const mobs = Object.values(MONSTERS).filter(m => {
      if (!q) return true;
      const gItem = m.guaranteedDropItemId ? ITEMS[m.guaranteedDropItemId]?.name : '';
      const rItem = m.rareDrop ? ITEMS[m.rareDrop.itemId]?.name : '';
      return m.name.toLowerCase().includes(q) ||
        m.zone.toLowerCase().includes(q) ||
        (gItem && gItem.toLowerCase().includes(q)) ||
        (rItem && rItem.toLowerCase().includes(q));
    });

    mobs.sort((a, b) => a.level - b.level);

    for (const m of mobs) {
      const card = document.createElement('div');
      card.className = 'bestiary-entry';

      const gDropName = m.guaranteedDropItemId && ITEMS[m.guaranteedDropItemId] ? ITEMS[m.guaranteedDropItemId].name : 'None';
      const gDropIcon = m.guaranteedDropItemId ? getItemIconSvg(m.guaranteedDropItemId, ITEMS[m.guaranteedDropItemId]?.category) : ICONS.crate;
      let rareDropHtml = '';
      if (m.rareDrop && ITEMS[m.rareDrop.itemId]) {
        const rName = ITEMS[m.rareDrop.itemId].name;
        const rIcon = getItemIconSvg(m.rareDrop.itemId, ITEMS[m.rareDrop.itemId]?.category);
        const pct = (m.rareDrop.chance * 100).toFixed(2);
        rareDropHtml = `<span class="bestiary-drop-pill" style="border-color: #805c2a; color: #ffd699;"><span class="svg-icon-inline icon-sm">${rIcon}</span> ${rName} <span class="bestiary-drop-rate">(${pct}%)</span></span>`;
      }

      card.innerHTML = `
        <div class="bestiary-entry-header">
          <span class="bestiary-mob-name">${m.name}</span>
          <span class="bestiary-mob-level">Lvl ${m.level}</span>
        </div>
        <div style="font-size:0.68rem; color:#a0aec0; font-style:italic;">Zone: ${m.zone}</div>
        <div class="bestiary-mob-stats">
          <span>HP: <b>${m.hp}</b></span>
          <span>Max Hit: <b>${m.maxHit}</b></span>
          <span>Coins: <b>${m.minCoins}-${m.maxCoins}</b></span>
        </div>
        <div class="bestiary-drops-container">
          <span class="bestiary-drops-title">Spoils & Drops:</span>
          <div class="bestiary-drops-pills">
            <span class="bestiary-drop-pill"><span class="svg-icon-inline icon-sm">${gDropIcon}</span> ${gDropName} <span class="bestiary-drop-rate">(100%)</span></span>
            ${rareDropHtml}
          </div>
        </div>
      `;
      list.appendChild(card);
    }
  }

  private setupItemTooltips() {
    window.addEventListener('blur', () => {
      const tooltip = document.getElementById('item-hover-tooltip');
      if (tooltip) tooltip.classList.add('hidden');
      const skillTooltip = document.getElementById('skill-hover-tooltip');
      if (skillTooltip) skillTooltip.classList.add('hidden');
    });
  }

  private attachSkillTooltip(el: HTMLElement, skillKey: SkillType) {
    const tooltip = document.getElementById('skill-hover-tooltip');
    if (!tooltip) return;

    el.addEventListener('mouseenter', (e: MouseEvent) => {
      if (!this.player) return;
      const record = this.player.skills[skillKey] || { level: 1, xp: 0 };
      const currentXp = Math.floor(record.xp || 0);
      const level = record.level || 1;
      const currentLvlXp = getXpForLevel(level);
      const nextLvlXp = getXpForLevel(level + 1);
      const needed = Math.max(1, nextLvlXp - currentLvlXp);
      const progress = Math.max(0, currentXp - currentLvlXp);
      const remaining = Math.max(0, nextLvlXp - currentXp);
      const percent = Math.min(100, (progress / needed) * 100);

      const iconEl = document.getElementById('skill-tooltip-icon');
      const nameEl = document.getElementById('skill-tooltip-name');
      const lvlEl = document.getElementById('skill-tooltip-level');
      const curXpEl = document.getElementById('skill-tooltip-current-xp');
      const nextXpEl = document.getElementById('skill-tooltip-next-xp');
      const remXpEl = document.getElementById('skill-tooltip-remaining-xp');
      const progEl = document.getElementById('skill-tooltip-progress-text');
      const fillEl = document.getElementById('skill-tooltip-fill');

      const cleanName = skillKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (iconEl) iconEl.innerHTML = ICONS[skillKey] || ICONS.skills;
      if (nameEl) nameEl.textContent = cleanName;
      if (lvlEl) lvlEl.textContent = `Lv ${level}`;
      if (curXpEl) curXpEl.textContent = `${currentXp.toLocaleString()} XP`;
      if (nextXpEl) nextXpEl.textContent = `${nextLvlXp.toLocaleString()} XP`;
      if (remXpEl) remXpEl.textContent = `${remaining.toLocaleString()} XP`;
      if (progEl) progEl.textContent = `${progress.toLocaleString()} / ${needed.toLocaleString()} (${percent.toFixed(1)}%)`;
      if (fillEl) fillEl.style.width = `${percent.toFixed(1)}%`;

      tooltip.classList.remove('hidden');
      const tx = Math.min(window.innerWidth - 240, e.clientX + 14);
      const ty = Math.min(window.innerHeight - 170, e.clientY + 14);
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${ty}px`;
    });

    el.addEventListener('mousemove', (e: MouseEvent) => {
      const tx = Math.min(window.innerWidth - 240, e.clientX + 14);
      const ty = Math.min(window.innerHeight - 170, e.clientY + 14);
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${ty}px`;
    });

    el.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  }

  private attachItemTooltip(el: HTMLElement, slot: { itemId: string; rarity?: string; plus?: number } | null, equipSlotType?: EquipSlot) {
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def) return;

    const tooltip = document.getElementById('item-hover-tooltip');
    if (!tooltip) return;

    el.addEventListener('mouseenter', (e: MouseEvent) => {
      const nameEl = document.getElementById('tooltip-name');
      const typeEl = document.getElementById('tooltip-type');
      const statsListEl = document.getElementById('tooltip-stats');
      const compEl = document.getElementById('tooltip-comparison');
      const flavorEl = document.getElementById('tooltip-flavor');

      const rarityColor = slot.rarity === 'legendary' ? '#f59e0b' :
                          slot.rarity === 'epic' ? '#a855f7' :
                          slot.rarity === 'rare' ? '#3b82f6' :
                          slot.rarity === 'uncommon' ? '#22c55e' : '#ffd700';

      if (nameEl) {
        nameEl.textContent = `${def.name}${slot.plus ? ` +${slot.plus}` : ''}`;
        nameEl.style.color = rarityColor;
      }

      if (typeEl) {
        typeEl.textContent = `${slot.rarity || 'common'} ${def.category.replace('_', ' ')}`;
      }

      if (statsListEl) {
        statsListEl.innerHTML = '';
        if (def.baseStats) {
          if (def.baseStats.accuracy) {
            statsListEl.innerHTML += `<div class="tooltip-stat-row"><span>Accuracy</span><span>+${def.baseStats.accuracy}</span></div>`;
          }
          if (def.baseStats.strength) {
            statsListEl.innerHTML += `<div class="tooltip-stat-row"><span>Strength</span><span>+${def.baseStats.strength}</span></div>`;
          }
          if (def.baseStats.defence) {
            statsListEl.innerHTML += `<div class="tooltip-stat-row"><span>Defence</span><span>+${def.baseStats.defence}</span></div>`;
          }
          if (def.baseStats.healing) {
            statsListEl.innerHTML += `<div class="tooltip-stat-row" style="color:#48bb78;"><span>Restores HP</span><span>+${def.baseStats.healing}</span></div>`;
          }
          if (def.baseStats.toolSpeedBonus) {
            statsListEl.innerHTML += `<div class="tooltip-stat-row" style="color:#ecc94b;"><span>Gathering Bonus</span><span>+${Math.round(def.baseStats.toolSpeedBonus * 100)}%</span></div>`;
          }
        }
        if (def.vendorFloorPrice) {
          statsListEl.innerHTML += `<div class="tooltip-stat-row" style="color:#e2e8f0; font-size:0.68rem;"><span>Vendor Value</span><span>${def.vendorFloorPrice} Coins</span></div>`;
        }
      }

      if (compEl) {
        compEl.innerHTML = '';
        const targetEquipSlot: EquipSlot | undefined = equipSlotType || def.slot;

        if (targetEquipSlot && this.player && this.player.equipment) {
          const equipped = this.player.equipment[targetEquipSlot];
          const eqDef = equipped ? ITEMS[equipped.itemId] : null;

          const myAcc = def.baseStats?.accuracy || 0;
          const eqAcc = eqDef?.baseStats?.accuracy || 0;
          const diffAcc = myAcc - eqAcc;

          const myStr = def.baseStats?.strength || 0;
          const eqStr = eqDef?.baseStats?.strength || 0;
          const diffStr = myStr - eqStr;

          const myDef = def.baseStats?.defence || 0;
          const eqDefVal = eqDef?.baseStats?.defence || 0;
          const diffDef = myDef - eqDefVal;

          const diffParts: string[] = [];
          if (diffAcc !== 0) {
            diffParts.push(`<span class="${diffAcc > 0 ? 'stat-diff-positive' : 'stat-diff-negative'}">${diffAcc > 0 ? '+' : ''}${diffAcc} Acc</span>`);
          }
          if (diffStr !== 0) {
            diffParts.push(`<span class="${diffStr > 0 ? 'stat-diff-positive' : 'stat-diff-negative'}">${diffStr > 0 ? '+' : ''}${diffStr} Str</span>`);
          }
          if (diffDef !== 0) {
            diffParts.push(`<span class="${diffDef > 0 ? 'stat-diff-positive' : 'stat-diff-negative'}">${diffDef > 0 ? '+' : ''}${diffDef} Def</span>`);
          }

          if (diffParts.length > 0) {
            compEl.innerHTML = `<div>Vs equipped: ${diffParts.join(' ')}</div>`;
            compEl.classList.remove('hidden');
          } else {
            compEl.classList.add('hidden');
          }
        } else {
          compEl.classList.add('hidden');
        }
      }

      if (flavorEl) {
        if (def.description) {
          flavorEl.textContent = def.description;
        } else if (def.category === 'cooked_food') {
          flavorEl.textContent = 'Cooked food. Restores health when eaten.';
        } else {
          flavorEl.textContent = '';
        }
      }

      tooltip.classList.remove('hidden');
      const tx = Math.min(window.innerWidth - 240, e.clientX + 14);
      const ty = Math.min(window.innerHeight - 180, e.clientY + 14);
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${ty}px`;
    });

    el.addEventListener('mousemove', (e: MouseEvent) => {
      const tx = Math.min(window.innerWidth - 240, e.clientX + 14);
      const ty = Math.min(window.innerHeight - 180, e.clientY + 14);
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${ty}px`;
    });

    el.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  }

  private showInGameConfirm(options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) {
    const modal = document.getElementById('game-confirm-modal');
    if (!modal) {
      if (confirm(options.message)) {
        options.onConfirm();
      } else if (options.onCancel) {
        options.onCancel();
      }
      return;
    }

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const btnConfirm = document.getElementById('confirm-modal-confirm') as HTMLButtonElement | null;
    const btnCancel = document.getElementById('confirm-modal-cancel') as HTMLButtonElement | null;

    if (titleEl) titleEl.textContent = options.title || 'Confirm Action';
    if (msgEl) msgEl.textContent = options.message;
    if (btnConfirm) {
      btnConfirm.textContent = options.confirmText || 'Confirm';
      btnConfirm.className = options.confirmClass || 'btn-stop';
    }
    if (btnCancel) {
      btnCancel.textContent = options.cancelText || 'Cancel';
    }

    const cleanup = () => {
      modal.classList.add('hidden');
      if (btnConfirm) btnConfirm.onclick = null;
      if (btnCancel) btnCancel.onclick = null;
    };

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        cleanup();
        options.onConfirm();
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        cleanup();
        if (options.onCancel) options.onCancel();
      };
    }

    modal.classList.remove('hidden');
  }

  private showInGamePrompt(options: {
    title?: string;
    message: string;
    defaultValue?: number | string;
    min?: number;
    max?: number;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (val: number) => void;
    onCancel?: () => void;
  }) {
    const modal = document.getElementById('game-prompt-modal');
    if (!modal) {
      const res = prompt(options.message, String(options.defaultValue ?? '1'));
      if (res !== null) {
        const num = parseInt(res, 10);
        if (!isNaN(num) && num > 0) options.onConfirm(num);
      }
      return;
    }

    const titleEl = document.getElementById('prompt-modal-title');
    const msgEl = document.getElementById('prompt-modal-message');
    const inputEl = document.getElementById('prompt-modal-input') as HTMLInputElement | null;
    const formEl = document.getElementById('game-prompt-form') as HTMLFormElement | null;
    const btnCancel = document.getElementById('prompt-modal-cancel') as HTMLButtonElement | null;
    const btnConfirm = document.getElementById('prompt-modal-confirm') as HTMLButtonElement | null;
    const iconEl = document.getElementById('prompt-modal-icon');

    if (iconEl) iconEl.innerHTML = ICONS.gold || ICONS.satchel;
    if (titleEl) titleEl.textContent = options.title || 'Enter Amount';
    if (msgEl) msgEl.textContent = options.message;
    if (inputEl) {
      inputEl.value = String(options.defaultValue ?? '1');
      if (options.min !== undefined) inputEl.min = String(options.min);
      else inputEl.min = '1';
      if (options.max !== undefined) inputEl.max = String(options.max);
      else inputEl.removeAttribute('max');
    }
    if (btnConfirm) btnConfirm.textContent = options.confirmText || 'Submit';
    if (btnCancel) btnCancel.textContent = options.cancelText || 'Cancel';

    const cleanup = () => {
      modal.classList.add('hidden');
      if (formEl) formEl.onsubmit = null;
      if (btnCancel) btnCancel.onclick = null;
    };

    if (formEl) {
      formEl.onsubmit = (e) => {
        e.preventDefault();
        const val = parseInt(inputEl?.value || '', 10);
        if (isNaN(val) || val <= 0) {
          this.showToast('Please enter a valid positive number.');
          return;
        }
        if (options.min !== undefined && val < options.min) {
          this.showToast(`Minimum value is ${options.min}.`);
          return;
        }
        if (options.max !== undefined && val > options.max) {
          this.showToast(`Maximum value is ${options.max}.`);
          return;
        }
        cleanup();
        options.onConfirm(val);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        cleanup();
        if (options.onCancel) options.onCancel();
      };
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 50);
  }

  private openAuthModal(defaultTab: 'login' | 'register' = 'login', allowClose = true) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('auth-close-btn');
    if (closeBtn) {
      closeBtn.style.display = allowClose ? 'block' : 'none';
    }

    const errBanner = document.getElementById('auth-error-banner');
    if (errBanner) {
      errBanner.style.display = 'none';
      errBanner.textContent = '';
    }

    const guestHint = document.getElementById('register-guest-hint');
    const regUserInput = document.getElementById('register-username') as HTMLInputElement | null;
    if (this.player && this.player.isGuest) {
      if (guestHint) guestHint.style.display = 'block';
      if (regUserInput && !regUserInput.value) {
        regUserInput.value = this.player.username.startsWith('Wanderer_') ? '' : this.player.username;
      }
    } else {
      if (guestHint) guestHint.style.display = 'none';
    }

    this.switchAuthTab(defaultTab);
    modal.classList.remove('hidden');
  }

  private switchAuthTab(tab: 'login' | 'register') {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-auth-login');
    const formRegister = document.getElementById('form-auth-register');
    const errBanner = document.getElementById('auth-error-banner');

    if (errBanner) errBanner.style.display = 'none';

    if (tab === 'login') {
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
      if (formLogin) {
        formLogin.classList.remove('hidden');
        formLogin.style.display = 'flex';
      }
      if (formRegister) {
        formRegister.classList.add('hidden');
        formRegister.style.display = 'none';
      }
      (document.getElementById('login-username') as HTMLInputElement | null)?.focus();
    } else {
      tabLogin?.classList.remove('active');
      tabRegister?.classList.add('active');
      if (formLogin) {
        formLogin.classList.add('hidden');
        formLogin.style.display = 'none';
      }
      if (formRegister) {
        formRegister.classList.remove('hidden');
        formRegister.style.display = 'flex';
      }
      (document.getElementById('register-username') as HTMLInputElement | null)?.focus();
    }
  }

  private setupAuthModal() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.getElementById('auth-close-btn');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-auth-login') as HTMLFormElement | null;
    const formRegister = document.getElementById('form-auth-register') as HTMLFormElement | null;
    const btnPlayGuest = document.getElementById('btn-play-guest');
    const errBanner = document.getElementById('auth-error-banner');

    if (tabLogin) tabLogin.onclick = () => this.switchAuthTab('login');
    if (tabRegister) tabRegister.onclick = () => this.switchAuthTab('register');

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }

    const showError = (msg: string) => {
      if (errBanner) {
        errBanner.textContent = msg;
        errBanner.style.display = 'block';
      }
    };

    if (formLogin) {
      formLogin.onsubmit = async (e) => {
        e.preventDefault();
        const username = (document.getElementById('login-username') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            showError(data.error || 'Failed to log in.');
            return;
          }

          localStorage.setItem('eldoria_session_token', data.token);
          localStorage.removeItem('eldoria_guest_id');
          this.player = data.player;

          modal?.classList.add('hidden');
          this.reconnectWs();
          this.updateUI();
          this.showToast(`Welcome back, ${data.player.username}.`);
        } catch (err) {
          showError('Network error while logging in.');
        }
      };
    }

    if (formRegister) {
      formRegister.onsubmit = async (e) => {
        e.preventDefault();
        const username = (document.getElementById('register-username') as HTMLInputElement).value;
        const password = (document.getElementById('register-password') as HTMLInputElement).value;
        const confirmPass = (document.getElementById('register-password-confirm') as HTMLInputElement).value;

        if (password !== confirmPass) {
          showError('Passwords do not match.');
          return;
        }

        try {
          const guestId = (this.player && this.player.isGuest) ? this.player.id : undefined;
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, guestId }),
          });
          const data = await res.json();
          if (!res.ok) {
            showError(data.error || 'Failed to register account.');
            return;
          }

          localStorage.setItem('eldoria_session_token', data.token);
          localStorage.removeItem('eldoria_guest_id');
          this.player = data.player;

          modal?.classList.add('hidden');
          this.reconnectWs();
          this.updateUI();
          this.showToast(`Account created. Welcome to Eldoria, ${data.player.username}.`);
        } catch (err) {
          showError('Network error while creating account.');
        }
      };
    }

    if (btnPlayGuest) {
      const savedGuestId = localStorage.getItem('eldoria_guest_id');
      if (savedGuestId) {
        btnPlayGuest.textContent = 'Continue as Guest';
      }

      btnPlayGuest.onclick = async () => {
        if (this.player) {
          modal?.classList.add('hidden');
          return;
        }
        const guestIdToUse = localStorage.getItem('eldoria_guest_id') || undefined;
        try {
          const res = await fetch('/api/auth/guest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestId: guestIdToUse }),
          });
          const data = await res.json();
          this.player = data.player;
          if (this.player) {
            localStorage.setItem('eldoria_guest_id', this.player.id);
            modal?.classList.add('hidden');
            this.connectWs();
            this.updateUI();
            this.showToast(`Entering as guest: ${this.player.username}. Register anytime to save progress.`);
          }
        } catch (err) {
          showError('Failed to enter as guest. Please try again.');
        }
      };
    }
  }

  private setupProfileModal() {
    const modal = document.getElementById('account-profile-modal');
    const closeBtn = document.getElementById('profile-close-btn');
    const charPill = document.getElementById('top-character-pill');

    const btnRegisterNow = document.getElementById('btn-profile-register-now');
    const btnLoginExisting = document.getElementById('btn-profile-login-existing');
    const btnNewGuest = document.getElementById('btn-profile-new-guest');
    const btnLogout = document.getElementById('btn-account-logout');

    if (charPill) {
      charPill.onclick = () => {
        if (!this.player) {
          this.openAuthModal('login', true);
          return;
        }

        const usernameEl = document.getElementById('profile-username');
        const roleBadge = document.getElementById('profile-role-badge');
        const statusEl = document.getElementById('profile-account-status');
        const idCode = document.getElementById('profile-id-code');
        const guestBox = document.getElementById('profile-guest-box');
        const accountBox = document.getElementById('profile-account-box');

        if (usernameEl) usernameEl.textContent = this.player.username;
        if (idCode) idCode.textContent = this.player.id;

        const offlineTimeEl = document.getElementById('profile-offline-time');
        if (offlineTimeEl) {
          offlineTimeEl.textContent = formatOfflineDuration(this.player.maxOfflineSeconds || OFFLINE_TIME_CONFIG.BASE_SECONDS);
        }

        if (this.player.isGuest) {
          if (roleBadge) {
            roleBadge.textContent = 'GUEST';
            roleBadge.className = 'status-tag idle';
          }
          if (statusEl) statusEl.textContent = 'Temporary Guest Character';
          if (guestBox) guestBox.style.display = 'flex';
          if (accountBox) accountBox.style.display = 'none';
        } else {
          if (roleBadge) {
            if (this.player.role === 'admin') {
              roleBadge.textContent = 'ADMIN';
              roleBadge.className = 'status-tag';
            } else {
              roleBadge.textContent = 'ADVENTURER';
              roleBadge.className = 'status-tag';
            }
          }
          if (statusEl) statusEl.textContent = 'Persistent Registered Account';
          if (guestBox) guestBox.style.display = 'none';
          if (accountBox) accountBox.style.display = 'flex';
        }

        modal?.classList.remove('hidden');
      };
    }

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }

    if (btnRegisterNow) {
      btnRegisterNow.onclick = () => {
        modal?.classList.add('hidden');
        this.openAuthModal('register', true);
      };
    }

    if (btnLoginExisting) {
      btnLoginExisting.onclick = () => {
        modal?.classList.add('hidden');
        this.openAuthModal('login', true);
      };
    }

    if (btnNewGuest) {
      btnNewGuest.onclick = () => {
        this.showInGameConfirm({
          title: 'New Guest Character',
          message: 'Create a new guest character? Current guest progress will be reset.',
          confirmText: 'Reset & New Guest',
          cancelText: 'Cancel',
          onConfirm: () => {
            localStorage.removeItem('eldoria_guest_id');
            localStorage.removeItem('eldoria_session_token');
            window.location.reload();
          },
        });
      };
    }

    if (btnLogout) {
      btnLogout.onclick = () => {
        this.showInGameConfirm({
          title: 'Log Out',
          message: 'Are you sure you want to log out of Eldoria?',
          confirmText: 'Log Out',
          cancelText: 'Cancel',
          onConfirm: () => {
            this.handleLogout();
          },
        });
      };
    }
  }

  private async handleLogout() {
    const token = localStorage.getItem('eldoria_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {}
    }
    localStorage.removeItem('eldoria_session_token');
    localStorage.removeItem('eldoria_guest_id');
    window.location.reload();
  }

  private openItemContextMenu(index: number, e: MouseEvent) {
    this.selectedInventoryIndex = index;
    const slot = this.player?.inventory[index];
    if (!slot) return;

    const def = ITEMS[slot.itemId];
    if (!def) return;

    const menu = document.getElementById('item-context-menu');
    if (!menu) return;

    const titleEl = document.getElementById('ctx-item-name');
    if (titleEl) titleEl.textContent = def.name;

    const statsEl = document.getElementById('ctx-item-stats');
    if (statsEl) {
      const statParts: string[] = [];
      if (def.baseStats?.accuracy) statParts.push(`+${def.baseStats.accuracy} acc`);
      if (def.baseStats?.strength) statParts.push(`+${def.baseStats.strength} str`);
      if (def.baseStats?.defence) statParts.push(`+${def.baseStats.defence} def`);
      if (def.baseStats?.toolSpeedBonus) statParts.push(`+${Math.round(def.baseStats.toolSpeedBonus * 100)}% Speed`);
      if (def.baseStats?.healing) statParts.push(`Heals +${def.baseStats.healing} HP`);
      if (def.equipReq) statParts.push(`${def.equipReq.skill} ${def.equipReq.level}`);
      
      const statsLine = statParts.length > 0 ? `<div style="color: var(--gold-bright); font-weight: 600; margin-bottom: 2px;">${statParts.join(' • ')}</div>` : '';
      const descLine = def.description ? `<div style="color: #cbd5e1; font-size: 0.72rem; line-height: 1.3;">${def.description}</div>` : '';
      statsEl.innerHTML = `${statsLine}${descLine}`;
    }

    const equipBtn = document.getElementById('ctx-btn-equip');
    const isEquippable = Boolean(def.slot || def.category === 'tool' || def.category === 'weapon' || def.category === 'armour' || def.category === 'steed');
    if (equipBtn) {
      equipBtn.style.display = isEquippable ? 'flex' : 'none';
      if (isEquippable) {
        let slotName = 'Gear Slot';
        if (def.category === 'tool' || def.slot?.startsWith('tool')) {
          if (def.id.includes('pickaxe')) slotName = 'Toolbelt (Mining)';
          else if (def.id.includes('axe')) slotName = 'Toolbelt (Woodcutting)';
          else if (def.id.includes('rod') || def.id.includes('fish')) slotName = 'Toolbelt (Fishing)';
          else slotName = 'Toolbelt';
        } else if (def.slot) {
          slotName = def.slot.toUpperCase();
        }
        equipBtn.textContent = `Equip (${slotName})`;
      }
    }

    const eatBtn = document.getElementById('ctx-btn-eat');
    if (eatBtn) {
      if (slot.itemId.startsWith('gem_pack_')) {
        eatBtn.style.display = 'flex';
        eatBtn.textContent = 'Open Gem Pack';
      } else if (def.category === 'cooked_food') {
        eatBtn.style.display = 'flex';
        eatBtn.textContent = 'Eat Food';
      } else {
        eatBtn.style.display = 'none';
      }
    }

    const hearth = this.getHearthLocation(this.player?.x, this.player?.y);
    const isNearHearth = this.player && Math.hypot(this.player.x - hearth.x, this.player.y - hearth.y) <= 1.5;
    const depPrefix = isNearHearth ? 'Deposit' : 'Walk & Deposit';

    const dep1Btn = document.getElementById('ctx-btn-deposit-1');
    if (dep1Btn) dep1Btn.textContent = `${depPrefix} one`;

    const depXBtn = document.getElementById('ctx-btn-deposit-x');
    if (depXBtn) depXBtn.textContent = `${depPrefix} X...`;

    const depAllBtn = document.getElementById('ctx-btn-deposit-all');
    if (depAllBtn) {
      depAllBtn.textContent = slot.quantity > 1 ? `${depPrefix} all ${slot.quantity}` : `${depPrefix} all`;
    }

    // Position popover floating adjacent to the clicked slot
    menu.classList.remove('hidden');

    const menuWidth = 220;
    const menuHeight = menu.offsetHeight || 190;
    const target = e.currentTarget as HTMLElement;
    const rect = target && target.getBoundingClientRect ? target.getBoundingClientRect() : { left: e.clientX, top: e.clientY, width: 36 };

    // Prefer popping out to the left of the slot (inside the drawer/panel area)
    let left = rect.left - menuWidth - 6;
    if (left < 10) {
      left = rect.left + (rect.width || 36) + 6;
    }
    let top = rect.top;
    if (top + menuHeight > window.innerHeight - 10) {
      top = window.innerHeight - menuHeight - 10;
    }
    if (top < 10) top = 10;

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }



  private updateBossBanner(_boss: any) {
    const pill = document.getElementById('boss-pill');
    if (pill) {
      pill.classList.add('hidden');
      pill.style.display = 'none';
    }
  }

  private showCatchUpModal(summary: any) {
    const modal = document.getElementById('away-modal')!;
    const body = document.getElementById('away-body')!;

    const minutes = Math.floor(summary.elapsedSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${remMins}m` : `${minutes} minutes`;

    let levelUpHtml = '';
    if (summary.leveledUp) {
      if (Array.isArray(summary.levelUps) && summary.levelUps.length > 0) {
        levelUpHtml = summary.levelUps.map((lu: any) => {
          const skillCapitalized = lu.skillName.charAt(0).toUpperCase() + lu.skillName.slice(1);
          const diff = lu.startLevel ? ` (+${lu.newLevel - lu.startLevel} Levels)` : '';
          const progression = lu.startLevel ? `Lv ${lu.startLevel} → Lv ${lu.newLevel}` : `Lv ${lu.newLevel}`;
          return `
            <div style="background: rgba(223, 166, 55, 0.15); border: 1px solid var(--gold-bright); border-radius: 6px; padding: 8px 10px; margin-top: 4px;">
              <div style="font-weight: 800; color: var(--gold-bright); font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                <span class="svg-icon-inline icon-sm">${ICONS.star}</span>
                <span>${skillCapitalized} leveled up to ${progression}${diff}!</span>
              </div>
            </div>
          `;
        }).join('');
      } else if (summary.skillName && summary.newLevel) {
        const skillCapitalized = summary.skillName.charAt(0).toUpperCase() + summary.skillName.slice(1);
        const diff = summary.startLevel ? ` (+${summary.newLevel - summary.startLevel} Levels)` : '';
        const progression = summary.startLevel ? `Lv ${summary.startLevel} → Lv ${summary.newLevel}` : `Lv ${summary.newLevel}`;
        levelUpHtml = `
          <div style="background: rgba(223, 166, 55, 0.15); border: 1px solid var(--gold-bright); border-radius: 6px; padding: 8px 10px; margin-top: 4px;">
            <div style="font-weight: 800; color: var(--gold-bright); font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
              <span class="svg-icon-inline icon-sm">${ICONS.star}</span>
              <span>${skillCapitalized} leveled up to ${progression}${diff}!</span>
            </div>
          </div>
        `;
      } else {
        levelUpHtml = `
          <div style="background: rgba(223, 166, 55, 0.15); border: 1px solid var(--gold-bright); border-radius: 6px; padding: 8px 10px; margin-top: 4px;">
            <div style="font-weight: 800; color: var(--gold-bright); font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
              <span class="svg-icon-inline icon-sm">${ICONS.star}</span>
              <span>Level up! You gained levels while you were away!</span>
            </div>
          </div>
        `;
      }
    }

    let itemsHtml = '';
    if (summary.itemsGained && Object.keys(summary.itemsGained).length > 0) {
      itemsHtml = `
        <div style="margin-top: 6px;">
          <div style="font-weight: 700; color: var(--gold-light); font-size: 0.74rem; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Loot Collected:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto;">
            ${Object.entries(summary.itemsGained).map(([id, qty]) => {
              const def = ITEMS[id];
              const name = def?.name || id;
              return `<span style="background: rgba(0, 0, 0, 0.45); border: 1px solid #573c24; border-radius: 4px; padding: 3px 8px; font-size: 0.75rem; color: #fff;"><b>${qty}x</b> ${name}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <p style="margin-bottom: 8px; font-size: 0.88rem; color: #e2e8f0;">You were away for <b>${timeStr}</b>. Here's what you got done:</p>
      <div style="background: #1c1108; padding: 12px; border-radius: 6px; border: 1px solid #4a301a; display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--gold-light);">Actions Completed:</span>
          <b>${(summary.completedCycles || 0).toLocaleString()}</b>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--gold-light);">XP Earned:</span>
          <b style="color: #48bb78;">+${(summary.xpGained || 0).toLocaleString()} XP</b>
        </div>
        ${levelUpHtml}
        ${itemsHtml}
        ${summary.overflowOccurred ? `<div style="color: #f6ad55; font-size: 0.74rem; margin-top: 4px; display: flex; align-items: center; gap: 5px;"><span class="svg-icon-inline icon-sm">${ICONS.storage}</span> Your bag filled up, so extra items were safely sent to your bank.</div>` : ''}
      </div>
    `;

    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');
    document.getElementById('away-close-btn')!.onclick = close;
    document.getElementById('away-ok-btn')!.onclick = close;
  }

  private setupAfkSystem() {
    const onActivity = () => {
      this.lastUserActivity = Date.now();
    };
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('mousedown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('wheel', onActivity, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (!this.hiddenSince) this.hiddenSince = Date.now();
      } else {
        if (this.hiddenSince && Date.now() - this.hiddenSince >= this.AFK_TIMEOUT_MS) {
          this.enterAfkMode('tab_hidden');
        }
        this.hiddenSince = null;
        this.lastUserActivity = Date.now();
      }
    });

    const afkBtn = document.getElementById('afk-resume-btn');
    if (afkBtn) {
      afkBtn.addEventListener('click', () => this.resumeFromAfk());
    }

    this.afkCheckTimer = setInterval(() => {
      if (this.isAfk || !this.player) return;
      const now = Date.now();
      const inactiveTime = now - this.lastUserActivity;
      const hiddenTime = this.hiddenSince ? now - this.hiddenSince : 0;
      if (inactiveTime >= this.AFK_TIMEOUT_MS || hiddenTime >= this.AFK_TIMEOUT_MS) {
        this.enterAfkMode(hiddenTime >= this.AFK_TIMEOUT_MS ? 'tab_hidden' : 'inactivity');
      }
    }, 5000);

    this.heartbeatTimer = setInterval(() => {
      if (this.isAfk || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      } catch {}
    }, 30000);
  }

  private enterAfkMode(reason: string) {
    if (this.isAfk) return;
    this.isAfk = true;
    console.log(`[AFK] Entering slumber mode (${reason}). Suspending canvas & WebSocket...`);

    // 1. Inform server so it immediately saves exact timestamp and stops ticking this session
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'ENTER_AFK' }));
      } catch {}
      try {
        this.ws.close(4001, 'User AFK');
      } catch {}
    }

    // 2. Pause 60 FPS canvas loop to free GPU / CPU
    this.renderer.pauseRendering();

    // 3. Populate and show AFK overlay
    const overlay = document.getElementById('afk-overlay');
    const taskVal = document.getElementById('afk-routine-val');
    const iconWrap = document.getElementById('afk-icon-wrap');
    const afkMaxOfflineEl = document.getElementById('afk-max-offline-time');
    if (iconWrap) iconWrap.innerHTML = ICONS.slumber;

    if (afkMaxOfflineEl && this.player) {
      afkMaxOfflineEl.textContent = formatOfflineDuration(this.player.maxOfflineSeconds || OFFLINE_TIME_CONFIG.BASE_SECONDS);
    }

    if (taskVal && this.player) {
      if (this.player.currentTask) {
        const rec = RECIPES[this.player.currentTask.recipeId];
        const mob = MONSTERS[this.player.currentTask.recipeId];
        const taskName = rec?.name || mob?.name || this.player.currentTask.recipeId;
        taskVal.textContent = taskName;
      } else {
        taskVal.textContent = 'Hanging out at the Hearth';
      }
    }

    if (overlay) {
      overlay.classList.remove('hidden');
    }
  }

  private resumeFromAfk() {
    if (!this.isAfk) return;
    console.log('[AFK] Welcome back! Resuming...');
    this.isAfk = false;
    this.lastUserActivity = Date.now();
    this.hiddenSince = null;

    // 1. Hide AFK overlay
    const overlay = document.getElementById('afk-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }

    // 2. Resume 60 FPS canvas rendering
    this.renderer.resumeRendering();

    // 3. Reconnect WebSocket: server will calculate simulateOfflineCatchUp and send INIT with catchUp!
    this.connectWs();
  }

  public destroy() {
    if (this.afkCheckTimer) clearInterval(this.afkCheckTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.levelUpTimer) clearTimeout(this.levelUpTimer);
  }

  private showToast(msg: string, alsoLogToChat: boolean = false) {
    if (!msg) return;
    const now = Date.now();
    // De-duplicate rapid duplicate toasts (prevents multi-trigger spam within 1.5s)
    if (this.lastToastText === msg && now - this.lastToastTime < 1500) {
      return;
    }
    this.lastToastText = msg;
    this.lastToastTime = now;

    // 1. Show floating non-intrusive on-screen toast
    const container = document.getElementById('game-toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'game-toast';
      toast.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
      container.appendChild(toast);

      // Keep at most 3 toasts visible at once
      while (container.children.length > 3) {
        container.removeChild(container.firstChild!);
      }

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 260);
      }, 2400);
    }

    // 2. Only log to chat if explicitly flagged
    if (alsoLogToChat) {
      this.appendChatMessage({
        channel: 'System',
        senderName: 'Eldoria',
        text: msg,
      });
    }
  }

  /* ========================================================
     ADMIN WORLD EDITOR METHODS
     ======================================================== */
  private setupAdminEditor() {
    // 1. Editor Tabs Navigation
    const tabs = document.querySelectorAll('.editor-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab') as any;
        this.switchEditorTab(target);
      });
    });

    // 3. Tile coordinate picker callback from map
    this.renderer.onTileSelected = (tx: number, ty: number) => {
      if (this.activeEditorTab === 'nodes') {
        const xIn = document.getElementById('node-form-x') as HTMLInputElement | null;
        const yIn = document.getElementById('node-form-y') as HTMLInputElement | null;
        if (xIn && yIn) {
          xIn.value = tx.toString();
          yIn.value = ty.toString();
        }
        if (this.renderer.selectedNodeId) {
          const editedNode = this.worldNodes.find(n => n.id === this.renderer.selectedNodeId);
          if (editedNode) {
            editedNode.x = tx;
            editedNode.y = ty;
          }
        }
        this.showToast(`Node coordinates set: (${tx}, ${ty})`);
      } else if (this.activeEditorTab === 'monsters') {
        const xIn = document.getElementById('monster-zone-form-x') as HTMLInputElement | null;
        const yIn = document.getElementById('monster-zone-form-y') as HTMLInputElement | null;
        if (xIn && yIn) {
          xIn.value = tx.toString();
          yIn.value = ty.toString();
        }
        this.showToast(`Zone coordinates set: (${tx}, ${ty})`);
      } else if (this.activeEditorTab === 'npcs') {
        const xIn = document.getElementById('npc-form-x') as HTMLInputElement | null;
        const yIn = document.getElementById('npc-form-y') as HTMLInputElement | null;
        if (xIn && yIn) {
          xIn.value = tx.toString();
          yIn.value = ty.toString();
        }
        this.showToast(`NPC coordinates set: (${tx}, ${ty})`);
      }
      this.renderer.editorMode = 'none';
    };

    this.renderer.onZoneDrawn = (zone: { x: number; y: number; width: number; height: number }) => {
      const form = document.getElementById('editor-monster-zone-form');
      if (form) form.classList.remove('hidden');
      const xIn = document.getElementById('monster-zone-form-x') as HTMLInputElement | null;
      const yIn = document.getElementById('monster-zone-form-y') as HTMLInputElement | null;
      const wIn = document.getElementById('monster-zone-form-width') as HTMLInputElement | null;
      const hIn = document.getElementById('monster-zone-form-height') as HTMLInputElement | null;
      if (xIn && yIn && wIn && hIn) {
        xIn.value = zone.x.toString();
        yIn.value = zone.y.toString();
        wIn.value = zone.width.toString();
        hIn.value = zone.height.toString();
      }
      this.showToast(`Spawn zone area defined: ${zone.width}x${zone.height} at (${zone.x}, ${zone.y})`);
    };

    // 4. Collision Tools
    const chkCollisions = document.getElementById('chk-show-collisions') as HTMLInputElement | null;
    if (chkCollisions) {
      chkCollisions.onchange = () => {
        this.renderer.showCollisions = chkCollisions.checked;
      };
    }

    const btnPaint = document.getElementById('btn-brush-paint');
    const btnErase = document.getElementById('btn-brush-erase');
    if (btnPaint && btnErase) {
      btnPaint.onclick = () => {
        this.collisionBrush = 'paint';
        btnPaint.classList.add('active');
        btnErase.classList.remove('active');
        this.renderer.editorMode = 'paint_collision';
      };
      btnErase.onclick = () => {
        this.collisionBrush = 'erase';
        btnErase.classList.add('active');
        btnPaint.classList.remove('active');
        this.renderer.editorMode = 'erase_collision';
      };
    }

    this.renderer.onCollisionToggled = () => {
      this.updateCollisionCount();
    };

    const btnClearColl = document.getElementById('btn-clear-collisions');
    if (btnClearColl) {
      btnClearColl.onclick = () => {
        if (confirm('Clear all collision boundaries on the map?')) {
          this.renderer.setCollisions([]);
          this.updateCollisionCount();
        }
      };
    }

    const btnAutoColl = document.getElementById('btn-auto-collisions');
    if (btnAutoColl) {
      btnAutoColl.onclick = () => {
        const existing = this.renderer.getCollisions();
        // Add river boundaries
        for (let y = 10; y <= 30; y++) existing.add(`3,${y}`);
        // Add east crag walls
        for (let y = 5; y <= 13; y++) {
          existing.add(`26,${y}`);
          existing.add(`27,${y}`);
        }
        // Add central water pool
        for (let x = 12; x <= 14; x++) {
          for (let y = 28; y <= 30; y++) {
            existing.add(`${x},${y}`);
          }
        }
        // Outer realm borders
        for (let x = 0; x < 60; x++) {
          existing.add(`${x},0`);
          existing.add(`${x},59`);
        }
        for (let y = 0; y < 60; y++) {
          existing.add(`0,${y}`);
          existing.add(`59,${y}`);
        }
        this.updateCollisionCount();
        this.showToast('Auto-detected water, river and world boundaries!');
      };
    }

    const btnSaveColl = document.getElementById('btn-save-collisions');
    if (btnSaveColl) {
      btnSaveColl.onclick = () => {
        const collArray = Array.from(this.renderer.getCollisions());
        this.sendWs({
          type: 'ADMIN_SAVE_COLLISIONS',
          collisions: collArray,
        });
        this.showToast(`Saved ${collArray.length} collision tiles!`);
      };
    }

    // 5b. Give Items Tab Setup
    const giveItemSelect = document.getElementById('give-item-select') as HTMLSelectElement | null;
    const giveItemSearch = document.getElementById('give-item-search') as HTMLInputElement | null;
    const giveItemForm = document.getElementById('editor-give-item-form') as HTMLFormElement | null;

    if (giveItemSelect) {
      // Populate item dropdown from shared ITEMS map
      const allItems = Object.entries(ITEMS).map(([id, def]) => ({ id, name: def.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const buildOptions = (filter: string) => {
        const lower = filter.toLowerCase().trim();
        const filtered = filter
          ? allItems.filter(i => i.name.toLowerCase().includes(lower) || i.id.toLowerCase().includes(lower))
          : allItems;
        if (filtered.length === 0) {
          giveItemSelect.innerHTML = `<option disabled style="color: #a0aec0; padding: 6px;">No items match "${filter}"</option>`;
        } else {
          giveItemSelect.innerHTML = filtered
            .map(i => `<option value="${i.id}">${i.name} (${i.id})</option>`)
            .join('');
          giveItemSelect.selectedIndex = 0;
        }
      };
      buildOptions('');

      if (giveItemSearch) {
        giveItemSearch.oninput = () => buildOptions(giveItemSearch.value);
      }
    }

    if (giveItemForm) {
      giveItemForm.onsubmit = (e) => {
        e.preventDefault();
        const itemId = (document.getElementById('give-item-select') as HTMLSelectElement)?.value;
        const target = (document.getElementById('give-item-target') as HTMLInputElement)?.value.trim();
        const qty = parseInt((document.getElementById('give-item-qty') as HTMLInputElement)?.value, 10) || 1;
        const dest = (document.querySelector('input[name="give-dest"]:checked') as HTMLInputElement)?.value || 'inventory';
        const silentEl = document.getElementById('give-item-silent') as HTMLInputElement | null;
        const silent = silentEl ? silentEl.checked : true;

        if (!itemId) {
          this.showToast('Select an item first.');
          return;
        }

        this.sendWs({
          type: 'ADMIN_GIVE_ITEM',
          itemId,
          quantity: qty,
          destination: dest,
          target: target || undefined,
          silent,
        });
      };
    }

    // 5b. Item Editor Setup
    this.setupItemEditor();

    // 5. Node Form Setup
    const typeSelect = document.getElementById('node-form-type') as HTMLSelectElement | null;
    const recSelect = document.getElementById('node-form-recipe') as HTMLSelectElement | null;

    if (typeSelect) {
      this.updateNodeRecipesForType(typeSelect.value || 'mine');
      typeSelect.addEventListener('change', () => {
        this.updateNodeRecipesForType(typeSelect.value);
      });
    }

    if (recSelect) {
      recSelect.addEventListener('change', () => {
        const nameInput = document.getElementById('node-form-name') as HTMLInputElement | null;
        if (nameInput && (!nameInput.value || nameInput.value === 'New Node')) {
          const rec = RECIPES[recSelect.value];
          if (rec) {
            nameInput.value = rec.name;
          }
        }
      });
    }

    const nodeForm = document.getElementById('editor-node-form') as HTMLFormElement | null;
    const btnAddNode = document.getElementById('btn-add-node');
    const btnCancelNode = document.getElementById('btn-cancel-node');
    const btnPickNode = document.getElementById('btn-pick-node-coord');

    if (btnAddNode && nodeForm) {
      btnAddNode.onclick = () => {
        nodeForm.classList.remove('hidden');
        this.renderer.selectedNodeId = null;
        (document.getElementById('node-form-id') as HTMLInputElement).value = '';
        (document.getElementById('node-form-name') as HTMLInputElement).value = '';
        const curType = (document.getElementById('node-form-type') as HTMLSelectElement).value || 'mine';
        this.updateNodeRecipesForType(curType);
        const px = this.player ? Math.round(this.player.x) : 25;
        const py = this.player ? Math.round(this.player.y) : 25;
        (document.getElementById('node-form-x') as HTMLInputElement).value = px.toString();
        (document.getElementById('node-form-y') as HTMLInputElement).value = py.toString();
      };
    }
    if (btnCancelNode && nodeForm) {
      btnCancelNode.onclick = () => {
        nodeForm.classList.add('hidden');
        this.renderer.selectedNodeId = null;
        this.renderer.editorMode = 'none';
        this.renderEditorNodes();
      };
    }
    if (btnPickNode) {
      btnPickNode.onclick = () => {
        this.renderer.editorMode = 'place_node';
        this.showToast('Click anywhere on the map to set node coordinates...');
      };
    }
    if (nodeForm) {
      nodeForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('node-form-id') as HTMLInputElement).value || `node_${Date.now()}`;
        const type = (document.getElementById('node-form-type') as HTMLSelectElement).value as any;
        const rawName = (document.getElementById('node-form-name') as HTMLInputElement).value.trim();
        const defaultName = type === 'farm' ? 'Verdant Plot' : (type === 'fire' ? 'Campfire' : (type === 'forge' ? 'Forge' : 'Work Station'));
        const name = (!rawName || rawName.startsWith('node_')) ? defaultName : rawName;
        const recipeId = (document.getElementById('node-form-recipe') as HTMLSelectElement).value || undefined;
        const x = parseInt((document.getElementById('node-form-x') as HTMLInputElement).value, 10);
        const y = parseInt((document.getElementById('node-form-y') as HTMLInputElement).value, 10);

        let targetX: number | undefined;
        let targetY: number | undefined;
        let targetLevelId: string | undefined;
        let targetLabel: string | undefined;

        if (type === 'door' || type === 'portal') {
          const txIn = document.getElementById('node-form-target-x') as HTMLInputElement | null;
          const tyIn = document.getElementById('node-form-target-y') as HTMLInputElement | null;
          const tlvlIn = document.getElementById('node-form-target-level') as HTMLSelectElement | null;
          const tlblIn = document.getElementById('node-form-target-label') as HTMLInputElement | null;

          if (txIn && txIn.value !== '') targetX = parseFloat(txIn.value);
          if (tyIn && tyIn.value !== '') targetY = parseFloat(tyIn.value);
          if (tlvlIn && tlvlIn.value) targetLevelId = tlvlIn.value;
          if (tlblIn && tlblIn.value.trim()) targetLabel = tlblIn.value.trim();
        }

        this.sendWs({
          type: 'ADMIN_SAVE_NODE',
          node: { id, name, type, recipeId, x, y, targetX, targetY, targetLevelId, targetLabel },
        });
        nodeForm.classList.add('hidden');
        this.renderer.selectedNodeId = null;
        this.showToast(`Saved node "${name}" (${x}, ${y})`);
        this.renderEditorNodes();
      };
    }

    // Node Search and Category Filter Listeners
    const nodeSearch = document.getElementById('editor-node-search') as HTMLInputElement | null;
    if (nodeSearch) {
      nodeSearch.addEventListener('input', () => {
        this.adminNodeSearchQuery = nodeSearch.value.trim().toLowerCase();
        this.renderEditorNodes();
      });
    }

    const pillBtns = document.querySelectorAll('#editor-node-type-filters .editor-pill-btn');
    pillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.adminNodeTypeFilter = btn.getAttribute('data-type') || 'all';
        this.renderEditorNodes();
      });
    });

    // 6. Monster Zone Form Setup
    const zoneForm = document.getElementById('editor-monster-zone-form') as HTMLFormElement | null;
    const btnAddZone = document.getElementById('btn-add-monster-zone');
    const btnCancelZone = document.getElementById('btn-cancel-monster-zone');
    const btnDragZone = document.getElementById('btn-drag-monster-zone');

    if (btnAddZone && zoneForm) {
      btnAddZone.onclick = () => {
        zoneForm.classList.remove('hidden');
        (document.getElementById('monster-zone-form-id') as HTMLInputElement).value = '';
        (document.getElementById('monster-zone-form-name') as HTMLInputElement).value = '';
        (document.getElementById('monster-zone-form-x') as HTMLInputElement).value = (this.player ? Math.floor(this.player.x) : 4).toString();
        (document.getElementById('monster-zone-form-y') as HTMLInputElement).value = (this.player ? Math.floor(this.player.y) : 44).toString();
        (document.getElementById('monster-zone-form-width') as HTMLInputElement).value = '10';
        (document.getElementById('monster-zone-form-height') as HTMLInputElement).value = '10';
        (document.getElementById('monster-zone-form-max') as HTMLInputElement).value = '4';
        (document.getElementById('monster-zone-form-respawn') as HTMLInputElement).value = '6';
      };
    }
    if (btnCancelZone && zoneForm) {
      btnCancelZone.onclick = () => zoneForm.classList.add('hidden');
    }
    if (btnDragZone) {
      btnDragZone.onclick = () => {
        this.renderer.editorMode = 'draw_zone';
        this.showToast('Click and drag across the map to define the spawn zone rectangle...');
      };
    }
    if (zoneForm) {
      zoneForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('monster-zone-form-id') as HTMLInputElement).value || `zone_${Date.now()}`;
        const name = (document.getElementById('monster-zone-form-name') as HTMLInputElement).value.trim();
        const monsterId = (document.getElementById('monster-zone-form-mobid') as HTMLSelectElement).value;
        const x = parseInt((document.getElementById('monster-zone-form-x') as HTMLInputElement).value, 10);
        const y = parseInt((document.getElementById('monster-zone-form-y') as HTMLInputElement).value, 10);
        const width = parseInt((document.getElementById('monster-zone-form-width') as HTMLInputElement).value, 10);
        const height = parseInt((document.getElementById('monster-zone-form-height') as HTMLInputElement).value, 10);
        const maxMonsters = parseInt((document.getElementById('monster-zone-form-max') as HTMLInputElement).value, 10);
        const respawnSeconds = parseInt((document.getElementById('monster-zone-form-respawn') as HTMLInputElement).value, 10);

        this.sendWs({
          type: 'ADMIN_SAVE_MONSTER_ZONE',
          zone: { id, name, monsterId, x, y, width, height, maxMonsters, respawnSeconds },
        });
        zoneForm.classList.add('hidden');
        this.showToast(`Saved monster spawn zone "${name}"`);
      };
    }

    // 7. NPC Form Setup
    const npcForm = document.getElementById('editor-npc-form') as HTMLFormElement | null;
    const btnAddNpc = document.getElementById('btn-add-npc');
    const btnCancelNpc = document.getElementById('btn-cancel-npc');
    const btnPickNpc = document.getElementById('btn-pick-npc-coord');

    if (btnAddNpc && npcForm) {
      btnAddNpc.onclick = () => {
        npcForm.classList.remove('hidden');
        (document.getElementById('npc-form-id') as HTMLInputElement).value = '';
        (document.getElementById('npc-form-name') as HTMLInputElement).value = '';
        (document.getElementById('npc-form-dialogue') as HTMLTextAreaElement).value = '';
        (document.getElementById('npc-form-x') as HTMLInputElement).value = (this.player?.x || 10).toString();
        (document.getElementById('npc-form-y') as HTMLInputElement).value = (this.player?.y || 22).toString();
        this.updateNpcFormQuestCheckboxes([]);
      };
    }
    if (btnCancelNpc && npcForm) {
      btnCancelNpc.onclick = () => npcForm.classList.add('hidden');
    }
    if (btnPickNpc) {
      btnPickNpc.onclick = () => {
        this.renderer.editorMode = 'place_npc';
        this.showToast('Click anywhere on the map to place NPC...');
      };
    }
    if (npcForm) {
      npcForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('npc-form-id') as HTMLInputElement).value || `npc_${Date.now()}`;
        const name = (document.getElementById('npc-form-name') as HTMLInputElement).value.trim();
        const role = (document.getElementById('npc-form-role') as HTMLSelectElement).value as any;
        const dialogueRaw = (document.getElementById('npc-form-dialogue') as HTMLTextAreaElement).value;
        const dialogue = dialogueRaw.split('\n').map(s => s.trim()).filter(Boolean);
        const checkedQuests = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="npc-quest"]:checked')).map(cb => cb.value);
        const x = parseInt((document.getElementById('npc-form-x') as HTMLInputElement).value, 10);
        const y = parseInt((document.getElementById('npc-form-y') as HTMLInputElement).value, 10);

        this.sendWs({
          type: 'ADMIN_SAVE_NPC',
          npc: { id, name, role, dialogue, questIds: checkedQuests, x, y },
        });
        npcForm.classList.add('hidden');
      };
    }

    // 8. Quest Form Setup
    const questForm = document.getElementById('editor-quest-form') as HTMLFormElement | null;
    const btnAddQuest = document.getElementById('btn-add-quest');
    const btnCancelQuest = document.getElementById('btn-cancel-quest');

    if (btnAddQuest && questForm) {
      btnAddQuest.onclick = () => {
        questForm.classList.remove('hidden');
        (document.getElementById('quest-form-id') as HTMLInputElement).value = '';
        (document.getElementById('quest-form-title') as HTMLInputElement).value = '';
        (document.getElementById('quest-form-desc') as HTMLTextAreaElement).value = '';
        (document.getElementById('quest-form-obj-target') as HTMLInputElement).value = '';
        const repChk = document.getElementById('quest-form-repeatable') as HTMLInputElement | null;
        if (repChk) repChk.checked = false;
      };
    }
    if (btnCancelQuest && questForm) {
      btnCancelQuest.onclick = () => questForm.classList.add('hidden');
    }
    if (questForm) {
      questForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('quest-form-id') as HTMLInputElement).value || `quest_${Date.now()}`;
        const title = (document.getElementById('quest-form-title') as HTMLInputElement).value.trim();
        const description = (document.getElementById('quest-form-desc') as HTMLTextAreaElement).value.trim();
        const npcId = (document.getElementById('quest-form-npc') as HTMLSelectElement).value;
        const objType = (document.getElementById('quest-form-obj-type') as HTMLSelectElement).value as any;
        const count = parseInt((document.getElementById('quest-form-obj-count') as HTMLInputElement).value, 10);
        const targetId = (document.getElementById('quest-form-obj-target') as HTMLInputElement).value.trim();
        const gold = parseInt((document.getElementById('quest-form-reward-gold') as HTMLInputElement).value, 10) || 0;
        const xp = parseInt((document.getElementById('quest-form-reward-xp') as HTMLInputElement).value, 10) || 0;
        const repeatable = (document.getElementById('quest-form-repeatable') as HTMLInputElement | null)?.checked || false;

        this.sendWs({
          type: 'ADMIN_SAVE_QUEST',
          quest: {
            id,
            title,
            description,
            npcId,
            objective: { type: objType, targetId, count },
            reward: { gold, xp },
            repeatable,
          },
        });
        questForm.classList.add('hidden');
      };
    }
  }

  private switchEditorTab(tab: 'nodes' | 'monsters' | 'npcs' | 'quests' | 'collisions' | 'giveitems' | 'items') {
    this.activeEditorTab = tab;
    const tabContents = ['nodes', 'monsters', 'npcs', 'quests', 'collisions', 'giveitems', 'items'];
    for (const t of tabContents) {
      const el = document.getElementById(`tab-content-${t}`);
      if (el) {
        if (t === tab) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    }

    if (tab === 'items') {
      this.renderEditorItems();
    }

    if (tab === 'monsters') {
      this.renderEditorMonsterZones();
    }

    if (tab === 'collisions') {
      this.renderer.showCollisions = true;
      const chk = document.getElementById('chk-show-collisions') as HTMLInputElement | null;
      if (chk) chk.checked = true;
      this.renderer.editorMode = this.collisionBrush === 'paint' ? 'paint_collision' : 'erase_collision';
      this.updateCollisionCount();
    } else {
      const chk = document.getElementById('chk-show-collisions') as HTMLInputElement | null;
      if (!chk || !chk.checked) {
        this.renderer.showCollisions = false;
      }
      this.renderer.editorMode = 'none';
    }
  }

  private updateCollisionCount() {
    const el = document.getElementById('collision-tile-count');
    if (el) {
      el.textContent = `${this.renderer.getCollisions().size} tiles`;
    }
  }

  private updateNodeRecipesForType(selectedType: string, selectedRecipeId?: string) {
    const recSelect = document.getElementById('node-form-recipe') as HTMLSelectElement | null;
    if (!recSelect) return;

    // Filter recipes strictly by node category/skill
    const typeToSkillMap: Record<string, string[]> = {
      tree: ['woodcutting'],
      mine: ['mining'],
      water: ['fishing'],
      herb: ['herbalism'],
      forge: ['smithing'],
      fire: ['cooking'],
      farm: ['farming'],
      workbench: ['crafting', 'fletching'],
      cauldron: ['alchemy'],
      monolith: ['attunement'],
      stall: ['thieving'],
      hearth_counter: [],
    };

    const targetSkills = typeToSkillMap[selectedType];
    let filteredRecipes = Object.values(RECIPES);

    const warpFields = document.getElementById('node-form-warp-fields');
    const recipeRow = document.getElementById('node-form-recipe-row');

    if (selectedType === 'door' || selectedType === 'portal') {
      if (warpFields) warpFields.classList.remove('hidden');
      if (recipeRow) recipeRow.classList.add('hidden');

      // Populate level selector from loaded LDtk levels
      const levelSelect = document.getElementById('node-form-target-level') as HTMLSelectElement | null;
      if (levelSelect) {
        const stitched = this.renderer.getStitchedWorld();
        const levels = stitched ? stitched.levels : [];
        levelSelect.innerHTML = `<option value="">-- Select Destination Level (Optional) --</option>` +
          levels.map(l => `<option value="${l.identifier}">${l.identifier} (${l.tileX}, ${l.tileY})</option>`).join('');

        levelSelect.onchange = () => {
          const selectedLvl = levels.find(l => l.identifier === levelSelect.value);
          if (selectedLvl) {
            const tx = document.getElementById('node-form-target-x') as HTMLInputElement | null;
            const ty = document.getElementById('node-form-target-y') as HTMLInputElement | null;
            const tlabel = document.getElementById('node-form-target-label') as HTMLInputElement | null;
            if (tx && (!tx.value || tx.value === '0')) tx.value = (selectedLvl.tileX + Math.floor(selectedLvl.widthTiles / 2)).toString();
            if (ty && (!ty.value || ty.value === '0')) ty.value = (selectedLvl.tileY + Math.floor(selectedLvl.heightTiles / 2)).toString();
            if (tlabel && !tlabel.value) tlabel.value = `Enter ${selectedLvl.identifier}`;
          }
        };
      }
      filteredRecipes = [];
    } else {
      if (warpFields) warpFields.classList.add('hidden');
      if (recipeRow) recipeRow.classList.remove('hidden');

      if (targetSkills && targetSkills.length > 0) {
        filteredRecipes = filteredRecipes.filter(r => targetSkills.includes(r.skill));
      } else if (selectedType === 'hearth_counter' || selectedType === 'farm') {
        filteredRecipes = [];
      }
    }

    recSelect.innerHTML = `<option value="">None (Heuristics / Bank)</option>` +
      filteredRecipes
        .map(r => `<option value="${r.id}">${r.name} (${r.skill} Lv ${r.levelReq})</option>`)
        .join('');

    if (selectedRecipeId && filteredRecipes.some(r => r.id === selectedRecipeId)) {
      recSelect.value = selectedRecipeId;
    } else {
      recSelect.value = '';
    }
  }

  public selectNodeForEditing(n: WorldNodeDisplay) {
    this.renderer.selectedNodeId = n.id;

    // Ensure the editor drawer is open and the nodes tab is active
    if (this.activeDrawer !== 'editor') {
      this.switchDrawer('editor');
    }
    this.switchEditorTab('nodes');

    const form = document.getElementById('editor-node-form');
    if (form) form.classList.remove('hidden');

    const idInput = document.getElementById('node-form-id') as HTMLInputElement | null;
    const nameInput = document.getElementById('node-form-name') as HTMLInputElement | null;
    const typeInput = document.getElementById('node-form-type') as HTMLSelectElement | null;
    const xInput = document.getElementById('node-form-x') as HTMLInputElement | null;
    const yInput = document.getElementById('node-form-y') as HTMLInputElement | null;

    if (idInput) idInput.value = n.id;
    if (nameInput) nameInput.value = n.name;
    if (typeInput) typeInput.value = n.type;
    this.updateNodeRecipesForType(n.type, n.recipeId);
    if (xInput) xInput.value = n.x.toString();
    if (yInput) yInput.value = n.y.toString();

    const txIn = document.getElementById('node-form-target-x') as HTMLInputElement | null;
    const tyIn = document.getElementById('node-form-target-y') as HTMLInputElement | null;
    const tlvlIn = document.getElementById('node-form-target-level') as HTMLSelectElement | null;
    const tlblIn = document.getElementById('node-form-target-label') as HTMLInputElement | null;

    if (txIn) txIn.value = n.targetX !== undefined ? n.targetX.toString() : '';
    if (tyIn) tyIn.value = n.targetY !== undefined ? n.targetY.toString() : '';
    if (tlvlIn) tlvlIn.value = n.targetLevelId || '';
    if (tlblIn) tlblIn.value = n.targetLabel || '';

    this.showToast(`Selected "${n.name}" for editing`);
    this.renderEditorNodes();

    // Scroll the selected card into view in the nodes list
    setTimeout(() => {
      const activeCard = document.querySelector(`.editor-entity-card[data-node-id="${n.id}"]`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  }

  private renderEditorNodes() {
    const container = document.getElementById('editor-nodes-list');
    if (!container) return;
    container.innerHTML = '';

    const allNodes = this.worldNodes.filter(n => n.type !== 'monster');

    // Update category pill counts
    const countAll = allNodes.length;
    const countMine = allNodes.filter(n => n.type === 'mine').length;
    const countTree = allNodes.filter(n => n.type === 'tree').length;
    const countWater = allNodes.filter(n => n.type === 'water').length;
    const countFarm = allNodes.filter(n => n.type === 'farm').length;
    const countHerb = allNodes.filter(n => n.type === 'herb').length;
    const countForge = allNodes.filter(n => n.type === 'forge').length;
    const countFire = allNodes.filter(n => n.type === 'fire').length;
    const countWorkbench = allNodes.filter(n => n.type === 'workbench').length;
    const countCauldron = allNodes.filter(n => n.type === 'cauldron').length;
    const countMonolith = allNodes.filter(n => n.type === 'monolith').length;
    const countStall = allNodes.filter(n => n.type === 'stall').length;
    const countHearth = allNodes.filter(n => n.type === 'hearth_counter').length;
    const countDoor = allNodes.filter(n => n.type === 'door' || n.type === 'portal').length;

    const elCountAll = document.getElementById('count-node-all');
    if (elCountAll) elCountAll.textContent = countAll.toString();
    const elCountDoor = document.getElementById('count-node-door');
    if (elCountDoor) elCountDoor.textContent = countDoor.toString();
    const elCountMine = document.getElementById('count-node-mine');
    if (elCountMine) elCountMine.textContent = countMine.toString();
    const elCountTree = document.getElementById('count-node-tree');
    if (elCountTree) elCountTree.textContent = countTree.toString();
    const elCountWater = document.getElementById('count-node-water');
    if (elCountWater) elCountWater.textContent = countWater.toString();
    const elCountFarm = document.getElementById('count-node-farm');
    if (elCountFarm) elCountFarm.textContent = countFarm.toString();
    const elCountHerb = document.getElementById('count-node-herb');
    if (elCountHerb) elCountHerb.textContent = countHerb.toString();
    const elCountForge = document.getElementById('count-node-forge');
    if (elCountForge) elCountForge.textContent = countForge.toString();
    const elCountFire = document.getElementById('count-node-fire');
    if (elCountFire) elCountFire.textContent = countFire.toString();
    const elCountWorkbench = document.getElementById('count-node-workbench');
    if (elCountWorkbench) elCountWorkbench.textContent = countWorkbench.toString();
    const elCountCauldron = document.getElementById('count-node-cauldron');
    if (elCountCauldron) elCountCauldron.textContent = countCauldron.toString();
    const elCountMonolith = document.getElementById('count-node-monolith');
    if (elCountMonolith) elCountMonolith.textContent = countMonolith.toString();
    const elCountStall = document.getElementById('count-node-stall');
    if (elCountStall) elCountStall.textContent = countStall.toString();
    const elCountHearth = document.getElementById('count-node-hearth');
    if (elCountHearth) elCountHearth.textContent = countHearth.toString();

    // Filter by type
    let filtered = allNodes;
    if (this.adminNodeTypeFilter !== 'all') {
      filtered = filtered.filter(n => n.type === this.adminNodeTypeFilter);
    }

    // Filter by search query
    if (this.adminNodeSearchQuery) {
      const q = this.adminNodeSearchQuery;
      filtered = filtered.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        (n.recipeId && n.recipeId.toLowerCase().includes(q)) ||
        `${n.x},${n.y}`.includes(q)
      );
    }

    // Sort by distance to player (closest first) - freeze re-sorting if a node is actively being edited so list doesn't shift
    const isEditingNode = Boolean(this.renderer.selectedNodeId);
    if (this.player && !isEditingNode) {
      const px = this.player.x;
      const py = this.player.y;
      filtered.sort((a, b) => {
        const da = Math.hypot(a.x - px, a.y - py);
        const db = Math.hypot(b.x - px, b.y - py);
        return da - db;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.72rem;">No resource nodes match the filter.</div>`;
      return;
    }

    for (const n of filtered) {
      const isSelected = this.renderer.selectedNodeId === n.id;
      const card = document.createElement('div');
      card.className = `editor-entity-card${isSelected ? ' active-selected-node' : ''}`;
      card.setAttribute('data-node-id', n.id);
      if (isSelected) {
        card.style.borderColor = '#ffd700';
        card.style.boxShadow = '0 0 8px rgba(255, 215, 0, 0.4)';
      }
      const dist = this.player ? Math.hypot(n.x - this.player.x, n.y - this.player.y) : null;
      const distText = dist !== null ? `<span class="editor-dist-tag">${dist.toFixed(1)}t</span>` : '';
      const recipeLabel = n.recipeId && RECIPES[n.recipeId] ? ` · ${RECIPES[n.recipeId].name}` : (n.recipeId ? ` · ${n.recipeId}` : '');

      const warpLabel = (n.type === 'door' || n.type === 'portal') && (n.targetX !== undefined || n.targetLevelId)
        ? ` · Warp ➔ ${n.targetLevelId ? n.targetLevelId + ' ' : ''}(${n.targetX ?? '?'}, ${n.targetY ?? '?'})`
        : '';

      card.innerHTML = `
        <div class="editor-entity-info" style="cursor: pointer;">
          <div class="editor-entity-title">
            <span class="editor-entity-badge-icon badge-${n.type}">${n.type}</span>${n.name}${distText}
          </div>
          <div class="editor-entity-meta">(${n.x}, ${n.y})${recipeLabel}${warpLabel}</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-tp" title="Teleport to node (${n.x}, ${n.y})">TP</button>
          <button class="btn-micro-edit" data-id="${n.id}">${isSelected ? 'Editing' : 'Edit'}</button>
          <button class="btn-micro-del" data-id="${n.id}">Del</button>
        </div>
      `;

      // Clicking the card body also selects the node for editing
      card.querySelector('.editor-entity-info')!.addEventListener('click', () => {
        this.selectNodeForEditing(n);
      });

      card.querySelector('.btn-micro-tp')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sendWs({
          type: 'ADMIN_TELEPORT',
          x: n.x,
          y: n.y,
        });
        this.showToast(`Teleported to ${n.name} (${n.x}, ${n.y})`);
      });

      card.querySelector('.btn-micro-edit')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectNodeForEditing(n);
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete node "${n.name}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_NODE', nodeId: n.id, id: n.id });
          if (this.renderer.selectedNodeId === n.id) {
            this.renderer.selectedNodeId = null;
            const form = document.getElementById('editor-node-form');
            if (form) form.classList.add('hidden');
          }
        }
      });

      container.appendChild(card);
    }
  }

  private renderEditorMonsterZones() {
    const container = document.getElementById('editor-monster-zones-list');
    if (!container) return;
    container.innerHTML = '';

    for (const z of this.monsterZones) {
      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      const centerX = Math.floor(z.x + z.width / 2);
      const centerY = Math.floor(z.y + z.height / 2);
      const dist = this.player ? Math.hypot(centerX - this.player.x, centerY - this.player.y) : null;
      const distText = dist !== null ? `<span class="editor-dist-tag">${dist.toFixed(1)}t</span>` : '';
      const activeCount = this.worldNodes.filter(n => n.type === 'monster' && n.zoneId === z.id).length;

      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${z.name}${distText}</div>
          <div class="editor-entity-meta">${z.monsterId} · (${z.x}, ${z.y}) [${z.width}x${z.height}] · ${activeCount}/${z.maxMonsters} active · ${z.respawnSeconds}s cd</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-tp" title="Teleport to center (${centerX}, ${centerY})">TP</button>
          <button class="btn-micro-edit" data-id="${z.id}">Edit</button>
          <button class="btn-micro-del" data-id="${z.id}">Del</button>
        </div>
      `;

      card.querySelector('.btn-micro-tp')!.addEventListener('click', () => {
        this.sendWs({
          type: 'ADMIN_TELEPORT',
          x: centerX,
          y: centerY,
        });
        this.showToast(`Teleported to ${z.name} (${centerX}, ${centerY})`);
      });

      card.querySelector('.btn-micro-edit')!.addEventListener('click', () => {
        const form = document.getElementById('editor-monster-zone-form')!;
        form.classList.remove('hidden');
        (document.getElementById('monster-zone-form-id') as HTMLInputElement).value = z.id;
        (document.getElementById('monster-zone-form-name') as HTMLInputElement).value = z.name;
        (document.getElementById('monster-zone-form-mobid') as HTMLSelectElement).value = z.monsterId;
        (document.getElementById('monster-zone-form-x') as HTMLInputElement).value = z.x.toString();
        (document.getElementById('monster-zone-form-y') as HTMLInputElement).value = z.y.toString();
        (document.getElementById('monster-zone-form-width') as HTMLInputElement).value = z.width.toString();
        (document.getElementById('monster-zone-form-height') as HTMLInputElement).value = z.height.toString();
        (document.getElementById('monster-zone-form-max') as HTMLInputElement).value = z.maxMonsters.toString();
        (document.getElementById('monster-zone-form-respawn') as HTMLInputElement).value = (z.respawnSeconds ?? 6).toString();
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete monster spawn zone "${z.name}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_MONSTER_ZONE', zoneId: z.id });
        }
      });

      container.appendChild(card);
    }
  }

  private updateNpcFormQuestCheckboxes(selectedQuestIds: string[] = []) {
    const container = document.getElementById('npc-form-quests-container');
    if (!container) return;
    if (this.quests.length === 0) {
      container.innerHTML = '<span style="font-size: 0.7rem; color: #a0aec0;">No quests created yet.</span>';
      return;
    }
    container.innerHTML = this.quests.map(q => {
      const isChecked = selectedQuestIds.includes(q.id);
      return `
        <label style="font-size: 0.72rem; color: #f3e8dc; display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="checkbox" name="npc-quest" value="${q.id}" ${isChecked ? 'checked' : ''} />
          <span>${q.title} <span style="color: #a0aec0; font-size: 0.65rem;">(${q.id})</span></span>
        </label>
      `;
    }).join('');
  }

  private renderEditorNpcs() {
    const container = document.getElementById('editor-npcs-list');
    if (!container) return;
    container.innerHTML = '';

    for (const npc of this.npcs) {
      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      const questCount = (npc.questIds || []).length;
      const dist = this.player ? Math.hypot(npc.x - this.player.x, npc.y - this.player.y) : null;
      const distText = dist !== null ? `<span class="editor-dist-tag">${dist.toFixed(1)}t</span>` : '';

      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${npc.name}${distText}</div>
          <div class="editor-entity-meta">${npc.role} · (${npc.x}, ${npc.y}) · ${npc.dialogue?.length || 0} line(s) · ${questCount} quest(s)</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-tp" title="Teleport to NPC (${npc.x}, ${npc.y})">TP</button>
          <button class="btn-micro-edit" data-id="${npc.id}">Edit</button>
          <button class="btn-micro-del" data-id="${npc.id}">Del</button>
        </div>
      `;

      card.querySelector('.btn-micro-tp')!.addEventListener('click', () => {
        this.sendWs({
          type: 'ADMIN_TELEPORT',
          x: npc.x,
          y: npc.y,
        });
        this.showToast(`Teleported to ${npc.name} (${npc.x}, ${npc.y})`);
      });

      card.querySelector('.btn-micro-edit')!.addEventListener('click', () => {
        const form = document.getElementById('editor-npc-form')!;
        form.classList.remove('hidden');
        (document.getElementById('npc-form-id') as HTMLInputElement).value = npc.id;
        (document.getElementById('npc-form-name') as HTMLInputElement).value = npc.name;
        (document.getElementById('npc-form-role') as HTMLSelectElement).value = npc.role;
        (document.getElementById('npc-form-dialogue') as HTMLTextAreaElement).value = (npc.dialogue || []).join('\n');
        (document.getElementById('npc-form-x') as HTMLInputElement).value = npc.x.toString();
        (document.getElementById('npc-form-y') as HTMLInputElement).value = npc.y.toString();
        this.updateNpcFormQuestCheckboxes(npc.questIds || []);
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete NPC "${npc.name}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_NPC', npcId: npc.id, id: npc.id });
        }
      });

      container.appendChild(card);
    }
  }

  private updateQuestNpcDropdown() {
    const select = document.getElementById('quest-form-npc') as HTMLSelectElement | null;
    if (!select) return;
    select.innerHTML = this.npcs.map(n => `<option value="${n.id}">${n.name} (${n.role})</option>`).join('');
  }

  private renderEditorQuests() {
    const container = document.getElementById('editor-quests-list');
    if (!container) return;
    container.innerHTML = '';

    for (const q of this.quests) {
      const xpVal = typeof q.reward.xp === 'number' ? q.reward.xp : (q.reward.xp?.amount || 0);
      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${q.title}</div>
          <div class="editor-entity-meta">${q.objective.type} ${q.objective.count}x ${q.objective.targetId} · Giver: ${q.npcId || 'None'} · ${q.repeatable ? '<span style="color:#68d391; font-weight:700;">Repeatable</span>' : '<span style="color:#a0aec0;">One-time</span>'}</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-edit" data-id="${q.id}">Edit</button>
          <button class="btn-micro-del" data-id="${q.id}">Del</button>
        </div>
      `;

      card.querySelector('.btn-micro-edit')!.addEventListener('click', () => {
        const form = document.getElementById('editor-quest-form')!;
        form.classList.remove('hidden');
        (document.getElementById('quest-form-id') as HTMLInputElement).value = q.id;
        (document.getElementById('quest-form-title') as HTMLInputElement).value = q.title;
        (document.getElementById('quest-form-desc') as HTMLTextAreaElement).value = q.description;
        (document.getElementById('quest-form-npc') as HTMLSelectElement).value = q.npcId || '';
        (document.getElementById('quest-form-obj-type') as HTMLSelectElement).value = q.objective.type;
        (document.getElementById('quest-form-obj-count') as HTMLInputElement).value = q.objective.count.toString();
        (document.getElementById('quest-form-obj-target') as HTMLInputElement).value = q.objective.targetId;
        (document.getElementById('quest-form-reward-gold') as HTMLInputElement).value = (q.reward.gold || 0).toString();
        (document.getElementById('quest-form-reward-xp') as HTMLInputElement).value = xpVal.toString();
        const repChk = document.getElementById('quest-form-repeatable') as HTMLInputElement | null;
        if (repChk) repChk.checked = Boolean(q.repeatable);
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete Quest "${q.title}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_QUEST', questId: q.id, id: q.id });
        }
      });

      container.appendChild(card);
    }
  }

  // --- In-Game Item Editor ---
  private setupItemEditor() {
    const itemSearchInput = document.getElementById('editor-item-search') as HTMLInputElement | null;
    if (itemSearchInput) {
      itemSearchInput.addEventListener('input', () => {
        this.renderEditorItems(itemSearchInput.value);
      });
    }

    const itemForm = document.getElementById('editor-item-form') as HTMLFormElement | null;
    const btnAddItem = document.getElementById('btn-add-item');
    const btnCancelItem = document.getElementById('btn-cancel-item');
    const btnDeleteItem = document.getElementById('btn-delete-item');

    const chkStackableInv = document.getElementById('item-form-stackable-inv') as HTMLInputElement | null;
    const stackRowInv = document.getElementById('item-form-max-stack-inv-row');
    const stackInputInv = document.getElementById('item-form-max-stack-inv') as HTMLInputElement | null;

    const chkStackableBank = document.getElementById('item-form-stackable-bank') as HTMLInputElement | null;
    const stackRowBank = document.getElementById('item-form-max-stack-bank-row');
    const stackInputBank = document.getElementById('item-form-max-stack-bank') as HTMLInputElement | null;

    if (chkStackableInv && stackRowInv && stackInputInv) {
      chkStackableInv.addEventListener('change', () => {
        if (chkStackableInv.checked) {
          stackRowInv.style.opacity = '1';
          stackInputInv.disabled = false;
          if (parseInt(stackInputInv.value, 10) <= 1) {
            stackInputInv.value = '999999';
          }
        } else {
          stackRowInv.style.opacity = '0.5';
          stackInputInv.disabled = true;
          stackInputInv.value = '1';
        }
      });
    }

    if (chkStackableBank && stackRowBank && stackInputBank) {
      chkStackableBank.addEventListener('change', () => {
        if (chkStackableBank.checked) {
          stackRowBank.style.opacity = '1';
          stackInputBank.disabled = false;
          if (parseInt(stackInputBank.value, 10) <= 1) {
            stackInputBank.value = '999999';
          }
        } else {
          stackRowBank.style.opacity = '0.5';
          stackInputBank.disabled = true;
          stackInputBank.value = '1';
        }
      });
    }

    if (btnAddItem && itemForm) {
      btnAddItem.onclick = () => {
        this.populateItemEditorForm(null);
      };
    }

    if (btnCancelItem && itemForm) {
      btnCancelItem.onclick = () => {
        itemForm.classList.add('hidden');
      };
    }

    if (btnDeleteItem && itemForm) {
      btnDeleteItem.onclick = () => {
        const id = (document.getElementById('item-form-id') as HTMLInputElement).value.trim();
        if (!id) return;
        if (confirm(`Delete / reset item "${id}"?`)) {
          this.sendWs({
            type: 'ADMIN_DELETE_ITEM',
            id,
          });
          itemForm.classList.add('hidden');
        }
      };
    }

    if (itemForm) {
      itemForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('item-form-id') as HTMLInputElement).value.trim();
        const name = (document.getElementById('item-form-name') as HTMLInputElement).value.trim();
        const category = (document.getElementById('item-form-category') as HTMLSelectElement).value as any;
        const tier = parseInt((document.getElementById('item-form-tier') as HTMLInputElement).value, 10) || 1;

        const stackableInInventory = chkStackableInv ? chkStackableInv.checked : true;
        const maxStackInventory = stackableInInventory
          ? (parseInt(stackInputInv?.value || '999999', 10) || 999999)
          : 1;

        const stackableInBank = chkStackableBank ? chkStackableBank.checked : true;
        const maxStackBank = stackableInBank
          ? (parseInt(stackInputBank?.value || '999999', 10) || 999999)
          : 1;

        const vendorFloorPrice = parseInt((document.getElementById('item-form-price') as HTMLInputElement).value, 10) || 0;
        const description = (document.getElementById('item-form-desc') as HTMLTextAreaElement).value.trim();
        const slotVal = (document.getElementById('item-form-slot') as HTMLSelectElement).value;
        const slot = slotVal ? (slotVal as EquipSlot) : undefined;

        const reqSkillVal = (document.getElementById('item-form-req-skill') as HTMLSelectElement).value;
        const reqLvl = parseInt((document.getElementById('item-form-req-lvl') as HTMLInputElement).value, 10) || 1;
        const equipReq = reqSkillVal ? { skill: reqSkillVal as SkillType, level: reqLvl } : undefined;

        const acc = parseInt((document.getElementById('item-form-accuracy') as HTMLInputElement).value, 10) || 0;
        const str = parseInt((document.getElementById('item-form-strength') as HTMLInputElement).value, 10) || 0;
        const def = parseInt((document.getElementById('item-form-defence') as HTMLInputElement).value, 10) || 0;
        const spd = parseFloat((document.getElementById('item-form-speed') as HTMLInputElement).value) || 0;
        const heal = parseInt((document.getElementById('item-form-heal') as HTMLInputElement).value, 10) || 0;
        const toolBonus = (parseFloat((document.getElementById('item-form-tool-bonus') as HTMLInputElement).value) || 0) / 100;

        let baseStats: any = undefined;
        if (acc || str || def || spd || heal || toolBonus) {
          baseStats = {};
          if (acc) baseStats.accuracy = acc;
          if (str) baseStats.strength = str;
          if (def) baseStats.defence = def;
          if (spd) baseStats.swingSpeedSeconds = spd;
          if (heal) baseStats.healing = heal;
          if (toolBonus) baseStats.toolSpeedBonus = toolBonus;
        }

        const itemDef: ItemDefinition = {
          id,
          name,
          category,
          tier,
          stackable: stackableInInventory && stackableInBank,
          stackableInInventory,
          stackableInBank,
          maxStack: maxStackInventory,
          maxStackInventory,
          maxStackBank,
          vendorFloorPrice,
          description: description || undefined,
          slot,
          equipReq,
          baseStats,
        };

        this.sendWs({
          type: 'ADMIN_SAVE_ITEM',
          item: itemDef,
        });

        itemForm.classList.add('hidden');
      };
    }
  }

  private populateItemEditorForm(def: ItemDefinition | null) {
    const form = document.getElementById('editor-item-form') as HTMLFormElement | null;
    if (!form) return;
    form.classList.remove('hidden');

    const heading = document.getElementById('item-form-heading');
    if (heading) heading.textContent = def ? `Edit Item: ${def.name}` : 'Create New Item';

    const idInput = document.getElementById('item-form-id') as HTMLInputElement;
    idInput.value = def ? def.id : '';
    idInput.readOnly = false;

    (document.getElementById('item-form-name') as HTMLInputElement).value = def ? def.name : '';
    (document.getElementById('item-form-category') as HTMLSelectElement).value = def ? def.category : 'ore';
    (document.getElementById('item-form-tier') as HTMLInputElement).value = (def ? def.tier : 1).toString();

    const isStackInv = isItemStackable(def || undefined, 'inventory');
    const maxStackInv = getItemMaxStack(def || undefined, 'inventory');

    const isStackBank = isItemStackable(def || undefined, 'bank');
    const maxStackBank = getItemMaxStack(def || undefined, 'bank');

    const chkStackableInv = document.getElementById('item-form-stackable-inv') as HTMLInputElement | null;
    const stackInputInv = document.getElementById('item-form-max-stack-inv') as HTMLInputElement | null;
    const stackRowInv = document.getElementById('item-form-max-stack-inv-row');
    if (chkStackableInv && stackInputInv && stackRowInv) {
      chkStackableInv.checked = isStackInv;
      stackInputInv.value = maxStackInv.toString();
      stackInputInv.disabled = !isStackInv;
      stackRowInv.style.opacity = isStackInv ? '1' : '0.5';
    }

    const chkStackableBank = document.getElementById('item-form-stackable-bank') as HTMLInputElement | null;
    const stackInputBank = document.getElementById('item-form-max-stack-bank') as HTMLInputElement | null;
    const stackRowBank = document.getElementById('item-form-max-stack-bank-row');
    if (chkStackableBank && stackInputBank && stackRowBank) {
      chkStackableBank.checked = isStackBank;
      stackInputBank.value = maxStackBank.toString();
      stackInputBank.disabled = !isStackBank;
      stackRowBank.style.opacity = isStackBank ? '1' : '0.5';
    }

    (document.getElementById('item-form-price') as HTMLInputElement).value = (def ? def.vendorFloorPrice : 5).toString();
    (document.getElementById('item-form-desc') as HTMLTextAreaElement).value = def?.description || '';
    (document.getElementById('item-form-slot') as HTMLSelectElement).value = def?.slot || '';

    (document.getElementById('item-form-req-skill') as HTMLSelectElement).value = def?.equipReq?.skill || '';
    (document.getElementById('item-form-req-lvl') as HTMLInputElement).value = (def?.equipReq?.level || 1).toString();

    (document.getElementById('item-form-accuracy') as HTMLInputElement).value = (def?.baseStats?.accuracy || 0).toString();
    (document.getElementById('item-form-strength') as HTMLInputElement).value = (def?.baseStats?.strength || 0).toString();
    (document.getElementById('item-form-defence') as HTMLInputElement).value = (def?.baseStats?.defence || 0).toString();
    (document.getElementById('item-form-speed') as HTMLInputElement).value = (def?.baseStats?.swingSpeedSeconds || 0).toString();
    (document.getElementById('item-form-heal') as HTMLInputElement).value = (def?.baseStats?.healing || 0).toString();
    (document.getElementById('item-form-tool-bonus') as HTMLInputElement).value = def?.baseStats?.toolSpeedBonus ? Math.round(def.baseStats.toolSpeedBonus * 100).toString() : '0';

    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private renderEditorItems(filter = '') {
    const container = document.getElementById('editor-items-list');
    if (!container) return;
    container.innerHTML = '';

    const q = filter.trim().toLowerCase();
    const allItems = Object.values(ITEMS)
      .filter(it => !q || it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q) || it.category.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (allItems.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); font-size: 0.75rem; padding: 8px; text-align: center;">No matching items found</div>';
      return;
    }

    for (const item of allItems) {
      const isStackInv = isItemStackable(item, 'inventory');
      const maxInv = getItemMaxStack(item, 'inventory');
      const isStackBank = isItemStackable(item, 'bank');
      const maxBank = getItemMaxStack(item, 'bank');

      let stackBadge = '';
      let stackBg = '#2f855a';

      if (isStackInv && isStackBank) {
        stackBadge = maxInv >= 999999 && maxBank >= 999999
          ? 'Stack: All'
          : `Inv: ${maxInv >= 999999 ? '∞' : maxInv} | Bank: ${maxBank >= 999999 ? '∞' : maxBank}`;
        stackBg = '#2b6cb0';
      } else if (isStackInv && !isStackBank) {
        stackBadge = `Inv: ${maxInv >= 999999 ? '∞' : maxInv} | Bank: 1`;
        stackBg = '#b7791f';
      } else if (!isStackInv && isStackBank) {
        stackBadge = `Inv: 1 | Bank: ${maxBank >= 999999 ? '∞' : maxBank}`;
        stackBg = '#2c7a7b';
      } else {
        stackBadge = 'Non-stackable';
        stackBg = '#742a2a';
      }

      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title" style="display: flex; align-items: center; gap: 6px;">
            <span>${item.name}</span>
            <span style="font-size: 0.65rem; background: ${stackBg}; color: #fff; padding: 1px 5px; border-radius: 3px; font-weight: 600;">${stackBadge}</span>
          </div>
          <div class="editor-entity-meta" style="font-size: 0.68rem; color: #a0aec0;">
            <code style="color: #ffd699;">${item.id}</code> · ${item.category} · Tier ${item.tier} · ${item.vendorFloorPrice}g
          </div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-edit" data-id="${item.id}">Edit</button>
        </div>
      `;

      card.addEventListener('click', () => {
        this.populateItemEditorForm(item);
      });

      container.appendChild(card);
    }
  }

  private openNpcDialogue(npc: NpcDefinition) {
    const modal = document.getElementById('npc-dialogue-modal');
    if (!modal) return;

    document.getElementById('npc-modal-name')!.textContent = npc.name;
    const titleEl = document.getElementById('npc-modal-title');
    if (titleEl) {
      titleEl.textContent = npc.role === 'merchant' ? 'Town Merchant' : npc.role === 'guide' ? 'Town Guide' : 'Quest Giver';
    }

    const dialEl = document.getElementById('npc-modal-dialogue')!;
    if (npc.dialogue && npc.dialogue.length > 0) {
      dialEl.innerHTML = npc.dialogue.map(line => `<div style="margin: 4px 0; line-height: 1.45;">"${line}"</div>`).join('');
    } else {
      dialEl.innerHTML = `<div style="margin: 4px 0;">"Greetings, traveler. Safe journey in the wilds of Eldoria."</div>`;
    }

    const questListEl = document.getElementById('npc-modal-quests')!;
    questListEl.innerHTML = '';

    const npcQuests = this.quests.filter(q => q.npcId === npc.id || (npc.questIds && npc.questIds.includes(q.id)));
    if (npcQuests.length > 0) {
      const heading = document.createElement('div');
      heading.style.fontSize = '0.72rem';
      heading.style.fontWeight = '700';
      heading.style.color = 'var(--gold-bright)';
      heading.style.marginBottom = '4px';
      heading.textContent = 'Available Quests:';
      questListEl.appendChild(heading);

      for (const q of npcQuests) {
        const xpVal = typeof q.reward.xp === 'number' ? q.reward.xp : (q.reward.xp?.amount || 0);
        const isAccepted = this.acceptedQuests.has(q.id);
        const isCompleted = this.completedQuests.has(q.id);
        const isRepeatable = Boolean(q.repeatable);

        let badgeHtml = '';
        if (isAccepted) {
          badgeHtml = `<span style="font-size:0.65rem; color:#63b3ed; background:rgba(66,153,225,0.15); border:1px solid #3182ce; padding:1px 5px; border-radius:3px; font-weight:700;">In Progress</span>`;
        } else if (isCompleted && !isRepeatable) {
          badgeHtml = `<span style="font-size:0.65rem; color:#68d391; background:rgba(72,187,120,0.15); border:1px solid #38a169; padding:1px 5px; border-radius:3px; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><span class="svg-icon-inline icon-sm">${ICONS.check}</span> Completed</span>`;
        } else if (isRepeatable) {
          badgeHtml = `<span style="font-size:0.65rem; color:#ecc94b; background:rgba(214,158,46,0.15); border:1px solid #d69e2e; padding:1px 5px; border-radius:3px; font-weight:700;">Repeatable</span>`;
        }

        let buttonHtml = '';
        if (isAccepted) {
          buttonHtml = `<button class="btn-stop" disabled style="font-size:0.72rem; padding:3px 8px; margin-top:4px; opacity:0.6; cursor:not-allowed;">In Progress</button>`;
        } else if (isCompleted && !isRepeatable) {
          buttonHtml = `<button class="btn-start" disabled style="font-size:0.72rem; padding:3px 8px; margin-top:4px; opacity:0.45; background:#2d3748; border-color:#4a5568; cursor:not-allowed;">Completed</button>`;
        } else {
          buttonHtml = `<button class="btn-start btn-accept-quest" data-qid="${q.id}" style="font-size:0.72rem; padding:3px 8px; margin-top:4px;">${isCompleted ? 'Accept Again' : 'Accept Quest'}</button>`;
        }

        const card = document.createElement('div');
        card.className = 'npc-quest-card';
        card.innerHTML = `
          <div class="npc-quest-title" style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
            <span>${q.title}</span>
            ${badgeHtml}
          </div>
          <div class="npc-quest-desc">${q.description}</div>
          <div class="npc-quest-rewards">
            Goal: ${q.objective.type} ${q.objective.count}x ${q.objective.targetId} • 
            Rewards: ${q.reward.gold || 0} Gold, ${xpVal} XP
          </div>
          ${buttonHtml}
        `;
        const btnAccept = card.querySelector('.btn-accept-quest') as HTMLButtonElement | null;
        if (btnAccept) {
          btnAccept.onclick = () => {
            this.acceptedQuests.add(q.id);
            this.saveQuestState();
            this.updateQuestTracker();
            this.showToast(`Accepted quest "${q.title}"! Pinned to Quest Log.`);
            modal.classList.add('hidden');
          };
        }
        questListEl.appendChild(card);
      }
    }

    modal.classList.remove('hidden');
  }

  // --- CELESTIAL GEM STORE & PAYPAL INTEGRATION ---

  public async fetchGemPacks() {
    try {
      const res = await fetch('/api/gem-packs');
      if (res.ok) {
        const data = await res.json();
        if (data.packs && Array.isArray(data.packs)) {
          this.gemPacksData = data.packs;
        }
      }
    } catch {
      // Fallback to shared constants
      this.gemPacksData = Object.values(GEM_PACKS);
    }
  }

  public openGemStoreModal(tab: 'queue' | 'packs' | 'offline' = 'queue') {
    const modal = document.getElementById('gem-store-modal');
    if (!modal) return;
    sound.play('ding');
    this.currentGemStoreTab = tab;
    modal.classList.remove('hidden');
    this.renderGemStoreTab(tab);
  }

  public closeGemStoreModal() {
    const modal = document.getElementById('gem-store-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  public renderGemStoreTab(tab: 'queue' | 'packs' | 'offline') {
    this.currentGemStoreTab = tab;
    const bodyEl = document.getElementById('gem-store-body');
    const balanceVal = document.getElementById('gem-store-balance-val');
    const balanceIcon = document.getElementById('gem-store-balance-icon');
    const storeIcon = document.getElementById('gem-store-icon');

    if (balanceIcon) balanceIcon.innerHTML = ICONS.gems;
    if (storeIcon) storeIcon.innerHTML = ICONS.gems;
    if (balanceVal && this.player) {
      balanceVal.textContent = (this.player.gems || 0).toLocaleString();
    }

    // Toggle tab active classes
    const tabQueue = document.getElementById('tab-gem-queue');
    const tabOffline = document.getElementById('tab-gem-offline');
    const tabPacks = document.getElementById('tab-gem-packs');
    tabQueue?.classList.toggle('active', tab === 'queue');
    tabOffline?.classList.toggle('active', tab === 'offline');
    tabPacks?.classList.toggle('active', tab === 'packs');

    if (!bodyEl || !this.player) return;
    bodyEl.innerHTML = '';

    if (tab === 'queue') {
      const unlocked = this.player.unlockedQueueSlots ?? QUEUE_SLOT_CONFIG.BASE_SLOTS;
      const nextSlot = unlocked + 1;
      const maxSlots = QUEUE_SLOT_CONFIG.MAX_SLOTS;

      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';

      const descBox = document.createElement('div');
      descBox.style.fontSize = '0.78rem';
      descBox.style.color = '#cbd5e0';
      descBox.style.lineHeight = '1.4';
      descBox.innerHTML = `
        Queue multiple actions in a row. Unlocked: <strong style="color: #68d391;">${unlocked} / ${maxSlots} slots</strong>.
        When an action finishes or materials run out, your character moves straight to the next task.
      `;
      container.appendChild(descBox);

      const slotsList = document.createElement('div');
      slotsList.style.display = 'flex';
      slotsList.style.flexDirection = 'column';
      slotsList.style.gap = '8px';

      for (let s = 1; s <= maxSlots; s++) {
        const slotRow = document.createElement('div');
        slotRow.style.display = 'flex';
        slotRow.style.alignItems = 'center';
        slotRow.style.justifyContent = 'space-between';
        slotRow.style.padding = '8px 12px';
        slotRow.style.borderRadius = '6px';
        slotRow.style.border = '1px solid rgba(255, 255, 255, 0.08)';

        if (s <= unlocked) {
          slotRow.style.background = 'rgba(72, 187, 120, 0.08)';
          slotRow.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #48bb78; font-weight: 700;">✓</span>
              <span style="font-size: 0.82rem; font-weight: 600;">Slot ${s}</span>
              <span style="font-size: 0.7rem; color: #a0aec0;">(Active)</span>
            </div>
            <span style="font-size: 0.72rem; color: #48bb78; font-weight: 600;">Unlocked</span>
          `;
        } else if (s === nextSlot) {
          const cost = QUEUE_SLOT_CONFIG.COSTS[s] || 500;
          const canAfford = (this.player.gems || 0) >= cost;
          slotRow.style.background = 'rgba(56, 189, 248, 0.08)';
          slotRow.style.borderColor = 'rgba(56, 189, 248, 0.3)';
          slotRow.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #38bdf8;">🔓</span>
              <div>
                <div style="font-size: 0.82rem; font-weight: 700; color: #e2e8f0;">Slot ${s}</div>
                <div style="font-size: 0.7rem; color: #a0aec0;">Adds a permanent action queue slot</div>
              </div>
            </div>
            <button class="btn-oak btn-unlock-slot" style="padding: 4px 12px; font-size: 0.75rem; background: ${canAfford ? '#3182ce' : '#4a5568'};">
              Unlock (${cost} 💎)
            </button>
          `;
          const btnUnlock = slotRow.querySelector('.btn-unlock-slot') as HTMLButtonElement;
          btnUnlock.onclick = () => {
            if (!canAfford) {
              this.showToast(`You need ${cost} gems to unlock Slot ${s}.`);
              this.renderGemStoreTab('packs');
              return;
            }
            sound.play('ding');
            this.sendWs({ type: 'UNLOCK_QUEUE_SLOT', slotNumber: s });
          };
        } else {
          const cost = QUEUE_SLOT_CONFIG.COSTS[s] || 500;
          slotRow.style.background = 'rgba(0, 0, 0, 0.2)';
          slotRow.style.opacity = '0.5';
          slotRow.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>🔒</span>
              <span style="font-size: 0.82rem; color: #a0aec0;">Slot ${s}</span>
            </div>
            <span style="font-size: 0.72rem; color: #718096;">Requires Slot ${s - 1} (${cost} 💎)</span>
          `;
        }
        slotsList.appendChild(slotRow);
      }
      container.appendChild(slotsList);
      bodyEl.appendChild(container);

    } else if (tab === 'offline') {
      const currentMax = this.player.maxOfflineSeconds || OFFLINE_TIME_CONFIG.BASE_SECONDS;
      const formattedCurrent = formatOfflineDuration(currentMax);
      const formattedNext = formatOfflineDuration(currentMax + OFFLINE_TIME_CONFIG.INCREMENT_SECONDS);
      const cost = OFFLINE_TIME_CONFIG.COST_PER_INCREMENT;
      const canAfford = (this.player.gems || 0) >= cost;

      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '14px';

      const descBox = document.createElement('div');
      descBox.style.fontSize = '0.78rem';
      descBox.style.color = '#cbd5e0';
      descBox.style.lineHeight = '1.45';
      descBox.innerHTML = `
        Your character automatically gathers resources, trains combat, and progresses action queues while offline or tabbed out.
        Expand your maximum offline simulation window with celestial gems.
      `;
      container.appendChild(descBox);

      // Current Cap Card
      const currentCard = document.createElement('div');
      currentCard.style.display = 'flex';
      currentCard.style.justifyContent = 'space-between';
      currentCard.style.alignItems = 'center';
      currentCard.style.padding = '12px 14px';
      currentCard.style.background = 'rgba(72, 187, 120, 0.08)';
      currentCard.style.border = '1px solid rgba(72, 187, 120, 0.25)';
      currentCard.style.borderRadius = '6px';
      currentCard.innerHTML = `
        <div>
          <div style="font-size: 0.72rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px;">Current Offline Limit</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #68d391; margin-top: 2px;">${formattedCurrent}</div>
        </div>
        <div style="font-size: 0.72rem; color: #48bb78; background: rgba(72, 187, 120, 0.15); padding: 4px 8px; border-radius: 4px; font-weight: 600;">
          Active Cap
        </div>
      `;
      container.appendChild(currentCard);

      // Upgrade Action Card
      const upgradeCard = document.createElement('div');
      upgradeCard.style.display = 'flex';
      upgradeCard.style.justifyContent = 'space-between';
      upgradeCard.style.alignItems = 'center';
      upgradeCard.style.padding = '12px 14px';
      upgradeCard.style.background = 'rgba(56, 189, 248, 0.08)';
      upgradeCard.style.border = '1px solid rgba(56, 189, 248, 0.25)';
      upgradeCard.style.borderRadius = '6px';
      upgradeCard.innerHTML = `
        <div>
          <div style="font-size: 0.84rem; font-weight: 700; color: #e2e8f0;">+15 Minutes Progression Time</div>
          <div style="font-size: 0.72rem; color: #a0aec0; margin-top: 2px;">
            Increases cap from <strong style="color: #cbd5e0;">${formattedCurrent}</strong> to <strong style="color: #38bdf8;">${formattedNext}</strong>
          </div>
        </div>
        <button id="btn-buy-offline-time" class="btn-oak" style="padding: 6px 14px; font-size: 0.78rem; font-weight: 700; background: ${canAfford ? '#3182ce' : '#4a5568'};">
          +15m (${cost} 💎)
        </button>
      `;
      const btnBuy = upgradeCard.querySelector('#btn-buy-offline-time') as HTMLButtonElement;
      btnBuy.onclick = () => {
        if (!canAfford) {
          this.showToast(`You need ${cost} gems to extend offline progression time.`);
          this.renderGemStoreTab('packs');
          return;
        }
        sound.play('ding');
        this.sendWs({ type: 'UPGRADE_OFFLINE_TIME' });
      };
      container.appendChild(upgradeCard);

      bodyEl.appendChild(container);

    } else if (tab === 'packs') {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';

      const infoBox = document.createElement('div');
      infoBox.style.fontSize = '0.78rem';
      infoBox.style.color = '#cbd5e0';
      infoBox.style.lineHeight = '1.4';
      infoBox.innerHTML = `
        Packs are placed straight into your inventory. Open them for gems, or sell them to other players for gold in the market.
      `;
      container.appendChild(infoBox);

      const grid = document.createElement('div');
      grid.className = 'gem-pack-grid';

      for (const pack of this.gemPacksData) {
        const card = document.createElement('div');
        card.className = 'gem-pack-card';
        card.innerHTML = `
          <div style="margin-bottom: 4px; display: flex; justify-content: center;">
            <img src="/icons/items/${pack.id}.png" style="width: 32px; height: 32px; image-rendering: pixelated;" alt="${pack.name}" />
          </div>
          <div class="gem-pack-name">${pack.name}</div>
          <div class="gem-pack-gems">${pack.gems.toLocaleString()} Gems</div>
          <div style="font-size: 0.7rem; color: #a0aec0; margin: 4px 0 2px 0;">Tradeable Pack</div>
          <button class="btn-pack-buy">$${pack.priceUsd.toFixed(2)}</button>
        `;

        const buyBtn = card.querySelector('.btn-pack-buy') as HTMLButtonElement;
        buyBtn.onclick = () => this.handleBuyGemPack(pack);
        grid.appendChild(card);
      }

      container.appendChild(grid);
      bodyEl.appendChild(container);
    }
  }

  private async handleBuyGemPack(pack: GemPackDef) {
    if (!this.player) return;
    try {
      this.showToast(`Starting checkout for ${pack.name}...`);
      const createRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id, playerId: this.player.id }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.orderId) {
        this.showToast(createData.error || 'Could not start checkout.');
        return;
      }

      // If approval URL is present (live/sandbox PayPal), open checkout window
      if (createData.approvalUrl) {
        const width = 500;
        const height = 620;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          createData.approvalUrl,
          'paypal_checkout',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no`
        );

        if (!popup) {
          window.location.href = createData.approvalUrl;
          return;
        }

        // Await buyer completing approval in the popup
        await new Promise<void>((resolve, reject) => {
          let timer: any = null;
          const messageHandler = (ev: MessageEvent) => {
            if (ev.data?.type === 'PAYPAL_APPROVED') {
              window.removeEventListener('message', messageHandler);
              if (timer) clearInterval(timer);
              resolve();
            } else if (ev.data?.type === 'PAYPAL_CANCELLED') {
              window.removeEventListener('message', messageHandler);
              if (timer) clearInterval(timer);
              reject(new Error('Checkout cancelled.'));
            }
          };
          window.addEventListener('message', messageHandler);

          timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              window.removeEventListener('message', messageHandler);
              // Give backend a moment to process or capture
              resolve();
            }
          }, 600);
        });
      }

      const captureRes = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createData.orderId,
          packId: pack.id,
          playerId: this.player.id,
        }),
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        this.showToast(captureData.error || 'Payment failed.');
        return;
      }

      sound.play('levelUp');
      this.showToast(`Thank you! Your ${pack.name} was placed in your inventory.`);
    } catch (err: any) {
      console.error('Checkout error:', err);
      this.showToast(err.message || 'Something went wrong with the purchase.');
    }
  }

  private triggerDoorWarp(doorNode: WorldNodeDisplay) {
    if (!this.player) return;

    let targetX = doorNode.targetX;
    let targetY = doorNode.targetY;

    // If targetLevelId was set, we can resolve level center if coordinates weren't set
    if (doorNode.targetLevelId && (targetX === undefined || targetY === undefined)) {
      const stitched = this.renderer.getStitchedWorld();
      if (stitched) {
        const lvl = stitched.levels.find(l => l.identifier === doorNode.targetLevelId);
        if (lvl) {
          if (targetX === undefined) targetX = lvl.tileX + Math.floor(lvl.widthTiles / 2);
          if (targetY === undefined) targetY = lvl.tileY + Math.floor(lvl.heightTiles / 2);
        }
      }
    }

    if (targetX === undefined || targetY === undefined) {
      this.showToast('This doorway leads nowhere yet. Configure destination in Admin Editor.');
      return;
    }

    sound.play('teleport');

    // Cancel current walking / task
    this.pendingDoorTarget = null;
    this.pendingMonsterTarget = null;
    this.pendingNpcTarget = null;
    this.pendingStationTarget = null;
    this.pendingHearthTarget = null;

    this.sendWs({
      type: 'USE_WARP',
      nodeId: doorNode.id,
    });
  }
}

new EldoriaClient();


