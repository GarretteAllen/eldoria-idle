export interface LevelBounds {
  identifier: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
}

export const ANCHOR_WORLD_X = 0;
export const ANCHOR_WORLD_Y = -256;

export function parseLdtkLevelBounds(
  ldtkLevels: any[],
  anchorX: number = ANCHOR_WORLD_X,
  anchorY: number = ANCHOR_WORLD_Y
): LevelBounds[] {
  return (ldtkLevels || []).map(lvl => ({
    identifier: lvl.identifier,
    tileX: Math.floor((lvl.worldX - anchorX) / 16),
    tileY: Math.floor((lvl.worldY - anchorY) / 16),
    widthTiles: Math.floor((lvl.pxWid || 256) / 16),
    heightTiles: Math.floor((lvl.pxHei || 256) / 16),
  }));
}

export function isTileInAnyLevel(
  x: number,
  y: number,
  levels: Array<{ tileX: number; tileY: number; widthTiles: number; heightTiles: number }>
): boolean {
  for (const lvl of levels) {
    if (
      x >= lvl.tileX &&
      x < lvl.tileX + lvl.widthTiles &&
      y >= lvl.tileY &&
      y < lvl.tileY + lvl.heightTiles
    ) {
      return true;
    }
  }
  return false;
}
