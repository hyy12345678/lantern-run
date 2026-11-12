import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { applyBlow, canBlow, startBlowCooldown, tickCooldown } from '../src/core/blow';
import { createGrid, isWalkablePoint, tileCenter, tileIndex } from '../src/core/grid';
import { BLOW_COOLDOWN_SEC, BLOW_PUSH_DISTANCE, BLOW_RADIUS } from '../src/core/config';
import { distance } from '../src/core/vec';
import type { Ghost, Grid } from '../src/core/types';

const OPEN = createGrid(20, 20, true);
const coordArb = fc.double({ min: 40, max: 600, noNaN: true });
const pointArb = fc.record({ x: coordArb, y: coordArb });

function ghostAt(pos: { x: number; y: number }, id = 0): Ghost {
  return {
    id,
    kind: 'chase',
    pos,
    path: [],
    pathIndex: 0,
    blinkTimer: 3,
    hitCooldown: 0,
    rngState: 1,
  };
}

describe('blow ability', () => {
  it('moves only ghosts within the blow radius, and moves them outward by at most the push distance', () => {
    fc.assert(
      fc.property(pointArb, fc.array(pointArb, { minLength: 1, maxLength: 6 }), (player, positions) => {
        const ghosts = positions.map((p, i) => ghostAt(p, i));
        const pushed = applyBlow(player, ghosts, OPEN);
        return ghosts.every((before, i) => {
          const after = pushed[i];
          const gapBefore = distance(before.pos, player);
          if (gapBefore > BLOW_RADIUS) return after.pos === before.pos;
          const gapAfter = distance(after.pos, player);
          return (
            gapAfter >= gapBefore - 1e-6 &&
            gapAfter - gapBefore <= BLOW_PUSH_DISTANCE + 1e-6 &&
            isWalkablePoint(OPEN, after.pos)
          );
        });
      }),
    );
  });

  it('stops a pushed ghost at a wall', () => {
    // Wall column at col 5. Ghost sits at col 3 and is pushed right toward the wall.
    const grid: Grid = createGrid(10, 10, true);
    for (let row = 0; row < 10; row++) grid.walkable[tileIndex(grid, { col: 5, row })] = false;
    const player = tileCenter({ col: 2, row: 5 });
    const ghost = ghostAt(tileCenter({ col: 3, row: 5 }));
    const [pushed] = applyBlow(player, [ghost], grid);
    expect(pushed.pos.x).toBeGreaterThan(ghost.pos.x);
    expect(pushed.pos.x).toBeLessThan(5 * 32);
    expect(isWalkablePoint(grid, pushed.pos)).toBe(true);
  });

  it('canBlow is true only when the cooldown has finished', () => {
    expect(canBlow(0)).toBe(true);
    expect(canBlow(0.1)).toBe(false);
  });

  it('a full cooldown ticks down to exactly 0', () => {
    let cooldown = startBlowCooldown();
    expect(cooldown).toBe(BLOW_COOLDOWN_SEC);
    for (let i = 0; i < 10; i++) cooldown = tickCooldown(cooldown, 0.5);
    expect(cooldown).toBe(0);
    expect(canBlow(cooldown)).toBe(true);
  });
});
