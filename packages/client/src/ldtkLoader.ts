export interface StitchedTile {
  tileX: number; // 0..31
  tileY: number; // 0..47
  srcX: number;
  srcY: number;
  width: number;
  height: number;
  flip: number;
}

export interface StitchedWorld {
  widthTiles: number;
  heightTiles: number;
  tileSize: number;
  tiles: StitchedTile[];
  tilesetImage: HTMLImageElement;
}

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

    const tiles: StitchedTile[] = [];
    const minWorldX = 0;
    const minWorldY = -256; // Level_3 starts at worldY: -256

    for (const level of ldtkData.levels || []) {
      for (const layer of level.layerInstances || []) {
        if (layer.__identifier === 'Outside_Town' || layer.gridTiles?.length > 0) {
          const gridSize = layer.__gridSize || 16;
          for (const tile of layer.gridTiles || []) {
            const worldPxX = level.worldX + tile.px[0] - minWorldX;
            const worldPxY = level.worldY + tile.px[1] - minWorldY;

            const tileX = Math.floor(worldPxX / gridSize);
            const tileY = Math.floor(worldPxY / gridSize);

            tiles.push({
              tileX,
              tileY,
              srcX: tile.src[0],
              srcY: tile.src[1],
              width: gridSize,
              height: gridSize,
              flip: tile.f || 0,
            });
          }
        }
      }
    }

    let maxTileX = 32;
    let maxTileY = 48;
    for (const t of tiles) {
      if (t.tileX + 1 > maxTileX) maxTileX = t.tileX + 1;
      if (t.tileY + 1 > maxTileY) maxTileY = t.tileY + 1;
    }

    console.log(`🗺️ Stitched LDtk World loaded! Total tiles: ${tiles.length} (${maxTileX}x${maxTileY}) from 4 levels.`);

    return {
      widthTiles: maxTileX,
      heightTiles: maxTileY,
      tileSize: 32, // Display size (scaled 2x from 16 for clean pixel art)
      tiles,
      tilesetImage: tilesetImg,
    };
  } catch (err) {
    console.error('Failed to load LDtk world', err);
    return null;
  }
}
