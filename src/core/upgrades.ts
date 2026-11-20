import {
  BLOW_COOLDOWN_SEC,
  BLOW_RADIUS,
  BRIGHT_WICK_BONUS,
  CANDY_FLAME_RESTORE,
  CANDY_PICKUP_RADIUS,
  FLAME_DECAY_PER_SEC,
  GHOST_CONTACT_DAMAGE,
  HUNGRY_FLAME_BONUS,
  HUNGRY_FLAME_FACTOR,
  IRON_PUMPKIN_REDUCTION,
  LAST_EMBER_FLAME,
  PLAYER_SPEED,
  QUICK_BREATH_COOLDOWN_SEC,
  QUICK_BREATH_RADIUS,
  SWEET_TOOTH_RADIUS,
  SWIFT_FEET_FACTOR,
  THICK_WAX_FACTOR,
} from './config';
import { mixSeed, shuffled } from './rng';

export type UpgradeId =
  | 'brightWick'
  | 'swiftFeet'
  | 'quickBreath'
  | 'thickWax'
  | 'ironPumpkin'
  | 'sweetTooth'
  | 'hungryFlame'
  | 'lastEmber';

/** Stats that upgrades can change. Built from the base values in config.ts. */
export interface Modifiers {
  playerSpeed: number;
  candyRestore: number;
  candyPickupRadius: number;
  flameDecayPerSec: number;
  blowRadius: number;
  blowCooldownSec: number;
  ghostDamage: number;
  /** When true, the flame relights once per room instead of going out. */
  lastEmber: boolean;
}

export const UPGRADE_IDS: readonly UpgradeId[] = [
  'brightWick',
  'swiftFeet',
  'quickBreath',
  'thickWax',
  'ironPumpkin',
  'sweetTooth',
  'hungryFlame',
  'lastEmber',
];

/** Number of upgrade cards offered after a trial room. */
export const UPGRADE_OFFER_SIZE = 3;

export const BASE_MODIFIERS: Modifiers = {
  playerSpeed: PLAYER_SPEED,
  candyRestore: CANDY_FLAME_RESTORE,
  candyPickupRadius: CANDY_PICKUP_RADIUS,
  flameDecayPerSec: FLAME_DECAY_PER_SEC,
  blowRadius: BLOW_RADIUS,
  blowCooldownSec: BLOW_COOLDOWN_SEC,
  ghostDamage: GHOST_CONTACT_DAMAGE,
  lastEmber: false,
};

interface UpgradeDef {
  name: string;
  description: string;
  /** Shown on its own line in the warning color. Only trade-off upgrades have one. */
  drawback?: string;
  /**
   * Changes stats relatively (adds or multiplies) or sets values that no other upgrade touches,
   * so the result does not depend on the order upgrades are taken in.
   */
  apply: (m: Modifiers) => Modifiers;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  brightWick: {
    name: 'Bright Wick',
    description: `Candy restores ${BRIGHT_WICK_BONUS} more flame.`,
    apply: (m) => ({ ...m, candyRestore: m.candyRestore + BRIGHT_WICK_BONUS }),
  },
  swiftFeet: {
    name: 'Swift Feet',
    description: 'Move 15% faster.',
    apply: (m) => ({ ...m, playerSpeed: m.playerSpeed * SWIFT_FEET_FACTOR }),
  },
  quickBreath: {
    name: 'Quick Breath',
    description: `Blow reaches ${QUICK_BREATH_RADIUS} px and recharges in ${QUICK_BREATH_COOLDOWN_SEC} s.`,
    apply: (m) => ({ ...m, blowRadius: QUICK_BREATH_RADIUS, blowCooldownSec: QUICK_BREATH_COOLDOWN_SEC }),
  },
  thickWax: {
    name: 'Thick Wax',
    description: 'Your flame burns 25% slower.',
    apply: (m) => ({ ...m, flameDecayPerSec: m.flameDecayPerSec * THICK_WAX_FACTOR }),
  },
  ironPumpkin: {
    name: 'Iron Pumpkin',
    description: `Ghosts take ${IRON_PUMPKIN_REDUCTION} less flame when they touch you.`,
    apply: (m) => ({ ...m, ghostDamage: m.ghostDamage - IRON_PUMPKIN_REDUCTION }),
  },
  sweetTooth: {
    name: 'Sweet Tooth',
    description: 'Grab candy from more than twice as far away.',
    apply: (m) => ({ ...m, candyPickupRadius: SWEET_TOOTH_RADIUS }),
  },
  hungryFlame: {
    name: 'Hungry Flame',
    description: `Candy restores ${HUNGRY_FLAME_BONUS} more flame.`,
    drawback: 'Your flame burns 50% faster.',
    apply: (m) => ({
      ...m,
      candyRestore: m.candyRestore + HUNGRY_FLAME_BONUS,
      flameDecayPerSec: m.flameDecayPerSec * HUNGRY_FLAME_FACTOR,
    }),
  },
  lastEmber: {
    name: 'Last Ember',
    description: `Once per room, a dying flame relights at ${LAST_EMBER_FLAME}.`,
    apply: (m) => ({ ...m, lastEmber: true }),
  },
};

/** Modifiers after applying each upgrade in `ids` to the base values. */
export function applyUpgrades(ids: readonly UpgradeId[]): Modifiers {
  return ids.reduce<Modifiers>((m, id) => UPGRADES[id].apply(m), BASE_MODIFIERS);
}

/**
 * Picks up to three upgrades the player does not have yet, in a seeded random order.
 * Returns an empty list when every upgrade is already taken.
 */
export function offerUpgrades(taken: readonly UpgradeId[], seed: number, roomIndex: number): UpgradeId[] {
  const candidates = UPGRADE_IDS.filter((id) => !taken.includes(id));
  const { value } = shuffled(candidates, mixSeed(seed, 100 + roomIndex));
  return value.slice(0, UPGRADE_OFFER_SIZE);
}
