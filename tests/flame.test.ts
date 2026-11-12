import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { addFlame, decayFlame, isLowFlame } from '../src/core/flame';
import { FLAME_DECAY_PER_SEC, FLAME_MAX, FLAME_MIN, FLAME_LOW_THRESHOLD, CANDY_FLAME_RESTORE } from '../src/core/config';

const flameArb = fc.double({ min: 0, max: 100, noNaN: true });
const dtArb = fc.double({ min: 0, max: 5, noNaN: true });
const amountArb = fc.double({ min: -100, max: 100, noNaN: true });

describe('flame', () => {
  it('decay keeps flame within [0, 100]', () => {
    fc.assert(
      fc.property(flameArb, dtArb, (flame, dt) => {
        const next = decayFlame(flame, dt);
        return next >= FLAME_MIN && next <= FLAME_MAX;
      }),
    );
  });

  it('decay never increases flame', () => {
    fc.assert(
      fc.property(flameArb, dtArb, (flame, dt) => decayFlame(flame, dt) <= flame),
    );
  });

  it('decay removes exactly the configured rate per second when not clamped', () => {
    expect(decayFlame(50, 2)).toBeCloseTo(50 - FLAME_DECAY_PER_SEC * 2);
  });

  it('any sequence of decay and add operations keeps flame within [0, 100]', () => {
    const opArb = fc.oneof(
      fc.record({ kind: fc.constant('decay' as const), value: dtArb }),
      fc.record({ kind: fc.constant('add' as const), value: amountArb }),
    );
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 200 }), (ops) => {
        let flame = 100;
        for (const op of ops) {
          flame = op.kind === 'decay' ? decayFlame(flame, op.value) : addFlame(flame, op.value);
          if (flame < FLAME_MIN || flame > FLAME_MAX) return false;
        }
        return true;
      }),
    );
  });

  it('candy restore adds the restore amount capped at 100', () => {
    fc.assert(
      fc.property(flameArb, (flame) => {
        const expected = Math.min(FLAME_MAX, flame + CANDY_FLAME_RESTORE);
        return Math.abs(addFlame(flame, CANDY_FLAME_RESTORE) - expected) < 1e-9;
      }),
    );
  });

  it('damage cannot push flame below 0', () => {
    expect(addFlame(10, -25)).toBe(0);
  });

  it('low flame starts at the threshold', () => {
    expect(isLowFlame(FLAME_LOW_THRESHOLD)).toBe(true);
    expect(isLowFlame(FLAME_LOW_THRESHOLD + 0.01)).toBe(false);
  });
});
