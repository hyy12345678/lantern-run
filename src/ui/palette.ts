// Colors and fonts from .kiro/steering/style-guide.md, plus cartoon-specific ink and accents.

import type { ThemeId } from '../core/types';

/** Plain font for HUD and body text. */
export const FONT = 'Fredoka, "Trebuchet MS", Arial, sans-serif';
/** Display font for titles only. */
export const TITLE_FONT = 'Creepster, Fredoka, "Trebuchet MS", Arial, sans-serif';

export type WallDecor = 'tombstone' | 'pillar' | 'hay' | 'coffin';
export type FloorStyle = 'grass' | 'flagstone' | 'soil' | 'crypt';

/** Colors and decoration for one room theme. Themes change looks only, never rules. */
export interface ThemePalette {
  /** Base floor color and a slightly different shade for large soft patches. */
  floorA: number;
  floorB: number;
  /** Small floor details: grass tufts, cracks, leaves. */
  detail: number;
  detailLight: number;
  floor: FloorStyle;
  border: number;
  borderLight: number;
  wall: number;
  wallLight: number;
  decor: WallDecor;
}

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  graveyard: {
    floorA: 0x2e3a52,
    floorB: 0x34425c,
    detail: 0x415a63,
    detailLight: 0x5b7a78,
    floor: 'grass',
    border: 0x1f4a44,
    borderLight: 0x2f6b5f,
    wall: 0x7a7398,
    wallLight: 0xb2aad2,
    decor: 'tombstone',
  },
  chapel: {
    floorA: 0x3d4766,
    floorB: 0x465173,
    detail: 0x2a3150,
    detailLight: 0x5a668a,
    floor: 'flagstone',
    border: 0x2a3550,
    borderLight: 0x46597e,
    wall: 0x7a4b2e,
    wallLight: 0xa86d44,
    decor: 'pillar',
  },
  pumpkinPatch: {
    floorA: 0x3e3324,
    floorB: 0x47392a,
    detail: 0x4f7a2e,
    detailLight: 0x6fa040,
    floor: 'soil',
    border: 0x2e4a1c,
    borderLight: 0x4f7a2e,
    wall: 0xd9a441,
    wallLight: 0xf0c864,
    decor: 'hay',
  },
  crypt: {
    floorA: 0x3a2129,
    floorB: 0x442630,
    detail: 0x24121a,
    detailLight: 0x5e3a44,
    floor: 'crypt',
    border: 0x1a1a1f,
    borderLight: 0x3a3a46,
    wall: 0x5b3a2b,
    wallLight: 0x87573f,
    decor: 'coffin',
  },
};

export const PAL = {
  ink: 0x1b0f24,
  night: 0x0b0614,
  skyTop: 0x0d0720,
  skyBottom: 0x3a1f55,
  moon: 0xfff1c1,
  moonShade: 0xe9d49a,
  stone: 0x6f6890,
  stoneLight: 0xa39bc4,
  stoneDark: 0x4a4368,
  pumpkin: 0xff8a00,
  pumpkinDark: 0xc95f00,
  pumpkinLight: 0xffb347,
  stem: 0x4f7a2e,
  candle: 0xffd166,
  ember: 0xff5e3a,
  ghostPatrol: 0xbde0fe,
  ghostChase: 0xd7b8ff,
  ghostBlink: 0xb8f2e6,
  blush: 0xff7aa2,
  wood: 0x6b4226,
  woodDark: 0x4a2c18,
  fog: 0xa48fd0,
  danger: 0xc1121f,
  accent: 0xffb347,
  /** Candy yellow. Same value as `candle`, named for use on candy and pickup effects. */
  candy: 0xffd166,
  text: '#f5f0ff',
  /** Same value as `text`. Kept for older call sites. */
  textHex: '#f5f0ff',
  textSoft: '#c9b8e6',
  accentText: '#ffb347',
  candyText: '#ffd166',
  /** Warning text, e.g. an upgrade's drawback. About 8.9:1 contrast on the night background. */
  warnText: '#ff8b8b',
  candyColors: [0xff6b9a, 0x7bd389, 0x6ec6ff, 0xffd166, 0xb388ff] as readonly number[],
} as const;
