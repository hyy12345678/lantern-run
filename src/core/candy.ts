import { CANDY_PICKUP_RADIUS } from './config';
import { distance } from './vec';
import type { Vec2 } from './types';

export interface CandyCollection {
  remaining: Vec2[];
  collected: Vec2[];
}

/** Splits candies into those within pickup range of the player and those left behind. */
export function collectCandies(player: Vec2, candies: readonly Vec2[]): CandyCollection {
  const remaining: Vec2[] = [];
  const collected: Vec2[] = [];
  for (const candy of candies) {
    if (distance(player, candy) <= CANDY_PICKUP_RADIUS) {
      collected.push(candy);
    } else {
      remaining.push(candy);
    }
  }
  return { remaining, collected };
}
