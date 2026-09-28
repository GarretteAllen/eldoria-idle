import { PlayerData, RECIPES, ITEMS, EquipSlot, SkillType, getXpToNextLevel } from '@eldoria/shared';
import { WorldRenderer, WorldNodeDisplay } from './canvas.js';
import { loadLdtkWorld } from './ldtkLoader.js';
import { ICONS } from './icons.js';

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

  // Deep Vein UI State
  private activeDrawer: 'skills' | 'inventory' | 'equipment' | 'storage' = 'skills';
  private selectedSkillKey: SkillType = 'mining';
  private selectedRecipeId: string = 'mine_pyrite';
  private selectedJobQuantity: number = Infinity;
  private isPopupOpen: boolean = false;
  private chatCollapsed: boolean = false;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new WorldRenderer(canvas);

    this.initStaticIcons();
    this.setupRightToolbar();
    this.setupTasksCard();
    this.setupChat();
    this.setupSkillJobPopup();
    this.setupModals();
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

    // Drawer Buttons
    document.getElementById('btn-fight-icon')!.innerHTML = ICONS.melee;
    document.getElementById('btn-home-icon')!.innerHTML = ICONS.hearth;

    // Popup Close
    document.getElementById('popup-close-btn')!.innerHTML = ICONS.close;
    document.getElementById('item-action-close-btn')!.innerHTML = ICONS.close;
    document.getElementById('away-close-btn')!.innerHTML = ICONS.close;
  }

  private async fetchNodesAndInit() {
    try {
      const world = await loadLdtkWorld();
      if (world) {
        this.renderer.setStitchedWorld(world);
      }

      const res = await fetch('/api/world/nodes');
      const data = await res.json();
      this.worldNodes = data.nodes || [];
      this.renderer.setNodes(this.worldNodes);

      this.renderer.onGroundClick = (tileX, tileY) => {
        this.sendWs({ type: 'MOVE_TO', x: tileX, y: tileY });
      };

      this.renderer.onNodeClick = (node: WorldNodeDisplay) => {
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
          this.switchDrawer('storage');
        } else {
          this.sendWs({ type: 'MOVE_TO', x: node.x, y: node.y });
        }
      };

      await this.initAuth();
    } catch (err) {
      console.error('Failed to init client', err);
    }
  }

  private async initAuth() {
    let guestId = localStorage.getItem('eldoria_guest_id');
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId }),
    });
    const data = await res.json();
    this.player = data.player;
    localStorage.setItem('eldoria_guest_id', this.player!.id);

    this.connectWs();
  }

  private connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?playerId=${this.player!.id}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('⚔️ Connected to Eldoria Idle server');
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
      setTimeout(() => this.connectWs(), 3000);
    };
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'INIT':
        this.player = msg.player;
        this.renderer.setLocalPlayer(this.player!);
        this.updateUI();

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
        break;

      case 'WORLD_STATE':
        this.renderer.updateOtherPlayers(msg.players);
        if (msg.onlineCount !== undefined) {
          this.updateOnlineCount(msg.onlineCount);
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

    // 3. Render Active Drawer
    if (this.activeDrawer === 'skills') this.renderSkillsDrawer();
    else if (this.activeDrawer === 'inventory') this.renderInventoryDrawer();
    else if (this.activeDrawer === 'equipment') this.renderEquipmentDrawer();
    else if (this.activeDrawer === 'storage') this.renderStorageDrawer();

    // If popup is open, update its display
    if (this.isPopupOpen) {
      this.updateSkillJobPopup();
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
    } else {
      taskNameEl.textContent = 'Idle — Choose a trade';
      taskSubEl.textContent = 'Select a trade from the skills menu or click the map';
      progressFillEl.style.width = '0%';
      taskIconEl.innerHTML = ICONS.skills;
      statusTagEl.textContent = 'IDLE';
      statusTagEl.className = 'status-tag idle';
    }
  }

  private setupTasksCard() {
    document.getElementById('task-stop-btn')!.onclick = () => {
      this.sendWs({ type: 'STOP_TASK' });
    };

    document.getElementById('task-home-btn')!.onclick = () => {
      this.sendWs({ type: 'STOP_TASK' });
      this.sendWs({ type: 'MOVE_TO', x: 8, y: 22 });
      this.switchDrawer('storage');
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

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (panel === 'skills' || panel === 'inventory' || panel === 'equipment' || panel === 'storage') {
          this.switchDrawer(panel);
        }
      });
    });

    document.getElementById('btn-quick-fight')!.onclick = () => {
      this.sendWs({ type: 'MOVE_TO', x: 4, y: 44 });
    };

    document.getElementById('btn-quick-home')!.onclick = () => {
      this.sendWs({ type: 'MOVE_TO', x: 8, y: 22 });
      this.switchDrawer('storage');
    };
  }

  private switchDrawer(drawer: 'skills' | 'inventory' | 'equipment' | 'storage') {
    this.activeDrawer = drawer;

    const drawers = ['skills', 'inventory', 'equipment', 'storage'];
    for (const d of drawers) {
      const el = document.getElementById(`${d}-drawer`);
      if (el) {
        if (d === drawer) el.classList.remove('hidden');
        else el.classList.add('hidden');
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

      itemEl.innerHTML = `
        <div class="job-item-header">
          <div class="job-name-wrap">
            <span>${recipe.name}</span>
          </div>
          <span class="job-rate">${rateText}</span>
        </div>
        <div class="job-details">${detailsText}</div>
        ${canMakeText}
      `;

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

    const isNearHearth = Math.hypot(this.player.x - 8, this.player.y - 22) <= 1.5;
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
        slotEl.addEventListener('click', () => {
          this.openItemActionModal(i);
        });
      }
      grid.appendChild(slotEl);
    }
  }

  private renderEquipmentDrawer() {
    if (!this.player) return;
    const container = document.getElementById('equipment-slots')!;
    container.innerHTML = '';

    const slots: EquipSlot[] = ['weapon', 'shield', 'helmet', 'body', 'legs', 'ring', 'amulet', 'steed', 'tool'];
    for (const slotKey of slots) {
      const itemSlot = this.player.equipment[slotKey];
      const div = document.createElement('div');
      div.className = 'rpg-slot';
      div.style.aspectRatio = 'auto';
      div.style.padding = '6px 8px';
      div.style.flexDirection = 'row';
      div.style.justifyContent = 'space-between';

      const label = slotKey.toUpperCase();
      if (itemSlot) {
        const def = ITEMS[itemSlot.itemId];
        div.innerHTML = `
          <div style="font-weight:700; font-size:0.75rem; color:var(--gold-main);">${label}</div>
          <div style="font-size:0.75rem; color:var(--text-main);">${def ? def.name : itemSlot.itemId}</div>
        `;
        div.onclick = () => {
          this.sendWs({ type: 'UNEQUIP_ITEM', slot: slotKey });
        };
      } else {
        div.innerHTML = `
          <div style="font-weight:600; font-size:0.75rem; color:var(--text-dim);">${label}</div>
          <div style="font-size:0.7rem; color:var(--text-dim);">(empty)</div>
        `;
      }
      container.appendChild(div);
    }
  }

  private renderStorageDrawer() {
    if (!this.player) return;
    const grid = document.getElementById('storage-grid')!;
    grid.innerHTML = '';
    document.getElementById('storage-count')!.textContent = this.player.storage.length.toString();

    const isNearHearth = Math.hypot(this.player.x - 8, this.player.y - 22) <= 1.5;
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
          this.sendWs({ type: 'MOVE_TO', x: 8, y: 22 });
        } else {
          this.sendWs({ type: 'WITHDRAW_ITEM', storageIndex: index });
        }
      };
      grid.appendChild(div);
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

    line.innerHTML = `
      <span class="chat-time">${timeStr}</span>
      <span class="chat-sender">${sender}:</span>
      <span>${msg.text}</span>
    `;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  private setupModals() {
    document.getElementById('item-action-close-btn')!.onclick = () => {
      document.getElementById('item-action-modal')!.classList.add('hidden');
    };

    document.getElementById('btn-action-equip')!.onclick = () => {
      if (this.selectedInventoryIndex !== null) {
        this.sendWs({ type: 'EQUIP_ITEM', inventoryIndex: this.selectedInventoryIndex });
        document.getElementById('item-action-modal')!.classList.add('hidden');
      }
    };

    document.getElementById('btn-action-eat')!.onclick = () => {
      if (this.selectedInventoryIndex !== null) {
        this.sendWs({ type: 'EAT_FOOD', inventoryIndex: this.selectedInventoryIndex });
        document.getElementById('item-action-modal')!.classList.add('hidden');
      }
    };

    document.getElementById('btn-action-deposit')!.onclick = () => {
      if (this.selectedInventoryIndex !== null) {
        this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
        document.getElementById('item-action-modal')!.classList.add('hidden');
      }
    };

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
      this.switchDrawer('storage');
    };
  }

  private openItemActionModal(index: number) {
    this.selectedInventoryIndex = index;
    const slot = this.player?.inventory[index];
    if (!slot) return;

    const def = ITEMS[slot.itemId];
    if (!def) return;

    const modal = document.getElementById('item-action-modal')!;
    document.getElementById('action-item-name')!.textContent = def.name;

    const equipBtn = document.getElementById('btn-action-equip')!;
    equipBtn.style.display = def.slot ? 'block' : 'none';

    const eatBtn = document.getElementById('btn-action-eat')!;
    eatBtn.style.display = def.category === 'cooked_food' ? 'block' : 'none';

    const isNearHearth = this.player && Math.hypot(this.player.x - 8, this.player.y - 22) <= 1.5;
    const depositBtn = document.getElementById('btn-action-deposit');
    if (depositBtn) {
      depositBtn.textContent = isNearHearth ? 'Deposit to Hearth' : 'Travel & Deposit to Hearth';
    }

    modal.classList.remove('hidden');
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
}

new EldoriaClient();
