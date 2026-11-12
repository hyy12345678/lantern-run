import type { Vec2 } from './types';

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

/** Scales the vector down to `max` length if it is longer. */
export function clampLength(a: Vec2, max: number): Vec2 {
  const len = length(a);
  return len > max && len > 0 ? scale(a, max / len) : a;
}
