import {
  BLINK_INTERVAL_SEC,
  BLINK_RANGE,
  CHASE_SPEED,
  CHASE_TRIGGER_RADIUS,
  GHOST_CONTACT_RADIUS,
  GHOST_RADIUS,
  PATROL_SPEED,
} from './config';
import { isWalkableTile, moveWithCollision, tileCenter } from './grid';
import { drawInt } from './rng';
import { distance, length, scale, sub } from './vec';
import type { Ghost, Grid, Vec2 } from './types';

const PATROL_ARRIVE_EPSILON = 0.5;

export function touchesPlayer(ghost: Ghost, player: Vec2): boolean {
  return distance(ghost.pos, player) <= GHOST_CONTACT_RADIUS;
}

/** Advances one ghost by `dt` seconds. Returns a new ghost object. */
export function stepGhost(ghost: Ghost, player: Vec2, grid: Grid, dt: number): Ghost {
  const cooled: Ghost = { ...ghost, hitCooldown: Math.max(0, ghost.hitCooldown - dt) };
  switch (ghost.kind) {
    case 'patrol':
      return stepPatrol(cooled, grid, dt);
    case 'chase':
      return stepChase(cooled, player, grid, dt);
    case 'blink':
      return stepBlink(cooled, player, grid, dt);
  }
}

function stepPatrol(ghost: Ghost, grid: Grid, dt: number): Ghost {
  if (ghost.path.length === 0) return ghost;
  const target = ghost.path[ghost.pathIndex];
  const toTarget = sub(target, ghost.pos);
  const remaining = length(toTarget);
  const travel = Math.min(PATROL_SPEED * dt, remaining);
  const direction = remaining > 0 ? scale(toTarget, 1 / remaining) : { x: 0, y: 0 };
  const pos = moveWithCollision(grid, ghost.pos, scale(direction, travel), GHOST_RADIUS);
  const arrived = distance(pos, target) < PATROL_ARRIVE_EPSILON;
  return {
    ...ghost,
    pos,
    pathIndex: arrived ? (ghost.pathIndex + 1) % ghost.path.length : ghost.pathIndex,
  };
}

function stepChase(ghost: Ghost, player: Vec2, grid: Grid, dt: number): Ghost {
  const toPlayer = sub(player, ghost.pos);
  const gap = length(toPlayer);
  if (gap === 0 || gap > CHASE_TRIGGER_RADIUS) return ghost;
  const travel = Math.min(CHASE_SPEED * dt, gap);
  const pos = moveWithCollision(grid, ghost.pos, scale(toPlayer, travel / gap), GHOST_RADIUS);
  return { ...ghost, pos };
}

function stepBlink(ghost: Ghost, player: Vec2, grid: Grid, dt: number): Ghost {
  const timer = ghost.blinkTimer - dt;
  if (timer > 0) return { ...ghost, blinkTimer: timer };

  const candidates = walkableCentersWithin(grid, player, BLINK_RANGE);
  if (candidates.length === 0) return { ...ghost, blinkTimer: BLINK_INTERVAL_SEC };

  const draw = drawInt(ghost.rngState, 0, candidates.length - 1);
  return {
    ...ghost,
    pos: candidates[draw.value],
    blinkTimer: BLINK_INTERVAL_SEC,
    rngState: draw.state,
  };
}

function walkableCentersWithin(grid: Grid, center: Vec2, range: number): Vec2[] {
  const found: Vec2[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const tile = { col, row };
      if (!isWalkableTile(grid, tile)) continue;
      const point = tileCenter(tile);
      if (distance(point, center) <= range) found.push(point);
    }
  }
  return found;
}
