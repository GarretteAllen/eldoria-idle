import { PlayerData, RECIPES, ITEMS, MONSTERS, EquipSlot, SkillType, getXpToNextLevel, NpcDefinition, QuestDefinition } from '@eldoria/shared';
import { WorldRenderer, WorldNodeDisplay } from './canvas.js';
import { loadLdtkWorld } from './ldtkLoader.js';
import { ICONS, getItemIconSvg } from './icons.js';

const SKILL_FLAVOR: Record<string, string> = {
  mining: 'Excavate raw veins of pyrite, galena, cold iron, quicksilver and starfall from the ancient crags.',
  fishing: 'Cast into shimmering waters, quiet streams and abyssal tides for bountiful catches.',
  woodcutting: 'Fell whispering oaks, willows, bloodwood and ancient elders across the frontier.',
  herbalism: 'Tend fertile soil, forage earth roots, ghost moss and mystical blooms for alchemy.',
  thieving: 'Lurk in shadowy alcoves to pickpocket citizens, merchants and opulent nobles.',
  smithing: 'Smelt ores into glowing ingots and hammer formidable blades and armaments at the forge.',
  cooking: 'Prepare nourishing smoked rations, chowders and celestial feasts over the firepit.',
  fletching: 'Carve seasoned timbers into recurve longbows and fletch deadly feathered arrows.',
  alchemy: 'Distill enchanted herbs and pure solvents into potent elixirs of haste and warding.',
  crafting: 'Cut celestial gems, stitch tough hides and fashion rings and talismans of power.',
  attunement: 'Channel primordial soul anima into cosmic blessings and celestial wards.',
  melee: 'Master the edge of the blade, crushing blows and close-quarters swordplay.',
  ranged: 'Pinpoint weak spots from afar with recurve bows and deadly flight.',
  magic: 'Unleash celestial sorcery, elemental tempests and arcane mysteries.',
  defence: 'Turn aside savage strikes with heavy bulwarks, deflection and fortified plate.',
  hitpoints: 'Endure mortal wounds through constitution, vigor and restorative feasts.',
};

const GATHERING_SKILLS: SkillType[] = ['mining', 'fishing', 'woodcutting', 'herbalism', 'thieving'];
const CRAFTING_SKILLS: SkillType[] = ['cooking', 'smithing', 'fletching', 'alchemy', 'crafting', 'attunement'];
const COMBAT_SKILLS: SkillType[] = ['melee', 'ranged', 'magic', 'defence', 'hitpoints'];

class EldoriaClient {
  private ws: WebSocket | null = null;
  private player: PlayerData | null = null;
  private renderer: WorldRenderer;
  private activeChannel = 'All';
  private selectedInventoryIndex: number | null = null;
  private worldNodes: WorldNodeDisplay[] = [];
  private npcs: NpcDefinition[] = [];
  private quests: QuestDefinition[] = [];

  // Deep Vein UI State
  private activeDrawer: 'skills' | 'inventory' | 'equipment' | 'storage' | 'editor' = 'skills';
  private selectedSkillKey: SkillType = 'mining';
  private selectedRecipeId: string = 'mine_pyrite';
  private selectedJobQuantity: number = Infinity;
  private isPopupOpen: boolean = false;
  private chatCollapsed: boolean = false;

  // Storage Modal State
  private selectedTransferAmount: number | 'all' = 1;
  private storageFilterQuery: string = '';
  private activeStorageTab: 'storage' | 'vendor' = 'storage';

  // Editor State
  private activeEditorTab: 'nodes' | 'monsters' | 'npcs' | 'quests' | 'collisions' | 'giveitems' = 'nodes';
  private collisionBrush: 'paint' | 'erase' = 'paint';

  // Interaction State
  private pendingNpcTarget: NpcDefinition | null = null;
  private pendingMonsterTarget: WorldNodeDisplay | null = null;

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
    this.setupAdminEditor();
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

    // Tasks Card
    document.getElementById('task-home-btn')!.innerHTML = ICONS.hearth;
    document.getElementById('task-stop-btn')!.innerHTML = ICONS.stop;

    // Toolbar
    document.getElementById('tool-btn-skills')!.innerHTML = ICONS.skills;
    document.getElementById('tool-btn-inventory')!.innerHTML = ICONS.inventory;
    document.getElementById('tool-btn-equipment')!.innerHTML = ICONS.equipment;
    document.getElementById('tool-btn-storage')!.innerHTML = ICONS.storage;
    document.getElementById('tool-btn-chat')!.innerHTML = ICONS.chat;
    const editorToolBtn = document.getElementById('tool-btn-editor');
    if (editorToolBtn) editorToolBtn.innerHTML = ICONS.editor;

    // Editor Header Crown
    const crownIcon = document.getElementById('editor-crown-icon');
    if (crownIcon) crownIcon.innerHTML = ICONS.admin;

    // Drawer Buttons
    document.getElementById('btn-fight-icon')!.innerHTML = ICONS.melee;
    document.getElementById('btn-home-icon')!.innerHTML = ICONS.hearth;

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
        this.pendingNpcTarget = null;
        this.pendingMonsterTarget = null;
        this.sendWs({ type: 'MOVE_TO', x: tileX, y: tileY });
      };

      this.renderer.onNpcClick = (npc: NpcDefinition) => {
        if (!this.player) return;
        const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
        if (dist <= 1.5) {
          // Already adjacent / at NPC: talk immediately
          this.pendingNpcTarget = null;
          this.openNpcDialogue(npc);
        } else {
          // Player MUST walk to the NPC before talking to it!
          this.pendingNpcTarget = npc;
          this.pendingMonsterTarget = null;
          const target = this.getAdjacentWalkableTile(npc.x, npc.y);
          this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
          this.showToast(`Walking to ${npc.name}...`);
        }
      };

      this.renderer.onNodeClick = (node: WorldNodeDisplay) => {
        this.pendingNpcTarget = null;

        // MONSTER / ENEMY: Stop one tile before the enemy, and then attack it!
        if (node.type === 'monster') {
          if (!this.player) return;
          const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
          if (dist <= 1.5) {
            // Already adjacent to enemy (one tile away): attack immediately!
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
            // Stop one tile before the enemy!
            this.pendingMonsterTarget = node;
            const target = this.getAdjacentWalkableTile(node.x, node.y);
            this.sendWs({ type: 'MOVE_TO', x: target.x, y: target.y });
            this.showToast(`Walking to ${node.name}...`);
          }
          return;
        }

        this.pendingMonsterTarget = null;
        if (node.recipeId) {
          const rec = RECIPES[node.recipeId];
          if (rec) {
            this.selectedSkillKey = rec.skill;
            this.selectedRecipeId = rec.id;
            this.openSkillJobPopup(rec.skill, rec.id);
          }
          this.sendWs({
            type: 'START_TASK',
            recipeId: node.recipeId,
            targetX: node.x,
            targetY: node.y,
          });
        } else if (node.type === 'hearth_counter') {
          this.sendWs({ type: 'MOVE_TO', x: node.x, y: node.y });
          this.openStorageModal();
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
          this.renderEditorMonsters();
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

    // No persistent registered session -> Present realm entry / login gate modal
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

    this.ws.onclose = () => {
      console.log('Disconnected. Retrying in 3s...');
      setTimeout(() => {
        if (this.player) this.connectWs();
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
        this.renderer.setLocalPlayer(this.player!);
        this.updateUI();

        if (msg.nodes) {
          this.worldNodes = msg.nodes;
          this.renderer.setNodes(this.worldNodes);
          this.renderEditorNodes();
          this.renderEditorMonsters();
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

        // Check if arrived adjacent to clicked Monster (stop 1 tile before enemy, then attack)
        if (this.pendingMonsterTarget && this.player) {
          const dist = Math.hypot(this.player.x - this.pendingMonsterTarget.x, this.player.y - this.pendingMonsterTarget.y);
          if (dist <= 1.5) {
            const target = this.pendingMonsterTarget;
            this.pendingMonsterTarget = null;
            this.sendWs({
              type: 'START_COMBAT',
              nodeId: target.id,
              monsterId: target.monsterId || 'mire_rat',
              targetX: target.x,
              targetY: target.y,
            });
            this.showToast(`Attacking ${target.name}!`);
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
        this.renderEditorNodes();
        this.renderEditorMonsters();
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

      case 'CHAT_BROADCAST':
        this.appendChatMessage(msg);
        if (msg.senderId) {
          this.renderer.addChatBubble(msg.senderId, msg.text);
        }
        break;

      case 'BOSS_UPDATE':
        this.updateBossBanner(msg.boss);
        break;

      case 'COMBAT_HIT':
        if (msg.target === 'monster') {
          if (msg.monsterId && msg.monsterHp !== undefined && msg.monsterMaxHp !== undefined) {
            this.renderer.monsterHpMap.set(msg.monsterId, { currentHp: msg.monsterHp, maxHp: msg.monsterMaxHp });
          }
          if (msg.nodeId && msg.monsterHp !== undefined && msg.monsterMaxHp !== undefined) {
            this.renderer.monsterHpMap.set(msg.nodeId, { currentHp: msg.monsterHp, maxHp: msg.monsterMaxHp });
          }
          if (msg.damage > 0) {
            this.showToast(`⚔️ Hit ${msg.monsterName} for ${msg.damage}! (${msg.monsterHp}/${msg.monsterMaxHp} HP)`);
          } else {
            this.showToast(`🛡️ You splashed against ${msg.monsterName}! (0 damage)`);
          }
        } else if (msg.target === 'player') {
          if (msg.damage > 0) {
            this.showToast(`💥 ${msg.monsterName} struck you for ${msg.damage} damage!`);
          }
        }
        break;

      case 'NOTIFICATION':
        this.showToast(msg.message);
        break;
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
        if (charPill) charPill.title = 'Guest Adventurer — Click to register permanent account';
      } else {
        nameEl.textContent = this.player.role === 'admin' 
          ? `[ADMIN] ${this.player.username || 'Admin'}` 
          : (this.player.username || 'Adventurer');
        if (charPill) charPill.title = this.player.role === 'admin'
          ? 'Administrator Account — Click for profile'
          : 'Registered Adventurer — Click for profile';
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
    const maxHp = (this.player.skills.hitpoints?.level || 10);
    document.getElementById('hp-text')!.textContent = `${this.player.currentHp} / ${maxHp}`;
    const hpPct = Math.min(100, Math.floor((this.player.currentHp / maxHp) * 100));
    document.getElementById('hp-bar-fill')!.style.width = `${hpPct}%`;

    // Speed
    const speed = this.player.moveSpeedTilesPerTick || 1.0;
    const bonusPct = Math.round((speed - 1.0) * 100);
    document.getElementById('speed-text')!.textContent = `${speed.toFixed(2)} t/t ${bonusPct > 0 ? '(+' + bonusPct + '%)' : ''}`;

    // 2. Tasks Card (Top-Left)
    this.updateTasksCard();

    // 3. Render Drawers (ensure all drawers and counters stay perfectly updated)
    this.renderSkillsDrawer();
    this.renderInventoryDrawer();
    this.renderEquipmentDrawer();
    this.renderStorageDrawer();
    this.renderStorageModal();
    if (this.activeDrawer === 'editor') {
      this.renderEditorNodes();
      this.renderEditorMonsters();
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
      taskNameEl.textContent = 'Banking — Riding to Hearth';
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
        taskNameEl.textContent = `Combat — ${monsterDef.name} (Lv ${monsterDef.level})`;
        const mSkill = this.player.skills.melee || { level: 1, xp: 0 };
        const { percent } = getXpToNextLevel(mSkill.level, mSkill.xp);
        taskSubEl.textContent = `MELEE ${mSkill.level} (${percent.toFixed(1)}%) • Auto-retaliating in ${monsterDef.zone}`;
        progressFillEl.style.width = `${Math.max(5, percent)}%`;
        taskIconEl.innerHTML = ICONS.melee || ICONS.skills;
        statusTagEl.textContent = 'COMBAT';
        statusTagEl.className = 'status-tag combat';
      } else {
        const rec = RECIPES[this.player.currentTask.recipeId];
        const skill = this.player.currentTask.skill;
        taskNameEl.textContent = rec ? `${rec.name}` : skill;

        const pSkill = this.player.skills[skill as SkillType] || { level: 1, xp: 0 };
        const { percent } = getXpToNextLevel(pSkill.level, pSkill.xp);
        taskSubEl.textContent = `${skill.toUpperCase()} ${pSkill.level} · ${percent.toFixed(1)}% to ${pSkill.level + 1} • Auto-banks when full`;
        progressFillEl.style.width = `${Math.max(5, percent)}%`;
        taskIconEl.innerHTML = ICONS[skill] || ICONS.skills;
        statusTagEl.textContent = 'WORKING';
        statusTagEl.className = 'status-tag';
      }
    } else {
      taskNameEl.textContent = 'Idle — Choose a trade';
      taskSubEl.textContent = 'Select a trade from the skills menu or click the map';
      progressFillEl.style.width = '0%';
      taskIconEl.innerHTML = ICONS.skills;
      statusTagEl.textContent = 'IDLE';
      statusTagEl.className = 'status-tag idle';
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
    ].filter(pt => pt.x >= 0 && pt.x < 60 && pt.y >= 0 && pt.y < 60 && !collisions.has(`${pt.x},${pt.y}`));

    if (candidates.length > 0 && this.player) {
      candidates.sort((a, b) =>
        Math.hypot(a.x - this.player!.x, a.y - this.player!.y) -
        Math.hypot(b.x - this.player!.x, b.y - this.player!.y)
      );
      return candidates[0];
    }
    return { x: targetX, y: targetY };
  }

  private getHearthLocation(playerX?: number, playerY?: number): { x: number; y: number } {
    const hearthNodes = this.worldNodes.filter(n =>
      n.type === 'hearth_counter' ||
      n.id.toLowerCase().includes('hearth') ||
      n.id.toLowerCase().includes('bank') ||
      (n.name && (n.name.toLowerCase().includes('hearth') || n.name.toLowerCase().includes('bank')))
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

  private getFightLocation(): { x: number; y: number } {
    const monsterNode = this.worldNodes.find(n => n.type === 'monster' || n.type === 'boss_arena');
    if (monsterNode) return { x: monsterNode.x, y: monsterNode.y };
    return { x: 4, y: 44 };
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

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (panel === 'skills' || panel === 'inventory' || panel === 'equipment') {
          this.switchDrawer(panel);
        }
      });
    });

    document.getElementById('btn-quick-fight')!.onclick = () => {
      const fight = this.getFightLocation();
      this.sendWs({ type: 'MOVE_TO', x: fight.x, y: fight.y });
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

    if (drawer !== 'skills') {
      this.closeSkillJobPopup();
    }

    if (drawer !== 'editor') {
      this.renderer.editorMode = 'none';
      this.renderer.showCollisions = false;
      const chk = document.getElementById('chk-show-collisions') as HTMLInputElement | null;
      if (chk) chk.checked = false;
      const btnPaint = document.getElementById('btn-brush-paint');
      const btnErase = document.getElementById('btn-brush-erase');
      if (btnPaint) btnPaint.classList.remove('active');
      if (btnErase) btnErase.classList.remove('active');
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
        this.openSkillJobPopup(skillKey);
      });

      container.appendChild(card);
    }
  }

  private setupSkillJobPopup() {
    document.getElementById('popup-close-btn')!.onclick = () => {
      this.closeSkillJobPopup();
    };

    // HOW MANY quantity buttons
    const qtyPills = document.querySelectorAll('.qty-pill');
    qtyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        qtyPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const q = pill.getAttribute('data-qty');
        this.selectedJobQuantity = q === 'Infinity' ? Infinity : parseInt(q || '1', 10);
      });
    });

    // Start button
    document.getElementById('btn-job-start')!.onclick = () => {
      if (!this.selectedRecipeId) return;
      const rec = RECIPES[this.selectedRecipeId];
      if (!rec) return;

      const matchingNode = this.worldNodes.find(n => n.recipeId === rec.id);
      const targetX = matchingNode ? matchingNode.x : this.player!.x;
      const targetY = matchingNode ? matchingNode.y : this.player!.y;

      this.sendWs({
        type: 'START_TASK',
        recipeId: rec.id,
        quantity: this.selectedJobQuantity,
        targetX,
        targetY,
      });

      this.closeSkillJobPopup();
    };

    // Stop button
    document.getElementById('btn-job-stop')!.onclick = () => {
      this.sendWs({ type: 'STOP_TASK' });
    };
  }

  private openSkillJobPopup(skillKey: SkillType, selectRecipeId?: string) {
    this.selectedSkillKey = skillKey;
    this.isPopupOpen = true;

    const popup = document.getElementById('skill-job-popup')!;
    popup.classList.remove('hidden');

    if (selectRecipeId) {
      this.selectedRecipeId = selectRecipeId;
    } else {
      // Default to first available unlocked recipe
      const available = Object.values(RECIPES).filter(r => r.skill === skillKey);
      if (available.length > 0) {
        this.selectedRecipeId = available[0].id;
      }
    }

    this.updateSkillJobPopup();
    this.renderSkillsDrawer();
  }

  private closeSkillJobPopup() {
    this.isPopupOpen = false;
    document.getElementById('skill-job-popup')!.classList.add('hidden');
    this.renderSkillsDrawer();
  }

  private updateSkillJobPopup() {
    if (!this.player) return;
    const skillKey = this.selectedSkillKey;
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

    for (const recipe of skillRecipes) {
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

      // Find matching world node if one exists for direct recipe or its primary input
      let matchingNode = this.worldNodes.find(n => n.recipeId === recipe.id);
      if (!matchingNode && recipe.inputs && recipe.inputs.length > 0) {
        const inputId = recipe.inputs[0].itemId;
        const sourceRecipe = Object.values(RECIPES).find(r => r.outputItemId === inputId);
        if (sourceRecipe) {
          matchingNode = this.worldNodes.find(n => n.recipeId === sourceRecipe.id);
        }
      }

      const iconSvg = ICONS[recipe.outputItemId] || ICONS[recipe.skill] || ICONS.skills;

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
        slotEl.innerHTML = `
          <div class="item-name">${name}</div>
          <span class="item-qty">${slot.quantity > 1 ? slot.quantity : ''}</span>
        `;
        slotEl.title = `${name} (${slot.rarity || 'plain'})\nClick for actions`;
        slotEl.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          this.openItemContextMenu(i, e);
        });
      }
      grid.appendChild(slotEl);

    }
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

    // 2. Render Worn Combat & Attire Equipment
    const container = document.getElementById('equipment-slots')!;
    container.innerHTML = '';

    const wornSlots: Array<{ key: EquipSlot; label: string; icon: string }> = [
      { key: 'weapon', label: 'Main Weapon', icon: '⚔️' },
      { key: 'shield', label: 'Shield / Off-Hand', icon: '🛡️' },
      { key: 'helmet', label: 'Headgear', icon: '🪖' },
      { key: 'hair', label: 'Cosmetic Hair', icon: '💇' },
      { key: 'body', label: 'Body Armour', icon: '🥋' },
      { key: 'legs', label: 'Leg Greaves', icon: '👖' },
      { key: 'steed', label: 'Mount / Steed', icon: '🐎' },
      { key: 'amulet', label: 'Amulet', icon: '📿' },
      { key: 'ring', label: 'Ring', icon: '💍' },
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

        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.1rem;">${slotDef.icon}</span>
            <div>
              <div style="font-weight:700; font-size:0.75rem; color:var(--gold-main);">${slotDef.label}</div>
              <div style="font-size:0.78rem; font-weight:600; color:${rarityCol};">${def ? def.name : itemSlot.itemId}</div>
            </div>
          </div>
          <button class="btn-oak" style="padding:2px 8px; font-size:0.68rem; height:22px;">Unequip</button>
        `;
        div.title = `${def?.name || itemSlot.itemId}\nClick to unequip into satchel`;
        div.onclick = () => {
          this.sendWs({ type: 'UNEQUIP_ITEM', slot: slotDef.key });
        };
      } else {
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1rem; opacity:0.4;">${slotDef.icon}</span>
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
        icon: string;
        matchCategory: string;
      }> = [
        { key: 'tool_pickaxe', fallbackKey: 'tool', label: 'Mining Pickaxe', icon: '⛏️', matchCategory: 'pickaxe' },
        { key: 'tool_axe', fallbackKey: 'tool', label: 'Woodcutting Axe', icon: '🪓', matchCategory: 'axe' },
        { key: 'tool_rod', fallbackKey: 'tool', label: 'Fishing Tackle', icon: '🎣', matchCategory: 'rod' },
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

          div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.1rem;">${slotDef.icon}</span>
              <div>
                <div style="font-weight:700; font-size:0.75rem; color:var(--gold-main);">${slotDef.label}</div>
                <div style="font-size:0.78rem; font-weight:600; color:${rarityCol};">${def ? def.name : itemSlot.itemId} <span style="font-size:0.7rem; color:#48bb78;">(${speedBonus})</span></div>
              </div>
            </div>
            <button class="btn-oak" style="padding:2px 8px; font-size:0.68rem; height:22px;">Unequip</button>
          `;
          div.title = `${def?.name || itemSlot.itemId} (${speedBonus})\nClick to unequip into satchel`;
          div.onclick = () => {
            this.sendWs({ type: 'UNEQUIP_ITEM', slot: actualSlotKey });
          };
        } else {
          div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1rem; opacity:0.4;">${slotDef.icon}</span>
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
      div.innerHTML = `
        <div class="item-name">${def ? def.name : slot.itemId}</div>
        <span class="item-qty">${slot.quantity}</span>
      `;
      div.title = isNearHearth 
        ? `Click to withdraw ${def?.name || slot.itemId} into satchel` 
        : `Travel to Hearth to withdraw items`;
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
    const viewStorage = document.getElementById('dv-storage-tab-view');
    const viewVendor = document.getElementById('dv-vendor-tab-view');

    if (tabStorage && tabVendor && viewStorage && viewVendor) {
      tabStorage.onclick = () => {
        this.activeStorageTab = 'storage';
        tabStorage.classList.add('active');
        tabVendor.classList.remove('active');
        viewStorage.classList.remove('hidden');
        viewVendor.classList.add('hidden');
        this.renderStorageModal();
      };

      tabVendor.onclick = () => {
        this.activeStorageTab = 'vendor';
        tabVendor.classList.add('active');
        tabStorage.classList.remove('active');
        viewVendor.classList.remove('hidden');
        viewStorage.classList.add('hidden');
        this.renderVendorView();
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

  private openStorageModal() {
    const modal = document.getElementById('deepvein-storage-modal');
    if (!modal) return;
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
        div.title = `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}) — Click to withdraw ${this.selectedTransferAmount === 'all' ? 'all' : this.selectedTransferAmount}`;

        div.onclick = () => {
          if (!isNearHearth) {
            this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
            this.showToast('Riding to Hearth Storage Counter...');
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
          div.title = `${def?.name || slot.itemId} (x${slot.quantity.toLocaleString()}) — Click to deposit ${this.selectedTransferAmount === 'all' ? 'all' : this.selectedTransferAmount}`;

          const index = i;
          div.onclick = () => {
            if (!isNearHearth) {
              this.sendWs({ type: 'MOVE_TO', x: hearth.x, y: hearth.y });
              this.showToast('Riding to Hearth Storage Counter...');
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
        div.title = `${def?.name || slot.itemId} (x${slot.quantity}) — Click to sell for ${totalPrice.toLocaleString()} Gold (${pricePerUnit} each)`;

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

  private setupChat() {
    const collapseBtn = document.getElementById('chat-collapse-btn')!;
    const chatCard = document.getElementById('chat-card')!;

    collapseBtn.onclick = () => {
      this.chatCollapsed = !this.chatCollapsed;
      if (this.chatCollapsed) {
        chatCard.style.maxHeight = '34px';
        collapseBtn.textContent = '▴';
      } else {
        chatCard.style.maxHeight = '280px';
        collapseBtn.textContent = '▾';
      }
    };

    const chanBtns = document.querySelectorAll('.chan-btn');
    chanBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        chanBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeChannel = btn.getAttribute('data-chan') || 'All';
      });
    });

    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('chat-input') as HTMLInputElement;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.sendWs({
        type: 'CHAT',
        channel: this.activeChannel,
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
    const log = document.getElementById('chat-messages')!;
    const line = document.createElement('div');
    line.className = 'chat-line';

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const sender = msg.senderName || 'Wanderer';

    const adminTag = msg.isAdmin
      ? `<span class="chat-admin-badge"><span style="display:inline-flex; width:12px; height:12px; margin-right:2px; vertical-align:middle;">${ICONS.admin}</span>ADMIN</span>`
      : '';

    line.innerHTML = `
      <span class="chat-time">${timeStr}</span>
      ${adminTag}
      <span class="chat-sender">${sender}:</span>
      <span>${msg.text}</span>
    `;
    log.appendChild(line);
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
        if (this.selectedInventoryIndex !== null) {
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
          const slot = this.player.inventory[this.selectedInventoryIndex];
          if (slot) {
            const countStr = prompt(`How many ${ITEMS[slot.itemId]?.name || 'items'} to deposit?`, String(slot.quantity));
            const count = parseInt(countStr || '', 10);
            if (!isNaN(count) && count > 0) {
              this.sendWs({ type: 'DEPOSIT_ITEM', inventoryIndex: this.selectedInventoryIndex, quantity: count });
            }
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
        if (confirm('Are you sure you want to log out of Eldoria?')) {
          this.handleLogout();
        }
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
        if (confirm('Create a new guest character? Current guest progress will be reset.')) {
          localStorage.removeItem('eldoria_guest_id');
          localStorage.removeItem('eldoria_session_token');
          window.location.reload();
        }
      };
    }

    if (btnLogout) {
      btnLogout.onclick = () => {
        if (confirm('Are you sure you want to log out of Eldoria?')) {
          this.handleLogout();
        }
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
      statsEl.textContent = statParts.length > 0 ? statParts.join(' ') : (def.description || `${slot.rarity || 'plain'} item`);
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
      eatBtn.style.display = def.category === 'cooked_food' ? 'flex' : 'none';
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



  private updateBossBanner(boss: any) {
    const pill = document.getElementById('boss-pill')!;
    if (!boss) {
      pill.classList.add('hidden');
      return;
    }
    pill.classList.remove('hidden');
    const info = document.getElementById('boss-info')!;
    info.textContent = `${boss.name} (${boss.currentHp.toLocaleString()} HP)`;

    const joinBtn = document.getElementById('boss-join-btn')!;
    joinBtn.onclick = () => {
      this.sendWs({ type: 'ATTACK_BOSS' });
    };
  }

  private showCatchUpModal(summary: any) {
    const modal = document.getElementById('away-modal')!;
    const body = document.getElementById('away-body')!;

    const minutes = Math.floor(summary.elapsedSeconds / 60);
    body.innerHTML = `
      <p style="margin-bottom: 8px;">You rested for <b>${minutes} minutes</b>.</p>
      <div style="background: #1c1108; padding: 10px; border-radius: 6px; border: 1px solid #4a301a; display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
        <div><b>Actions Finished:</b> ${summary.completedCycles}</div>
        <div><b>XP Earned:</b> +${summary.xpGained.toLocaleString()}</div>
        ${summary.leveledUp ? '<div style="color:var(--gold-bright); font-weight:700;">Ascension! You gained new levels!</div>' : ''}
        ${summary.overflowOccurred ? '<div style="color:var(--red-accent);">Satchel filled! Remaining spoils were safely deposited at the Hearth Altar.</div>' : ''}
      </div>
    `;

    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');
    document.getElementById('away-close-btn')!.onclick = close;
    document.getElementById('away-ok-btn')!.onclick = close;
  }

  private showToast(msg: string) {
    this.appendChatMessage({
      channel: 'System',
      senderName: 'Eldoria',
      text: msg,
    });
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
        this.showToast(`Node coordinates set: (${tx}, ${ty})`);
      } else if (this.activeEditorTab === 'monsters') {
        const xIn = document.getElementById('monster-form-x') as HTMLInputElement | null;
        const yIn = document.getElementById('monster-form-y') as HTMLInputElement | null;
        if (xIn && yIn) {
          xIn.value = tx.toString();
          yIn.value = ty.toString();
        }
        this.showToast(`Monster coordinates set: (${tx}, ${ty})`);
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

    // 5. Node Form Setup

    const recSelect = document.getElementById('node-form-recipe') as HTMLSelectElement | null;
    if (recSelect) {
      recSelect.innerHTML = `<option value="">None (Heuristics / Bank)</option>` +
        Object.values(RECIPES)
          .map(r => `<option value="${r.id}">${r.name} (${r.skill} Lv ${r.levelReq})</option>`)
          .join('');
    }

    const nodeForm = document.getElementById('editor-node-form') as HTMLFormElement | null;
    const btnAddNode = document.getElementById('btn-add-node');
    const btnCancelNode = document.getElementById('btn-cancel-node');
    const btnPickNode = document.getElementById('btn-pick-node-coord');

    if (btnAddNode && nodeForm) {
      btnAddNode.onclick = () => {
        nodeForm.classList.remove('hidden');
        (document.getElementById('node-form-id') as HTMLInputElement).value = '';
        (document.getElementById('node-form-name') as HTMLInputElement).value = '';
        (document.getElementById('node-form-x') as HTMLInputElement).value = '25';
        (document.getElementById('node-form-y') as HTMLInputElement).value = '25';
      };
    }
    if (btnCancelNode && nodeForm) {
      btnCancelNode.onclick = () => nodeForm.classList.add('hidden');
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
        const name = (document.getElementById('node-form-name') as HTMLInputElement).value.trim();
        const type = (document.getElementById('node-form-type') as HTMLSelectElement).value as any;
        const recipeId = (document.getElementById('node-form-recipe') as HTMLSelectElement).value || undefined;
        const x = parseInt((document.getElementById('node-form-x') as HTMLInputElement).value, 10);
        const y = parseInt((document.getElementById('node-form-y') as HTMLInputElement).value, 10);

        this.sendWs({
          type: 'ADMIN_SAVE_NODE',
          node: { id, name, type, recipeId, x, y },
        });
        nodeForm.classList.add('hidden');
      };
    }

    // 6. Monster Form Setup
    const mobForm = document.getElementById('editor-monster-form') as HTMLFormElement | null;
    const btnAddMob = document.getElementById('btn-add-monster');
    const btnCancelMob = document.getElementById('btn-cancel-monster');
    const btnPickMob = document.getElementById('btn-pick-monster-coord');

    if (btnAddMob && mobForm) {
      btnAddMob.onclick = () => {
        mobForm.classList.remove('hidden');
        (document.getElementById('monster-form-id') as HTMLInputElement).value = '';
        (document.getElementById('monster-form-name') as HTMLInputElement).value = '';
        (document.getElementById('monster-form-x') as HTMLInputElement).value = '4';
        (document.getElementById('monster-form-y') as HTMLInputElement).value = '44';
      };
    }
    if (btnCancelMob && mobForm) {
      btnCancelMob.onclick = () => mobForm.classList.add('hidden');
    }
    if (btnPickMob) {
      btnPickMob.onclick = () => {
        this.renderer.editorMode = 'place_node';
        this.showToast('Click anywhere on the map to set monster coordinates...');
      };
    }
    if (mobForm) {
      mobForm.onsubmit = (e) => {
        e.preventDefault();
        const id = (document.getElementById('monster-form-id') as HTMLInputElement).value || `mob_${Date.now()}`;
        const name = (document.getElementById('monster-form-name') as HTMLInputElement).value.trim();
        const monsterId = (document.getElementById('monster-form-mobid') as HTMLSelectElement).value;
        const x = parseInt((document.getElementById('monster-form-x') as HTMLInputElement).value, 10);
        const y = parseInt((document.getElementById('monster-form-y') as HTMLInputElement).value, 10);

        this.sendWs({
          type: 'ADMIN_SAVE_NODE',
          node: { id, name, type: 'monster', monsterId, x, y },
        });
        mobForm.classList.add('hidden');
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

        this.sendWs({
          type: 'ADMIN_SAVE_QUEST',
          quest: {
            id,
            title,
            description,
            npcId,
            objective: { type: objType, targetId, count },
            reward: { gold, xp },
          },
        });
        questForm.classList.add('hidden');
      };
    }
  }

  private switchEditorTab(tab: 'nodes' | 'monsters' | 'npcs' | 'quests' | 'collisions' | 'giveitems') {
    this.activeEditorTab = tab;
    const tabContents = ['nodes', 'monsters', 'npcs', 'quests', 'collisions', 'giveitems'];
    for (const t of tabContents) {
      const el = document.getElementById(`tab-content-${t}`);
      if (el) {
        if (t === tab) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
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

  private renderEditorNodes() {
    const container = document.getElementById('editor-nodes-list');
    if (!container) return;
    container.innerHTML = '';

    const nodes = this.worldNodes.filter(n => n.type !== 'monster');
    for (const n of nodes) {
      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${n.name}</div>
          <div class="editor-entity-meta">${n.type} · (${n.x}, ${n.y}) ${n.recipeId ? `· ${n.recipeId}` : ''}</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-edit" data-id="${n.id}">Edit</button>
          <button class="btn-micro-del" data-id="${n.id}">Del</button>
        </div>
      `;

      card.querySelector('.btn-micro-edit')!.addEventListener('click', () => {
        const form = document.getElementById('editor-node-form')!;
        form.classList.remove('hidden');
        (document.getElementById('node-form-id') as HTMLInputElement).value = n.id;
        (document.getElementById('node-form-name') as HTMLInputElement).value = n.name;
        (document.getElementById('node-form-type') as HTMLSelectElement).value = n.type;
        (document.getElementById('node-form-recipe') as HTMLSelectElement).value = n.recipeId || '';
        (document.getElementById('node-form-x') as HTMLInputElement).value = n.x.toString();
        (document.getElementById('node-form-y') as HTMLInputElement).value = n.y.toString();
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete node "${n.name}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_NODE', nodeId: n.id, id: n.id });
        }
      });

      container.appendChild(card);
    }
  }

  private renderEditorMonsters() {
    const container = document.getElementById('editor-monsters-list');
    if (!container) return;
    container.innerHTML = '';

    const monsters = this.worldNodes.filter(n => n.type === 'monster');
    for (const m of monsters) {
      const card = document.createElement('div');
      card.className = 'editor-entity-card';
      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${m.name}</div>
          <div class="editor-entity-meta">${m.monsterId || 'mire_rat'} · (${m.x}, ${m.y})</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-edit" data-id="${m.id}">Edit</button>
          <button class="btn-micro-del" data-id="${m.id}">Del</button>
        </div>
      `;

      card.querySelector('.btn-micro-edit')!.addEventListener('click', () => {
        const form = document.getElementById('editor-monster-form')!;
        form.classList.remove('hidden');
        (document.getElementById('monster-form-id') as HTMLInputElement).value = m.id;
        (document.getElementById('monster-form-name') as HTMLInputElement).value = m.name;
        (document.getElementById('monster-form-mobid') as HTMLSelectElement).value = m.monsterId || 'mire_rat';
        (document.getElementById('monster-form-x') as HTMLInputElement).value = m.x.toString();
        (document.getElementById('monster-form-y') as HTMLInputElement).value = m.y.toString();
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete monster spawn "${m.name}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_NODE', nodeId: m.id, id: m.id });
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
      card.innerHTML = `
        <div class="editor-entity-info">
          <div class="editor-entity-title">${npc.name}</div>
          <div class="editor-entity-meta">${npc.role} · (${npc.x}, ${npc.y}) · ${npc.dialogue?.length || 0} line(s) · ${questCount} quest(s)</div>
        </div>
        <div class="editor-entity-actions">
          <button class="btn-micro-edit" data-id="${npc.id}">Edit</button>
          <button class="btn-micro-del" data-id="${npc.id}">Del</button>
        </div>
      `;

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
          <div class="editor-entity-meta">${q.objective.type} ${q.objective.count}x ${q.objective.targetId} · Giver: ${q.npcId || 'None'}</div>
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
      });

      card.querySelector('.btn-micro-del')!.addEventListener('click', () => {
        if (confirm(`Delete Quest "${q.title}"?`)) {
          this.sendWs({ type: 'ADMIN_DELETE_QUEST', questId: q.id, id: q.id });
        }
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
        const card = document.createElement('div');
        card.className = 'npc-quest-card';
        card.innerHTML = `
          <div class="npc-quest-title">${q.title}</div>
          <div class="npc-quest-desc">${q.description}</div>
          <div class="npc-quest-rewards">
            Goal: ${q.objective.type} ${q.objective.count}x ${q.objective.targetId} • 
            Rewards: ${q.reward.gold || 0} Gold, ${xpVal} XP
          </div>
          <button class="btn-start" style="font-size:0.72rem; padding:3px 8px; margin-top:4px;">Accept Quest</button>
        `;
        const btnAccept = card.querySelector('button')!;
        btnAccept.onclick = () => {
          this.showToast(`Accepted quest "${q.title}"!`);
          modal.classList.add('hidden');
        };
        questListEl.appendChild(card);
      }
    }

    modal.classList.remove('hidden');
  }
}

new EldoriaClient();

