// Colors and fonts from .kiro/steering/style-guide.md, plus cartoon-specific ink and accents.

import type { ThemeId } from '../core/types';

export const FONT = 'Fredoka, "Trebuchet MS", Arial, sans-serif';

export type WallDecor = 'tombstone' | 'pillar' | 'hay' | 'coffin';

/** Colors and wall decoration for one room theme. Themes change looks only, never rules. */
export interface ThemePalette {
  floorA: number;
  floorB: number;
  floorEdge: number;
  border: number;
  borderLight: number;
  wall: number;
  wallLight: number;
  decor: WallDecor;
}

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  graveyard: {
    floorA: 0x31275a,
    floorB: 0x3a2e66,
    floorEdge: 0x1f1738,
    border: 0x1f4a44,
    borderLight: 0x2f6b5f,
    wall: 0x6f6890,
    wallLight: 0xa39bc4,
    decor: 'tombstone',
  },
  chapel: {
    floorA: 0x3b4d6b,
    floorB: 0x435877,
    floorEdge: 0x1d2a3d,
    border: 0x2a3550,
    borderLight: 0x46597e,
    wall: 0xc9c3d6,
    wallLight: 0xf0ecf7,
    decor: 'pillar',
  },
  pumpkinPatch: {
    floorA: 0x3f4a24,
    floorB: 0x4a5a2b,
    floorEdge: 0x242c12,
    border: 0x2e4a1c,
    borderLight: 0x4f7a2e,
    wall: 0xd9a441,
    wallLight: 0xf0c864,
    decor: 'hay',
  },
  crypt: {
    floorA: 0x3a1a22,
    floorB: 0x4a2029,
    floorEdge: 0x1d0b10,
    border: 0x1a1a1f,
    borderLight: 0x3a3a46,
    wall: 0x5b2b2b,
    wallLight: 0x7a3d3d,
    decor: 'coffin',
  },
};

export const PAL = {
  ink: 0x1b0f24,
  skyTop: 0x0d0720,
  skyBottom: 0x3a1f55,
  moon: 0xfff1c1,
  moonShade: 0xe9d49a,
  floorA: 0x31275a,
  floorB: 0x3a2e66,
  floorEdge: 0x1f1738,
  hedge: 0x1f4a44,
  hedgeLight: 0x2f6b5f,
  stone: 0x6f6890,
  stoneLight: 0xa39bc4,
  stoneDark: 0x4a4368,
  pumpkin: 0xff8a00,
  pumpkinDark: 0xc95f00,
  pumpkinLight: 0xffb347,
  stem: 0x4f7a2e,
  candle: 0xffd166,
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
  /** Same value as `text`, as a number for places that need a hex string. */
  textHex: '#f5f0ff',
  textSoft: '#c9b8e6',
  accentText: '#ffb347',
  candyColors: [0xff6b9a, 0x7bd389, 0x6ec6ff, 0xffd166, 0xb388ff] as readonly number[],
} as const;
