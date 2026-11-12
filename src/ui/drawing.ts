// Procedural cartoon art. Everything is drawn with Graphics so there are no image licensing issues.
// Each function takes a Graphics object and draws in world pixels.

import Phaser from 'phaser';
import type { GhostKind, Vec2 } from '../core/types';
import type { UpgradeId } from '../core/upgrades';
import { PAL } from './palette';
import type { ThemePalette, WallDecor } from './palette';

type Canvas = Phaser.GameObjects.Graphics;

/** Deterministic pseudo-random value in [0, 1) from tile coordinates. Used for small per-tile variation. */
export function tileHash(col: number, row: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function drawFloorTile(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  g.fillStyle(h < 0.5 ? p.floorA : p.floorB, 1);
  g.fillRect(x, y, size, size);
  // Cobblestone: a rounded stone with a lighter top edge and a dark outline.
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(x + 3, y + 3, size - 6, (size - 6) * 0.45, 6);
  g.lineStyle(2, p.floorEdge, 0.8);
  g.strokeRoundedRect(x + 2, y + 2, size - 4, size - 4, 6);
  g.fillStyle(p.floorEdge, 0.5);
  g.fillCircle(x + size * (0.3 + h * 0.4), y + size * 0.62, 2);
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

/** Wall tile, drawn in the theme's decoration style. */
export function drawWallTile(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  const draw: Record<WallDecor, () => void> = {
    tombstone: () => drawTombstone(g, x, y, size, h, p),
    pillar: () => drawPillar(g, x, y, size, p),
    hay: () => drawHayBale(g, x, y, size, h, p),
    coffin: () => drawCoffin(g, x, y, size, p),
  };
  draw[p.decor]();
}

/** Graveyard wall: a tombstone with a rounded top, a cross, and a soft shadow. */
export function drawTombstone(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  const w = size * 0.68;
  const cx = x + size / 2;
  const top = y + size * 0.14;
  const bottom = y + size * 0.9;
  const shoulder = top + w / 2;

  g.fillStyle(PAL.ink, 0.35);
  g.fillEllipse(cx, bottom + 2, w * 1.1, 7);

  g.fillStyle(p.wall, 1);
  g.beginPath();
  g.moveTo(cx - w / 2, bottom);
  g.lineTo(cx - w / 2, shoulder);
  g.arc(cx, shoulder, w / 2, Math.PI, 0, false);
  g.lineTo(cx + w / 2, bottom);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();

  g.fillStyle(p.wallLight, 0.5);
  g.fillRect(cx - w / 2 + 3, shoulder, 3, bottom - shoulder - 4);

  const crossAlpha = 0.45 + h * 0.2;
  g.fillStyle(PAL.ink, crossAlpha);
  g.fillRect(cx - 1.5, shoulder - 8, 3, 16);
  g.fillRect(cx - 6, shoulder - 3, 12, 3);
}

/** Chapel wall: a stone column with a capital and base. */
export function drawPillar(g: Canvas, x: number, y: number, size: number, p: ThemePalette): void {
  const cx = x + size / 2;
  const shaft = size * 0.4;
  g.fillStyle(PAL.ink, 0.35);
  g.fillEllipse(cx, y + size * 0.94, size * 0.7, 6);

  g.fillStyle(p.wall, 1);
  g.fillRect(cx - shaft / 2, y + size * 0.22, shaft, size * 0.66);
  g.fillStyle(p.wallLight, 1);
  g.fillRoundedRect(cx - size * 0.36, y + size * 0.12, size * 0.72, size * 0.14, 3);
  g.fillRoundedRect(cx - size * 0.36, y + size * 0.8, size * 0.72, size * 0.12, 3);
  g.lineStyle(2, PAL.ink, 1);
  g.strokeRoundedRect(cx - size * 0.36, y + size * 0.12, size * 0.72, size * 0.14, 3);
  g.strokeRoundedRect(cx - size * 0.36, y + size * 0.8, size * 0.72, size * 0.12, 3);
  g.strokeRect(cx - shaft / 2, y + size * 0.22, shaft, size * 0.66);
  g.fillStyle(p.wallLight, 0.6);
  g.fillRect(cx - shaft / 2 + 3, y + size * 0.26, 2, size * 0.56);
}

/** Pumpkin-patch wall: a hay bale with straw lines and a tied band. */
export function drawHayBale(g: Canvas, x: number, y: number, size: number, h: number, p: ThemePalette): void {
  const inset = size * 0.1;
  g.fillStyle(PAL.ink, 0.35);
  g.fillEllipse(x + size / 2, y + size * 0.92, size * 0.8, 6);

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

/** Crypt wall: a coffin shape with a cross on the lid. */
export function drawCoffin(g: Canvas, x: number, y: number, size: number, p: ThemePalette): void {
  const cx = x + size / 2;
  const top = y + size * 0.18;
  const bottom = y + size * 0.9;
  const w = size * 0.56;
  const points: readonly Vec2[] = [
    { x: cx - w * 0.5, y: top + size * 0.12 },
    { x: cx, y: top },
    { x: cx + w * 0.5, y: top + size * 0.12 },
    { x: cx + w * 0.42, y: bottom },
    { x: cx - w * 0.42, y: bottom },
  ];
  g.fillStyle(p.wall, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (const pt of points.slice(1)) g.lineTo(pt.x, pt.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();
  g.fillStyle(p.wallLight, 0.6);
  g.fillRect(cx - 1.5, top + size * 0.2, 3, size * 0.5);
  g.fillRect(cx - w * 0.2, top + size * 0.34, w * 0.4, 3);
}

/** Arched church door on the goal tile. The window light pulses when `open`, and stays dim when locked. */
export function drawDoor(g: Canvas, x: number, y: number, size: number, time: number, open = true): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
  g.fillStyle(PAL.candle, open ? 0.12 + pulse * 0.12 : 0.02);
  g.fillCircle(x + size / 2, y + size / 2, size * (0.9 + pulse * 0.2));

  g.fillStyle(PAL.stoneLight, 1);
  g.fillRoundedRect(x + 3, y + 3, size - 6, size - 3, size / 2 - 3);
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokeRoundedRect(x + 3, y + 3, size - 6, size - 3, size / 2 - 3);

  g.fillStyle(PAL.wood, 1);
  g.fillRoundedRect(x + 8, y + 8, size - 16, size - 8, size / 2 - 8);
  g.lineStyle(2, PAL.woodDark, 0.9);
  g.lineBetween(x + size / 2, y + 10, x + size / 2, y + size - 4);
  g.lineBetween(x + 10, y + size * 0.6, x + size - 10, y + size * 0.6);

  g.fillStyle(PAL.candle, open ? 0.9 + pulse * 0.1 : 0.2);
  g.fillCircle(x + size - 13, y + size * 0.55, 2.5);
}

/** Jack-o'-lantern with a glow whose size follows the flame value (0 to 1). */
export function drawPumpkin(g: Canvas, cx: number, cy: number, r: number, flame01: number, time: number, phase = 0): void {
  const flicker = 1 + Math.sin(time * 0.013 + phase) * 0.03 + Math.sin(time * 0.037 + phase * 2) * 0.02;
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

  // Triangle eyes, lit from inside.
  const eyes = [cx - r * 0.45, cx + r * 0.45];
  for (const ex of eyes) {
    g.fillStyle(PAL.candle, 1);
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
}

/**
 * The Pumpkin King: a large jack-o'-lantern in a flapping purple cape, with a gold crown
 * and angry brows. It is the boss room's only enemy.
 */
export function drawPumpkinKing(g: Canvas, cx: number, cy: number, r: number, time: number): void {
  const sway = Math.sin(time * 0.004) * r * 0.12;
  g.fillStyle(0x3a1d4d, 0.95);
  g.beginPath();
  g.moveTo(cx - r * 1.05, cy + r * 0.1);
  g.lineTo(cx + r * 1.05, cy + r * 0.1);
  g.lineTo(cx + r * 0.6 + sway, cy + r * 1.7);
  g.lineTo(cx - r * 0.2 + sway, cy + r * 1.3);
  g.lineTo(cx - r * 0.7 + sway, cy + r * 1.75);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();

  drawPumpkin(g, cx, cy, r, 1, time, 2.2);

  // Crown, drawn as a zig-zag polygon above the stem.
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
  g.moveTo(cx + crown[0][0] * r, cy + crown[0][1] * r);
  for (const [px, py] of crown.slice(1)) g.lineTo(cx + px * r, cy + py * r);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();
  g.fillStyle(PAL.danger, 1);
  g.fillCircle(cx, cy - r * 0.95, r * 0.09);

  // Angry brows.
  g.lineStyle(Math.max(2.5, r * 0.12), PAL.ink, 1);
  g.lineBetween(cx - r * 0.7, cy - r * 0.42, cx - r * 0.2, cy - r * 0.22);
  g.lineBetween(cx + r * 0.7, cy - r * 0.42, cx + r * 0.2, cy - r * 0.22);
}

/** Cartoon ghost with a wavy hem. Blink ghosts fade in and out. */
export function drawGhost(g: Canvas, cx: number, cy: number, r: number, kind: GhostKind, time: number, phase: number): void {
  const y = cy + Math.sin(time * 0.004 + phase) * r * 0.12;
  const body = kind === 'chase' ? PAL.ghostChase : kind === 'blink' ? PAL.ghostBlink : PAL.ghostPatrol;
  const alpha = kind === 'blink' ? 0.6 + 0.3 * Math.sin(time * 0.006 + phase) : 0.95;

  const outline: Vec2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    outline.push({ x: cx + Math.cos(a) * r, y: y - r * 0.1 + Math.sin(a) * r });
  }
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    outline.push({ x: cx + r - t * 2 * r, y: y + r * 0.85 + Math.sin(t * Math.PI * 3) * r * 0.2 });
  }

  g.fillStyle(body, alpha);
  g.beginPath();
  g.moveTo(outline[0].x, outline[0].y);
  for (const p of outline.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.5, PAL.ink, 1);
  g.strokePath();

  g.fillStyle(PAL.ink, 1);
  g.fillEllipse(cx - r * 0.35, y - r * 0.1, r * 0.24, r * 0.34);
  g.fillEllipse(cx + r * 0.35, y - r * 0.1, r * 0.24, r * 0.34);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - r * 0.3, y - r * 0.2, r * 0.07);
  g.fillCircle(cx + r * 0.4, y - r * 0.2, r * 0.07);

  g.fillStyle(PAL.blush, 0.55);
  g.fillCircle(cx - r * 0.6, y + r * 0.22, r * 0.16);
  g.fillCircle(cx + r * 0.6, y + r * 0.22, r * 0.16);

  g.fillStyle(PAL.ink, 1);
  g.fillEllipse(cx, y + r * 0.35, r * 0.22, r * 0.18);

  if (kind === 'chase') {
    g.lineStyle(3, PAL.ink, 1);
    g.lineBetween(cx - r * 0.6, y - r * 0.42, cx - r * 0.15, y - r * 0.28);
    g.lineBetween(cx + r * 0.6, y - r * 0.42, cx + r * 0.15, y - r * 0.28);
  }
}

/** Wrapped candy that bobs and sparkles. */
export function drawCandy(g: Canvas, cx: number, cy: number, color: number, time: number, phase: number): void {
  const y = cy + Math.sin(time * 0.005 + phase) * 2.5;
  const s = 9;
  const left: [number, number, number, number, number, number] = [cx - s * 0.9, y, cx - s * 2.1, y - s * 0.9, cx - s * 2.1, y + s * 0.9];
  const right: [number, number, number, number, number, number] = [cx + s * 0.9, y, cx + s * 2.1, y - s * 0.9, cx + s * 2.1, y + s * 0.9];

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

/** Soft drifting fog bands. Drawn under the entities. */
export function drawFog(g: Canvas, width: number, height: number, time: number, alpha: number): void {
  for (let i = 0; i < 5; i++) {
    const speed = 12 + i * 4;
    const span = width + 480;
    const x = ((time * speed * 0.001 + i * 230) % span) - 240;
    const y = height * (0.2 + i * 0.17);
    g.fillStyle(PAL.fog, alpha);
    g.fillEllipse(x, y, 460, 90);
    g.fillStyle(PAL.fog, alpha * 0.6);
    g.fillEllipse(x + 120, y + 25, 300, 60);
  }
}

/** Small icon for each upgrade. Drawn inside a `size` x `size` square centered on (cx, cy). */
export function drawUpgradeIcon(g: Canvas, cx: number, cy: number, size: number, id: UpgradeId): void {
  const s = size / 2;
  switch (id) {
    case 'brightWick': {
      // Flame: a teardrop with a bright core.
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy + s * 0.25, s * 0.5);
      g.fillTriangle(cx - s * 0.5, cy + s * 0.2, cx + s * 0.5, cy + s * 0.2, cx, cy - s * 0.9);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, cy + s * 0.3, s * 0.2);
      break;
    }
    case 'swiftFeet': {
      // Three speed chevrons.
      g.lineStyle(Math.max(2, s * 0.22), 0x6ec6ff, 1);
      for (let i = -1; i <= 1; i++) {
        const ox = cx + i * s * 0.55 - s * 0.2;
        g.lineBetween(ox - s * 0.25, cy - s * 0.5, ox + s * 0.2, cy);
        g.lineBetween(ox + s * 0.2, cy, ox - s * 0.25, cy + s * 0.5);
      }
      break;
    }
    case 'quickBreath': {
      // Wind: three curling lines.
      g.lineStyle(Math.max(2, s * 0.2), 0xffffff, 0.95);
      for (let i = 0; i < 3; i++) {
        const y = cy - s * 0.5 + i * s * 0.5;
        g.lineBetween(cx - s * 0.8, y, cx + s * 0.3 - i * s * 0.1, y);
        g.strokeCircle(cx + s * 0.35, y, s * 0.15);
      }
      break;
    }
    case 'thickWax': {
      // Candle with a drip.
      g.fillStyle(0xf3e6c8, 1);
      g.fillRoundedRect(cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 1.0, 3);
      g.fillStyle(PAL.candle, 1);
      g.fillCircle(cx, cy - s * 0.25, s * 0.25);
      g.fillStyle(0xf3e6c8, 1);
      g.fillCircle(cx + s * 0.35, cy + s * 0.3, s * 0.12);
      g.lineStyle(1.5, PAL.ink, 0.8);
      g.strokeRoundedRect(cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 1.0, 3);
      break;
    }
    case 'ironPumpkin': {
      // Shield with a small pumpkin on it.
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
  }
}
