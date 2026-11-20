import {
  BOSS_CHASE_SEC,
  BOSS_CONTACT_RADIUS,
  BOSS_DASH_SEC,
  BOSS_DASH_SPEED,
  BOSS_RADIUS,
  BOSS_SPEED,
  BOSS_WINDUP_SEC,
} from './config';
import { moveWithCollision } from './grid';
import { distance, length, scale, sub } from './vec';
import type { Boss, Grid, Vec2 } from './types';

/** Below this, a dash step counts as blocked by a wall. */
const DASH_BLOCKED_EPSILON = 0.01;

export function createBoss(pos: Vec2): Boss {
  return { pos, hitCooldown: 0, phase: 'chase', phaseTimer: BOSS_CHASE_SEC, dashDir: { x: 1, y: 0 } };
}

export function bossTouchesPlayer(boss: Boss, player: Vec2): boolean {
  return distance(boss.pos, player) <= BOSS_CONTACT_RADIUS;
}

/** Unit vector from `from` toward `to`, or the fallback when they are at the same point. */
function directionTo(from: Vec2, to: Vec2, fallback: Vec2): Vec2 {
  const offset = sub(to, from);
  const len = length(offset);
  return len > 0 ? scale(offset, 1 / len) : fallback;
}

/**
 * Advances the Pumpkin King by `dt` seconds through its cycle:
 * chase the player, stand still while winding up (the dash direction is locked at the start),
 * then dash. A dash that hits a wall ends early.
 */
export function stepBoss(boss: Boss, player: Vec2, grid: Grid, dt: number): Boss {
  const hitCooldown = Math.max(0, boss.hitCooldown - dt);
  const timer = boss.phaseTimer - dt;

  switch (boss.phase) {
    case 'chase': {
      if (timer <= 0) {
        const dashDir = directionTo(boss.pos, player, boss.dashDir);
        return { ...boss, hitCooldown, phase: 'windup', phaseTimer: BOSS_WINDUP_SEC, dashDir };
      }
      const toPlayer = sub(player, boss.pos);
      const gap = length(toPlayer);
      if (gap === 0) return { ...boss, hitCooldown, phaseTimer: timer };
      const travel = Math.min(BOSS_SPEED * dt, gap);
      const pos = moveWithCollision(grid, boss.pos, scale(toPlayer, travel / gap), BOSS_RADIUS);
      return { ...boss, pos, hitCooldown, phaseTimer: timer };
    }
    case 'windup': {
      if (timer <= 0) return { ...boss, hitCooldown, phase: 'dash', phaseTimer: BOSS_DASH_SEC };
      return { ...boss, hitCooldown, phaseTimer: timer };
    }
    case 'dash': {
      const pos = moveWithCollision(grid, boss.pos, scale(boss.dashDir, BOSS_DASH_SPEED * dt), BOSS_RADIUS);
      const blocked = dt > 0 && distance(pos, boss.pos) < DASH_BLOCKED_EPSILON;
      if (timer <= 0 || blocked) {
        return { ...boss, pos, hitCooldown, phase: 'chase', phaseTimer: BOSS_CHASE_SEC };
      }
      return { ...boss, pos, hitCooldown, phaseTimer: timer };
    }
  }
}
