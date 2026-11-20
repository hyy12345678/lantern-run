import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  BOSS_MIN_TILE_DIST,
  CANDY_SPARE_COUNT,
  ROOM_CANDY_GOALS,
  ROOM_GHOST_COUNTS,
  TILE_SIZE,
  WALL_SEGMENT_MAX,
} from '../src/core/config';
import { generateRoom } from '../src/core/room';
import { distanceMap, findPath, isWalkablePoint, tileAt, tileIndex } from '../src/core/grid';
import { TRIAL_THEMES, BOSS_THEME } from '../src/core/themes';
import type { RoomLayout, Tile } from '../src/core/types';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const roomArb = fc.constantFrom<1 | 2 | 3 | 4>(1, 2, 3, 4);

function startTile(layout: RoomLayout) {
  return tileAt(layout.start);
}

function interiorWalls(room: RoomLayout): Tile[] {
  const walls: Tile[] = [];
  const { grid } = room;
  for (let row = 1; row < grid.rows - 1; row++) {
    for (let col = 1; col < grid.cols - 1; col++) {
      if (!grid.walkable[tileIndex(grid, { col, row })]) walls.push({ col, row });
    }
  }
  return walls;
}

/** Groups interior walls into pieces that touch, including diagonally. */
function wallPieces(room: RoomLayout): Tile[][] {
  const walls = interiorWalls(room);
  const key = (t: Tile): string => `${t.col},${t.row}`;
  const remaining = new Map(walls.map((t) => [key(t), t]));
  const pieces: Tile[][] = [];
  for (const wall of walls) {
    if (!remaining.has(key(wall))) continue;
    const piece: Tile[] = [];
    const stack = [wall];
    remaining.delete(key(wall));
    while (stack.length > 0) {
      const t = stack.pop() as Tile;
      piece.push(t);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const near = remaining.get(key({ col: t.col + dc, row: t.row + dr }));
          if (near) {
            remaining.delete(key(near));
            stack.push(near);
          }
        }
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

describe('room layout (R7.7)', () => {
  it('keeps every walkable tile reachable from the start', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        const dist = distanceMap(room.grid, startTile(room));
        return room.grid.walkable.every((walkable, i) => !walkable || dist[i] >= 0);
      }),
      { numRuns: 60 },
    );
  });

  it('builds interior walls from straight pieces that never touch the border or each other', () => {
    fc.assert(
      fc.property(roomArb, seedArb, (roomIndex, seed) => {
        const room = generateRoom(roomIndex, seed);
        const { cols, rows } = room.grid;
        return wallPieces(room).every((piece) => {
          const sameRow = piece.every((t) => t.row === piece[0].row);
          const sameCol = piece.every((t) => t.col === piece[0].col);
          const offBorder = piece.every((t) => t.col >= 2 && t.row >= 2 && t.col <= cols - 3 && t.row <= rows - 3);
          return (sameRow || sameCol) && piece.length <= WALL_SEGMENT_MAX && offBorder;
        });
      }),
      { numRuns: 60 },
    );
  });

  it('gives the boss room fewer walls than a trial room on average', () => {
    let boss = 0;
    let trial = 0;
    for (let seed = 1; seed <= 40; seed++) {
      boss += interiorWalls(generateRoom(4, seed)).length;
      trial += interiorWalls(generateRoom(2, seed)).length;
    }
    expect(boss).toBeLessThan(trial);
  });
});

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
