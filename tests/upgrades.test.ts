import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { applyUpgrades, BASE_MODIFIERS, offerUpgrades, UPGRADE_IDS, UPGRADE_OFFER_SIZE } from '../src/core/upgrades';
import type { UpgradeId } from '../src/core/upgrades';
import {
  BRIGHT_WICK_RESTORE,
  IRON_PUMPKIN_DAMAGE,
  QUICK_BREATH_COOLDOWN_SEC,
  QUICK_BREATH_RADIUS,
  SWIFT_FEET_SPEED,
  THICK_WAX_DECAY_PER_SEC,
} from '../src/core/config';

const upgradeIdArb = fc.constantFrom<UpgradeId>(...UPGRADE_IDS);

describe('upgrades', () => {
  it('applying no upgrades gives the base modifiers', () => {
    expect(applyUpgrades([])).toEqual(BASE_MODIFIERS);
  });

  it('each upgrade changes exactly its own stat', () => {
    const cases: [UpgradeId, Partial<typeof BASE_MODIFIERS>][] = [
      ['brightWick', { candyRestore: BRIGHT_WICK_RESTORE }],
      ['swiftFeet', { playerSpeed: SWIFT_FEET_SPEED }],
      ['quickBreath', { blowRadius: QUICK_BREATH_RADIUS, blowCooldownSec: QUICK_BREATH_COOLDOWN_SEC }],
      ['thickWax', { flameDecayPerSec: THICK_WAX_DECAY_PER_SEC }],
      ['ironPumpkin', { ghostDamage: IRON_PUMPKIN_DAMAGE }],
    ];
    for (const [id, expected] of cases) {
      expect(applyUpgrades([id])).toEqual({ ...BASE_MODIFIERS, ...expected });
    }
  });

  it('offers at most three distinct upgrades that are not already taken', () => {
    fc.assert(
      fc.property(fc.uniqueArray(upgradeIdArb, { maxLength: 5 }), fc.integer({ min: 0, max: 0xffffffff }), fc.constantFrom(1, 2, 3), (taken, seed, room) => {
        const offered = offerUpgrades(taken, seed, room);
        const distinct = new Set(offered).size === offered.length;
        const notTaken = offered.every((id) => !taken.includes(id));
        const expectedCount = Math.min(UPGRADE_OFFER_SIZE, UPGRADE_IDS.length - taken.length);
        return distinct && notTaken && offered.length === expectedCount;
      }),
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
