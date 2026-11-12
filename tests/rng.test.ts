import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { drawFloat, drawInt } from '../src/core/rng';

const stateArb = fc.integer({ min: 0, max: 0xffffffff });

describe('rng', () => {
  it('drawFloat returns values in [0, 1) for any state', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const { value } = drawFloat(state);
        return value >= 0 && value < 1;
      }),
    );
  });

  it('drawFloat is deterministic for the same state', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        expect(drawFloat(state)).toEqual(drawFloat(state));
      }),
    );
  });

  it('drawInt stays inside the inclusive range', () => {
    fc.assert(
      fc.property(stateArb, fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 50 }), (state, min, span) => {
        const max = min + span;
        const { value } = drawInt(state, min, max);
        return Number.isInteger(value) && value >= min && value <= max;
      }),
    );
  });
});
