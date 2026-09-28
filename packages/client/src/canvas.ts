import { PlayerData } from '@eldoria/shared';

export interface RemotePlayer {
  id: string;
  name: string;
  title?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  currentTask: string | null;
  bankingState?: string;
}

export interface ChatBubble {
  senderId: string;
  text: string;
  expiresAt: number;
}

export interface WorldNodeDisplay {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  recipeId?: string;
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

const TILE_SIZE = 32;

export class WorldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private localPlayer: PlayerData | null = null;
  private otherPlayers = new Map<string, RemotePlayer>();
  private chatBubbles: ChatBubble[] = [];
  private nodes: WorldNodeDisplay[] = [];

  // Smooth visual positions (sub-tile interpolation)
  private visualX = 25;
  private visualY = 25;
  private cameraX = 0;
  private cameraY = 0;
  private animTick = 0;

  // Visual effects
  private destinationMarker: { x: number; y: number; time: number } | null = null;
  private dustParticles: DustParticle[] = [];

  public onNodeClick?: (node: WorldNodeDisplay) => void;
  public onGroundClick?: (tileX: number, tileY: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupInput();

    requestAnimationFrame((ts) => this.render(ts));
  }

  public setNodes(nodes: WorldNodeDisplay[]) {
    this.nodes = nodes;
  }

  public setLocalPlayer(player: PlayerData) {
    this.localPlayer = player;
  }

  public setDestinationMarker(tileX: number, tileY: number) {
    this.destinationMarker = { x: tileX, y: tileY, time: Date.now() };
  }

  public updateOtherPlayers(players: RemotePlayer[]) {
    this.otherPlayers.clear();
    for (const p of players) {
      if (this.localPlayer && p.id !== this.localPlayer.id) {
        this.otherPlayers.set(p.id, p);
      }
    }
  }

  public addChatBubble(senderId: string, text: string) {
    this.chatBubbles.push({
      senderId,
      text,
      expiresAt: Date.now() + 5000,
    });
  }

  private resize() {
    this.canvas.width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    this.canvas.height = this.canvas.parentElement?.clientHeight || window.innerHeight;
  }

  private setupInput() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      const worldX = (clickScreenX + this.cameraX) / TILE_SIZE;
      const worldY = (clickScreenY + this.cameraY) / TILE_SIZE;
      const tileX = Math.floor(worldX);
      const tileY = Math.floor(worldY);

      this.setDestinationMarker(tileX, tileY);

      // Check if clicked a node within 1.2 tiles
      const clickedNode = this.nodes.find(n => Math.hypot(n.x - tileX, n.y - tileY) <= 1.2);
      if (clickedNode && this.onNodeClick) {
        this.onNodeClick(clickedNode);
      } else if (this.onGroundClick) {
        this.onGroundClick(tileX, tileY);
      }
    });
  }

  private render(timestamp: number) {
    this.animTick = timestamp;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.localPlayer) {
      // 60 FPS Sub-tile linear interpolation for smooth movement
      const targetX = this.localPlayer.x;
      const targetY = this.localPlayer.y;
      const dx = targetX - this.visualX;
      const dy = targetY - this.visualY;

      this.visualX += dx * 0.25;
      this.visualY += dy * 0.25;

      // Spawn dust puff when moving fast
      if (Math.hypot(dx, dy) > 0.05 && Math.random() < 0.3) {
        this.dustParticles.push({
          x: this.visualX * TILE_SIZE + TILE_SIZE / 2,
          y: this.visualY * TILE_SIZE + TILE_SIZE / 2 + 10,
          size: 3 + Math.random() * 4,
          alpha: 0.6,
        });
      }

      // Camera smoothly tracks interpolated position
      const targetCamX = this.visualX * TILE_SIZE - canvas.width / 2;
      const targetCamY = this.visualY * TILE_SIZE - canvas.height / 2;
      this.cameraX += (targetCamX - this.cameraX) * 0.15;
      this.cameraY += (targetCamY - this.cameraY) * 0.15;
    }

    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    // 1. Draw World Terrain
    this.drawTerrain();

    // 2. Draw Planned Path Trail
    this.drawPathTrail();

    // 3. Draw Destination Reticle
    this.drawDestinationMarker();

    // 4. Draw Interactive Nodes
    this.drawNodes();

    // 5. Draw Dust Particles
    this.drawDustParticles();

    // 6. Draw Other Players
    for (const remote of this.otherPlayers.values()) {
      this.drawPlayer(
        remote.x,
        remote.y,
        remote.name,
        remote.title,
        false,
        remote.isMoving || false,
        remote.currentTask,
        remote.bankingState
      );
    }

    // 7. Draw Local Player (Interpolated)
    if (this.localPlayer) {
      const isMoving = this.localPlayer.isMoving || (this.localPlayer.path && this.localPlayer.path.length > 0) || Math.hypot(this.localPlayer.x - this.visualX, this.localPlayer.y - this.visualY) > 0.1;
      this.drawPlayer(
        this.visualX,
        this.visualY,
        this.localPlayer.username,
        this.localPlayer.activeTitle,
        true,
        isMoving,
        this.localPlayer.currentTask ? this.localPlayer.currentTask.skill : null,
        this.localPlayer.bankingState,
        this.localPlayer.moveSpeedTilesPerTick
      );
    }

    // 8. Draw Overhead Chat Bubbles
    this.drawChatBubbles();

    ctx.restore();
    requestAnimationFrame((ts) => this.render(ts));
  }

  private drawTerrain() {
    const { ctx } = this;
    const startTileX = Math.max(0, Math.floor(this.cameraX / TILE_SIZE));
    const endTileX = Math.min(60, Math.ceil((this.cameraX + this.canvas.width) / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(this.cameraY / TILE_SIZE));
    const endTileY = Math.min(60, Math.ceil((this.cameraY + this.canvas.height) / TILE_SIZE));

    for (let x = startTileX; x <= endTileX; x++) {
      for (let y = startTileY; y <= endTileY; y++) {
        // Town Square Cobblestone
        if (x >= 20 && x <= 30 && y >= 20 && y <= 30) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#2c3038' : '#323740';
        }
        // Quarry (West)
        else if (x <= 18 && y <= 20) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#38322c' : '#403932';
        }
        // Timberland (North-East)
        else if (x >= 32 && y <= 22) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1e3020' : '#223825';
        }
        // Shore / Water (East)
        else if (x >= 46 && y >= 30) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1a2a40' : '#1e324d';
        }
        // Default Plain
        else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1b211c' : '#202621';
        }

        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawPathTrail() {
    if (!this.localPlayer || !this.localPlayer.path || this.localPlayer.path.length === 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(229, 179, 56, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.visualX * TILE_SIZE + TILE_SIZE / 2, this.visualY * TILE_SIZE + TILE_SIZE / 2);

    for (const step of this.localPlayer.path) {
      ctx.lineTo(step.x * TILE_SIZE + TILE_SIZE / 2, step.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawDestinationMarker() {
    if (!this.destinationMarker) return;
    const { ctx } = this;
    const age = Date.now() - this.destinationMarker.time;
    if (age > 2000) {
      this.destinationMarker = null;
      return;
    }

    const px = this.destinationMarker.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.destinationMarker.y * TILE_SIZE + TILE_SIZE / 2;
    const pulse = 6 + Math.sin(age * 0.01) * 3;
    const alpha = Math.max(0, 1 - age / 2000);

    ctx.save();
    ctx.strokeStyle = `rgba(229, 179, 56, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(229, 179, 56, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawNodes() {
    const { ctx } = this;
    for (const node of this.nodes) {
      const px = node.x * TILE_SIZE;
      const py = node.y * TILE_SIZE;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '18px sans-serif';

      let icon = '📍';
      if (node.type === 'hearth_counter') icon = '🏦';
      else if (node.type === 'forge') icon = '🔨';
      else if (node.type === 'fire') icon = '🔥';
      else if (node.type === 'mine') icon = '💎';
      else if (node.type === 'tree') icon = '🌲';
      else if (node.type === 'water') icon = '🐟';
      else if (node.type === 'monster') icon = '🐺';
      else if (node.type === 'boss_arena') icon = '🐉';

      ctx.fillText(icon, px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 6);

      ctx.font = '10px system-ui';
      ctx.fillStyle = '#f0e6d2';
      ctx.fillText(node.name, px + TILE_SIZE / 2, py - 4);
      ctx.restore();
    }
  }

  private drawDustParticles() {
    const { ctx } = this;
    ctx.save();
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.alpha -= 0.03;
      p.size += 0.2;
      p.y -= 0.3;

      if (p.alpha <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(160, 140, 110, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(
    x: number,
    y: number,
    name: string,
    title?: string,
    isSelf: boolean = false,
    isMoving: boolean = false,
    taskSkill: string | null = null,
    bankingState?: string,
    moveSpeed?: number
  ) {
    const { ctx } = this;
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(px, py + 12, isMoving ? 14 : 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isMoving) {
      // === MOUNTED STATE (Galloping on Steed) ===
      const gallopBob = Math.sin(this.animTick * 0.02) * 2;

      // Horse Body
      ctx.fillStyle = '#8b5a2b'; // Chestnut mount
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 2 + gallopBob, 20, 12, 4);
      ctx.fill();
      ctx.strokeStyle = '#5c3a1e';
      ctx.stroke();

      // Horse Head / Neck
      ctx.fillStyle = '#7a4e25';
      ctx.beginPath();
      ctx.ellipse(px + 8, py - 4 + gallopBob, 6, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Rider on Mount
      ctx.fillStyle = isSelf ? '#e5b338' : '#4299e1';
      ctx.beginPath();
      ctx.arc(px, py - 9 + gallopBob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Speed Tag
      if (moveSpeed) {
        ctx.font = '8px system-ui';
        ctx.fillStyle = '#48bb78';
        ctx.textAlign = 'center';
        ctx.fillText(`⚡ ${moveSpeed} t/tick`, px, py + 22);
      }
    } else {
      // === ON FOOT (Standing or Working) ===
      ctx.fillStyle = isSelf ? '#e5b338' : '#4299e1';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Working Tool Animation
      if (taskSkill) {
        const bob = Math.sin(this.animTick * 0.008) * 4;
        ctx.font = '12px sans-serif';
        ctx.fillText('⛏️', px + 10, py - 8 + bob);
      }
    }

    // Overhead Banking Status Badge
    if (bankingState === 'walking_to_bank') {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#f6ad55';
      ctx.textAlign = 'center';
      ctx.fillText('🏦 Riding to Hearth...', px, py - 34);
    } else if (bankingState === 'returning_to_work') {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#68d391';
      ctx.textAlign = 'center';
      ctx.fillText('⛏️ Returning to Work...', px, py - 34);
    }

    // Name & Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = isSelf ? '#ffd700' : '#e2e8f0';
    ctx.fillText(name, px, py - 14);

    if (title) {
      ctx.font = 'italic 9px system-ui';
      ctx.fillStyle = '#a0aec0';
      ctx.fillText(`"${title}"`, px, py - 24);
    }

    ctx.restore();
  }

  private drawChatBubbles() {
    const { ctx } = this;
    const now = Date.now();
    this.chatBubbles = this.chatBubbles.filter(b => b.expiresAt > now);

    for (const bubble of this.chatBubbles) {
      let targetX = 0;
      let targetY = 0;

      if (this.localPlayer && bubble.senderId === this.localPlayer.id) {
        targetX = this.visualX * TILE_SIZE + TILE_SIZE / 2;
        targetY = this.visualY * TILE_SIZE - 32;
      } else {
        const remote = this.otherPlayers.get(bubble.senderId);
        if (remote) {
          targetX = remote.x * TILE_SIZE + TILE_SIZE / 2;
          targetY = remote.y * TILE_SIZE - 32;
        } else {
          continue;
        }
      }

      ctx.save();
      ctx.font = '11px system-ui';
      const textWidth = ctx.measureText(bubble.text).width;
      const pad = 6;

      ctx.fillStyle = 'rgba(20, 24, 30, 0.9)';
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(targetX - textWidth / 2 - pad, targetY - 14, textWidth + pad * 2, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(bubble.text, targetX, targetY);
      ctx.restore();
    }
  }
}
