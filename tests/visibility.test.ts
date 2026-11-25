import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { castRay, castVisibilityRays } from '../src/core/visibility';
import type { LightRay } from '../src/core/visibility';
import { createGrid, isWalkableTile, tileAt, tileCenter, tileIndex } from '../src/core/grid';
import { TILE_SIZE } from '../src/core/config';
import { distance } from '../src/core/vec';
import type { Grid, Vec2 } from '../src/core/types';

const SIZE = 16;
const TAU = Math.PI * 2;

/** A 16 x 16 grid of random walls with a closed wall border. */
const walledGridArb = fc
  .array(fc.boolean(), { minLength: SIZE * SIZE, maxLength: SIZE * SIZE })
  .map((cells): Grid => {
    const walkable = cells.map((wall) => !wall);
    for (let i = 0; i < SIZE; i++) {
      walkable[i] = false;
      walkable[(SIZE - 1) * SIZE + i] = false;
      walkable[i * SIZE] = false;
      walkable[i * SIZE + SIZE - 1] = false;
    }
    return { cols: SIZE, rows: SIZE, walkable };
  });

/** A point anywhere inside an inner tile (not only its centre), which is made walkable. */
const originArb = fc.record({
  col: fc.integer({ min: 1, max: SIZE - 2 }),
  row: fc.integer({ min: 1, max: SIZE - 2 }),
  fx: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
  fy: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
});

function placeOrigin(grid: Grid, o: { col: number; row: number; fx: number; fy: number }): Vec2 {
  grid.walkable[tileIndex(grid, o)] = true;
  return { x: (o.col + o.fx) * TILE_SIZE, y: (o.row + o.fy) * TILE_SIZE };
}

const angleOf = (origin: Vec2, p: Vec2): number => {
  const a = Math.atan2(p.y - origin.y, p.x - origin.x);
  return ((a % TAU) + TAU) % TAU;
};

describe('light occlusion (R15.1)', () => {
  it('reaches the full radius in every direction in an open area', () => {
    const grid = createGrid(40, 40, true);
    const origin = tileCenter({ col: 20, row: 20 });
    const rays = castVisibilityRays(grid, origin, 200, 72);
    expect(rays).toHaveLength(72);
    for (const ray of rays) {
      expect(ray.blocked).toBe(false);
      expect(distance(ray.end, origin)).toBeCloseTo(200, 6);
    }
  });

  it('stops at the face of the first wall and reports that wall, so the wall can stay lit', () => {
    const grid = createGrid(30, 20, true);
    for (let row = 0; row < 20; row++) grid.walkable[tileIndex(grid, { col: 12, row })] = false;
    const origin = tileCenter({ col: 8, row: 10 });
    const east = castRay(grid, origin, { x: 1, y: 0 }, 400);
    expect(east.blocked).toBe(true);
    expect(east.end.x).toBeCloseTo(12 * TILE_SIZE, 6);
    expect(east.end.y).toBeCloseTo(origin.y, 6);
    expect(east.wall).toEqual({ col: 12, row: 10 });
  });

  it('casts no light from inside a wall', () => {
    const grid = createGrid(10, 10, true);
    grid.walkable[tileIndex(grid, { col: 5, row: 5 })] = false;
    const origin = tileCenter({ col: 5, row: 5 });
    expect(castVisibilityRays(grid, origin, 100, 8).every((r) => r.blocked && distance(r.end, origin) === 0)).toBe(true);
  });

  it('returns rays sorted by angle, never past the radius, crossing only open tiles', () => {
    fc.assert(
      fc.property(walledGridArb, originArb, fc.double({ min: 40, max: 300, noNaN: true }), (grid, o, radius) => {
        const origin = placeOrigin(grid, o);
        const rays = castVisibilityRays(grid, origin, radius, 48);
        const angles = rays.map((r) => angleOf(origin, r.end));
        for (let i = 1; i < angles.length; i++) if (angles[i] < angles[i - 1] - 1e-9) return false;
        return rays.every((ray: LightRay) => {
          const length = distance(ray.end, origin);
          if (length > radius + 1e-6) return false;
          if (!ray.blocked && Math.abs(length - radius) > 1e-6) return false;
          if (ray.blocked && (!ray.wall || isWalkableTile(grid, ray.wall))) return false;
          // Everything before the end is open floor.
          const steps = Math.ceil(length);
          for (let i = 0; i < steps; i++) {
            const t = (i / steps) * (1 - 1e-6);
            const tile = tileAt({ x: origin.x + (ray.end.x - origin.x) * t, y: origin.y + (ray.end.y - origin.y) * t });
            if (!isWalkableTile(grid, tile)) return false;
          }
          return true;
        });
      }),
      { numRuns: 150 },
    );
  });

  it('outlines the lit area exactly: any ray ends on the line between its two neighbouring rays', () => {
    fc.assert(
      fc.property(
        walledGridArb,
        originArb,
        fc.array(fc.double({ min: 0, max: TAU, maxExcluded: true, noNaN: true }), { minLength: 1, maxLength: 20 }),
        (grid, o, probes) => {
          const origin = placeOrigin(grid, o);
          // The radius reaches past the border, so every ray ends on a wall face and none on the circle.
          const radius = SIZE * TILE_SIZE * 2;
          const rays = castVisibilityRays(grid, origin, radius, 8);
          const angles = rays.map((r) => angleOf(origin, r.end));
          return probes.every((theta) => {
            let i = angles.length - 1;
            for (let k = 0; k < angles.length; k++) if (angles[k] <= theta) i = k;
            const j = (i + 1) % angles.length;
            const gap = (((angles[j] - angles[i]) % TAU) + TAU) % TAU;
            // The two rays of a corner pair are 2e-4 rad apart and sit on different faces. Skip probes between them.
            if (gap < 3e-4) return true;
            const a = rays[i].end;
            const b = rays[j].end;
            const p = castRay(grid, origin, { x: Math.cos(theta), y: Math.sin(theta) }, radius).end;
            const abx = b.x - a.x;
            const aby = b.y - a.y;
            const len = Math.hypot(abx, aby);
            if (len < 1e-9) return distance(p, a) < 1e-3;
            const offLine = Math.abs(abx * (p.y - a.y) - aby * (p.x - a.x)) / len;
            return offLine < 1e-3;
          });
        },
      ),
      { numRuns: 150 },
    );
  });
});
