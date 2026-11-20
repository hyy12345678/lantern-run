import { TILE_SIZE } from './config';
import { isWalkableTile } from './grid';
import type { Grid, Tile, Vec2 } from './types';

export interface LightRay {
  /** Where the light along this ray stops. */
  end: Vec2;
  /** True when a wall stopped the ray before it reached the full radius. */
  blocked: boolean;
}

/**
 * Casts `rayCount` rays evenly around `origin` and returns where the light along each one ends.
 * Ray i points at angle `i / rayCount * 2π`.
 */
export function castLightRays(grid: Grid, origin: Vec2, radius: number, rayCount: number): LightRay[] {
  const rays: LightRay[] = [];
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    rays.push(castRay(grid, origin, { x: Math.cos(angle), y: Math.sin(angle) }, radius));
  }
  return rays;
}

/**
 * Follows one ray through the grid with a tile-by-tile traversal (DDA), so no wall tile is skipped.
 * The ray stops at the far side of the first wall tile it enters: that wall stays lit, and
 * everything behind it is in shadow. `dir` must be a unit vector.
 */
export function castRay(grid: Grid, origin: Vec2, dir: Vec2, maxDist: number): LightRay {
  const at = (t: number): Vec2 => ({ x: origin.x + dir.x * t, y: origin.y + dir.y * t });
  const tile: Tile = { col: Math.floor(origin.x / TILE_SIZE), row: Math.floor(origin.y / TILE_SIZE) };
  if (!isWalkableTile(grid, tile)) return { end: { ...origin }, blocked: true };

  const stepCol = dir.x > 0 ? 1 : -1;
  const stepRow = dir.y > 0 ? 1 : -1;
  const boundaryX = (dir.x > 0 ? tile.col + 1 : tile.col) * TILE_SIZE;
  const boundaryY = (dir.y > 0 ? tile.row + 1 : tile.row) * TILE_SIZE;
  // Distance along the ray to the next vertical and horizontal grid line, and between grid lines.
  let tMaxX = dir.x !== 0 ? (boundaryX - origin.x) / dir.x : Infinity;
  let tMaxY = dir.y !== 0 ? (boundaryY - origin.y) / dir.y : Infinity;
  const tDeltaX = dir.x !== 0 ? TILE_SIZE / Math.abs(dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? TILE_SIZE / Math.abs(dir.y) : Infinity;

  for (;;) {
    let t: number;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      tile.col += stepCol;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      tile.row += stepRow;
    }
    if (t >= maxDist) return { end: at(maxDist), blocked: false };
    if (!isWalkableTile(grid, tile)) {
      const exit = Math.min(tMaxX, tMaxY);
      return exit < maxDist ? { end: at(exit), blocked: true } : { end: at(maxDist), blocked: false };
    }
  }
}
