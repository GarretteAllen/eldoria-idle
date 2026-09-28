import { PlayerData, RECIPES, ITEMS, EquipSlot, getXpToNextLevel } from '@eldoria/shared';
import { WorldRenderer, WorldNodeDisplay } from './canvas.js';

class EldoriaClient {
  private ws: WebSocket | null = null;
  private player: PlayerData | null = null;
  private renderer: WorldRenderer;
  private activeChannel = 'All';
  private selectedInventoryIndex: number | null = null;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new WorldRenderer(canvas);

    this.setupTabs();
    this.setupChat();
    this.setupTaskControls();
    this.setupModals();
    this.fetchNodesAndInit();
  }

  private async fetchNodesAndInit() {
    try {
      const res = await fetch('/api/world/nodes');
      const data = await res.json();
      this.renderer.setNodes(data.nodes);

      this.renderer.onGroundClick = (tileX, tileY) => {
        this.sendWs({ type: 'MOVE_TO', x: tileX, y: tileY });
      };

      this.renderer.onNodeClick = (node: WorldNodeDisplay) => {
        if (node.recipeId) {
          this.sendWs({
            type: 'START_TASK',
            recipeId: node.recipeId,
            targetX: node.x,
            targetY: node.y,
          });
        } else if (node.type === 'hearth_counter') {
          this.sendWs({ type: 'MOVE_TO', x: node.x, y: node.y });
          this.openHearthModal();
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
      console.log('Connected to Eldoria Idle server');
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
          document.getElementById('online-count')!.textContent = msg.onlineCount;
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
          document.getElementById('online-count')!.textContent = msg.onlineCount;
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

      case 'LEVEL_UP':
        this.showToast(`🎉 Level Up! You achieved level ${msg.newLevel} in ${msg.skill.replace('_', ' ')}!`);
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

  private updateUI() {
    if (!this.player) return;

    // Currencies
    document.getElementById('val-gold')!.textContent = this.player.gold.toLocaleString();
    document.getElementById('val-gems')!.textContent = this.player.gems.toLocaleString();
    document.getElementById('val-anima')!.textContent = this.player.anima.toLocaleString();

    // Player status chip
    document.getElementById('player-display-name')!.textContent = this.player.username;
    const maxHp = (this.player.skills.vitality?.level || 10);
    document.getElementById('hp-text')!.textContent = `${this.player.currentHp} / ${maxHp} HP`;
    const hpPct = Math.min(100, Math.floor((this.player.currentHp / maxHp) * 100));
    document.getElementById('hp-bar-fill')!.style.width = `${hpPct}%`;

    // Speed stat
    const speed = this.player.moveSpeedTilesPerTick || 1.0;
    const bonusPct = Math.round((speed - 1.0) * 100);
    document.getElementById('speed-chip')!.textContent = `⚡ ${speed.toFixed(2)} tiles/tick ${bonusPct > 0 ? '(+' + bonusPct + '%)' : ''}`;

    // Active Task Bar
    const taskNameEl = document.getElementById('task-name')!;
    const taskSubEl = document.getElementById('task-subtext')!;
    const progressFillEl = document.getElementById('task-progress-fill')!;
    const taskIconEl = document.getElementById('task-icon')!;

    if (this.player.bankingState === 'walking_to_bank') {
      taskNameEl.textContent = 'Banking — Riding to Hearth';
      taskSubEl.textContent = `Satchel full (28/28) • Depositing spoils...`;
      progressFillEl.style.width = '100%';
      taskIconEl.textContent = '🐴';
    } else if (this.player.bankingState === 'returning_to_work') {
      taskNameEl.textContent = 'Returning to Work';
      taskSubEl.textContent = `Riding back to node at ${this.player.moveSpeedTilesPerTick || 1.0} tiles/tick...`;
      progressFillEl.style.width = '100%';
      taskIconEl.textContent = '🐴';
    } else if (this.player.isMoving && this.player.path && this.player.path.length > 0) {
      taskNameEl.textContent = 'Traveling on Road';
      taskSubEl.textContent = `${this.player.path.length} tiles remaining (${(this.player.moveSpeedTilesPerTick || 1.0)} tiles/tick)`;
      progressFillEl.style.width = '100%';
      taskIconEl.textContent = '🐴';
    } else if (this.player.currentTask) {
      const rec = RECIPES[this.player.currentTask.recipeId];
      taskNameEl.textContent = rec ? rec.name : this.player.currentTask.skill;
      taskSubEl.textContent = `Completed: ${this.player.currentTask.completedQuantity} • Walks to Hearth when full`;
      progressFillEl.style.width = '100%';

      let icon = '⛏️';
      if (this.player.currentTask.skill === 'timbercraft') icon = '🪓';
      else if (this.player.currentTask.skill === 'tidecalling') icon = '🎣';
      else if (this.player.currentTask.skill === 'rune_forging') icon = '🔨';
      else if (this.player.currentTask.skill === 'hearthcraft') icon = '🍲';
      taskIconEl.textContent = icon;
    } else {
      taskNameEl.textContent = 'Idle — Choose a trade';
      taskSubEl.textContent = 'Click an ore, tree, or shoreline on the map';
      progressFillEl.style.width = '0%';
      taskIconEl.textContent = '💤';
    }

    // Render Tabs
    this.renderSkillsTab();
    this.renderInventoryTab();
    this.renderEquipmentTab();
  }

  private renderSkillsTab() {
    if (!this.player) return;
    const container = document.getElementById('skills-list')!;
    container.innerHTML = '';

    const skillEntries = Object.entries(this.player.skills);
    for (const [skillKey, record] of skillEntries) {
      const { percent, current, needed } = getXpToNextLevel(record.level, record.xp);

      const card = document.createElement('div');
      card.className = 'skill-card';
      card.title = `Progress: ${current.toLocaleString()} / ${needed.toLocaleString()} XP to next level`;
      const cleanName = skillKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

      card.innerHTML = `
        <div class="skill-header">
          <span>${cleanName}</span>
          <span class="skill-level-badge">Lv ${record.level}</span>
        </div>
        <div class="skill-bar">
          <div class="skill-fill" style="width: ${percent}%;"></div>
        </div>
      `;
      container.appendChild(card);
    }
  }

  private renderInventoryTab() {
    if (!this.player) return;
    const grid = document.getElementById('inventory-grid')!;
    grid.innerHTML = '';

    document.getElementById('inv-count')!.textContent = this.player.inventory.length.toString();

    for (let i = 0; i < 28; i++) {
      const slot = this.player.inventory[i];
      const slotEl = document.createElement('div');
      slotEl.className = 'item-slot';

      if (slot) {
        const def = ITEMS[slot.itemId];
        const name = def ? def.name : slot.itemId;
        if (slot.rarity && slot.rarity !== 'plain') {
          slotEl.classList.add(`rarity-${slot.rarity}`);
        }
        slotEl.innerHTML = `
          <div>${name}</div>
          <span class="qty">${slot.quantity > 1 ? slot.quantity : ''}</span>
        `;
        slotEl.title = `${name} (${slot.rarity || 'plain'})\nClick for actions`;
        slotEl.addEventListener('click', () => {
          this.openItemActionModal(i);
        });
      }
      grid.appendChild(slotEl);
    }
  }

  private renderEquipmentTab() {
    if (!this.player) return;
    const container = document.getElementById('equipment-slots')!;
    container.innerHTML = '';

    const slots: EquipSlot[] = ['weapon', 'shield', 'helmet', 'body', 'legs', 'ring', 'amulet', 'steed', 'tool'];
    for (const slotKey of slots) {
      const itemSlot = this.player.equipment[slotKey];
      const div = document.createElement('div');
      div.className = 'item-slot';
      div.style.aspectRatio = 'auto';
      div.style.padding = '8px';
      div.style.marginBottom = '6px';
      div.style.cursor = itemSlot ? 'pointer' : 'default';

      const def = itemSlot ? ITEMS[itemSlot.itemId] : null;
      div.innerHTML = `
        <div style="font-weight:600; text-transform:capitalize;">${slotKey}:</div>
        <div style="color:var(--accent-gold);">${def ? def.name + ' (Click to unequip)' : '— Empty —'}</div>
      `;

      if (itemSlot) {
        div.addEventListener('click', () => {
          this.sendWs({ type: 'UNEQUIP_ITEM', slot: slotKey });
        });
      }

      container.appendChild(div);
    }
  }

  private openItemActionModal(index: number) {
    if (!this.player) return;
    const slot = this.player.inventory[index];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def) return;

    this.selectedInventoryIndex = index;
    const modal = document.getElementById('item-action-modal')!;
    document.getElementById('action-item-name')!.textContent = `${def.name} (${slot.rarity || 'plain'})`;

    const equipBtn = document.getElementById('btn-action-equip')!;
    equipBtn.style.display = def.slot ? 'block' : 'none';

    const eatBtn = document.getElementById('btn-action-eat')!;
    eatBtn.style.display = def.category === 'cooked_food' ? 'block' : 'none';

    modal.classList.remove('hidden');
  }

  private openHearthModal() {
    if (!this.player) return;
    const modal = document.getElementById('hearth-modal')!;
    document.getElementById('storage-count')!.textContent = this.player.storage.length.toString();

    const grid = document.getElementById('storage-grid')!;
    grid.innerHTML = '';

    for (const slot of this.player.storage) {
      const def = ITEMS[slot.itemId];
      const div = document.createElement('div');
      div.className = 'item-slot';
      if (slot.rarity && slot.rarity !== 'plain') {
        div.classList.add(`rarity-${slot.rarity}`);
      }
      div.innerHTML = `
        <div>${def ? def.name : slot.itemId}</div>
        <span class="qty">${slot.quantity}</span>
      `;
      grid.appendChild(div);
    }

    modal.classList.remove('hidden');
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

    document.getElementById('btn-open-hearth')!.onclick = () => {
      this.openHearthModal();
    };

    document.getElementById('hearth-close-btn')!.onclick = () => {
      document.getElementById('hearth-modal')!.classList.add('hidden');
    };

    document.getElementById('btn-deposit-all')!.onclick = () => {
      this.sendWs({ type: 'DEPOSIT_ALL_RESOURCES' });
      setTimeout(() => this.openHearthModal(), 200);
    };
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

  private setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tabTarget = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tabTarget}`)?.classList.add('active');
      });
    });
  }

  private setupChat() {
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

  private appendChatMessage(msg: any) {
    const log = document.getElementById('chat-messages')!;
    const line = document.createElement('div');
    line.className = 'chat-line';

    const sender = msg.senderName || 'Wanderer';
    line.innerHTML = `
      <span style="color:#718096;">[${msg.channel || 'All'}]</span>
      <span class="chat-sender">${sender}:</span>
      <span>${msg.text}</span>
    `;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  private setupTaskControls() {
    document.getElementById('task-stop-btn')!.addEventListener('click', () => {
      this.sendWs({ type: 'STOP_TASK' });
    });
  }

  private showCatchUpModal(summary: any) {
    const modal = document.getElementById('away-modal')!;
    const body = document.getElementById('away-body')!;

    const minutes = Math.floor(summary.elapsedSeconds / 60);
    body.innerHTML = `
      <p>You rested for <b>${minutes} minutes</b>.</p>
      <div style="margin: 12px 0; background: #0e1014; padding: 10px; border-radius: 6px;">
        <div><b>Actions Finished:</b> ${summary.completedCycles}</div>
        <div><b>XP Earned:</b> +${summary.xpGained.toLocaleString()}</div>
        ${summary.leveledUp ? '<div style="color:var(--accent-gold); font-weight:700;">⭐ You gained new levels!</div>' : ''}
        ${summary.overflowOccurred ? '<div style="color:var(--accent-red);">⚠️ Satchel filled! Remaining spoils were safely deposited at the Hearth Altar.</div>' : ''}
      </div>
    `;

    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');
    document.getElementById('away-close-btn')!.onclick = close;
    document.getElementById('away-ok-btn')!.onclick = close;
  }

  private showToast(msg: string) {
    // Append to chat as server announcement
    this.appendChatMessage({
      channel: 'System',
      senderName: 'Eldoria',
      text: msg,
    });
  }
}

new EldoriaClient();
