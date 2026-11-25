import { TILE_SIZE } from './config';
import { isWalkableTile } from './grid';
import type { Grid, Tile, Vec2 } from './types';

export interface LightRay {
  /** Where the light along this ray stops: the radius, or the face of the first wall tile it reaches. */
  end: Vec2;
  /** True when a wall stopped the ray before it reached the full radius. */
  blocked: boolean;
  /** The wall tile that stopped the ray. That tile is lit as a whole, so the wall itself stays visible. */
  wall?: Tile;
}

/** Angle offset (radians) for the pair of rays cast just past each side of a wall corner. */
const CORNER_EPSILON = 1e-4;
const TAU = Math.PI * 2;

/**
 * Casts rays aimed at every place where the light outline can turn, and returns them sorted by angle.
 * Joining neighbouring ray ends with straight lines gives the exact lit area (a visibility polygon),
 * so shadow edges are straight lines instead of a sawtooth between evenly spaced samples.
 *
 * Between two neighbouring rays, the light ends either on one straight wall face or on the circle.
 * The outline moves to another face only at a wall corner, or where a wall face crosses the circle,
 * so the rays are:
 * - a pair just to each side of every wall-tile corner inside the radius,
 * - one at each point where a wall-tile edge crosses the circle,
 * - `arcCount` evenly spaced rays, so the circle itself stays round.
 */
export function castVisibilityRays(grid: Grid, origin: Vec2, radius: number, arcCount: number): LightRay[] {
  const angles: number[] = [];
  for (let i = 0; i < arcCount; i++) angles.push((i / arcCount) * TAU);

  const minCol = Math.floor((origin.x - radius) / TILE_SIZE);
  const maxCol = Math.floor((origin.x + radius) / TILE_SIZE);
  const minRow = Math.floor((origin.y - radius) / TILE_SIZE);
  const maxRow = Math.floor((origin.y + radius) / TILE_SIZE);
  const r2 = radius * radius;
  const seenCorners = new Set<string>();
  const addPoint = (x: number, y: number): void => {
    angles.push(Math.atan2(y - origin.y, x - origin.x));
  };

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (isWalkableTile(grid, { col, row })) continue;
      const x0 = col * TILE_SIZE;
      const y0 = row * TILE_SIZE;
      const x1 = x0 + TILE_SIZE;
      const y1 = y0 + TILE_SIZE;
      for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
        const key = `${cx},${cy}`;
        if (seenCorners.has(key)) continue;
        seenCorners.add(key);
        const dx = cx - origin.x;
        const dy = cy - origin.y;
        if (dx * dx + dy * dy > r2) continue;
        const a = Math.atan2(dy, dx);
        angles.push(a - CORNER_EPSILON, a + CORNER_EPSILON);
      }
      // Where each of the four edges crosses the circle.
      for (const x of [x0, x1]) {
        const h = r2 - (x - origin.x) ** 2;
        if (h < 0) continue;
        const s = Math.sqrt(h);
        for (const y of [origin.y - s, origin.y + s]) if (y >= y0 && y <= y1) addPoint(x, y);
      }
      for (const y of [y0, y1]) {
        const h = r2 - (y - origin.y) ** 2;
        if (h < 0) continue;
        const s = Math.sqrt(h);
        for (const x of [origin.x - s, origin.x + s]) if (x >= x0 && x <= x1) addPoint(x, y);
      }
    }
  }

  return angles
    .map((a) => ((a % TAU) + TAU) % TAU)
    .sort((a, b) => a - b)
    .map((a) => castRay(grid, origin, { x: Math.cos(a), y: Math.sin(a) }, radius));
}

/**
 * Follows one ray through the grid with a tile-by-tile traversal (DDA), so no wall tile is skipped.
 * The ray stops where it enters the first wall tile and reports that tile; everything behind the
 * wall's face is in shadow. `dir` must be a unit vector.
 */
export function castRay(grid: Grid, origin: Vec2, dir: Vec2, maxDist: number): LightRay {
  const at = (t: number): Vec2 => ({ x: origin.x + dir.x * t, y: origin.y + dir.y * t });
  const tile: Tile = { col: Math.floor(origin.x / TILE_SIZE), row: Math.floor(origin.y / TILE_SIZE) };
  if (!isWalkableTile(grid, tile)) return { end: { ...origin }, blocked: true, wall: { ...tile } };

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
    if (!isWalkableTile(grid, tile)) return { end: at(t), blocked: true, wall: { ...tile } };
  }
}
