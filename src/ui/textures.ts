import Phaser from 'phaser';
import { drawCandy } from './drawing';
import { PAL } from './palette';

export const TEX = {
  spark: 'fx-spark',
  smoke: 'fx-smoke',
  leaf: 'fx-leaf',
  candy: (i: number): string => `fx-candy-${i}`,
} as const;

/** Small radial dot, white so particles can tint it. */
function radialDot(scene: Phaser.Scene, key: string, radius: number, stops: readonly [number, number][]): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, radius * 2, radius * 2);
  if (!canvas) return;
  const ctx = canvas.getContext();
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, radius * 2, radius * 2);
  canvas.refresh();
}

/** Generates the particle and icon textures once per game. Everything is drawn in code. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  radialDot(scene, TEX.spark, 8, [
    [0, 1],
    [0.35, 0.9],
    [1, 0],
  ]);
  radialDot(scene, TEX.smoke, 16, [
    [0, 0.55],
    [0.6, 0.3],
    [1, 0],
  ]);

  if (!scene.textures.exists(TEX.leaf)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 4, 12, 6);
    g.lineStyle(1, 0x000000, 0.25);
    g.lineBetween(2, 4, 12, 4);
    g.generateTexture(TEX.leaf, 14, 8);
    g.destroy();
  }

  PAL.candyColors.forEach((color, i) => {
    const key = TEX.candy(i);
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    drawCandy(g, 24, 16, color, 0, 0);
    g.generateTexture(key, 48, 32);
    g.destroy();
  });
}
