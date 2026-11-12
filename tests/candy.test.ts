import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { collectCandies } from '../src/core/candy';
import { CANDY_PICKUP_RADIUS } from '../src/core/config';
import { distance } from '../src/core/vec';

const pointArb = fc.record({
  x: fc.double({ min: 0, max: 400, noNaN: true }),
  y: fc.double({ min: 0, max: 400, noNaN: true }),
});

describe('candy collection', () => {
  it('splits candies into collected and remaining without losing any', () => {
    fc.assert(
      fc.property(pointArb, fc.array(pointArb, { maxLength: 30 }), (player, candies) => {
        const { remaining, collected } = collectCandies(player, candies);
        return remaining.length + collected.length === candies.length;
      }),
    );
  });

  it('collects only candies inside the pickup radius', () => {
    fc.assert(
      fc.property(pointArb, fc.array(pointArb, { maxLength: 30 }), (player, candies) => {
        const { remaining, collected } = collectCandies(player, candies);
        return (
          collected.every((c) => distance(player, c) <= CANDY_PICKUP_RADIUS) &&
          remaining.every((c) => distance(player, c) > CANDY_PICKUP_RADIUS)
        );
      }),
    );
  });

  it('returns empty lists when there are no candies', () => {
    expect(collectCandies({ x: 0, y: 0 }, [])).toEqual({ remaining: [], collected: [] });
  });
});
