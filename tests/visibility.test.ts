import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { castLightRays } from '../src/core/visibility';
import { createGrid, isWalkableTile, tileAt, tileCenter, tileIndex } from '../src/core/grid';
import { TILE_SIZE } from '../src/core/config';
import { distance } from '../src/core/vec';
import type { Grid } from '../src/core/types';

describe('light occlusion (R15.1)', () => {
  it('reaches the full radius in every direction in an open area', () => {
    const grid = createGrid(40, 40, true);
    const origin = tileCenter({ col: 20, row: 20 });
    const rays = castLightRays(grid, origin, 200, 72);
    for (const ray of rays) {
      expect(ray.blocked).toBe(false);
      expect(distance(ray.end, origin)).toBeCloseTo(200, 6);
    }
  });

  it('stops at the far side of the first wall, so the wall itself stays lit', () => {
    const grid = createGrid(30, 20, true);
    for (let row = 0; row < 20; row++) grid.walkable[tileIndex(grid, { col: 12, row })] = false;
    const origin = tileCenter({ col: 8, row: 10 });
    const [east] = castLightRays(grid, origin, 400, 4);
    expect(east.blocked).toBe(true);
    expect(east.end.x).toBeCloseTo(13 * TILE_SIZE, 6);
    expect(east.end.y).toBeCloseTo(origin.y, 6);
  });

  it('casts no light from inside a wall', () => {
    const grid = createGrid(10, 10, true);
    grid.walkable[tileIndex(grid, { col: 5, row: 5 })] = false;
    const origin = tileCenter({ col: 5, row: 5 });
    expect(castLightRays(grid, origin, 100, 8).every((r) => r.blocked && distance(r.end, origin) === 0)).toBe(true);
  });

  it('never lets light pass through more than one wall tile, and never past the radius', () => {
    const gridArb = fc
      .array(fc.boolean(), { minLength: 16 * 16, maxLength: 16 * 16 })
      .map((cells): Grid => ({ cols: 16, rows: 16, walkable: cells.map((wall) => !wall) }));
    fc.assert(
      fc.property(
        gridArb,
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 15 }),
        fc.double({ min: 40, max: 300, noNaN: true }),
        (grid, col, row, radius) => {
          grid.walkable[tileIndex(grid, { col, row })] = true;
          const origin = tileCenter({ col, row });
          return castLightRays(grid, origin, radius, 48).every((ray) => {
            const length = distance(ray.end, origin);
            if (length > radius + 1e-6) return false;
            if (!ray.blocked && Math.abs(length - radius) > 1e-6) return false;
            // Walk the lit segment. Stop just short of the end, which sits on the exit edge of the wall.
            const walls = new Set<number>();
            const steps = Math.ceil(length);
            for (let i = 0; i < steps; i++) {
              const t = (i / steps) * (1 - 1e-6);
              const tile = tileAt({ x: origin.x + (ray.end.x - origin.x) * t, y: origin.y + (ray.end.y - origin.y) * t });
              if (!isWalkableTile(grid, tile)) walls.add(tile.row * grid.cols + tile.col);
            }
            return walls.size <= 1;
          });
        },
      ),
      { numRuns: 150 },
    );
  });
});
