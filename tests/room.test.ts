import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  BOSS_MIN_TILE_DIST,
  CANDY_SPARE_COUNT,
  ROOM_CANDY_GOALS,
  ROOM_GHOST_COUNTS,
  TILE_SIZE,
} from '../src/core/config';
import { generateRoom } from '../src/core/room';
import { findPath, isWalkablePoint, tileAt } from '../src/core/grid';
import { TRIAL_THEMES, BOSS_THEME } from '../src/core/themes';
import type { RoomLayout } from '../src/core/types';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const roomArb = fc.constantFrom<1 | 2 | 3 | 4>(1, 2, 3, 4);

function startTile(layout: RoomLayout) {
  return tileAt(layout.start);
}

describe('room generation', () => {
  it('is deterministic for the same room index and seed', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        expect(generateRoom(roomIndex, seed)).toEqual(generateRoom(roomIndex, seed));
      }),
      { numRuns: 50 },
    );
  });

  it('always has a path from start to door', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        return findPath(room.grid, startTile(room), room.doorTile) !== null;
      }),
      { numRuns: 50 },
    );
  });

  it('places the configured candy goal plus spares, all reachable', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        const goal = ROOM_CANDY_GOALS[roomIndex - 1];
        return (
          room.candyGoal === goal &&
          room.candies.length === goal + CANDY_SPARE_COUNT &&
          room.candies.every(
            (c) => isWalkablePoint(room.grid, c) && findPath(room.grid, startTile(room), tileAt(c)) !== null,
          )
        );
      }),
      { numRuns: 50 },
    );
  });

  it('places the configured number of regular ghosts on walkable tiles', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        return (
          room.ghosts.length === ROOM_GHOST_COUNTS[roomIndex - 1] &&
          room.ghosts.every((g) => isWalkablePoint(room.grid, g.pos))
        );
      }),
      { numRuns: 50 },
    );
  });

  it('gives each patrol ghost a closed loop of adjacent walkable tile centers', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        return room.ghosts
          .filter((g) => g.kind === 'patrol')
          .every((g) => {
            const pts = g.path;
            if (pts.length < 2) return false;
            return pts.every((p, i) => {
              const next = pts[(i + 1) % pts.length];
              const steps = Math.abs(p.x - next.x) + Math.abs(p.y - next.y);
              return isWalkablePoint(room.grid, p) && Math.abs(steps - TILE_SIZE) < 1e-9;
            });
          });
      }),
      { numRuns: 50 },
    );
  });

  it('places the Pumpkin King only in the boss room, at least the minimum distance from start', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const bossRoom = generateRoom(4, seed);
        const trialRoom = generateRoom(2, seed);
        if (trialRoom.boss !== null || bossRoom.boss === null) return false;
        if (!isWalkablePoint(bossRoom.grid, bossRoom.boss.pos)) return false;
        const path = findPath(bossRoom.grid, startTile(bossRoom), tileAt(bossRoom.boss.pos));
        return path !== null && path.length - 1 >= BOSS_MIN_TILE_DIST;
      }),
      { numRuns: 50 },
    );
  });

  it('uses a trial theme for rooms 1 to 3 and the crypt for the boss room', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const trial = [1, 2, 3].every((i) => TRIAL_THEMES.includes(generateRoom(i as 1 | 2 | 3, seed).theme));
        return trial && generateRoom(4, seed).theme === BOSS_THEME;
      }),
      { numRuns: 50 },
    );
  });
});
