import { FLAME_DECAY_PER_SEC, FLAME_LOW_THRESHOLD, FLAME_MAX, FLAME_MIN } from './config';

export function clampFlame(value: number): number {
  return Math.min(FLAME_MAX, Math.max(FLAME_MIN, value));
}

/** Lowers the flame by `ratePerSec` over `dt` seconds. Never goes below 0. */
export function decayFlame(flame: number, dt: number, ratePerSec: number = FLAME_DECAY_PER_SEC): number {
  return clampFlame(flame - ratePerSec * dt);
}

/** Adds `amount` to the flame (negative to damage it), clamped to [0, 100]. */
export function addFlame(flame: number, amount: number): number {
  return clampFlame(flame + amount);
}

export function isLowFlame(flame: number): boolean {
  return flame <= FLAME_LOW_THRESHOLD;
}
