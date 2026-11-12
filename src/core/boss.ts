import { BOSS_CONTACT_RADIUS, BOSS_RADIUS, BOSS_SPEED } from './config';
import { moveWithCollision } from './grid';
import { distance, length, scale, sub } from './vec';
import type { Boss, Grid, Vec2 } from './types';

export function bossTouchesPlayer(boss: Boss, player: Vec2): boolean {
  return distance(boss.pos, player) <= BOSS_CONTACT_RADIUS;
}

/** Moves the Pumpkin King toward the player at a fixed speed, with no trigger radius. */
export function stepBoss(boss: Boss, player: Vec2, grid: Grid, dt: number): Boss {
  const hitCooldown = Math.max(0, boss.hitCooldown - dt);
  const toPlayer = sub(player, boss.pos);
  const gap = length(toPlayer);
  if (gap === 0) return { pos: boss.pos, hitCooldown };
  const travel = Math.min(BOSS_SPEED * dt, gap);
  const pos = moveWithCollision(grid, boss.pos, scale(toPlayer, travel / gap), BOSS_RADIUS);
  return { pos, hitCooldown };
}
