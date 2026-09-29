import { PlayerData, NpcDefinition, WorldNode, MONSTER_SPRITES, PLAYER_EQUIPMENT_SPRITES, EquipmentSpriteCoord, EquipSlot, InventorySlot } from '@eldoria/shared';
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
  equipment?: Partial<Record<EquipSlot, InventorySlot>>;
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
  private enemiesImage: HTMLImageElement | null = null;
  private playerEquipmentImage: HTMLImageElement | null = null;

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

    this.enemiesImage = new Image();
    this.enemiesImage.src = '/maps/enemies.png';

    this.playerEquipmentImage = new Image();
    this.playerEquipmentImage.src = '/maps/player_equipment.png';

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

      if (this.editorMode === 'none') {
        const isHoveringNpc = this.npcs.some(n => n.x === this.hoverTileX && n.y === this.hoverTileY);
        const isHoveringMonster = this.nodes.some(n => n.type === 'monster' && n.x === this.hoverTileX && n.y === this.hoverTileY);
        this.canvas.style.cursor = (isHoveringNpc || isHoveringMonster) ? 'pointer' : 'default';
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

      // 2. Click NPC (ONLY on the exact tile square of the NPC)
      const clickedNpc = this.npcs.find(n => n.x === tileX && n.y === tileY);
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
        remote.role === 'admin',
        remote.equipment
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
        this.localPlayer.role === 'admin',
        this.localPlayer.equipment
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

      // === MONSTER / ENEMY NODES ===
      if (node.type === 'monster') {
        const mobId = node.monsterId || 'mire_rat';
        const spriteCoord = MONSTER_SPRITES[mobId] || MONSTER_SPRITES['mire_rat'];

        // Red/Crimson combat hover outline feedback if hovered
        if (this.hoverTileX === node.x && this.hoverTileY === node.y) {
          ctx.fillStyle = 'rgba(229, 62, 62, 0.2)';
          ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          ctx.strokeStyle = '#e53e3e';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

          // Corner brackets
          ctx.strokeStyle = '#feb2b2';
          ctx.lineWidth = 2;
          const c = 5;
          ctx.beginPath();
          ctx.moveTo(px, py + c); ctx.lineTo(px, py); ctx.lineTo(px + c, py);
          ctx.moveTo(px + TILE_SIZE - c, py); ctx.lineTo(px + TILE_SIZE, py); ctx.lineTo(px + TILE_SIZE, py + c);
          ctx.moveTo(px, py + TILE_SIZE - c); ctx.lineTo(px, py + TILE_SIZE); ctx.lineTo(px + c, py + TILE_SIZE);
          ctx.moveTo(px + TILE_SIZE - c, py + TILE_SIZE); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE - c);
          ctx.stroke();
        }

        // Idle breathing / bobbing animation
        const idleBob = Math.sin(this.animTick * 0.004 + node.x * 2) * 1.5;

        // Shadow under the enemy sprite
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Render the 2D pixel-art sprite matching the tileset
        if (this.enemiesImage && this.enemiesImage.complete) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            this.enemiesImage,
            spriteCoord.col * 16,
            spriteCoord.row * 16,
            16,
            16,
            px,
            py + idleBob,
            TILE_SIZE,
            TILE_SIZE
          );
        }

        // Stylized Enemy nameplate badge overhead
        const text = node.name;
        ctx.font = '700 10px Inter, system-ui, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const badgeW = textWidth + 14;
        const badgeH = 16;
        const badgeX = px + TILE_SIZE / 2 - badgeW / 2;
        const badgeY = py - 8;

        ctx.fillStyle = 'rgba(28, 12, 12, 0.9)';
        ctx.strokeStyle = '#9b2c2c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#feb2b2';
        ctx.textAlign = 'center';
        ctx.fillText(text, px + TILE_SIZE / 2, badgeY + 11);

        ctx.restore();
        continue;
      }

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
      // Highlighted square outline feedback on the NPC tile when hovered
      if (this.hoverTileX === npc.x && this.hoverTileY === npc.y) {
        const tilePx = npc.x * TILE_SIZE;
        const tilePy = npc.y * TILE_SIZE;

        // Subtle soft highlight fill
        ctx.fillStyle = 'rgba(56, 178, 172, 0.2)';
        ctx.fillRect(tilePx + 1, tilePy + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        // Crisp cyan glowing border around the exact square
        ctx.strokeStyle = '#38b2ac';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tilePx + 0.5, tilePy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

        // Corner bracket accents
        ctx.strokeStyle = '#81e6d9';
        ctx.lineWidth = 2;
        const c = 5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(tilePx, tilePy + c); ctx.lineTo(tilePx, tilePy); ctx.lineTo(tilePx + c, tilePy);
        // Top-right
        ctx.moveTo(tilePx + TILE_SIZE - c, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy + c);
        // Bottom-left
        ctx.moveTo(tilePx, tilePy + TILE_SIZE - c); ctx.lineTo(tilePx, tilePy + TILE_SIZE); ctx.lineTo(tilePx + c, tilePy + TILE_SIZE);
        // Bottom-right
        ctx.moveTo(tilePx + TILE_SIZE - c, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE - c);
        ctx.stroke();
      }

      // Render ONLY the name, positioned cleanly above the NPC sprite tile
      const name = npc.name;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';

      // Crisp dark text shadow for high contrast on any terrain
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(name, px + 1, py - 22);
      ctx.fillText(name, px - 1, py - 22);
      ctx.fillText(name, px, py - 21);
      ctx.fillText(name, px, py - 23);

      // Clean bright NPC nameplate
      ctx.fillStyle = '#81e6d9';
      ctx.fillText(name, px, py - 22);

      // Floating Quest Exclamation Mark (if NPC has active quests)
      if (npc.questIds && npc.questIds.length > 0) {
        const bob = Math.sin(this.animTick * 0.005) * 2;
        ctx.fillStyle = '#ecc94b';
        ctx.beginPath();
        ctx.arc(px, py - 35 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a202c';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText('!', px, py - 32 + bob);
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
    isAdmin: boolean = false,
    equipment?: Partial<Record<EquipSlot, InventorySlot>>
  ) {
    const { ctx } = this;
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;

    ctx.save();

    // Helper to resolve an equipment sprite from an itemId or key
    const getSprite = (key?: string): EquipmentSpriteCoord | undefined => {
      if (!key) return undefined;
      if (PLAYER_EQUIPMENT_SPRITES[key]) return PLAYER_EQUIPMENT_SPRITES[key];
      for (const k of Object.keys(PLAYER_EQUIPMENT_SPRITES)) {
        if (key.includes(k) || k.includes(key)) return PLAYER_EQUIPMENT_SPRITES[k];
      }
      return undefined;
    };

    // Helper to draw a 16x16 layer from player_equipment.png scaled to 32x32
    const drawLayer = (coord?: EquipmentSpriteCoord, offX: number = 0, offY: number = 0, rotation?: number) => {
      if (!coord || !this.playerEquipmentImage || !this.playerEquipmentImage.complete) return;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (rotation !== undefined && rotation !== 0) {
        ctx.translate(px + offX, py + offY);
        ctx.rotate(rotation);
        ctx.drawImage(
          this.playerEquipmentImage,
          coord.col * 16,
          coord.row * 16,
          16,
          16,
          -TILE_SIZE / 2,
          -TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE
        );
      } else {
        ctx.drawImage(
          this.playerEquipmentImage,
          coord.col * 16,
          coord.row * 16,
          16,
          16,
          px - TILE_SIZE / 2 + offX,
          py - TILE_SIZE / 2 + offY,
          TILE_SIZE,
          TILE_SIZE
        );
      }
      ctx.restore();
    };

    const isMounted = Boolean(equipment && equipment.steed);

    if (isMounted) {
      // === MOUNTED GALLOPING ON STEED ===
      const gallopBob = isMoving ? Math.sin(this.animTick * 0.02) * 2 : 0;

      // Ground shadow under steed
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(px, py + 12, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1. Draw Steed
      const steedCoord = getSprite(equipment?.steed?.itemId || 'steed_courser');
      drawLayer(steedCoord, 0, gallopBob);

      // Rider seated in the saddle
      const riderY = -3 + gallopBob;

      // 2. Base Body
      drawLayer(getSprite('base_male'), -1, riderY);

      // 3. Leg Armor
      const legCoord = getSprite(equipment?.legs?.itemId) || getSprite('tunic_pants');
      drawLayer(legCoord, -1, riderY);

      // 4. Body Armor
      const bodyCoord = getSprite(equipment?.body?.itemId) || getSprite('tunic_cloth');
      drawLayer(bodyCoord, -1, riderY);

      // 5. Helmet / Hair
      const helmCoord = getSprite(equipment?.helmet?.itemId);
      if (helmCoord) {
        drawLayer(helmCoord, -1, riderY);
      } else if (isAdmin) {
        drawLayer(getSprite('astralite_helm'), -1, riderY);
      } else {
        drawLayer(getSprite('hair_adventurer'), -1, riderY);
      }

      // 6. Shield / Offhand
      const shieldCoord = getSprite(equipment?.shield?.itemId);
      if (shieldCoord) drawLayer(shieldCoord, -1, riderY);

      // 7. Weapon (Mounted: show weapon if equipped)
      const weaponCoord = getSprite(equipment?.weapon?.itemId);
      if (weaponCoord) {
        drawLayer(weaponCoord, -1, riderY);
      }

      // Speed Tag
      if (moveSpeed) {
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#48bb78';
        ctx.textAlign = 'center';
        ctx.fillText(`${moveSpeed.toFixed(1)} t/t`, px, py + 22);
      }
    } else {
      // === DISMOUNTED / WALKING ON FOOT / WORKING / IDLE ===
      // Natural walking step bob when moving on foot, gentle breathing bob when standing
      const breatheBob = isMoving ? Math.sin(this.animTick * 0.015) * 1.5 : Math.sin(this.animTick * 0.003) * 1.5;

      // Ground shadow under player
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(px, py + 12, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1. Base Body
      drawLayer(getSprite('base_male'), 0, breatheBob);

      // 2. Leg Armor
      const legCoord = getSprite(equipment?.legs?.itemId) || getSprite('tunic_pants');
      drawLayer(legCoord, 0, breatheBob);

      // 3. Body Armor
      const bodyCoord = getSprite(equipment?.body?.itemId) || getSprite('tunic_cloth');
      drawLayer(bodyCoord, 0, breatheBob);

      // 4. Helmet / Hair
      const helmCoord = getSprite(equipment?.helmet?.itemId);
      if (helmCoord) {
        drawLayer(helmCoord, 0, breatheBob);
      } else if (isAdmin) {
        drawLayer(getSprite('astralite_helm'), 0, breatheBob);
      } else {
        drawLayer(getSprite('hair_adventurer'), 0, breatheBob);
      }

      // 5. Shield / Offhand
      const shieldCoord = getSprite(equipment?.shield?.itemId);
      if (shieldCoord) drawLayer(shieldCoord, 0, breatheBob);

      // 6. Weapon / Toolbelt Working Tool
      if (taskSkill) {
        // Toolbelt tools are ONLY visible and animated when actively working on that skill!
        if (taskSkill === 'mining') {
          const swing = Math.sin(this.animTick * 0.014) * 0.5;
          const pickaxe = equipment?.tool_pickaxe || equipment?.tool;
          const toolCoord = getSprite(pickaxe?.itemId) || getSprite('rune_pickaxe_dawnburn');
          drawLayer(toolCoord, 0, breatheBob, swing);
        } else if (taskSkill === 'woodcutting') {
          const chop = Math.sin(this.animTick * 0.014) * 0.5;
          const axe = equipment?.tool_axe || equipment?.tool;
          const toolCoord = getSprite(axe?.itemId) || getSprite('rune_axe_dawnburn');
          drawLayer(toolCoord, 0, breatheBob, chop);
        } else if (taskSkill === 'fishing') {
          const rodTug = Math.sin(this.animTick * 0.007) * 0.18;
          const rod = equipment?.tool_rod || equipment?.tool;
          const toolCoord = getSprite(rod?.itemId) || getSprite('fishing_rod_willow');
          drawLayer(toolCoord, 0, breatheBob, rodTug);
        } else {
          const genericTool = equipment?.tool || equipment?.weapon;
          const toolCoord = getSprite(genericTool?.itemId);
          if (toolCoord) {
            const swing = Math.sin(this.animTick * 0.012) * 0.35;
            drawLayer(toolCoord, 0, breatheBob, swing);
          }
        }
      } else {
        // When IDLE, WALKING, or STANDING: ONLY draw weapon if weapon is equipped! Tools on toolbelt are invisible!
        const weaponCoord = getSprite(equipment?.weapon?.itemId);
        if (weaponCoord) {
          drawLayer(weaponCoord, 0, breatheBob);
        }
      }
    }

    // Overhead Name & Title & Badges Positioning
    // Shifted upwards cleanly so names never obscure player heads, tall helmets, or mounts!
    const nameBaseY = isMounted ? py - 30 : py - 24;
    const titleY = nameBaseY - 11;
    const adminY = title ? titleY - 11 : nameBaseY - 11;
    const bankingY = (isAdmin ? adminY : (title ? titleY : nameBaseY)) - 12;

    // Overhead Banking Status Badge
    if (bankingState === 'walking_to_bank') {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#f6ad55';
      ctx.textAlign = 'center';
      ctx.fillText('Riding to Hearth...', px, bankingY);
    } else if (bankingState === 'returning_to_work') {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#68d391';
      ctx.textAlign = 'center';
      ctx.fillText('Returning to Work...', px, bankingY);
    }

    // Overhead Admin Crown / Badge
    if (isAdmin) {
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText('👑 [ADMIN]', px, adminY);
    }

    // Name with 4-directional dark stroke for sharp contrast against all terrains
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(name, px - 1, nameBaseY);
    ctx.fillText(name, px + 1, nameBaseY);
    ctx.fillText(name, px, nameBaseY - 1);
    ctx.fillText(name, px, nameBaseY + 1);

    ctx.fillStyle = isSelf ? '#ffd700' : '#f0f4f8';
    ctx.fillText(name, px, nameBaseY);

    if (title) {
      ctx.font = 'italic 9px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(`"${title}"`, px - 1, titleY);
      ctx.fillText(`"${title}"`, px + 1, titleY);
      ctx.fillText(`"${title}"`, px, titleY - 1);
      ctx.fillText(`"${title}"`, px, titleY + 1);

      ctx.fillStyle = '#cbd5e0';
      ctx.fillText(`"${title}"`, px, titleY);
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
