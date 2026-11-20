// Procedural cartoon art. Everything is drawn with Graphics so there are no image licensing issues.
// Each function takes a Graphics object and draws in world pixels.
// Animated functions take a `time` in ms. Pass `animTime(time)` from settings.ts to respect reduced motion.

import Phaser from 'phaser';
import type { BossPhase, GhostKind, Vec2 } from '../core/types';
import type { UpgradeId } from '../core/upgrades';
import { PAL } from './palette';
import type { ThemePalette } from './palette';

type Canvas = Phaser.GameObjects.Graphics;

/** Which neighbouring tiles of a wall are also walls. Used to join pews and slabs into one piece. */
export interface WallNeighbours {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

// Flicker frequencies, in radians per ms. 0.006 is about 0.95 Hz and 0.011 about 1.75 Hz,
// inside the style guide's 0.5 to 2 Hz range.
const FLICKER_SLOW = 0.006;
const FLICKER_FAST = 0.011;

/** Deterministic pseudo-random value in [0, 1) from tile coordinates and a salt. Used for per-tile variation. */
export function tileHash(col: number, row: number, salt = 0): number {
  const n = Math.sin(col * 127.1 + row * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// ---------------------------------------------------------------- floors and borders

/** Crypt floors get a candle where tileHash(col, row, 3) is above this. About 1 tile in 30. */
export const CRYPT_CANDLE_THRESHOLD = 0.967;
/** Candle position inside its tile, as a fraction of the tile size. */
export const CRYPT_CANDLE_OFFSET = { x: 0.65, y: 0.65 } as const;

/** Floor tile without a grid outline. Neighbouring tiles blend into one continuous ground. */
export function drawFloorTile(g: Canvas, x: number, y: number, size: number, col: number, row: number, p: ThemePalette): void {
  g.fillStyle(p.floorA, 1);
  g.fillRect(x, y, size, size);
  const h1 = tileHash(col, row, 1);
  const h2 = tileHash(col, row, 2);
  const h3 = tileHash(col, row, 3);

  // Large soft patches that cross tile edges, so the ground does not read as a board.
  if (h1 < 0.35) {
    g.fillStyle(p.floorB, 1);
    g.fillEllipse(x + size * (0.2 + h2 * 0.6), y + size * (0.2 + h3 * 0.6), size * 1.3, size * 0.9);
  }

  switch (p.floor) {
    case 'grass': {
      const tufts = h2 < 0.5 ? 2 : 1;
      for (let i = 0; i < tufts; i++) {
        const tx = x + size * (0.2 + tileHash(col, row, 10 + i) * 0.6);
        const ty = y + size * (0.3 + tileHash(col, row, 20 + i) * 0.55);
        g.lineStyle(2, i === 0 ? p.detail : p.detailLight, 0.9);
        g.lineBetween(tx, ty, tx - 3, ty - 6);
        g.lineBetween(tx, ty, tx, ty - 8);
        g.lineBetween(tx, ty, tx + 3, ty - 6);
      }
      if (h3 > 0.9) {
        g.fillStyle(0xe8d6ff, 0.8);
        g.fillCircle(x + size * 0.7, y + size * 0.4, 2);
      }
      break;
    }
    case 'flagstone': {
      // Two stones per tile with a soft gap. The split moves from row to row like real paving.
      const split = 0.35 + (row % 2) * 0.3;
      g.fillStyle(p.detailLight, 0.18);
      g.fillRoundedRect(x + 2, y + 2, size * split - 3, size - 4, 4);
      g.fillRoundedRect(x + size * split + 1, y + 2, size * (1 - split) - 3, size - 4, 4);
      g.lineStyle(2, p.detail, 0.55);
      g.lineBetween(x + size * split, y + 2, x + size * split, y + size - 2);
      if (h3 > 0.85) {
        g.lineStyle(1.5, p.detail, 0.8);
        g.lineBetween(x + size * 0.2, y + size * 0.3, x + size * 0.35, y + size * 0.5);
      }
      break;
    }
    case 'soil': {
      if (h2 < 0.4) {
        // A small curling vine leaf.
        const lx = x + size * (0.25 + h3 * 0.5);
        const ly = y + size * 0.6;
        g.lineStyle(2, p.detail, 0.9);
        g.lineBetween(lx - 6, ly + 3, lx + 6, ly - 2);
        g.fillStyle(p.detailLight, 0.95);
        g.fillEllipse(lx + 2, ly - 5, 8, 5);
      }
      if (h3 > 0.6) {
        g.fillStyle(0x2a2118, 0.8);
        g.fillCircle(x + size * (0.2 + h1 * 0.6), y + size * 0.3, 1.8);
        g.fillCircle(x + size * (0.5 + h2 * 0.3), y + size * 0.75, 1.4);
      }
      break;
    }
    case 'crypt': {
      g.lineStyle(2, p.detail, 0.7);
      if (h2 < 0.3) {
        const cx = x + size * 0.3;
        const cy = y + size * 0.2;
        g.lineBetween(cx, cy, cx + 6, cy + 7);
        g.lineBetween(cx + 6, cy + 7, cx + 3, cy + 14);
        g.lineBetween(cx + 6, cy + 7, cx + 13, cy + 10);
      }
      if (h3 > CRYPT_CANDLE_THRESHOLD) {
        // A candle stub. Its warm light makes the crypt feel lived in.
        const cx = x + size * CRYPT_CANDLE_OFFSET.x;
        const cy = y + size * CRYPT_CANDLE_OFFSET.y;
        g.fillStyle(PAL.candle, 0.18);
        g.fillCircle(cx, cy - 6, 9);
        g.fillStyle(0xf3e6c8, 1);
        g.fillRect(cx - 2.5, cy - 6, 5, 8);
        g.fillStyle(PAL.candle, 1);
        g.fillEllipse(cx, cy - 9, 3.5, 6);
      }
      break;
    }
  }
}

/** Border: a cluster of rounded bushes, tinted per theme. */
export function drawHedge(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  g.fillStyle(p.border, 1);
  g.fillRect(x, y, size, size);
  const r = size * 0.32;
  const spots: readonly Vec2[] = [
    { x: 0.25, y: 0.3 },
    { x: 0.75, y: 0.28 },
    { x: 0.5, y: 0.62 },
    { x: 0.22, y: 0.8 },
    { x: 0.8, y: 0.78 },
  ];
  for (const s of spots) {
    const cx = x + size * (s.x + (h - 0.5) * 0.06);
    const cy = y + size * s.y;
    g.fillStyle(p.borderLight, 1);
    g.fillCircle(cx, cy, r);
    g.lineStyle(2, PAL.ink, 0.8);
    g.strokeCircle(cx, cy, r);
  }
}

// ---------------------------------------------------------------- walls

/** Soft shadow to the lower right, so walls stand up from the floor. */
function wallShadow(g: Canvas, x: number, y: number, size: number): void {
  g.fillStyle(PAL.ink, 0.32);
  g.fillRoundedRect(x + 5, y + size * 0.55, size - 4, size * 0.48, 6);
}

/** Wall tile in the theme's decoration style. */
export function drawWallTile(
  g: Canvas,
  x: number,
  y: number,
  size: number,
  h: number,
  p: ThemePalette,
  n: WallNeighbours,
): void {
  wallShadow(g, x, y, size);
  switch (p.decor) {
    case 'tombstone':
      drawTombstone(g, x, y, size, h, p);
      break;
    case 'pillar':
      if (n.left || n.right) drawPew(g, x, y, size, p, n);
      else drawPillar(g, x, y, size);
      break;
    case 'hay':
      if (h < 0.28) drawPumpkinPile(g, x, y, size, h);
      else drawHayBale(g, x, y, size, h, p);
      break;
    case 'coffin':
      if (n.left || n.right) drawSlab(g, x, y, size, p, n);
      else drawCoffin(g, x, y, size, p);
      break;
  }
}

/** Graveyard wall: one of three headstone shapes, chosen per tile. */
export function drawTombstone(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  const cx = x + size / 2;
  const bottom = y + size * 0.9;
  g.fillStyle(p.wall, 1);
  g.lineStyle(2.5, PAL.ink, 1);

  if (h < 0.55) {
    // Rounded headstone with a carved cross.
    const w = size * 0.68;
    const shoulder = y + size * 0.14 + w / 2;
    g.beginPath();
    g.moveTo(cx - w / 2, bottom);
    g.lineTo(cx - w / 2, shoulder);
    g.arc(cx, shoulder, w / 2, Math.PI, 0, false);
    g.lineTo(cx + w / 2, bottom);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(p.wallLight, 0.5);
    g.fillRect(cx - w / 2 + 3, shoulder, 3, bottom - shoulder - 4);
    g.fillStyle(PAL.ink, 0.5);
    g.fillRect(cx - 1.5, shoulder - 8, 3, 16);
    g.fillRect(cx - 6, shoulder - 3, 12, 3);
  } else if (h < 0.8) {
    // Stone cross.
    const arm = size * 0.2;
    g.fillRect(cx - arm / 2, y + size * 0.1, arm, size * 0.8);
    g.strokeRect(cx - arm / 2, y + size * 0.1, arm, size * 0.8);
    g.fillRect(cx - size * 0.32, y + size * 0.3, size * 0.64, arm);
    g.strokeRect(cx - size * 0.32, y + size * 0.3, size * 0.64, arm);
    g.fillStyle(p.wallLight, 0.5);
    g.fillRect(cx - arm / 2 + 2, y + size * 0.12, 2, size * 0.75);
  } else {
    // Low slab with moss.
    g.fillRoundedRect(x + size * 0.12, y + size * 0.42, size * 0.76, size * 0.48, 5);
    g.strokeRoundedRect(x + size * 0.12, y + size * 0.42, size * 0.76, size * 0.48, 5);
    g.fillStyle(0x5b7a58, 0.9);
    g.fillEllipse(x + size * 0.3, y + size * 0.45, size * 0.3, size * 0.12);
  }
}

/** Chapel wall standing alone: a stone column with a capital and base. */
export function drawPillar(g: Canvas, x: number, y: number, size: number): void {
  const cx = x + size / 2;
  const shaft = size * 0.4;
  g.fillStyle(PAL.stone, 1);
  g.fillRect(cx - shaft / 2, y + size * 0.22, shaft, size * 0.66);
  g.fillStyle(PAL.stoneLight, 1);
  g.fillRoundedRect(cx - size * 0.36, y + size * 0.12, size * 0.72, size * 0.14, 3);
  g.fillRoundedRect(cx - size * 0.36, y + size * 0.8, size * 0.72, size * 0.12, 3);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(cx - size * 0.36, y + size * 0.12, size * 0.72, size * 0.14, 3);
  g.strokeRoundedRect(cx - size * 0.36, y + size * 0.8, size * 0.72, size * 0.12, 3);
  g.strokeRect(cx - shaft / 2, y + size * 0.22, shaft, size * 0.66);
  g.fillStyle(0xffffff, 0.25);
  g.fillRect(cx - shaft / 2 + 3, y + size * 0.26, 2, size * 0.56);
}

/** Chapel wall in a row: a wooden pew. Neighbouring pieces join into one long bench. */
export function drawPew(g: Canvas, x: number, y: number, size: number, p: ThemePalette, n: WallNeighbours): void {
  const left = n.left ? x : x + size * 0.12;
  const right = n.right ? x + size : x + size * 0.88;
  const backTop = y + size * 0.18;
  const seatTop = y + size * 0.56;
  g.fillStyle(p.wall, 1);
  g.fillRect(left, backTop, right - left, size * 0.3);
  g.fillStyle(p.wallLight, 1);
  g.fillRect(left, seatTop, right - left, size * 0.22);
  g.lineStyle(2, PAL.ink, 1);
  g.lineBetween(left, backTop, right, backTop);
  g.lineBetween(left, seatTop + size * 0.22, right, seatTop + size * 0.22);
  g.lineBetween(left, seatTop, right, seatTop);
  if (!n.left) g.strokeRect(left, backTop, 4, size * 0.6);
  if (!n.right) g.strokeRect(right - 4, backTop, 4, size * 0.6);
  // Feet.
  g.fillStyle(PAL.woodDark, 1);
  g.fillRect(x + size * 0.45, seatTop + size * 0.22, 4, size * 0.12);
}

/** Pumpkin-patch wall: a hay bale with straw lines and a tied band. */
export function drawHayBale(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  const inset = size * 0.1;
  g.fillStyle(p.wall, 1);
  g.fillRoundedRect(x + inset, y + size * 0.22, size - inset * 2, size * 0.66, 5);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(x + inset, y + size * 0.22, size - inset * 2, size * 0.66, 5);
  g.lineStyle(2, p.wallLight, 0.7);
  for (let i = 1; i <= 3; i++) {
    const ly = y + size * (0.22 + i * 0.165) + (h - 0.5) * 2;
    g.lineBetween(x + inset + 4, ly, x + size - inset - 4, ly);
  }
  g.fillStyle(PAL.wood, 1);
  g.fillRect(x + size / 2 - 2, y + size * 0.22, 4, size * 0.66);
}

/** A small candle with a pale spirit flame, standing on top of a headstone. */
export function drawSpiritCandle(g: Canvas, cx: number, top: number): void {
  g.fillStyle(0xbdf7e4, 0.25);
  g.fillCircle(cx, top - 8, 9);
  g.fillStyle(0xf3e6c8, 1);
  g.fillRect(cx - 2.5, top - 6, 5, 7);
  g.lineStyle(1.5, PAL.ink, 1);
  g.strokeRect(cx - 2.5, top - 6, 5, 7);
  g.fillStyle(0xbdf7e4, 1);
  g.fillEllipse(cx, top - 10, 4, 7);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(cx, top - 9, 1.6, 3);
}

/** A carved, lit face on the big pumpkin of a pile, so some piles glow like jack-o'-lanterns. */
export function drawCarvedFace(g: Canvas, cx: number, cy: number, r: number): void {
  g.fillStyle(PAL.candle, 1);
  g.fillTriangle(cx - r * 0.55, cy - r * 0.05, cx - r * 0.15, cy - r * 0.05, cx - r * 0.35, cy - r * 0.45);
  g.fillTriangle(cx + r * 0.15, cy - r * 0.05, cx + r * 0.55, cy - r * 0.05, cx + r * 0.35, cy - r * 0.45);
  g.beginPath();
  g.moveTo(cx - r * 0.55, cy + r * 0.2);
  g.lineTo(cx + r * 0.55, cy + r * 0.2);
  g.lineTo(cx + r * 0.3, cy + r * 0.5);
  g.lineTo(cx, cy + r * 0.35);
  g.lineTo(cx - r * 0.3, cy + r * 0.5);
  g.closePath();
  g.fillPath();
}

/** Pumpkin-patch wall: a pile of two unlit pumpkins. */
function drawPumpkinPile(g: Canvas, x: number, y: number, size: number, h: number): void {
  const pumpkin = (cx: number, cy: number, r: number): void => {
    g.fillStyle(h < 0.14 ? 0xe07a1f : 0xd9661a, 1);
    g.fillEllipse(cx, cy, r * 2.2, r * 1.8);
    g.lineStyle(2, PAL.ink, 1);
    g.strokeEllipse(cx, cy, r * 2.2, r * 1.8);
    g.lineStyle(1.5, 0x9c4510, 0.8);
    g.strokeEllipse(cx, cy, r * 0.9, r * 1.7);
    g.fillStyle(PAL.stem, 1);
    g.fillRect(cx - 1.5, cy - r - 3, 3, 5);
  };
  // Big enough to fill the tile, so the pile reads as an obstacle, not a pickup.
  pumpkin(x + size * 0.62, y + size * 0.42, size * 0.24);
  pumpkin(x + size * 0.4, y + size * 0.62, size * 0.32);
}

/** Crypt wall standing alone or in a column: a coffin. */
export function drawCoffin(g: Canvas, x: number, y: number, size: number, p: ThemePalette): void {
  const cx = x + size / 2;
  const top = y + size * 0.1;
  const bottom = y + size * 0.92;
  const w = size * 0.6;
  const points: readonly Vec2[] = [
    { x: cx - w * 0.3, y: top },
    { x: cx + w * 0.3, y: top },
    { x: cx + w * 0.5, y: top + size * 0.22 },
    { x: cx + w * 0.34, y: bottom },
    { x: cx - w * 0.34, y: bottom },
    { x: cx - w * 0.5, y: top + size * 0.22 },
  ];
  g.fillStyle(p.wall, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (const pt of points.slice(1)) g.lineTo(pt.x, pt.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();
  g.fillStyle(p.wallLight, 0.8);
  g.fillRect(cx - 1.5, top + size * 0.18, 3, size * 0.42);
  g.fillRect(cx - w * 0.2, top + size * 0.3, w * 0.4, 3);
}

/** Crypt wall in a row: a stone sarcophagus. Neighbouring pieces join into one long slab. */
function drawSlab(g: Canvas, x: number, y: number, size: number, p: ThemePalette, n: WallNeighbours): void {
  const left = n.left ? x : x + size * 0.1;
  const right = n.right ? x + size : x + size * 0.9;
  g.fillStyle(PAL.stoneDark, 1);
  g.fillRect(left, y + size * 0.3, right - left, size * 0.6);
  g.fillStyle(p.wallLight, 1);
  g.fillRect(left, y + size * 0.22, right - left, size * 0.16);
  g.lineStyle(2, PAL.ink, 1);
  g.lineBetween(left, y + size * 0.22, right, y + size * 0.22);
  g.lineBetween(left, y + size * 0.9, right, y + size * 0.9);
  if (!n.left) g.lineBetween(left, y + size * 0.22, left, y + size * 0.9);
  if (!n.right) g.lineBetween(right, y + size * 0.22, right, y + size * 0.9);
}

// ---------------------------------------------------------------- door

/**
 * Arched church door on the goal tile.
 * Locked: dim, with a padlock. Open: the door swings in and warm light pours out.
 */
export function drawDoor(g: Canvas, x: number, y: number, size: number, time: number, open = true): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
  const cx = x + size / 2;

  if (open) {
    g.fillStyle(PAL.candle, 0.14 + pulse * 0.12);
    g.fillCircle(cx, y + size / 2, size * (1 + pulse * 0.25));
  }

  g.fillStyle(PAL.stoneLight, 1);
  g.fillRoundedRect(x + 3, y + 3, size - 6, size - 3, size / 2 - 3);
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokeRoundedRect(x + 3, y + 3, size - 6, size - 3, size / 2 - 3);

  if (open) {
    // Bright doorway, with the door panel pushed to one side.
    g.fillStyle(0xfff2c8, 1);
    g.fillRoundedRect(x + 8, y + 8, size - 16, size - 8, size / 2 - 8);
    g.fillStyle(PAL.wood, 1);
    g.fillRect(x + 8, y + 12, 5, size - 12);
    g.lineStyle(2, PAL.woodDark, 1);
    g.strokeRect(x + 8, y + 12, 5, size - 12);
  } else {
    g.fillStyle(PAL.wood, 1);
    g.fillRoundedRect(x + 8, y + 8, size - 16, size - 8, size / 2 - 8);
    g.lineStyle(2, PAL.woodDark, 0.9);
    g.lineBetween(cx, y + 10, cx, y + size - 4);
    g.lineBetween(x + 10, y + size * 0.6, x + size - 10, y + size * 0.6);
    // Padlock.
    g.lineStyle(2, 0xc9c3d6, 1);
    g.strokeCircle(cx, y + size * 0.5, 3.5);
    g.fillStyle(0xc9c3d6, 1);
    g.fillRoundedRect(cx - 5, y + size * 0.52, 10, 8, 2);
  }
}

// ---------------------------------------------------------------- player and enemies

/**
 * Jack-o'-lantern with a glow whose size follows the flame value (0 to 1).
 * `flash` (0 to 1) whitens it briefly after a hit.
 */
export function drawPumpkin(
  g: Canvas,
  cx: number,
  cy: number,
  r: number,
  flame01: number,
  time: number,
  phase = 0,
  flash = 0,
): void {
  const flicker = 1 + Math.sin(time * FLICKER_SLOW + phase) * 0.03 + Math.sin(time * FLICKER_FAST + phase * 2) * 0.02;
  const glowR = r * (1.8 + 1.6 * flame01) * flicker;
  for (let i = 0; i < 4; i++) {
    g.fillStyle(PAL.candle, 0.05 + i * 0.05);
    g.fillCircle(cx, cy, glowR * (1 - i * 0.2));
  }

  g.fillStyle(PAL.pumpkin, 1);
  g.fillEllipse(cx, cy, r * 2.1, r * 1.8);
  g.lineStyle(r * 0.12, PAL.pumpkinDark, 0.6);
  g.strokeEllipse(cx - r * 0.42, cy, r * 0.8, r * 1.7);
  g.strokeEllipse(cx + r * 0.42, cy, r * 0.8, r * 1.7);
  g.fillStyle(PAL.pumpkinLight, 0.55);
  g.fillEllipse(cx - r * 0.45, cy - r * 0.42, r * 0.5, r * 0.3);
  g.lineStyle(Math.max(2, r * 0.12), PAL.ink, 1);
  g.strokeEllipse(cx, cy, r * 2.1, r * 1.8);

  g.fillStyle(PAL.stem, 1);
  g.fillRoundedRect(cx - r * 0.14, cy - r * 0.95, r * 0.28, r * 0.4, 2);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(cx - r * 0.14, cy - r * 0.95, r * 0.28, r * 0.4, 2);

  // Triangle eyes, lit from inside. They dim as the flame runs low.
  const eyeAlpha = 0.45 + 0.55 * flame01;
  const eyes = [cx - r * 0.45, cx + r * 0.45];
  for (const ex of eyes) {
    g.fillStyle(PAL.candle, eyeAlpha);
    g.fillTriangle(ex - r * 0.2, cy - r * 0.12, ex + r * 0.2, cy - r * 0.12, ex, cy - r * 0.5);
    g.lineStyle(Math.max(1.5, r * 0.08), PAL.ink, 1);
    g.strokeTriangle(ex - r * 0.2, cy - r * 0.12, ex + r * 0.2, cy - r * 0.12, ex, cy - r * 0.5);
  }

  // Toothy grin.
  g.fillStyle(PAL.ink, 1);
  g.beginPath();
  g.moveTo(cx - r * 0.6, cy + r * 0.2);
  g.lineTo(cx + r * 0.6, cy + r * 0.2);
  g.lineTo(cx + r * 0.42, cy + r * 0.55);
  g.lineTo(cx + r * 0.2, cy + r * 0.3);
  g.lineTo(cx, cy + r * 0.6);
  g.lineTo(cx - r * 0.2, cy + r * 0.3);
  g.lineTo(cx - r * 0.42, cy + r * 0.55);
  g.closePath();
  g.fillPath();

  if (flash > 0) {
    g.fillStyle(0xffffff, 0.65 * flash);
    g.fillEllipse(cx, cy, r * 2.1, r * 1.8);
  }
}

/**
 * The Pumpkin King: a large jack-o'-lantern in a purple cape, with a gold crown and angry brows.
 * While winding up it glows red and trembles. While dashing its cape streams behind it.
 */
export function drawPumpkinKing(
  g: Canvas,
  cx: number,
  cy: number,
  r: number,
  time: number,
  phase: BossPhase = 'chase',
  dashDir: Vec2 = { x: 1, y: 0 },
): void {
  let x = cx;
  if (phase === 'windup') {
    x += Math.sin(time * 0.09) * 2;
    g.fillStyle(PAL.danger, 0.25 + 0.15 * Math.sin(time * 0.02));
    g.fillCircle(x, cy, r * 2);
  }

  const sway = Math.sin(time * 0.004) * r * 0.12;
  const trail = phase === 'dash' ? { x: -dashDir.x * r * 0.9, y: -dashDir.y * r * 0.9 } : { x: sway, y: 0 };
  g.fillStyle(0x3a1d4d, 0.95);
  g.beginPath();
  g.moveTo(x - r * 1.05, cy + r * 0.1);
  g.lineTo(x + r * 1.05, cy + r * 0.1);
  g.lineTo(x + r * 0.6 + trail.x, cy + r * 1.7 + trail.y);
  g.lineTo(x - r * 0.2 + trail.x, cy + r * 1.3 + trail.y);
  g.lineTo(x - r * 0.7 + trail.x, cy + r * 1.75 + trail.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();

  drawPumpkin(g, x, cy, r, 1, time, 2.2);

  const crown: readonly [number, number][] = [
    [-0.7, -0.9],
    [-0.7, -1.3],
    [-0.35, -1.05],
    [0, -1.5],
    [0.35, -1.05],
    [0.7, -1.3],
    [0.7, -0.9],
  ];
  g.fillStyle(PAL.candle, 1);
  g.beginPath();
  g.moveTo(x + crown[0][0] * r, cy + crown[0][1] * r);
  for (const [px, py] of crown.slice(1)) g.lineTo(x + px * r, cy + py * r);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();
  g.fillStyle(PAL.danger, 1);
  g.fillCircle(x, cy - r * 0.95, r * 0.09);

  g.lineStyle(Math.max(2.5, r * 0.12), PAL.ink, 1);
  g.lineBetween(x - r * 0.7, cy - r * 0.42, x - r * 0.2, cy - r * 0.22);
  g.lineBetween(x + r * 0.7, cy - r * 0.42, x + r * 0.2, cy - r * 0.22);
}

/**
 * Dashed warning line showing where the Pumpkin King is about to dash.
 * `progress` (0 to 1) fills the line as the wind-up runs out.
 */
export function drawDashWarning(g: Canvas, from: Vec2, dir: Vec2, reach: number, progress: number): void {
  const dash = 12;
  const gap = 8;
  const filled = reach * Math.min(1, Math.max(0, progress));
  g.lineStyle(4, PAL.danger, 0.85);
  for (let d = 30; d < reach; d += dash + gap) {
    const end = Math.min(d + dash, reach);
    g.lineStyle(4, PAL.danger, d < filled ? 0.95 : 0.35);
    g.lineBetween(from.x + dir.x * d, from.y + dir.y * d, from.x + dir.x * end, from.y + dir.y * end);
  }
  const tip = { x: from.x + dir.x * reach, y: from.y + dir.y * reach };
  const side = { x: -dir.y, y: dir.x };
  g.fillStyle(PAL.danger, 0.9);
  g.fillTriangle(
    tip.x + dir.x * 10,
    tip.y + dir.y * 10,
    tip.x + side.x * 8,
    tip.y + side.y * 8,
    tip.x - side.x * 8,
    tip.y - side.y * 8,
  );
}

export interface GhostCues {
  /** Chase ghost is coming for the player: draw a "!" above it. */
  chasing?: boolean;
  /** 0 = fully visible, 1 = gone. Used as a blink ghost is about to teleport. */
  fade?: number;
}

/** Cartoon ghost with a wavy hem and optional cues for what it is about to do. */
export function drawGhost(
  g: Canvas,
  cx: number,
  cy: number,
  r: number,
  kind: GhostKind,
  time: number,
  phase: number,
  cues: GhostCues = {},
): void {
  const y = cy + Math.sin(time * 0.004 + phase) * r * 0.12;
  const body = kind === 'chase' ? PAL.ghostChase : kind === 'blink' ? PAL.ghostBlink : PAL.ghostPatrol;
  const visible = 1 - (cues.fade ?? 0);
  const alpha = 0.92 * visible;
  if (alpha <= 0.02) return;

  const outline: Vec2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    outline.push({ x: cx + Math.cos(a) * r, y: y - r * 0.1 + Math.sin(a) * r });
  }
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    outline.push({ x: cx + r - t * 2 * r, y: y + r * 0.85 + Math.sin(t * Math.PI * 3 + time * 0.005) * r * 0.2 });
  }

  // Soft halo so the ghost reads against dark floors.
  g.fillStyle(body, 0.16 * visible);
  g.fillCircle(cx, y + r * 0.2, r * 1.8);

  g.fillStyle(body, alpha);
  g.beginPath();
  g.moveTo(outline[0].x, outline[0].y);
  for (const p of outline.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, visible);
  g.strokePath();

  g.fillStyle(PAL.ink, visible);
  g.fillEllipse(cx - r * 0.35, y - r * 0.1, r * 0.24, r * 0.34);
  g.fillEllipse(cx + r * 0.35, y - r * 0.1, r * 0.24, r * 0.34);
  g.fillStyle(0xffffff, 0.9 * visible);
  g.fillCircle(cx - r * 0.3, y - r * 0.2, r * 0.07);
  g.fillCircle(cx + r * 0.4, y - r * 0.2, r * 0.07);

  g.fillStyle(PAL.blush, 0.55 * visible);
  g.fillCircle(cx - r * 0.6, y + r * 0.22, r * 0.16);
  g.fillCircle(cx + r * 0.6, y + r * 0.22, r * 0.16);

  g.fillStyle(PAL.ink, visible);
  g.fillEllipse(cx, y + r * 0.35, r * 0.22, r * 0.18);

  if (kind === 'chase') {
    g.lineStyle(3, PAL.ink, visible);
    g.lineBetween(cx - r * 0.6, y - r * 0.42, cx - r * 0.15, y - r * 0.28);
    g.lineBetween(cx + r * 0.6, y - r * 0.42, cx + r * 0.15, y - r * 0.28);
  }

  if (cues.chasing) {
    // "!" above the head.
    const mx = cx + r * 0.9;
    const my = y - r * 1.5;
    g.fillStyle(PAL.danger, 1);
    g.fillCircle(mx, my, 7);
    g.lineStyle(2, PAL.ink, 1);
    g.strokeCircle(mx, my, 7);
    g.fillStyle(0xffffff, 1);
    g.fillRect(mx - 1.2, my - 4.5, 2.4, 5.5);
    g.fillCircle(mx, my + 3, 1.4);
  }

  if ((cues.fade ?? 0) > 0) {
    drawSparkle(g, cx - r * 0.8, y - r * 0.6, 4, 0.8 * (cues.fade ?? 0));
    drawSparkle(g, cx + r * 0.7, y + r * 0.3, 3, 0.8 * (cues.fade ?? 0));
  }
}

/** Wrapped candy that bobs and sparkles. */
export function drawCandy(g: Canvas, cx: number, cy: number, color: number, time: number, phase: number): void {
  const y = cy + Math.sin(time * 0.005 + phase) * 2.5;
  const s = 9;
  const left: [number, number, number, number, number, number] = [cx - s * 0.9, y, cx - s * 2.1, y - s * 0.9, cx - s * 2.1, y + s * 0.9];
  const right: [number, number, number, number, number, number] = [cx + s * 0.9, y, cx + s * 2.1, y - s * 0.9, cx + s * 2.1, y + s * 0.9];

  g.fillStyle(color, 0.18);
  g.fillCircle(cx, y, s * 2.4);

  g.fillStyle(color, 1);
  g.fillTriangle(...left);
  g.fillTriangle(...right);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeTriangle(...left);
  g.strokeTriangle(...right);

  g.fillStyle(color, 1);
  g.fillEllipse(cx, y, s * 2.2, s * 1.7);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeEllipse(cx, y, s * 2.2, s * 1.7);
  g.lineStyle(2, 0xffffff, 0.5);
  g.lineBetween(cx - s * 0.2, y - s * 0.7, cx - s * 0.2, y + s * 0.7);

  drawSparkle(g, cx + s * 0.8, y - s * 0.7, 3.5, 0.6 + 0.4 * Math.sin(time * 0.008 + phase));
}

export function drawSparkle(g: Canvas, x: number, y: number, s: number, alpha: number): void {
  g.fillStyle(0xffffff, alpha);
  g.fillTriangle(x, y - s, x + s * 0.28, y, x, y + s);
  g.fillTriangle(x - s, y, x, y - s * 0.28, x + s, y);
}

// ---------------------------------------------------------------- ambience

/** Bat silhouette with flapping wings. `flap` is an angle in radians. */
export function drawBat(g: Canvas, x: number, y: number, s: number, flap: number): void {
  const lift = Math.sin(flap) * s * 0.45;
  g.fillStyle(PAL.ink, 0.9);
  g.fillTriangle(x, y, x - s * 1.3, y - s * 0.4 - lift, x - s * 0.5, y + s * 0.2);
  g.fillTriangle(x, y, x + s * 1.3, y - s * 0.4 - lift, x + s * 0.5, y + s * 0.2);
  g.fillEllipse(x, y, s * 0.5, s * 0.45);
  g.fillCircle(x - s * 0.14, y - s * 0.28, s * 0.12);
  g.fillCircle(x + s * 0.14, y - s * 0.28, s * 0.12);
}

/** Soft drifting fog bands. Speeds are 6 to 18 px/s, under the style guide's 20 px/s limit. */
export function drawFog(g: Canvas, width: number, height: number, time: number, alpha: number): void {
  for (let i = 0; i < 5; i++) {
    const speed = 6 + i * 3;
    const span = width + 480;
    const x = ((time * speed * 0.001 + i * 230) % span) - 240;
    const y = height * (0.2 + i * 0.17);
    g.fillStyle(PAL.fog, alpha);
    g.fillEllipse(x, y, 460, 90);
    g.fillStyle(PAL.fog, alpha * 0.6);
    g.fillEllipse(x + 120, y + 25, 300, 60);
  }
}

/**
 * Fireflies that drift slowly and pulse. They are drawn above the darkness,
 * so they glow in the parts of the room the lantern does not reach.
 */
export function drawFireflies(g: Canvas, width: number, height: number, time: number, count: number, color: number): void {
  for (let i = 0; i < count; i++) {
    const bx = tileHash(i, 7, 1) * width;
    const by = 40 + tileHash(i, 7, 2) * (height - 60);
    const speed = 0.0004 + tileHash(i, 7, 3) * 0.0004;
    // Small loops: at most about 14 px/s.
    const x = bx + Math.sin(time * speed + i) * 22;
    const y = by + Math.cos(time * speed * 1.3 + i * 2) * 14;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.003 + i * 1.7);
    g.fillStyle(color, 0.12 * pulse + 0.04);
    g.fillCircle(x, y, 7);
    g.fillStyle(color, 0.55 * pulse + 0.25);
    g.fillCircle(x, y, 1.8);
  }
}

// ---------------------------------------------------------------- icons

/** Small icon for each upgrade. Drawn inside a `size` x `size` square centered on (cx, cy). */
export function drawUpgradeIcon(g: Canvas, cx: number, cy: number, size: number, id: UpgradeId): void {
  const s = size / 2;
  switch (id) {
    case 'brightWick': {
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy + s * 0.25, s * 0.5);
      g.fillTriangle(cx - s * 0.5, cy + s * 0.2, cx + s * 0.5, cy + s * 0.2, cx, cy - s * 0.9);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, cy + s * 0.3, s * 0.2);
      break;
    }
    case 'swiftFeet': {
      g.lineStyle(Math.max(2, s * 0.22), 0x6ec6ff, 1);
      for (let i = -1; i <= 1; i++) {
        const ox = cx + i * s * 0.55 - s * 0.2;
        g.lineBetween(ox - s * 0.25, cy - s * 0.5, ox + s * 0.2, cy);
        g.lineBetween(ox + s * 0.2, cy, ox - s * 0.25, cy + s * 0.5);
      }
      break;
    }
    case 'quickBreath': {
      g.lineStyle(Math.max(2, s * 0.2), 0xffffff, 0.95);
      for (let i = 0; i < 3; i++) {
        const y = cy - s * 0.5 + i * s * 0.5;
        g.lineBetween(cx - s * 0.8, y, cx + s * 0.3 - i * s * 0.1, y);
        g.strokeCircle(cx + s * 0.35, y, s * 0.15);
      }
      break;
    }
    case 'thickWax': {
      g.fillStyle(0xf3e6c8, 1);
      g.fillRoundedRect(cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 1.0, Math.min(3, s * 0.2));
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy - s * 0.25, s * 0.25);
      g.fillStyle(0xf3e6c8, 1);
      g.fillCircle(cx + s * 0.35, cy + s * 0.3, s * 0.12);
      g.lineStyle(1.5, PAL.ink, 0.8);
      g.strokeRoundedRect(cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 1.0, Math.min(3, s * 0.2));
      break;
    }
    case 'ironPumpkin': {
      g.fillStyle(0xa9b4c2, 1);
      g.beginPath();
      g.moveTo(cx - s * 0.7, cy - s * 0.7);
      g.lineTo(cx + s * 0.7, cy - s * 0.7);
      g.lineTo(cx + s * 0.7, cy + s * 0.05);
      g.lineTo(cx, cy + s * 0.9);
      g.lineTo(cx - s * 0.7, cy + s * 0.05);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, PAL.ink, 1);
      g.strokePath();
      g.fillStyle(PAL.pumpkin, 1);
      g.fillCircle(cx, cy - s * 0.05, s * 0.3);
      break;
    }
    case 'sweetTooth': {
      // Lollipop.
      g.lineStyle(Math.max(2, s * 0.14), 0xf3e6c8, 1);
      g.lineBetween(cx, cy, cx, cy + s * 0.95);
      g.fillStyle(0xff6b9a, 1);
      g.fillCircle(cx, cy - s * 0.25, s * 0.6);
      g.lineStyle(Math.max(1.5, s * 0.12), 0xffffff, 0.9);
      g.beginPath();
      g.arc(cx, cy - s * 0.25, s * 0.35, 0, Math.PI * 1.4, false);
      g.strokePath();
      g.lineStyle(1.5, PAL.ink, 0.9);
      g.strokeCircle(cx, cy - s * 0.25, s * 0.6);
      break;
    }
    case 'hungryFlame': {
      // A big red flame with a jagged mouth: more fuel, more hunger.
      g.fillStyle(PAL.ember, 1);
      g.fillCircle(cx, cy + s * 0.3, s * 0.6);
      g.fillTriangle(cx - s * 0.6, cy + s * 0.25, cx + s * 0.6, cy + s * 0.25, cx, cy - s * 1.0);
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy + s * 0.4, s * 0.3);
      g.fillStyle(PAL.ink, 1);
      g.fillTriangle(cx - s * 0.3, cy + s * 0.2, cx - s * 0.1, cy + s * 0.2, cx - s * 0.2, cy + s * 0.42);
      g.fillTriangle(cx + s * 0.1, cy + s * 0.2, cx + s * 0.3, cy + s * 0.2, cx + s * 0.2, cy + s * 0.42);
      break;
    }
    case 'lastEmber': {
      // A small ember inside a protective ring.
      g.lineStyle(Math.max(2, s * 0.14), PAL.candle, 0.9);
      g.strokeCircle(cx, cy, s * 0.8);
      g.fillStyle(PAL.ember, 1);
      g.fillCircle(cx, cy + s * 0.15, s * 0.3);
      g.fillTriangle(cx - s * 0.3, cy + s * 0.1, cx + s * 0.3, cy + s * 0.1, cx, cy - s * 0.45);
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy + s * 0.18, s * 0.13);
      break;
    }
  }
}
