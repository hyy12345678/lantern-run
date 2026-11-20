import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { bossTouchesPlayer, createBoss, stepBoss } from '../src/core/boss';
import { createGrid, isWalkablePoint, tileCenter, tileIndex } from '../src/core/grid';
import { generateRoom } from '../src/core/room';
import {
  BOSS_CHASE_SEC,
  BOSS_CONTACT_RADIUS,
  BOSS_DASH_SEC,
  BOSS_DASH_SPEED,
  BOSS_SPEED,
  BOSS_WINDUP_SEC,
} from '../src/core/config';
import type { Boss } from '../src/core/types';

const OPEN = createGrid(40, 40, true);
const DT = 1 / 60;

/** Steps the boss for `seconds` with the player standing still. */
function run(boss: Boss, player: { x: number; y: number }, seconds: number, grid = OPEN): Boss {
  let b = boss;
  for (let t = 0; t < seconds - 1e-9; t += DT) b = stepBoss(b, player, grid, DT);
  return b;
}

describe('Pumpkin King', () => {
  it('starts chasing and moves toward the player at its chase speed', () => {
    const boss = createBoss({ x: 200, y: 200 });
    const player = { x: 600, y: 200 };
    const after = stepBoss(boss, player, OPEN, 0.5);
    expect(after.phase).toBe('chase');
    expect(after.pos.x - boss.pos.x).toBeCloseTo(BOSS_SPEED * 0.5, 5);
  });

  it('winds up after the chase time and locks the dash direction toward the player', () => {
    const boss = createBoss({ x: 200, y: 200 });
    const player = { x: 200, y: 900 };
    const windup = run(boss, player, BOSS_CHASE_SEC + DT);
    expect(windup.phase).toBe('windup');
    expect(windup.dashDir.x).toBeCloseTo(0, 5);
    expect(windup.dashDir.y).toBeCloseTo(1, 5);
  });

  it('does not move during the wind-up, even if the player moves (R10.5)', () => {
    const boss: Boss = { ...createBoss({ x: 300, y: 300 }), phase: 'windup', phaseTimer: BOSS_WINDUP_SEC, dashDir: { x: 1, y: 0 } };
    fc.assert(
      fc.property(fc.double({ min: 0, max: BOSS_WINDUP_SEC * 0.9, noNaN: true }), fc.integer({ min: 0, max: 1200 }), (dt, px) => {
        const after = stepBoss(boss, { x: px, y: 50 }, OPEN, dt);
        return after.pos.x === boss.pos.x && after.pos.y === boss.pos.y && after.dashDir === boss.dashDir;
      }),
    );
  });

  it('dashes along the locked direction at dash speed, then returns to chasing', () => {
    const boss: Boss = { ...createBoss({ x: 300, y: 300 }), phase: 'dash', phaseTimer: BOSS_DASH_SEC, dashDir: { x: 1, y: 0 } };
    // The player is somewhere else entirely. The dash must ignore them.
    const player = { x: 300, y: 1000 };
    const moved = stepBoss(boss, player, OPEN, 0.1);
    expect(moved.pos.x - boss.pos.x).toBeCloseTo(BOSS_DASH_SPEED * 0.1, 3);
    expect(moved.pos.y).toBeCloseTo(boss.pos.y, 5);
    const done = run(boss, player, BOSS_DASH_SEC + DT);
    expect(done.phase).toBe('chase');
  });

  it('stops its dash at a wall and goes back to chasing (R10.7)', () => {
    const grid = createGrid(20, 20, true);
    for (let row = 0; row < 20; row++) grid.walkable[tileIndex(grid, { col: 8, row })] = false;
    const start = tileCenter({ col: 6, row: 10 });
    const boss: Boss = { ...createBoss(start), phase: 'dash', phaseTimer: BOSS_DASH_SEC, dashDir: { x: 1, y: 0 } };
    const after = run(boss, { x: 0, y: 0 }, BOSS_DASH_SEC * 0.9, grid);
    expect(after.phase).toBe('chase');
    expect(isWalkablePoint(grid, after.pos)).toBe(true);
    expect(after.pos.x).toBeLessThan(8 * 32);
  });

  it('stays on walkable tiles in a generated boss room over a long fight', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const room = generateRoom(4, seed);
        let boss = room.boss as Boss;
        // The player circles the start so the boss goes through several dash cycles.
        for (let i = 0; i < 900; i++) {
          const angle = i * 0.02;
          const player = { x: room.start.x + Math.cos(angle) * 20, y: room.start.y + Math.sin(angle) * 20 };
          boss = stepBoss(boss, player, room.grid, DT);
          if (!isWalkablePoint(room.grid, boss.pos)) return false;
        }
        return true;
      }),
      { numRuns: 20 },
    );
  });

  it('touches the player only inside its contact radius', () => {
    const boss = createBoss({ x: 100, y: 100 });
    expect(bossTouchesPlayer(boss, { x: 100 + BOSS_CONTACT_RADIUS - 1, y: 100 })).toBe(true);
    expect(bossTouchesPlayer(boss, { x: 100 + BOSS_CONTACT_RADIUS + 1, y: 100 })).toBe(false);
  });
});
