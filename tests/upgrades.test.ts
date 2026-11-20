import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  applyUpgrades,
  BASE_MODIFIERS,
  offerUpgrades,
  UPGRADE_IDS,
  UPGRADE_OFFER_SIZE,
  UPGRADES,
} from '../src/core/upgrades';
import type { Modifiers, UpgradeId } from '../src/core/upgrades';

const upgradeIdArb = fc.constantFrom<UpgradeId>(...UPGRADE_IDS);

function expectModifiersClose(actual: Modifiers, expected: Modifiers): void {
  for (const key of Object.keys(expected) as (keyof Modifiers)[]) {
    const a = actual[key];
    const e = expected[key];
    if (typeof e === 'number' && typeof a === 'number') expect(a).toBeCloseTo(e, 9);
    else expect(a).toBe(e);
  }
}

describe('upgrades', () => {
  it('defines exactly eight upgrades', () => {
    expect(UPGRADE_IDS).toHaveLength(8);
    expect(new Set(UPGRADE_IDS).size).toBe(8);
  });

  it('applying no upgrades gives the base modifiers', () => {
    expect(applyUpgrades([])).toEqual(BASE_MODIFIERS);
  });

  it('each upgrade alone gives its documented values (R9.1)', () => {
    const cases: [UpgradeId, Partial<Modifiers>][] = [
      ['brightWick', { candyRestore: 20 }],
      ['swiftFeet', { playerSpeed: 138 }],
      ['quickBreath', { blowRadius: 150, blowCooldownSec: 3.5 }],
      ['thickWax', { flameDecayPerSec: 1.125 }],
      ['ironPumpkin', { ghostDamage: 15 }],
      ['sweetTooth', { candyPickupRadius: 56 }],
      ['hungryFlame', { candyRestore: 30, flameDecayPerSec: 2.25 }],
      ['lastEmber', { lastEmber: true }],
    ];
    for (const [id, expected] of cases) {
      expectModifiersClose(applyUpgrades([id]), { ...BASE_MODIFIERS, ...expected });
    }
  });

  it('gives the same modifiers whatever order the upgrades are taken in (R9.6)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(upgradeIdArb, { maxLength: 8 }).chain((ids) =>
          fc.tuple(fc.constant(ids), fc.shuffledSubarray(ids, { minLength: ids.length, maxLength: ids.length })),
        ),
        ([ids, reordered]) => {
          expectModifiersClose(applyUpgrades(reordered), applyUpgrades(ids));
        },
      ),
    );
  });

  it('only trade-off upgrades have a drawback line', () => {
    const withDrawback = UPGRADE_IDS.filter((id) => UPGRADES[id].drawback !== undefined);
    expect(withDrawback).toEqual(['hungryFlame']);
  });

  it('offers at most three distinct upgrades that are not already taken', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(upgradeIdArb, { maxLength: 8 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom(1, 2, 3),
        (taken, seed, room) => {
          const offered = offerUpgrades(taken, seed, room);
          const distinct = new Set(offered).size === offered.length;
          const notTaken = offered.every((id) => !taken.includes(id));
          const expectedCount = Math.min(UPGRADE_OFFER_SIZE, UPGRADE_IDS.length - taken.length);
          return distinct && notTaken && offered.length === expectedCount;
        },
      ),
    );
  });

  it('offers the same cards for the same seed and room', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.constantFrom(1, 2, 3), (seed, room) => {
        expect(offerUpgrades([], seed, room)).toEqual(offerUpgrades([], seed, room));
      }),
    );
  });

  it('offers nothing once every upgrade is taken', () => {
    expect(offerUpgrades([...UPGRADE_IDS], 1, 1)).toEqual([]);
  });
});
