import type { ThemeId } from './types';

/** Themes a trial room can use. Chosen by the seeded RNG. */
export const TRIAL_THEMES: readonly ThemeId[] = ['graveyard', 'chapel', 'pumpkinPatch'];

/** The boss room always uses this theme. */
export const BOSS_THEME: ThemeId = 'crypt';

export const THEME_NAMES: Record<ThemeId, string> = {
  graveyard: 'Graveyard',
  chapel: 'Chapel',
  pumpkinPatch: 'Pumpkin Patch',
  crypt: 'Crypt',
};
