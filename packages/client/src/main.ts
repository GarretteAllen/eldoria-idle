import { PlayerData, RECIPES, ITEMS, getXpToNextLevel } from '@eldoria/shared';
import { WorldRenderer, WorldNodeDisplay } from './canvas.js';

class EldoriaClient {
  private ws: WebSocket | null = null;
  private player: PlayerData | null = null;
  private renderer: WorldRenderer;
  private activeChannel = 'All';

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new WorldRenderer(canvas);

    this.setupTabs();
    this.setupChat();
    this.setupTaskControls();
    this.fetchNodesAndInit();
  }

  private async fetchNodesAndInit() {
    try {
      const res = await fetch('/api/world/nodes');
      const data = await res.json();
      this.renderer.setNodes(data.nodes);

      this.renderer.onGroundClick = (tileX, tileY) => {
        this.sendWs({ type: 'MOVE', x: tileX, y: tileY });
      };

      this.renderer.onNodeClick = (node: WorldNodeDisplay) => {
        this.sendWs({ type: 'MOVE', x: node.x, y: node.y });
        if (node.recipeId) {
          this.sendWs({
            type: 'START_TASK',
            recipeId: node.recipeId,
            targetX: node.x,
            targetY: node.y,
          });
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
        this.showNotification(`🎉 Level Up! You achieved level ${msg.newLevel} in ${msg.skill.replace('_', ' ')}!`);
        break;

      case 'NOTIFICATION':
        this.showNotification(msg.message);
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

    // Player chip
    document.getElementById('player-display-name')!.textContent = this.player.username;
    const maxHp = (this.player.skills.vitality?.level || 10);
    document.getElementById('hp-text')!.textContent = `${this.player.currentHp} / ${maxHp} HP`;
    const hpPct = Math.min(100, Math.floor((this.player.currentHp / maxHp) * 100));
    document.getElementById('hp-bar-fill')!.style.width = `${hpPct}%`;

    // Active Task Bar
    const taskNameEl = document.getElementById('task-name')!;
    const taskSubEl = document.getElementById('task-subtext')!;
    const progressFillEl = document.getElementById('task-progress-fill')!;
    const taskIconEl = document.getElementById('task-icon')!;

    if (this.player.currentTask) {
      const rec = RECIPES[this.player.currentTask.recipeId];
      taskNameEl.textContent = rec ? rec.name : this.player.currentTask.skill;
      taskSubEl.textContent = `Completed: ${this.player.currentTask.completedQuantity} • Auto-deposits to Hearth`;
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
        slotEl.title = `${name} (${slot.rarity || 'plain'})\nVendor Floor: ${def?.vendorFloorPrice || 0} Gold`;
      }
      grid.appendChild(slotEl);
    }
  }

  private renderEquipmentTab() {
    if (!this.player) return;
    const container = document.getElementById('equipment-slots')!;
    container.innerHTML = '';

    const slots = ['weapon', 'shield', 'helmet', 'body', 'legs', 'ring', 'amulet', 'steed', 'tool'];
    for (const slotKey of slots) {
      const itemSlot = this.player.equipment[slotKey as keyof typeof this.player.equipment];
      const div = document.createElement('div');
      div.className = 'item-slot';
      div.style.aspectRatio = 'auto';
      div.style.padding = '8px';
      div.style.marginBottom = '6px';

      const def = itemSlot ? ITEMS[itemSlot.itemId] : null;
      div.innerHTML = `
        <div style="font-weight:600; text-transform:capitalize;">${slotKey}:</div>
        <div style="color:var(--accent-gold);">${def ? def.name : '— Empty —'}</div>
      `;
      container.appendChild(div);
    }
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

  private showNotification(msg: string) {
    console.log(msg);
  }
}

new EldoriaClient();
