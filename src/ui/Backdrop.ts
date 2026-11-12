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
