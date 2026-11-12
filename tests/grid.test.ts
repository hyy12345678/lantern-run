import { describe, expect, it } from 'vitest';
import { createGrid, distanceMap, findPath, moveWithCollision, tileCenter, tileIndex } from '../src/core/grid';
import { PLAYER_RADIUS, TILE_SIZE } from '../src/core/config';
import type { Grid } from '../src/core/types';

function wallColumn(cols: number, rows: number, wallCol: number): Grid {
  const grid = createGrid(cols, rows, true);
  for (let row = 0; row < rows; row++) {
    grid.walkable[tileIndex(grid, { col: wallCol, row })] = false;
  }
  return grid;
}

describe('grid', () => {
  it('finds a shortest path on an open grid', () => {
    const grid = createGrid(10, 10, true);
    const path = findPath(grid, { col: 0, row: 0 }, { col: 3, row: 4 });
    expect(path).not.toBeNull();
    expect(path).toHaveLength(3 + 4 + 1);
    expect(path?.[0]).toEqual({ col: 0, row: 0 });
    expect(path?.[path.length - 1]).toEqual({ col: 3, row: 4 });
  });

  it('returns null when a wall separates start and goal', () => {
    const grid = wallColumn(5, 1, 2);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 4, row: 0 })).toBeNull();
  });

  it('marks unreachable tiles with -1 in the distance map', () => {
    const grid = wallColumn(5, 1, 2);
    const dist = distanceMap(grid, { col: 0, row: 0 });
    expect(dist[tileIndex(grid, { col: 1, row: 0 })]).toBe(1);
    expect(dist[tileIndex(grid, { col: 4, row: 0 })]).toBe(-1);
  });

  it('stops a moving circle at a wall without overlapping it', () => {
    const grid = wallColumn(10, 10, 5);
    const start = tileCenter({ col: 4, row: 5 });
    const end = moveWithCollision(grid, start, { x: 100, y: 0 }, PLAYER_RADIUS);
    // Wall tile starts at x = 5 * TILE_SIZE. The circle's right edge must stay left of it.
    expect(end.x + PLAYER_RADIUS).toBeLessThan(5 * TILE_SIZE);
    expect(end.x).toBeGreaterThanOrEqual(start.x);
  });

  it('slides along a wall when only one axis is blocked', () => {
    const grid = wallColumn(10, 10, 5);
    const start = tileCenter({ col: 4, row: 5 });
    const end = moveWithCollision(grid, start, { x: 100, y: 10 }, PLAYER_RADIUS);
    expect(end.y).toBeGreaterThan(start.y);
  });
});
