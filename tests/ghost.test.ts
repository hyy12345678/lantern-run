import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { hasClearLine, isChasing, stepGhost, touchesPlayer } from '../src/core/ghost';
import { createGrid, isWalkablePoint, tileCenter, tileIndex } from '../src/core/grid';
import { generateRoom } from '../src/core/room';
import { BLINK_RANGE, CHASE_TRIGGER_RADIUS, GHOST_CONTACT_RADIUS, TILE_SIZE } from '../src/core/config';
import { distance } from '../src/core/vec';
import type { Ghost, GhostKind } from '../src/core/types';

const OPEN = createGrid(20, 20, true);
const coordArb = fc.double({ min: 40, max: 600, noNaN: true });
const pointArb = fc.record({ x: coordArb, y: coordArb });

function ghostAt(kind: GhostKind, pos: { x: number; y: number }, rngState = 12345): Ghost {
  return {
    id: 0,
    kind,
    pos,
    path: [],
    pathIndex: 0,
    blinkTimer: 3,
    hitCooldown: 0,
    rngState,
  };
}

describe('ghost behaviour', () => {
  it('chase ghost never gets farther from the player in one step', () => {
    fc.assert(
      fc.property(pointArb, pointArb, fc.double({ min: 0.001, max: 0.1, noNaN: true }), (pos, player, dt) => {
        const before = distance(pos, player);
        if (before > CHASE_TRIGGER_RADIUS) return true;
        const after = stepGhost(ghostAt('chase', pos), player, OPEN, dt);
        return distance(after.pos, player) <= before + 1e-9;
      }),
    );
  });

  it('chase ghost goes around a wall to reach the player (R5.2)', () => {
    // A wall column at col 5 with a single gap at row 4. Ghost on the left, player on the right.
    // The detour stays inside the 160 px chase radius, so the ghost keeps chasing the whole way.
    const grid = createGrid(10, 10, true);
    for (let row = 0; row < 10; row++) {
      if (row !== 4) grid.walkable[tileIndex(grid, { col: 5, row })] = false;
    }
    const player = tileCenter({ col: 6, row: 6 });
    let ghost = ghostAt('chase', tileCenter({ col: 4, row: 6 }));
    // Straight across is only 64 px, but the wall blocks it. Walking pressed against the wall would never arrive.
    expect(hasClearLine(grid, ghost.pos, player, 10)).toBe(false);
    let reached = false;
    for (let i = 0; i < 60 * 20 && !reached; i++) {
      ghost = stepGhost(ghost, player, grid, 1 / 60);
      expect(isWalkablePoint(grid, ghost.pos)).toBe(true);
      reached = touchesPlayer(ghost, player);
    }
    expect(reached).toBe(true);
  });

  it('marks a chase ghost as chasing only inside its trigger radius', () => {
    const ghost = ghostAt('chase', { x: 100, y: 100 });
    expect(isChasing(ghost, { x: 100 + CHASE_TRIGGER_RADIUS - 1, y: 100 })).toBe(true);
    expect(isChasing(ghost, { x: 100 + CHASE_TRIGGER_RADIUS + 1, y: 100 })).toBe(false);
    expect(isChasing({ ...ghost, kind: 'patrol' }, { x: 101, y: 100 })).toBe(false);
  });

  it('chase ghost ignores a player outside its trigger radius', () => {
    const ghost = ghostAt('chase', { x: 40, y: 40 });
    const far = { x: 600, y: 600 };
    expect(stepGhost(ghost, far, OPEN, 0.1).pos).toEqual(ghost.pos);
  });

  it('blink ghost teleports to a walkable tile within range when its timer runs out', () => {
    fc.assert(
      fc.property(pointArb, fc.integer({ min: 1, max: 0xffffffff }), (player, rngState) => {
        const ghost = { ...ghostAt('blink', { x: 40, y: 40 }, rngState), blinkTimer: 0 };
        const after = stepGhost(ghost, player, OPEN, 0.016);
        return (
          distance(after.pos, player) <= BLINK_RANGE + TILE_SIZE &&
          isWalkablePoint(OPEN, after.pos) &&
          after.blinkTimer > 0
        );
      }),
    );
  });

  it('patrol ghost stays on walkable tiles over a generated night', () => {
    const layout = generateRoom(2, 424242);
    const patrol = layout.ghosts.find((g) => g.kind === 'patrol');
    expect(patrol).toBeDefined();
    let ghost = patrol as Ghost;
    for (let i = 0; i < 600; i++) {
      ghost = stepGhost(ghost, layout.start, layout.grid, 1 / 60);
      expect(isWalkablePoint(layout.grid, ghost.pos)).toBe(true);
    }
  });

  it('contact is detected within the contact radius only', () => {
    const ghost = ghostAt('chase', { x: 100, y: 100 });
    expect(touchesPlayer(ghost, { x: 100 + GHOST_CONTACT_RADIUS - 1, y: 100 })).toBe(true);
    expect(touchesPlayer(ghost, { x: 100 + GHOST_CONTACT_RADIUS + 1, y: 100 })).toBe(false);
  });
});
