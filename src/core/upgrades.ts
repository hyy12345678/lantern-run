import {
  BRIGHT_WICK_RESTORE,
  BLOW_COOLDOWN_SEC,
  BLOW_RADIUS,
  CANDY_FLAME_RESTORE,
  FLAME_DECAY_PER_SEC,
  GHOST_CONTACT_DAMAGE,
  IRON_PUMPKIN_DAMAGE,
  PLAYER_SPEED,
  QUICK_BREATH_COOLDOWN_SEC,
  QUICK_BREATH_RADIUS,
  SWIFT_FEET_SPEED,
  THICK_WAX_DECAY_PER_SEC,
} from './config';
import { mixSeed, shuffled } from './rng';

export type UpgradeId = 'brightWick' | 'swiftFeet' | 'quickBreath' | 'thickWax' | 'ironPumpkin';

/** Stats that upgrades can change. Built from the base values in config.ts. */
export interface Modifiers {
  playerSpeed: number;
  candyRestore: number;
  flameDecayPerSec: number;
  blowRadius: number;
  blowCooldownSec: number;
  ghostDamage: number;
}

export const UPGRADE_IDS: readonly UpgradeId[] = ['brightWick', 'swiftFeet', 'quickBreath', 'thickWax', 'ironPumpkin'];

/** Number of upgrade cards offered after a trial room. */
export const UPGRADE_OFFER_SIZE = 3;

export const BASE_MODIFIERS: Modifiers = {
  playerSpeed: PLAYER_SPEED,
  candyRestore: CANDY_FLAME_RESTORE,
  flameDecayPerSec: FLAME_DECAY_PER_SEC,
  blowRadius: BLOW_RADIUS,
  blowCooldownSec: BLOW_COOLDOWN_SEC,
  ghostDamage: GHOST_CONTACT_DAMAGE,
};

interface UpgradeDef {
  name: string;
  description: string;
  apply: (m: Modifiers) => Modifiers;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  brightWick: {
    name: 'Bright Wick',
    description: `Candy restores ${BRIGHT_WICK_RESTORE} flame instead of ${CANDY_FLAME_RESTORE}.`,
    apply: (m) => ({ ...m, candyRestore: BRIGHT_WICK_RESTORE }),
  },
  swiftFeet: {
    name: 'Swift Feet',
    description: 'Move 15% faster.',
    apply: (m) => ({ ...m, playerSpeed: SWIFT_FEET_SPEED }),
  },
  quickBreath: {
    name: 'Quick Breath',
    description: `Blow reaches ${QUICK_BREATH_RADIUS} px and recharges in ${QUICK_BREATH_COOLDOWN_SEC} s.`,
    apply: (m) => ({ ...m, blowRadius: QUICK_BREATH_RADIUS, blowCooldownSec: QUICK_BREATH_COOLDOWN_SEC }),
  },
  thickWax: {
    name: 'Thick Wax',
    description: 'Flame burns 25% slower.',
    apply: (m) => ({ ...m, flameDecayPerSec: THICK_WAX_DECAY_PER_SEC }),
  },
  ironPumpkin: {
    name: 'Iron Pumpkin',
    description: `Ghost contact costs ${IRON_PUMPKIN_DAMAGE} flame instead of ${GHOST_CONTACT_DAMAGE}.`,
    apply: (m) => ({ ...m, ghostDamage: IRON_PUMPKIN_DAMAGE }),
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
