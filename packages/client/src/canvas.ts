import { PlayerData, NpcDefinition, WorldNode } from '@eldoria/shared';
import { StitchedWorld } from './ldtkLoader.js';

export interface RemotePlayer {
  id: string;
  name: string;
  title?: string;
  role?: string;
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

export type WorldNodeDisplay = WorldNode;

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
  private npcs: NpcDefinition[] = [];
  private collisions = new Set<string>();
  private stitchedWorld: StitchedWorld | null = null;
  private terrainCanvas: HTMLCanvasElement | null = null;

  // Editor states
  public editorMode: 'none' | 'place_node' | 'place_npc' | 'paint_collision' | 'erase_collision' = 'none';
  public showCollisions = false;
  private hoverTileX = 0;
  private hoverTileY = 0;

  // Smooth visual positions (sub-tile interpolation)
  private visualX = 25;
  private visualY = 25;
  private cameraX = 0;
  private cameraY = 0;
  private animTick = 0;

  // Visual effects
  private destinationMarker: { x: number; y: number; time: number } | null = null;
  private dustParticles: DustParticle[] = [];

  // Interaction callbacks
  public onNodeClick?: (node: WorldNodeDisplay) => void;
  public onNpcClick?: (npc: NpcDefinition) => void;
  public onGroundClick?: (tileX: number, tileY: number) => void;
  public onTileSelected?: (tileX: number, tileY: number) => void;
  public onCollisionToggled?: (tileX: number, tileY: number, added: boolean) => void;

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

  public setNpcs(npcs: NpcDefinition[]) {
    this.npcs = npcs;
  }

  public setCollisions(collisions: string[] | Set<string>) {
    this.collisions = new Set<string>(collisions);
  }

  public getCollisions(): Set<string> {
    return this.collisions;
  }

  public setStitchedWorld(world: StitchedWorld) {
    this.stitchedWorld = world;
    this.bakeTerrain();
  }

  private bakeTerrain() {
    if (!this.stitchedWorld) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = this.stitchedWorld.widthTiles * TILE_SIZE;
    offscreen.height = this.stitchedWorld.heightTiles * TILE_SIZE;
    const octx = offscreen.getContext('2d')!;
    octx.imageSmoothingEnabled = false;

    // Base background under-layer
    octx.fillStyle = '#1e3020';
    octx.fillRect(0, 0, offscreen.width, offscreen.height);

    for (const t of this.stitchedWorld.tiles) {
      octx.drawImage(
        this.stitchedWorld.tilesetImage,
        t.srcX,
        t.srcY,
        t.width,
        t.height,
        t.tileX * TILE_SIZE,
        t.tileY * TILE_SIZE,
        TILE_SIZE + 0.5,
        TILE_SIZE + 0.5
      );
    }

    this.terrainCanvas = offscreen;
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
    let isMouseDown = false;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;
      const camX = Math.round(this.cameraX);
      const camY = Math.round(this.cameraY);
      this.hoverTileX = Math.floor((clickScreenX + camX) / TILE_SIZE);
      this.hoverTileY = Math.floor((clickScreenY + camY) / TILE_SIZE);

      if (isMouseDown) {
        if (this.editorMode === 'paint_collision') {
          const key = `${this.hoverTileX},${this.hoverTileY}`;
          if (!this.collisions.has(key)) {
            this.collisions.add(key);
            this.onCollisionToggled?.(this.hoverTileX, this.hoverTileY, true);
          }
        } else if (this.editorMode === 'erase_collision') {
          const key = `${this.hoverTileX},${this.hoverTileY}`;
          if (this.collisions.has(key)) {
            this.collisions.delete(key);
            this.onCollisionToggled?.(this.hoverTileX, this.hoverTileY, false);
          }
        }
      }
    });

    this.canvas.addEventListener('mousedown', () => {
      isMouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      const camX = Math.round(this.cameraX);
      const camY = Math.round(this.cameraY);

      const tileX = Math.floor((clickScreenX + camX) / TILE_SIZE);
      const tileY = Math.floor((clickScreenY + camY) / TILE_SIZE);

      // 1. Editor mode handling
      if (this.editorMode === 'paint_collision') {
        const key = `${tileX},${tileY}`;
        this.collisions.add(key);
        this.onCollisionToggled?.(tileX, tileY, true);
        return;
      }
      if (this.editorMode === 'erase_collision') {
        const key = `${tileX},${tileY}`;
        this.collisions.delete(key);
        this.onCollisionToggled?.(tileX, tileY, false);
        return;
      }
      if (this.editorMode === 'place_node' || this.editorMode === 'place_npc') {
        this.onTileSelected?.(tileX, tileY);
        return;
      }

      this.setDestinationMarker(tileX, tileY);

      // 2. Click NPC
      const clickedNpc = this.npcs.find(n => Math.hypot(n.x - tileX, n.y - tileY) <= 1.2);
      if (clickedNpc && this.onNpcClick) {
        this.onNpcClick(clickedNpc);
        return;
      }

      // 3. Click Node
      const clickedNode = this.nodes.find(n => Math.hypot(n.x - tileX, n.y - tileY) <= 1.2);
      if (clickedNode && this.onNodeClick) {
        this.onNodeClick(clickedNode);
        return;
      }

      // 4. Ground click movement
      if (this.onGroundClick) {
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

    const camX = Math.round(this.cameraX);
    const camY = Math.round(this.cameraY);

    ctx.save();
    ctx.translate(-camX, -camY);

    // 1. Draw World Terrain (Stitched LDtk Tiles)
    this.drawTerrain();

    // 2. Draw Collisions Overlay (if active or editing)
    this.drawCollisions();

    // 3. Draw Planned Path Trail
    this.drawPathTrail();

    // 4. Draw Destination Reticle
    this.drawDestinationMarker();

    // 5. Draw Interactive Nodes
    this.drawNodes();

    // 6. Draw NPCs
    this.drawNpcs();

    // 7. Draw Dust Particles
    this.drawDustParticles();

    // 8. Draw Other Players
    for (const remote of this.otherPlayers.values()) {
      this.drawPlayer(
        remote.x,
        remote.y,
        remote.name,
        remote.title,
        false,
        remote.isMoving || false,
        remote.currentTask,
        remote.bankingState,
        undefined,
        remote.role === 'admin'
      );
    }

    // 9. Draw Local Player (Interpolated)
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
        this.localPlayer.moveSpeedTilesPerTick,
        this.localPlayer.role === 'admin'
      );
    }

    // 10. Draw Overhead Chat Bubbles
    this.drawChatBubbles();

    // 11. Draw Editor Preview Overlay
    this.drawEditorOverlay();

    ctx.restore();
    requestAnimationFrame((ts) => this.render(ts));
  }

  private drawTerrain() {
    const { ctx } = this;

    if (this.terrainCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.terrainCanvas, 0, 0);
      return;
    }

    const startTileX = Math.max(0, Math.floor(this.cameraX / TILE_SIZE) - 1);
    const endTileX = Math.min(60, Math.ceil((this.cameraX + this.canvas.width) / TILE_SIZE) + 1);
    const startTileY = Math.max(0, Math.floor(this.cameraY / TILE_SIZE) - 1);
    const endTileY = Math.min(60, Math.ceil((this.cameraY + this.canvas.height) / TILE_SIZE) + 1);

    for (let x = startTileX; x <= endTileX; x++) {
      for (let y = startTileY; y <= endTileY; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1b211c' : '#202621';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawCollisions() {
    if (!this.showCollisions && !this.editorMode.includes('collision')) return;
    const { ctx } = this;
    ctx.save();
    for (const key of this.collisions) {
      const [xStr, yStr] = key.split(',');
      const tx = parseInt(xStr, 10);
      const ty = parseInt(yStr, 10);
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;

      ctx.fillStyle = 'rgba(229, 62, 62, 0.35)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(229, 62, 62, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
    ctx.restore();
  }

  private drawEditorOverlay() {
    if (this.editorMode === 'none') return;
    const { ctx } = this;
    const px = this.hoverTileX * TILE_SIZE;
    const py = this.hoverTileY * TILE_SIZE;

    ctx.save();
    if (this.editorMode === 'paint_collision') {
      ctx.strokeStyle = '#e53e3e';
      ctx.fillStyle = 'rgba(229, 62, 62, 0.45)';
    } else if (this.editorMode === 'erase_collision') {
      ctx.strokeStyle = '#3182ce';
      ctx.fillStyle = 'rgba(49, 130, 206, 0.45)';
    } else {
      ctx.strokeStyle = '#ecc94b';
      ctx.fillStyle = 'rgba(236, 201, 75, 0.35)';
    }

    ctx.lineWidth = 2;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

    // Coordinate tooltip tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px - 10, py - 20, 52, 16, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.hoverTileX}, ${this.hoverTileY}`, px + 16, py - 8);

    ctx.restore();
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

      const isHearth = node.type === 'hearth_counter';
      const pulse = Math.sin(this.animTick * 0.003 + node.x * 2) * (isHearth ? 2.5 : 1.5);
      ctx.fillStyle = isHearth ? 'rgba(223, 166, 55, 0.35)' : 'rgba(212, 175, 55, 0.2)';
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, (isHearth ? 10 : 7) + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Stylized nameplate badge
      const text = node.name;
      ctx.font = isHearth ? '700 11px Inter, sans-serif' : '600 10px Inter, sans-serif';
      const textWidth = ctx.measureText(text).width;
      const badgeW = textWidth + (isHearth ? 18 : 14);
      const badgeH = isHearth ? 18 : 16;
      const badgeX = px + TILE_SIZE / 2 - badgeW / 2;
      const badgeY = py - (isHearth ? 10 : 8);

      ctx.fillStyle = isHearth ? 'rgba(28, 17, 8, 0.95)' : 'rgba(18, 22, 28, 0.85)';
      ctx.strokeStyle = isHearth ? '#dfa637' : '#5a4522';
      ctx.lineWidth = isHearth ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHearth ? '#ffd466' : '#f3e8cb';
      ctx.textAlign = 'center';
      ctx.fillText(text, px + TILE_SIZE / 2, badgeY + (isHearth ? 13 : 11));
      ctx.restore();
    }
  }

  private drawNpcs() {
    const { ctx } = this;
    for (const npc of this.npcs) {
      const px = npc.x * TILE_SIZE + TILE_SIZE / 2;
      const py = npc.y * TILE_SIZE + TILE_SIZE / 2;

      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(px, py + 12, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Robe / Body
      ctx.fillStyle = '#234e52';
      ctx.beginPath();
      ctx.arc(px, py + 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38b2ac';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Head
      ctx.fillStyle = '#fbd38d';
      ctx.beginPath();
      ctx.arc(px, py - 6, 6, 0, Math.PI * 2);
      ctx.fill();

      // Nameplate badge
      const name = npc.name;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      const textWidth = ctx.measureText(name).width;
      const badgeW = textWidth + 18;
      const badgeH = 16;
      const badgeX = px - badgeW / 2;
      const badgeY = py - 26;

      ctx.fillStyle = 'rgba(12, 28, 28, 0.92)';
      ctx.strokeStyle = '#38b2ac';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#81e6d9';
      ctx.fillText(name, px, badgeY + 11);

      // Title
      if (npc.title) {
        ctx.font = 'italic 8px Inter, sans-serif';
        ctx.fillStyle = '#a0aec0';
        ctx.fillText(npc.title, px, badgeY - 3);
      }

      // Floating Quest Exclamation Mark
      if (npc.questIds && npc.questIds.length > 0) {
        const bob = Math.sin(this.animTick * 0.005) * 2;
        ctx.fillStyle = '#ecc94b';
        ctx.beginPath();
        ctx.arc(px, badgeY - 14 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a202c';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText('!', px, badgeY - 11 + bob);
      }

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
    moveSpeed?: number,
    isAdmin: boolean = false
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
      ctx.fillStyle = '#8b5a2b';
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
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#48bb78';
        ctx.textAlign = 'center';
        ctx.fillText(`${moveSpeed.toFixed(1)} t/t`, px, py + 22);
      }
    } else {
      // === DISMOUNTED / GATHERING / WORKING STATE ===
      const breatheBob = Math.sin(this.animTick * 0.003) * 1;

      // Character Cloak / Torso
      ctx.fillStyle = isSelf ? '#2b6cb0' : '#4a5568';
      ctx.beginPath();
      ctx.arc(px, py + 2 + breatheBob, 8, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = isSelf ? '#e5b338' : '#cbd5e0';
      ctx.beginPath();
      ctx.arc(px, py - 6 + breatheBob, 5, 0, Math.PI * 2);
      ctx.fill();

      // If working, animate swinging vector tool
      if (taskSkill) {
        const swing = Math.sin(this.animTick * 0.012) * 0.8;
        ctx.save();
        ctx.translate(px + 7, py + 2);
        ctx.rotate(swing);
        // Wooden handle
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -8);
        ctx.stroke();
        // Iron head
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(4, -11);
        ctx.lineTo(11, -4);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Overhead Banking Status Badge
    if (bankingState === 'walking_to_bank') {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#f6ad55';
      ctx.textAlign = 'center';
      ctx.fillText('Riding to Hearth...', px, py - 34);
    } else if (bankingState === 'returning_to_work') {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#68d391';
      ctx.textAlign = 'center';
      ctx.fillText('Returning to Work...', px, py - 34);
    }

    // Overhead Admin Crown / Badge
    if (isAdmin) {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText('👑 [ADMIN]', px, title ? py - 34 : py - 24);
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
      let px = 0;
      let py = 0;

      if (this.localPlayer && bubble.senderId === this.localPlayer.id) {
        px = this.visualX * TILE_SIZE + TILE_SIZE / 2;
        py = this.visualY * TILE_SIZE - 25;
      } else {
        const other = this.otherPlayers.get(bubble.senderId);
        if (other) {
          px = other.x * TILE_SIZE + TILE_SIZE / 2;
          py = other.y * TILE_SIZE - 25;
        } else {
          continue;
        }
      }

      ctx.save();
      ctx.font = '10px Inter, sans-serif';
      const textWidth = ctx.measureText(bubble.text).width;
      const bubbleW = textWidth + 12;
      const bubbleH = 18;
      const bubbleX = px - bubbleW / 2;
      const bubbleY = py - bubbleH;

      ctx.fillStyle = 'rgba(20, 15, 10, 0.9)';
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(bubble.text, px, bubbleY + 12);
      ctx.restore();
    }
  }
}
