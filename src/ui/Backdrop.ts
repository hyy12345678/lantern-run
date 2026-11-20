import Phaser from 'phaser';
import { drawFloat } from '../core/rng';
import { drawBat, drawFog } from './drawing';
import { PAL } from './palette';

function lerpColor(a: number, b: number, t: number): number {
  const channel = (shift: number): number => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

interface Bat {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
}

/** Title-screen background: gradient sky, stars, a moon, drifting bats, and fog. */
export class Backdrop {
  private readonly bats: Phaser.GameObjects.Graphics;
  private readonly fog: Phaser.GameObjects.Graphics;
  private readonly batList: Bat[] = [];
  private readonly width: number;
  private readonly height: number;

  /** `moonX` is the moon's horizontal position as a fraction of the screen width. */
  constructor(scene: Phaser.Scene, moonX = 0.8) {
    const { width, height } = scene.scale;
    this.width = width;
    this.height = height;

    const sky = scene.add.graphics().setDepth(0);
    const bands = 40;
    for (let i = 0; i < bands; i++) {
      sky.fillStyle(lerpColor(PAL.skyTop, PAL.skyBottom, i / (bands - 1)), 1);
      sky.fillRect(0, (i / bands) * height, width, height / bands + 1);
    }

    this.drawStars(sky);
    this.drawMoon(sky, width * moonX, height * 0.22);
    this.drawSkyline(scene.add.graphics().setDepth(1));

    this.fog = scene.add.graphics().setDepth(2);
    this.bats = scene.add.graphics().setDepth(3);

    let seed = 2026;
    const next = (): number => {
      const draw = drawFloat(seed);
      seed = draw.state;
      return draw.value;
    };
    for (let i = 0; i < 6; i++) {
      this.batList.push({
        x: next() * width,
        y: height * (0.1 + next() * 0.5),
        size: 10 + next() * 10,
        speed: 25 + next() * 35,
        phase: next() * Math.PI * 2,
      });
    }
  }

  update(time: number): void {
    this.fog.clear();
    drawFog(this.fog, this.width, this.height, time, 0.12);

    this.bats.clear();
    for (const bat of this.batList) {
      const x = ((bat.x + ((time * bat.speed) / 1000)) % (this.width + 80)) - 40;
      const y = bat.y + Math.sin(time * 0.001 + bat.phase) * 14;
      drawBat(this.bats, x, y, bat.size, time * 0.012 + bat.phase);
    }
  }

  private drawStars(g: Phaser.GameObjects.Graphics): void {
    let seed = 99;
    for (let i = 0; i < 90; i++) {
      const a = drawFloat(seed);
      const b = drawFloat(a.state);
      const c = drawFloat(b.state);
      seed = c.state;
      g.fillStyle(0xfff6e0, 0.35 + c.value * 0.6);
      g.fillCircle(a.value * this.width, b.value * this.height * 0.75, 0.8 + c.value * 1.6);
    }
  }

  /** Rolling hills, a church with a lit window, and a row of headstones along the bottom edge. */
  private drawSkyline(g: Phaser.GameObjects.Graphics): void {
    const w = this.width;
    const h = this.height;
    const base = h * 0.84;

    // Far hills.
    g.fillStyle(0x24133a, 1);
    g.fillEllipse(w * 0.15, base + 30, w * 0.6, 150);
    g.fillEllipse(w * 0.75, base + 40, w * 0.8, 170);

    // Church on the right: nave, steeple, cross, and a warm window.
    const cx = w * 0.9;
    g.fillStyle(0x170b26, 1);
    g.fillRect(cx - 70, base - 60, 140, 80);
    g.fillTriangle(cx - 80, base - 60, cx + 80, base - 60, cx, base - 110);
    g.fillRect(cx - 20, base - 170, 40, 120);
    g.fillTriangle(cx - 28, base - 170, cx + 28, base - 170, cx, base - 230);
    g.fillRect(cx - 2, base - 252, 4, 24);
    g.fillRect(cx - 9, base - 244, 18, 4);
    g.fillStyle(PAL.candle, 0.2);
    g.fillCircle(cx, base - 22, 26);
    g.fillStyle(PAL.candle, 0.95);
    g.fillRoundedRect(cx - 9, base - 38, 18, 26, 8);
    g.fillStyle(PAL.candle, 0.85);
    g.fillRoundedRect(cx - 4, base - 130, 8, 14, 4);

    // Bare tree on the left.
    g.lineStyle(7, 0x170b26, 1);
    g.lineBetween(w * 0.1, base + 10, w * 0.1, base - 120);
    g.lineStyle(4, 0x170b26, 1);
    g.lineBetween(w * 0.1, base - 70, w * 0.05, base - 120);
    g.lineBetween(w * 0.1, base - 90, w * 0.15, base - 140);
    g.lineBetween(w * 0.13, base - 115, w * 0.18, base - 118);
    g.lineBetween(w * 0.07, base - 100, w * 0.03, base - 98);

    // Near ground with headstones.
    g.fillStyle(0x12081e, 1);
    g.fillRect(0, base + 10, w, h - base);
    g.fillEllipse(w * 0.5, base + 14, w * 1.2, 40);
    for (let i = 0; i < 9; i++) {
      const x = w * (0.22 + i * 0.055) + (i % 2) * 8;
      const sh = 18 + (i % 3) * 6;
      g.fillRoundedRect(x - 8, base - sh + 8, 16, sh, { tl: 8, tr: 8, bl: 0, br: 0 });
    }
  }

  private drawMoon(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      g.fillStyle(PAL.moon, 0.04 + i * 0.02);
      g.fillCircle(x, y, 90 - i * 16);
    }
    g.fillStyle(PAL.moon, 1);
    g.fillCircle(x, y, 44);
    g.fillStyle(PAL.moonShade, 0.8);
    g.fillCircle(x - 14, y - 8, 9);
    g.fillCircle(x + 16, y + 12, 6);
    g.fillCircle(x + 6, y - 18, 4);
  }
}
