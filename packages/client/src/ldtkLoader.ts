export interface BakedLevel {
  identifier: string;
  worldX: number;
  worldY: number;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  canvas: HTMLCanvasElement;
  isFarOff: boolean;
}

export interface StitchedWorld {
  tileSize: number;
  levels: BakedLevel[];
  tilesetImage: HTMLImageElement;
  minTileX: number;
  maxTileX: number;
  minTileY: number;
  maxTileY: number;
  widthTiles: number;
  heightTiles: number;
  overworldCanvas: HTMLCanvasElement;
}

import { ANCHOR_WORLD_X, ANCHOR_WORLD_Y } from '@eldoria/shared';
export { ANCHOR_WORLD_X, ANCHOR_WORLD_Y };

export async function loadLdtkWorld(): Promise<StitchedWorld | null> {
  try {
    const res = await fetch('/maps/world.ldtk');
    if (!res.ok) {
      console.warn('Could not fetch /maps/world.ldtk');
      return null;
    }
    const ldtkData = await res.json();

    // Load tileset image
    const tilesetImg = new Image();
    tilesetImg.src = '/maps/tilemap_packed-export.png';
    await new Promise((resolve, reject) => {
      tilesetImg.onload = resolve;
      tilesetImg.onerror = reject;
    });

    const bakedLevels: BakedLevel[] = [];

    for (const level of ldtkData.levels || []) {
      const tileX = Math.floor((level.worldX - ANCHOR_WORLD_X) / 16);
      const tileY = Math.floor((level.worldY - ANCHOR_WORLD_Y) / 16);
      const widthTiles = Math.floor((level.pxWid || 256) / 16);
      const heightTiles = Math.floor((level.pxHei || 256) / 16);
      const isFarOff = Math.abs(tileX) > 100 || Math.abs(tileY) > 100;

      const lvlCanvas = document.createElement('canvas');
      lvlCanvas.width = widthTiles * 32;
      lvlCanvas.height = heightTiles * 32;
      const lctx = lvlCanvas.getContext('2d')!;
      lctx.imageSmoothingEnabled = false;

      // Base background under-layer
      lctx.fillStyle = '#1e3020';
      lctx.fillRect(0, 0, lvlCanvas.width, lvlCanvas.height);

      // Render layers from bottom to top
      const layers = (level.layerInstances || []).slice().reverse();
      for (const layer of layers) {
        if (!layer.gridTiles || layer.gridTiles.length === 0) continue;
        const gridSize = layer.__gridSize || 16;
        for (const tile of layer.gridTiles) {
          const localTileX = Math.floor(tile.px[0] / gridSize);
          const localTileY = Math.floor(tile.px[1] / gridSize);
          const destPx = localTileX * 32;
          const destPy = localTileY * 32;

          if (tile.f) {
            lctx.save();
            lctx.translate(destPx + 16, destPy + 16);
            lctx.scale((tile.f & 1) ? -1 : 1, (tile.f & 2) ? -1 : 1);
            lctx.drawImage(
              tilesetImg,
              tile.src[0], tile.src[1], gridSize, gridSize,
              -16, -16, 32 + 0.5, 32 + 0.5
            );
            lctx.restore();
          } else {
            lctx.drawImage(
              tilesetImg,
              tile.src[0], tile.src[1], gridSize, gridSize,
              destPx, destPy, 32 + 0.5, 32 + 0.5
            );
          }
        }
      }

      bakedLevels.push({
        identifier: level.identifier,
        worldX: level.worldX,
        worldY: level.worldY,
        tileX,
        tileY,
        widthTiles,
        heightTiles,
        canvas: lvlCanvas,
        isFarOff,
      });
    }

    // Determine contiguous overworld cluster bounds
    const overworldLevels = bakedLevels.filter(l => !l.isFarOff);
    const pool = overworldLevels.length > 0 ? overworldLevels : bakedLevels;

    let minTileX = Infinity;
    let maxTileX = -Infinity;
    let minTileY = Infinity;
    let maxTileY = -Infinity;

    for (const l of pool) {
      if (l.tileX < minTileX) minTileX = l.tileX;
      if (l.tileX + l.widthTiles > maxTileX) maxTileX = l.tileX + l.widthTiles;
      if (l.tileY < minTileY) minTileY = l.tileY;
      if (l.tileY + l.heightTiles > maxTileY) maxTileY = l.tileY + l.heightTiles;
    }

    if (minTileX === Infinity) {
      minTileX = 0; maxTileX = 32; minTileY = 0; maxTileY = 48;
    }

    // Create stitched overworld preview canvas for the world map modal
    const overworldCanvas = document.createElement('canvas');
    overworldCanvas.width = Math.max(32, (maxTileX - minTileX) * 32);
    overworldCanvas.height = Math.max(32, (maxTileY - minTileY) * 32);
    const octx = overworldCanvas.getContext('2d')!;
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = '#1e3020';
    octx.fillRect(0, 0, overworldCanvas.width, overworldCanvas.height);

    for (const lvl of pool) {
      octx.drawImage(
        lvl.canvas,
        (lvl.tileX - minTileX) * 32,
        (lvl.tileY - minTileY) * 32,
        lvl.widthTiles * 32 + 0.5,
        lvl.heightTiles * 32 + 0.5
      );
    }

    console.log(`[LDtk World] Dynamic LDtk World loaded! ${bakedLevels.length} levels baked. Overworld bounds: (${minTileX}, ${minTileY}) to (${maxTileX}, ${maxTileY}) [${maxTileX - minTileX}x${maxTileY - minTileY} tiles].`);

    return {
      tileSize: 32,
      levels: bakedLevels,
      tilesetImage: tilesetImg,
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
      widthTiles: maxTileX - minTileX,
      heightTiles: maxTileY - minTileY,
      overworldCanvas,
    };
  } catch (err) {
    console.error('Failed to load LDtk world', err);
    return null;
  }
}
