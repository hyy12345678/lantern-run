import { COLLISION_SUBSTEP_PX, TILE_SIZE } from './config';
import type { Grid, Tile, Vec2 } from './types';

const NEIGHBOR_OFFSETS: readonly Tile[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
];

export function createGrid(cols: number, rows: number, walkable = true): Grid {
  return { cols, rows, walkable: new Array<boolean>(cols * rows).fill(walkable) };
}

export function tileIndex(grid: Grid, tile: Tile): number {
  return tile.row * grid.cols + tile.col;
}

export function inBounds(grid: Grid, tile: Tile): boolean {
  return tile.col >= 0 && tile.row >= 0 && tile.col < grid.cols && tile.row < grid.rows;
}

export function isWalkableTile(grid: Grid, tile: Tile): boolean {
  return inBounds(grid, tile) && grid.walkable[tileIndex(grid, tile)] === true;
}

export function tileAt(p: Vec2): Tile {
  return { col: Math.floor(p.x / TILE_SIZE), row: Math.floor(p.y / TILE_SIZE) };
}

export function tileCenter(tile: Tile): Vec2 {
  return { x: (tile.col + 0.5) * TILE_SIZE, y: (tile.row + 0.5) * TILE_SIZE };
}

export function isWalkablePoint(grid: Grid, p: Vec2): boolean {
  return isWalkableTile(grid, tileAt(p));
}

/** True when a circle of `radius` centered at `p` only touches walkable tiles. */
export function canOccupy(grid: Grid, p: Vec2, radius: number): boolean {
  const corners: readonly Vec2[] = [
    { x: p.x - radius, y: p.y - radius },
    { x: p.x + radius, y: p.y - radius },
    { x: p.x - radius, y: p.y + radius },
    { x: p.x + radius, y: p.y + radius },
  ];
  return corners.every((c) => isWalkablePoint(grid, c));
}

/**
 * Moves a circle by `delta`, one axis at a time, in small sub-steps.
 * An axis that would enter a wall is not applied, so the circle slides along walls
 * and never overlaps them. Sub-steps keep fast moves from skipping over thin obstacles.
 */
export function moveWithCollision(grid: Grid, pos: Vec2, delta: Vec2, radius: number): Vec2 {
  const largest = Math.max(Math.abs(delta.x), Math.abs(delta.y));
  const steps = Math.max(1, Math.ceil(largest / COLLISION_SUBSTEP_PX));
  const stepX = delta.x / steps;
  const stepY = delta.y / steps;
  let p = pos;
  for (let i = 0; i < steps; i++) {
    const nextX = { x: p.x + stepX, y: p.y };
    if (canOccupy(grid, nextX, radius)) p = nextX;
    const nextY = { x: p.x, y: p.y + stepY };
    if (canOccupy(grid, nextY, radius)) p = nextY;
  }
  return p;
}

/** Breadth-first distances (in tiles) from `from`. Unreachable tiles hold -1. */
export function distanceMap(grid: Grid, from: Tile): Int32Array {
  const dist = new Int32Array(grid.cols * grid.rows).fill(-1);
  if (!isWalkableTile(grid, from)) return dist;
  const queue: Tile[] = [from];
  dist[tileIndex(grid, from)] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const offset of NEIGHBOR_OFFSETS) {
      const next = { col: current.col + offset.col, row: current.row + offset.row };
      if (!isWalkableTile(grid, next)) continue;
      const key = tileIndex(grid, next);
      if (dist[key] !== -1) continue;
      dist[key] = dist[tileIndex(grid, current)] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/** Shortest walkable path from `from` to `to`, including both ends. Null when none exists. */
export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  if (!isWalkableTile(grid, from) || !isWalkableTile(grid, to)) return null;
  const prev = new Int32Array(grid.cols * grid.rows).fill(-1);
  const seen = new Uint8Array(grid.cols * grid.rows);
  const queue: Tile[] = [from];
  seen[tileIndex(grid, from)] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.col === to.col && current.row === to.row) {
      const path: Tile[] = [];
      let cursor: Tile | null = current;
      while (cursor !== null) {
        path.unshift(cursor);
        const back: number = prev[tileIndex(grid, cursor)];
        cursor = back === -1 ? null : { col: back % grid.cols, row: Math.floor(back / grid.cols) };
      }
      return path;
    }
    for (const offset of NEIGHBOR_OFFSETS) {
      const next = { col: current.col + offset.col, row: current.row + offset.row };
      if (!isWalkableTile(grid, next)) continue;
      const key = tileIndex(grid, next);
      if (seen[key] === 1) continue;
      seen[key] = 1;
      prev[key] = tileIndex(grid, current);
      queue.push(next);
    }
  }
  return null;
}
