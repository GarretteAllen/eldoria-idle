import { PlayerData, NpcDefinition, WorldNode, ITEMS, MONSTERS, MONSTER_SPRITES, PLAYER_EQUIPMENT_SPRITES, EquipmentSpriteCoord, EquipSlot, InventorySlot } from '@eldoria/shared';
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
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;

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

  // Interaction callbacks
  public onNodeClick?: (node: WorldNodeDisplay) => void;
  public onNpcClick?: (npc: NpcDefinition) => void;
  public onGroundClick?: (tileX: number, tileY: number) => void;
  public onTileSelected?: (tileX: number, tileY: number) => void;
  public onCollisionToggled?: (tileX: number, tileY: number, added: boolean) => void;
  public monsterHpMap = new Map<string, { currentHp: number; maxHp: number }>();
  private combatProjectiles: Array<{
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startTime: number;
    duration: number;
    style: 'melee' | 'ranged' | 'magic';
  }> = [];

  public addCombatProjectile(startX: number, startY: number, targetX: number, targetY: number, style: 'melee' | 'ranged' | 'magic') {
    this.combatProjectiles.push({
      startX,
      startY,
      targetX,
      targetY,
      startTime: Date.now(),
      duration: style === 'melee' ? 220 : 380,
      style,
    });
  }

  // Attack animation state per player (both local player and other players in the world)
  public playerAttackAnims = new Map<string, {
    startTime: number;
    duration: number;
    style: 'melee' | 'ranged' | 'magic';
  }>();

  public triggerPlayerAttack(style: 'melee' | 'ranged' | 'magic', playerId: string = 'self') {
    this.playerAttackAnims.set(playerId, {
      startTime: performance.now(),
      duration: 380,
      style,
    });
  }

  // Floating combat texts (hitsplats, miss, heals, gold drops)
  private floatingTexts: Array<{
    startX: number;
    startY: number;
    text: string;
    type: 'damage' | 'splash' | 'heal' | 'gold' | 'xp';
    startTime: number;
    duration: number;
  }> = [];

  public addFloatingText(tileX: number, tileY: number, text: string, type: 'damage' | 'splash' | 'heal' | 'gold' | 'xp' = 'damage') {
    this.floatingTexts.push({
      startX: tileX,
      startY: tileY,
      text,
      type,
      startTime: performance.now(),
      duration: 1000,
    });
  }

  // Monster hit flinch / red flash map
  public monsterHitFlashes = new Map<string, number>();

  public triggerMonsterFlinch(monsterIdOrKey: string) {
    this.monsterHitFlashes.set(monsterIdOrKey, performance.now());
  }

  // Monster death poof particle effects
  private deathEffects: Array<{
    x: number;
    y: number;
    startTime: number;
    duration: number;
  }> = [];

  public addDeathEffect(tileX: number, tileY: number) {
    this.deathEffects.push({
      x: tileX,
      y: tileY,
      startTime: performance.now(),
      duration: 600,
    });
  }

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
        const isHoveringNode = this.nodes.some(n => n.x === this.hoverTileX && n.y === this.hoverTileY);
        this.canvas.style.cursor = (isHoveringNpc || isHoveringNode) ? 'pointer' : 'default';
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

      // 3. Click Node (ONLY on the exact tile square of the Node)
      const clickedNode = this.nodes.find(n => n.x === tileX && n.y === tileY);
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

    // 7. Draw Other Players
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
        remote.equipment,
        remote.id
      );
    }

    // 9. Draw Local Player (Interpolated)
    if (this.localPlayer) {
      const isMoving = this.localPlayer.isMoving || (this.localPlayer.path && this.localPlayer.path.length > 0) || Math.hypot(this.localPlayer.x - this.visualX, this.localPlayer.y - this.visualY) > 0.1;
      const currentTaskSkill = this.localPlayer.currentTask
        ? ((this.localPlayer.currentTask.skill as string) === 'combat' ? this.getPlayerCombatStyle(this.localPlayer) : this.localPlayer.currentTask.skill)
        : null;

      this.drawPlayer(
        this.visualX,
        this.visualY,
        this.localPlayer.username,
        this.localPlayer.activeTitle,
        true,
        isMoving,
        currentTaskSkill,
        this.localPlayer.bankingState,
        this.localPlayer.moveSpeedTilesPerTick,
        this.localPlayer.role === 'admin',
        this.localPlayer.equipment,
        this.localPlayer.id
      );
    }

    // 10. Draw Combat Projectiles & Effects
    this.drawCombatProjectiles();

    // 11. Draw Death Poof Particle FX
    this.drawDeathEffects();

    // 12. Draw Floating Hitsplats & Damage Numbers
    this.drawFloatingTexts();

    // 13. Draw Overhead Chat Bubbles
    this.drawChatBubbles();

    // 14. Draw Editor Preview Overlay
    this.drawEditorOverlay();

    ctx.restore();

    // 15. Ambient Day/Night Lighting Overlay (Viewport space)
    this.drawDayNightLighting();

    // 16. Tactical Radar Minimap
    this.drawMinimap();

    requestAnimationFrame((ts) => this.render(ts));
  }

  private drawCombatProjectiles() {
    const now = Date.now();
    this.combatProjectiles = this.combatProjectiles.filter(p => now - p.startTime < p.duration);
    if (this.combatProjectiles.length === 0) return;
    const { ctx } = this;

    for (const p of this.combatProjectiles) {
      const progress = Math.min(1, (now - p.startTime) / p.duration);
      const curTileX = p.startX + (p.targetX - p.startX) * progress;
      const curTileY = p.startY + (p.targetY - p.startY) * progress;
      const px = Math.round(curTileX * TILE_SIZE + TILE_SIZE / 2);
      const py = Math.round(curTileY * TILE_SIZE + TILE_SIZE / 2);

      ctx.save();
      if (p.style === 'ranged') {
        // Arrow projectile
        const angle = Math.atan2(p.targetY - p.startY, p.targetX - p.startX);
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.strokeStyle = '#d69e2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(7, 0);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = '#f6e05e';
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(3, -3);
        ctx.lineTo(3, 3);
        ctx.fill();
      } else if (p.style === 'magic') {
        // Glowing magic spark orb
        ctx.fillStyle = '#63b3ed';
        ctx.shadowColor = '#4299e1';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Melee slash spark arc
        ctx.strokeStyle = `rgba(254, 178, 178, ${1 - progress})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 10 * progress, -Math.PI / 4, Math.PI / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawDeathEffects() {
    const now = performance.now();
    this.deathEffects = this.deathEffects.filter(e => now - e.startTime < e.duration);
    if (this.deathEffects.length === 0) return;
    const { ctx } = this;

    for (const e of this.deathEffects) {
      const progress = Math.min(1, (now - e.startTime) / e.duration);
      const px = Math.round(e.x * TILE_SIZE + TILE_SIZE / 2);
      const py = Math.round(e.y * TILE_SIZE + TILE_SIZE / 2);

      ctx.save();
      // Dissipating dust / smoke ring
      const ringRadius = 6 + progress * 16;
      ctx.strokeStyle = `rgba(210, 195, 170, ${Math.max(0, (1 - progress) * 0.75)})`;
      ctx.lineWidth = 2 * (1 - progress);
      ctx.beginPath();
      ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Golden spark particles flying outward
      const particleCount = 6;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const dist = progress * 18;
        const sparkX = px + Math.cos(angle) * dist;
        const sparkY = py + Math.sin(angle) * dist - progress * 4;
        ctx.fillStyle = `rgba(255, 215, 0, ${Math.max(0, 1 - progress)})`;
        ctx.fillRect(sparkX - 1, sparkY - 1, 2.5, 2.5);
      }
      ctx.restore();
    }
  }

  private drawFloatingTexts() {
    const now = performance.now();
    this.floatingTexts = this.floatingTexts.filter(ft => now - ft.startTime < ft.duration);
    if (this.floatingTexts.length === 0) return;
    const { ctx } = this;

    for (const ft of this.floatingTexts) {
      const elapsed = now - ft.startTime;
      const progress = Math.min(1, elapsed / ft.duration);
      // Upward floating motion with smooth ease out
      const floatY = Math.sin(progress * (Math.PI / 2)) * 26;
      const alpha = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;

      const px = Math.round(ft.startX * TILE_SIZE + TILE_SIZE / 2);
      const py = Math.round(ft.startY * TILE_SIZE - 10 - floatY);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Pop-in scale
      const scale = progress < 0.15 ? 0.7 + (progress / 0.15) * 0.4 : 1.0;
      ctx.translate(px, py);
      ctx.scale(scale, scale);

      ctx.font = 'bold 11px Inter, monospace, sans-serif';
      const textW = ctx.measureText(ft.text).width;
      const padX = 6;
      const badgeW = Math.max(22, textW + padX * 2);
      const badgeH = 17;
      const bx = -badgeW / 2;
      const by = -badgeH / 2;

      let bgColor = 'rgba(180, 25, 25, 0.92)';
      let borderColor = '#f56565';
      let textColor = '#ffffff';

      if (ft.type === 'splash') {
        bgColor = 'rgba(25, 55, 120, 0.9)';
        borderColor = '#4299e1';
        textColor = '#ebf8ff';
      } else if (ft.type === 'heal') {
        bgColor = 'rgba(20, 110, 50, 0.92)';
        borderColor = '#48bb78';
        textColor = '#f0fff4';
      } else if (ft.type === 'gold') {
        bgColor = 'rgba(140, 95, 20, 0.95)';
        borderColor = '#ecc94b';
        textColor = '#fffaf0';
      } else if (ft.type === 'xp') {
        bgColor = 'rgba(90, 45, 140, 0.92)';
        borderColor = '#b794f4';
        textColor = '#faf5ff';
      }

      // Hitsplat badge background
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      // Hitsplat text
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, 0, 1);

      ctx.restore();
    }
  }

  private drawDayNightLighting() {
    // Smooth 24-minute real-world full day/night ambient cycle
    const now = Date.now();
    const cyclePeriodMs = 24 * 60 * 1000;
    const timeInCycle = (now % cyclePeriodMs) / cyclePeriodMs; // 0 to 1
    // Darkness is highest at midnight (0.5), zero at noon (0.0)
    const darkness = Math.max(0, Math.sin(timeInCycle * Math.PI * 2 - Math.PI / 2) * 0.42);
    if (darkness <= 0.04) return;

    const { ctx, canvas } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Dark indigo night overlay
    ctx.fillStyle = `rgba(5, 7, 24, ${darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out warm light radiuses using destination-out
    ctx.globalCompositeOperation = 'destination-out';

    // 1. Local Player Torch Light
    if (this.localPlayer) {
      const pScreenX = Math.round(this.visualX * TILE_SIZE + TILE_SIZE / 2 - this.cameraX);
      const pScreenY = Math.round(this.visualY * TILE_SIZE + TILE_SIZE / 2 - this.cameraY);
      const rad = 80;
      const grad = ctx.createRadialGradient(pScreenX, pScreenY, 12, pScreenX, pScreenY, rad);
      grad.addColorStop(0, `rgba(0, 0, 0, ${darkness * 1.8})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${darkness * 0.9})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pScreenX, pScreenY, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Town Hearth Bonfire Light
    const hearthScreenX = Math.round(8 * TILE_SIZE + TILE_SIZE / 2 - this.cameraX);
    const hearthScreenY = Math.round(24 * TILE_SIZE + TILE_SIZE / 2 - this.cameraY);
    const hRad = 140;
    const hGrad = ctx.createRadialGradient(hearthScreenX, hearthScreenY, 20, hearthScreenX, hearthScreenY, hRad);
    hGrad.addColorStop(0, `rgba(0, 0, 0, ${darkness * 2})`);
    hGrad.addColorStop(0.5, `rgba(0, 0, 0, ${darkness})`);
    hGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(hearthScreenX, hearthScreenY, hRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public setMinimapCanvas(canvas: HTMLCanvasElement | null) {
    this.minimapCanvas = canvas;
    this.minimapCtx = canvas ? canvas.getContext('2d') : null;
  }

  public getVisualCoords(): { x: number; y: number } {
    return { x: Math.round(this.visualX), y: Math.round(this.visualY) };
  }

  private drawMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx) return;
    const mCtx = this.minimapCtx;
    const mCanvas = this.minimapCanvas;
    const w = mCanvas.width;
    const h = mCanvas.height;

    mCtx.clearRect(0, 0, w, h);

    // 1. Terrain slice
    if (this.terrainCanvas) {
      // 34 tiles wide (radius 17)
      const tileRadius = 17;
      const sX = (this.visualX - tileRadius) * TILE_SIZE;
      const sY = (this.visualY - tileRadius) * TILE_SIZE;
      const sDim = tileRadius * 2 * TILE_SIZE;

      mCtx.imageSmoothingEnabled = false;
      mCtx.drawImage(this.terrainCanvas, sX, sY, sDim, sDim, 0, 0, w, h);
    } else {
      mCtx.fillStyle = '#140d07';
      mCtx.fillRect(0, 0, w, h);
    }

    // 2. Resource & Monster Node Pips
    const cx = w / 2;
    const cy = h / 2;
    const scale = w / (17 * 2); // 4 px per tile

    for (const node of this.nodes) {
      const dx = node.x - this.visualX;
      const dy = node.y - this.visualY;
      if (Math.abs(dx) <= 17 && Math.abs(dy) <= 17) {
        const px = cx + dx * scale;
        const py = cy + dy * scale;
        if (node.type === 'monster') {
          mCtx.fillStyle = '#f56565'; // red
        } else if (node.type === 'mine') {
          mCtx.fillStyle = '#cbd5e0'; // slate silver
        } else if (node.type === 'tree') {
          mCtx.fillStyle = '#48bb78'; // green
        } else if (node.type === 'water') {
          mCtx.fillStyle = '#4299e1'; // ocean blue
        } else if (node.type === 'hearth_counter') {
          mCtx.fillStyle = '#ecc94b'; // gold
        } else {
          mCtx.fillStyle = '#ed8936'; // orange
        }
        mCtx.beginPath();
        mCtx.arc(px, py, 2, 0, Math.PI * 2);
        mCtx.fill();
      }
    }

    // 3. NPC Pips
    for (const npc of this.npcs) {
      const dx = npc.x - this.visualX;
      const dy = npc.y - this.visualY;
      if (Math.abs(dx) <= 17 && Math.abs(dy) <= 17) {
        const px = cx + dx * scale;
        const py = cy + dy * scale;
        mCtx.fillStyle = '#38bdf8'; // cyan
        mCtx.beginPath();
        mCtx.arc(px, py, 2.5, 0, Math.PI * 2);
        mCtx.fill();
      }
    }

    // 4. Other Players
    for (const other of this.otherPlayers.values()) {
      const dx = other.x - this.visualX;
      const dy = other.y - this.visualY;
      if (Math.abs(dx) <= 17 && Math.abs(dy) <= 17) {
        const px = cx + dx * scale;
        const py = cy + dy * scale;
        mCtx.fillStyle = '#ffffff';
        mCtx.beginPath();
        mCtx.arc(px, py, 2, 0, Math.PI * 2);
        mCtx.fill();
      }
    }

    // 5. Local Player (Center)
    mCtx.fillStyle = '#ffd700';
    mCtx.beginPath();
    mCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    mCtx.fill();

    // Pulse ring
    const pulse = (performance.now() % 1500) / 1500;
    mCtx.strokeStyle = `rgba(255, 215, 0, ${1 - pulse})`;
    mCtx.lineWidth = 1.5;
    mCtx.beginPath();
    mCtx.arc(cx, cy, 3 + pulse * 5, 0, Math.PI * 2);
    mCtx.stroke();

    // Dark vignette border inside canvas
    const grad = mCtx.createRadialGradient(cx, cy, 50, cx, cy, 68);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    mCtx.fillStyle = grad;
    mCtx.fillRect(0, 0, w, h);
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
    const path = this.localPlayer.path;
    const startX = this.visualX * TILE_SIZE + TILE_SIZE / 2;
    const startY = this.visualY * TILE_SIZE + TILE_SIZE / 2;

    ctx.save();

    // 1. Wide semi-transparent golden aura glow
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (const step of path) {
      ctx.lineTo(step.x * TILE_SIZE + TILE_SIZE / 2, step.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.25)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. High-contrast dark shadow outline for visibility against any terrain
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (const step of path) {
      ctx.lineTo(step.x * TILE_SIZE + TILE_SIZE / 2, step.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.strokeStyle = 'rgba(10, 8, 5, 0.85)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 3. Vibrant animated golden marching line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (const step of path) {
      ctx.lineTo(step.x * TILE_SIZE + TILE_SIZE / 2, step.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -this.animTick * 0.035; // Directional marching movement
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Glowing waypoint nodes along turns & steps
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const px = step.x * TILE_SIZE + TILE_SIZE / 2;
      const py = step.y * TILE_SIZE + TILE_SIZE / 2;

      // Dark contrast ring
      ctx.fillStyle = 'rgba(12, 10, 6, 0.85)';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner core
      ctx.fillStyle = i === path.length - 1 ? '#ffffff' : '#ffe066';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDestinationMarker() {
    const hasPath = !!(this.localPlayer?.path && this.localPlayer.path.length > 0);
    let destX: number | null = null;
    let destY: number | null = null;

    if (this.destinationMarker) {
      const age = Date.now() - this.destinationMarker.time;
      if (age > 4000 && !hasPath) {
        this.destinationMarker = null;
      } else {
        destX = this.destinationMarker.x;
        destY = this.destinationMarker.y;
      }
    }

    if (destX === null && hasPath && this.localPlayer?.path) {
      const last = this.localPlayer.path[this.localPlayer.path.length - 1];
      destX = last.x;
      destY = last.y;
    }

    if (destX === null || destY === null) return;

    const { ctx } = this;
    const tilePx = destX * TILE_SIZE;
    const tilePy = destY * TILE_SIZE;
    const centerX = tilePx + TILE_SIZE / 2;
    const centerY = tilePy + TILE_SIZE / 2;

    ctx.save();

    // 1. Destination Tile Background Tint & Glow
    const pulseAlpha = 0.15 + Math.sin(this.animTick * 0.006) * 0.08;
    ctx.fillStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
    ctx.fillRect(tilePx + 1, tilePy + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // 2. High-contrast Destination Tile Corner Reticle
    const c = 7;
    // Dark shadow backing for corner brackets
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(tilePx, tilePy + c); ctx.lineTo(tilePx, tilePy); ctx.lineTo(tilePx + c, tilePy);
    ctx.moveTo(tilePx + TILE_SIZE - c, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy + c);
    ctx.moveTo(tilePx, tilePy + TILE_SIZE - c); ctx.lineTo(tilePx, tilePy + TILE_SIZE); ctx.lineTo(tilePx + c, tilePy + TILE_SIZE);
    ctx.moveTo(tilePx + TILE_SIZE - c, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE - c);
    ctx.stroke();

    // Bright golden corner brackets
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tilePx, tilePy + c); ctx.lineTo(tilePx, tilePy); ctx.lineTo(tilePx + c, tilePy);
    ctx.moveTo(tilePx + TILE_SIZE - c, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy); ctx.lineTo(tilePx + TILE_SIZE, tilePy + c);
    ctx.moveTo(tilePx, tilePy + TILE_SIZE - c); ctx.lineTo(tilePx, tilePy + TILE_SIZE); ctx.lineTo(tilePx + c, tilePy + TILE_SIZE);
    ctx.moveTo(tilePx + TILE_SIZE - c, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE); ctx.lineTo(tilePx + TILE_SIZE, tilePy + TILE_SIZE - c);
    ctx.stroke();

    // 3. Central Pulsing Target Ring
    const ringRadius = 8 + Math.sin(this.animTick * 0.008) * 2;
    // Shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Gold ring
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair tick marks (N, S, E, W)
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - ringRadius - 3); ctx.lineTo(centerX, centerY - ringRadius + 2);
    ctx.moveTo(centerX, centerY + ringRadius - 2); ctx.lineTo(centerX, centerY + ringRadius + 3);
    ctx.moveTo(centerX - ringRadius - 3, centerY); ctx.lineTo(centerX - ringRadius + 2, centerY);
    ctx.moveTo(centerX + ringRadius - 2, centerY); ctx.lineTo(centerX + ringRadius + 3, centerY);
    ctx.stroke();

    // Center bright bullseye dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Click Expansion Ripple (active when freshly clicked)
    if (this.destinationMarker) {
      const clickAge = Date.now() - this.destinationMarker.time;
      if (clickAge < 800) {
        const rippleProgress = clickAge / 800;
        const rippleRadius = 4 + rippleProgress * 18;
        const rippleAlpha = (1 - rippleProgress) * 0.85;

        ctx.strokeStyle = `rgba(255, 235, 120, ${rippleAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawMonsterZones() {
    const { ctx } = this;
    const monsterNodes = this.nodes.filter(n => n.type === 'monster');
    if (monsterNodes.length === 0) return;

    // Group monster nodes by monsterId, then partition by spatial proximity (<= 7 tiles)
    const byMob = new Map<string, WorldNodeDisplay[]>();
    for (const node of monsterNodes) {
      const mobId = node.monsterId || 'mire_rat';
      if (!byMob.has(mobId)) byMob.set(mobId, []);
      byMob.get(mobId)!.push(node);
    }

    const clusters: { mobId: string; nodes: WorldNodeDisplay[] }[] = [];
    for (const [mobId, nodes] of byMob.entries()) {
      const visited = new Set<string>();
      for (const node of nodes) {
        if (visited.has(node.id)) continue;
        const cluster: WorldNodeDisplay[] = [];
        const queue: WorldNodeDisplay[] = [node];
        visited.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          cluster.push(curr);
          for (const other of nodes) {
            if (!visited.has(other.id) && Math.hypot(curr.x - other.x, curr.y - other.y) <= 7) {
              visited.add(other.id);
              queue.push(other);
            }
          }
        }
        clusters.push({ mobId, nodes: cluster });
      }
    }

    ctx.save();
    for (const { mobId, nodes } of clusters) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      }

      const pad = 0.55;
      const zx = Math.round((minX - pad) * TILE_SIZE);
      const zy = Math.round((minY - pad) * TILE_SIZE);
      const zw = Math.round((maxX - minX + 1 + pad * 2) * TILE_SIZE);
      const zh = Math.round((maxY - minY + 1 + pad * 2) * TILE_SIZE);

      // 1. Subtle territory ground tint
      ctx.fillStyle = 'rgba(25, 12, 7, 0.35)';
      ctx.beginPath();
      ctx.roundRect(zx, zy, zw, zh, 8);
      ctx.fill();

      // 2. Dashed territory boundary
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(223, 166, 55, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Corner accents
      const c = 8;
      ctx.strokeStyle = '#dfa637';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(zx, zy + c); ctx.lineTo(zx, zy); ctx.lineTo(zx + c, zy);
      ctx.moveTo(zx + zw - c, zy); ctx.lineTo(zx + zw, zy); ctx.lineTo(zx + zw, zy + c);
      ctx.moveTo(zx, zy + zh - c); ctx.lineTo(zx, zy + zh); ctx.lineTo(zx + c, zy + zh);
      ctx.moveTo(zx + zw - c, zy + zh); ctx.lineTo(zx + zw, zy + zh); ctx.lineTo(zx + zw, zy + zh - c);
      ctx.stroke();

      // 4. Territory Zone Header Badge
      const mobDef = MONSTERS[mobId];
      const zoneName = mobDef ? mobDef.zone : 'Wilderness';
      const mobName = mobDef ? mobDef.name : nodes[0]?.name || mobId;
      const mobLevel = mobDef ? mobDef.level : 1;
      const label = `${zoneName} · ${mobName} (Lvl ${mobLevel})`;

      ctx.font = '700 10.5px Inter, system-ui, sans-serif';
      const labelW = ctx.measureText(label).width + 16;
      const labelH = 18;
      const labelX = zx + 8;
      const labelY = zy - 10;

      ctx.fillStyle = 'rgba(18, 10, 5, 0.92)';
      ctx.strokeStyle = '#84613b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, labelH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffd699';
      ctx.textAlign = 'left';
      ctx.fillText(label, labelX + 8, labelY + 13);
    }
    ctx.restore();
  }

  private drawNodes() {
    const { ctx } = this;
    // Draw monster territory zone boundaries under the nodes
    this.drawMonsterZones();

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

        // Check if monster was recently struck (flinch recoil & red flash) - ONLY for this specific node!
        const lastHit = this.monsterHitFlashes.get(node.id) || 0;
        const flinchElapsed = performance.now() - lastHit;
        const isFlinching = flinchElapsed < 160;
        const flinchX = isFlinching ? Math.sin(flinchElapsed * 0.12) * 3 : 0;

        // Render the 2D pixel-art sprite matching the tileset
        if (this.enemiesImage && this.enemiesImage.complete) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          if (isFlinching) {
            ctx.filter = 'brightness(1.5) sepia(1) hue-rotate(-50deg) saturate(3)';
          }
          ctx.drawImage(
            this.enemiesImage,
            spriteCoord.col * 16,
            spriteCoord.row * 16,
            16,
            16,
            px + flinchX,
            py + idleBob,
            TILE_SIZE,
            TILE_SIZE
          );
          ctx.restore();
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

        // Monster HP bar below badge if in combat - STRICTLY for this individual enemy!
        const hpInfo = this.monsterHpMap.get(node.id);
        if (hpInfo && hpInfo.maxHp > 0) {
          const hpPct = Math.max(0, Math.min(1, hpInfo.currentHp / hpInfo.maxHp));
          const hpBarY = badgeY + badgeH + 2;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(badgeX, hpBarY, badgeW, 4);
          ctx.fillStyle = hpPct > 0.5 ? '#48bb78' : hpPct > 0.25 ? '#ecc94b' : '#e53e3e';
          ctx.fillRect(badgeX, hpBarY, badgeW * hpPct, 4);
        }

        ctx.restore();
        continue;
      }

      const isHearth = node.type === 'hearth_counter';
      const isHovered = this.hoverTileX === node.x && this.hoverTileY === node.y;

      // Themed hover outline feedback on the exact tile when hovered
      if (isHovered) {
        let fillStyle = 'rgba(212, 175, 55, 0.2)';
        let strokeStyle = '#d4af37';
        let cornerStyle = '#fef08a';

        if (isHearth) {
          fillStyle = 'rgba(223, 166, 55, 0.25)';
          strokeStyle = '#dfa637';
          cornerStyle = '#ffe680';
        } else if (node.type === 'tree') {
          fillStyle = 'rgba(56, 161, 105, 0.22)';
          strokeStyle = '#38a169';
          cornerStyle = '#9ae6b4';
        } else if (node.type === 'mine') {
          fillStyle = 'rgba(217, 119, 6, 0.22)';
          strokeStyle = '#d97706';
          cornerStyle = '#fcd34d';
        } else if (node.type === 'water') {
          fillStyle = 'rgba(49, 130, 206, 0.22)';
          strokeStyle = '#3182ce';
          cornerStyle = '#90cdf4';
        } else if (node.type === 'forge' || node.type === 'fire') {
          fillStyle = 'rgba(221, 107, 32, 0.25)';
          strokeStyle = '#dd6b20';
          cornerStyle = '#fbd38d';
        } else if (node.type === 'farm') {
          fillStyle = 'rgba(72, 187, 120, 0.22)';
          strokeStyle = '#48bb78';
          cornerStyle = '#c6f6d5';
        } else if (node.type === 'boss_arena') {
          fillStyle = 'rgba(159, 122, 234, 0.22)';
          strokeStyle = '#9f7aea';
          cornerStyle = '#d6bcfa';
        }

        ctx.fillStyle = fillStyle;
        ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

        // Corner bracket accents
        ctx.strokeStyle = cornerStyle;
        ctx.lineWidth = 2;
        const c = 5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(px, py + c); ctx.lineTo(px, py); ctx.lineTo(px + c, py);
        // Top-right
        ctx.moveTo(px + TILE_SIZE - c, py); ctx.lineTo(px + TILE_SIZE, py); ctx.lineTo(px + TILE_SIZE, py + c);
        // Bottom-left
        ctx.moveTo(px, py + TILE_SIZE - c); ctx.lineTo(px, py + TILE_SIZE); ctx.lineTo(px + c, py + TILE_SIZE);
        // Bottom-right
        ctx.moveTo(px + TILE_SIZE - c, py + TILE_SIZE); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE - c);
        ctx.stroke();
      }

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
      ctx.strokeStyle = isHovered ? (isHearth ? '#ffe680' : '#d4af37') : (isHearth ? '#dfa637' : '#5a4522');
      ctx.lineWidth = (isHovered || isHearth) ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHearth ? '#ffd466' : (isHovered ? '#fff4cc' : '#f3e8cb');
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

  private getPlayerCombatStyle(player: PlayerData): 'melee' | 'ranged' | 'magic' {
    if (player.equipment?.weapon) {
      const def = ITEMS[player.equipment.weapon.itemId];
      if (def?.equipReq?.skill === 'ranged' || def?.id.includes('bow')) return 'ranged';
      if (def?.equipReq?.skill === 'magic' || def?.id.includes('staff') || def?.id.includes('wand')) return 'magic';
    }
    return 'melee';
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
    equipment?: Partial<Record<EquipSlot, InventorySlot>>,
    playerId?: string
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
      const drawX = Math.round(px - TILE_SIZE / 2 + offX);
      const drawY = Math.round(py - TILE_SIZE / 2 + offY);
      if (rotation !== undefined && rotation !== 0) {
        ctx.translate(Math.round(px + offX), Math.round(py + offY));
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
          drawX,
          drawY,
          TILE_SIZE,
          TILE_SIZE
        );
      }
      ctx.restore();
    };

    const isMounted = Boolean(equipment && equipment.steed);

    if (isMounted) {
      // === MOUNTED GALLOPING ON STEED ===
      const gallopBob = Math.round(isMoving ? Math.sin(this.animTick * 0.02) * 2 : 0);

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

      // 2. Base Body (bald, unclothed mannequin)
      drawLayer(getSprite('base_male'), -1, riderY);

      // 3. Leg Armor (only if equipped)
      const legCoord = getSprite(equipment?.legs?.itemId);
      if (legCoord) drawLayer(legCoord, -1, riderY);

      // 4. Body Armor (only if equipped)
      const bodyCoord = getSprite(equipment?.body?.itemId);
      if (bodyCoord) drawLayer(bodyCoord, -1, riderY);

      // 5. Helmet / Hair
      const helmCoord = getSprite(equipment?.helmet?.itemId);
      if (helmCoord) {
        drawLayer(helmCoord, -1, riderY);
      } else {
        const hairCoord = getSprite(equipment?.hair?.itemId);
        if (hairCoord) drawLayer(hairCoord, -1, riderY);
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
      const rawBob = isMoving ? Math.sin(this.animTick * 0.015) * 1.5 : Math.sin(this.animTick * 0.003) * 1.5;
      const breatheBob = Math.round(rawBob);

      // Ground shadow under player
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(px, py + 12, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1. Base Body (bald, unclothed mannequin)
      drawLayer(getSprite('base_male'), 0, breatheBob);

      // 2. Leg Armor (only if equipped)
      const legCoord = getSprite(equipment?.legs?.itemId);
      if (legCoord) drawLayer(legCoord, 0, breatheBob);

      // 3. Body Armor (only if equipped)
      const bodyCoord = getSprite(equipment?.body?.itemId);
      if (bodyCoord) drawLayer(bodyCoord, 0, breatheBob);

      // 4. Helmet / Hair
      const helmCoord = getSprite(equipment?.helmet?.itemId);
      if (helmCoord) {
        drawLayer(helmCoord, 0, breatheBob);
      } else {
        const hairCoord = getSprite(equipment?.hair?.itemId);
        if (hairCoord) drawLayer(hairCoord, 0, breatheBob);
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
        } else if (taskSkill === 'melee' || taskSkill === 'ranged' || taskSkill === 'magic') {
          const weapon = equipment?.weapon;
          const weaponId = weapon?.itemId || '';
          const isBow = taskSkill === 'ranged' || weaponId.includes('bow');
          const isStaff = taskSkill === 'magic' || weaponId.includes('staff') || weaponId.includes('wand');

          // Attack animation strictly plays only during active attack swings!
          const now = performance.now();
          const attack = playerId ? this.playerAttackAnims.get(playerId) : null;
          const isAttacking = Boolean(attack && (now - attack.startTime < attack.duration));
          const progress = isAttacking ? Math.min(1, Math.max(0, (now - attack!.startTime) / attack!.duration)) : 0;

          if (isBow) {
            // Ranged Bow: Held ready between attacks; draws string back and snaps forward only when attacking!
            const weaponCoord = getSprite(weapon?.itemId) || getSprite('ashwood_shortbow');
            let drawAngle = -0.05;
            let drawX = 0;
            if (isAttacking) {
              if (progress < 0.6) {
                // Draw bow back
                const p = progress / 0.6;
                drawAngle = -0.05 - p * 0.28;
                drawX = -Math.round(p * 2);
              } else if (progress < 0.8) {
                // Snap release forward
                const p = (progress - 0.6) / 0.2;
                drawAngle = -0.33 + p * 0.35;
                drawX = 1 - Math.round(p * 1);
              } else {
                // Return to rest
                drawAngle = -0.05;
                drawX = 0;
              }
            }
            if (weaponCoord) {
              drawLayer(weaponCoord, drawX, breatheBob, drawAngle);
            }
          } else if (isStaff) {
            // Magic Staff: Held upright; raises overhead and casts forward burst only when attacking!
            const weaponCoord = getSprite(weapon?.itemId) || getSprite('ashwood_staff');
            let castTilt = -0.08;
            let castY = breatheBob;
            let castX = 0;
            if (isAttacking) {
              if (progress < 0.45) {
                // Raise high overhead to gather arcane energy
                const p = progress / 0.45;
                castTilt = -0.08 - p * 0.32;
                castY = breatheBob - Math.round(p * 3);
              } else if (progress < 0.75) {
                // Thrust forward to project magic bolt
                const p = (progress - 0.45) / 0.3;
                castTilt = -0.40 + p * 0.52;
                castY = breatheBob - 3 + Math.round(p * 3);
                castX = Math.round(p * 2);
              } else {
                // Settle back to neutral
                const p = (progress - 0.75) / 0.25;
                castTilt = 0.12 - p * 0.20;
                castY = breatheBob;
                castX = Math.round((1 - p) * 2);
              }
            }
            if (weaponCoord) {
              drawLayer(weaponCoord, castX, castY, castTilt);
            }
          } else {
            // Melee Blade: Held at ready side guard; winds up and executes power slash strike only when attacking!
            const weaponCoord = getSprite(weapon?.itemId) || getSprite('blade_iron');
            let slashAngle = -0.15;
            let slashX = 0;
            if (isAttacking) {
              if (progress < 0.25) {
                // Wind-up: pull back
                const p = progress / 0.25;
                slashAngle = -0.15 - p * 0.35;
                slashX = -Math.round(p * 1);
              } else if (progress < 0.65) {
                // Power slash strike across target
                const p = (progress - 0.25) / 0.4;
                slashAngle = -0.50 + p * 1.25;
                slashX = Math.round((p - 0.5) * 3);
              } else {
                // Return to ready guard
                const p = (progress - 0.65) / 0.35;
                slashAngle = 0.75 - p * 0.90;
                slashX = 0;
              }
            }
            if (weaponCoord) {
              drawLayer(weaponCoord, slashX, breatheBob, slashAngle);
            }
          }
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
