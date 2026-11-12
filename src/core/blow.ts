import { BLOW_COOLDOWN_SEC, BLOW_PUSH_DISTANCE, BLOW_PUSH_STEP_PX, BLOW_RADIUS, GHOST_RADIUS } from './config';
import { canOccupy } from './grid';
import { length, scale, sub } from './vec';
import type { Ghost, Grid, Vec2 } from './types';

export function canBlow(cooldownLeft: number): boolean {
  return cooldownLeft <= 0;
}

export function startBlowCooldown(): number {
  return BLOW_COOLDOWN_SEC;
}

export function tickCooldown(cooldownLeft: number, dt: number): number {
  return Math.max(0, cooldownLeft - dt);
}

/**
 * Pushes every ghost within BLOW_RADIUS of the player straight away from the player.
 * Each ghost moves in small steps and stops at the first wall, so no ghost ends up in a wall.
 */
export function applyBlow(
  player: Vec2,
  ghosts: readonly Ghost[],
  grid: Grid,
  radius: number = BLOW_RADIUS,
): Ghost[] {
  return ghosts.map((ghost) => {
    const offset = sub(ghost.pos, player);
    const gap = length(offset);
    if (gap > radius) return ghost;
    const direction = gap > 0 ? scale(offset, 1 / gap) : { x: 1, y: 0 };
    return { ...ghost, pos: pushOutward(grid, ghost.pos, direction) };
  });
}

function pushOutward(grid: Grid, start: Vec2, direction: Vec2): Vec2 {
  let pos = start;
  let travelled = 0;
  while (travelled < BLOW_PUSH_DISTANCE) {
    const step = Math.min(BLOW_PUSH_STEP_PX, BLOW_PUSH_DISTANCE - travelled);
    const next = { x: pos.x + direction.x * step, y: pos.y + direction.y * step };
    if (!canOccupy(grid, next, GHOST_RADIUS)) break;
    pos = next;
    travelled += step;
  }
  return pos;
}
