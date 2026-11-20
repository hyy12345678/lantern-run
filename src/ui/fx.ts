import Phaser from 'phaser';
import type { Vec2 } from '../core/types';
import { FONT } from './palette';
import { isReducedMotion } from './settings';

/** Small colored dots that fly outward and fade. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const reach = isReducedMotion() ? 10 : 26 + Math.random() * 26;
    const dot = scene.add.circle(x, y, 3 + Math.random() * 2.5, color).setDepth(15);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * reach,
      y: y + Math.sin(angle) * reach,
      alpha: 0,
      scale: 0.2,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

/** Expanding ring, used when the blow ability fires. */
export function ring(scene: Phaser.Scene, x: number, y: number, color: number, radius: number): void {
  const circle = scene.add.circle(x, y, 10, 0, 0).setStrokeStyle(4, color, 1).setDepth(15);
  scene.tweens.add({
    targets: circle,
    scale: radius / 10,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onComplete: () => circle.destroy(),
  });
}

/** Short text that rises from a point and fades, e.g. "+15" when candy is picked up. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 20): void {
  const label = scene.add
    .text(x, y - 14, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#1b0f24',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(16);
  scene.tweens.add({
    targets: label,
    y: isReducedMotion() ? label.y : label.y - 30,
    alpha: 0,
    duration: 900,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}

/**
 * Pulses the screen edges in `color` and fades out. The middle of the screen stays clear,
 * so this never flashes the full screen (style guide).
 */
export function edgePulse(scene: Phaser.Scene, color: number, strength = 1): void {
  const { width, height } = scene.scale;
  const g = scene.add.graphics().setDepth(30);
  const bands = 14;
  const bandWidth = 5;
  for (let i = 0; i < bands; i++) {
    const alpha = 0.32 * strength * (1 - i / bands) ** 1.6;
    g.lineStyle(bandWidth, color, alpha);
    const inset = i * bandWidth + bandWidth / 2;
    g.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  }
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: 420,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

const IRIS_DEPTH = 40;

/** Black screen with a round hole, redrawn as the hole grows or shrinks. */
function irisLayer(scene: Phaser.Scene): { draw: (at: Vec2, radius: number) => void; destroy: () => void } {
  const { width, height } = scene.scale;
  const layer = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(IRIS_DEPTH);
  const hole = scene.make.graphics({}, false);
  return {
    draw: (at, radius) => {
      layer.clear();
      layer.fill(0x000000, 1);
      if (radius > 0) {
        hole.clear();
        hole.fillStyle(0xffffff, 1);
        hole.fillCircle(at.x, at.y, radius);
        layer.erase(hole);
      }
    },
    destroy: () => {
      layer.destroy();
      hole.destroy();
    },
  };
}

/** Radius that uncovers the whole screen from any point on it. */
function fullRadius(scene: Phaser.Scene): number {
  return Math.hypot(scene.scale.width, scene.scale.height);
}

/**
 * Opens the screen as a growing circle centred on `at` (R15.4). With reduced motion it fades in.
 * `onDone` runs once the screen is fully open.
 */
export function irisOpen(scene: Phaser.Scene, at: Vec2, onDone?: () => void, ms = 520): void {
  if (isReducedMotion()) {
    const { width, height } = scene.scale;
    const curtain = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1).setDepth(IRIS_DEPTH);
    scene.tweens.add({ targets: curtain, alpha: 0, duration: ms * 0.6, onComplete: () => (curtain.destroy(), onDone?.()) });
    return;
  }
  const iris = irisLayer(scene);
  const state = { r: 0 };
  iris.draw(at, 0);
  scene.tweens.add({
    targets: state,
    r: fullRadius(scene),
    duration: ms,
    ease: 'Cubic.easeIn',
    onUpdate: () => iris.draw(at, state.r),
    onComplete: () => (iris.destroy(), onDone?.()),
  });
}

/**
 * Closes the screen as a shrinking circle around `from()`, runs `onMidpoint` while it is black,
 * then opens it around `to()`. With reduced motion it fades out and in.
 */
export function irisTransition(
  scene: Phaser.Scene,
  from: () => Vec2,
  to: () => Vec2,
  onMidpoint: () => void,
  onDone?: () => void,
): void {
  if (isReducedMotion()) {
    transition(scene, onMidpoint, 200, onDone);
    return;
  }
  const iris = irisLayer(scene);
  const state = { r: fullRadius(scene) };
  scene.tweens.add({
    targets: state,
    r: 0,
    duration: 380,
    ease: 'Cubic.easeOut',
    onUpdate: () => iris.draw(from(), state.r),
    onComplete: () => {
      iris.destroy();
      onMidpoint();
      irisOpen(scene, to(), onDone);
    },
  });
}

/**
 * Fades to black, runs `onMidpoint` while the screen is dark, then fades back in.
 * Used between rooms with reduced motion, so the layout swap is hidden.
 */
export function transition(scene: Phaser.Scene, onMidpoint: () => void, halfMs = 200, onDone?: () => void): void {
  const { width, height } = scene.scale;
  const curtain = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(IRIS_DEPTH);
  scene.tweens.add({
    targets: curtain,
    alpha: 1,
    duration: halfMs,
    onComplete: () => {
      onMidpoint();
      scene.tweens.add({
        targets: curtain,
        alpha: 0,
        duration: halfMs,
        onComplete: () => (curtain.destroy(), onDone?.()),
      });
    },
  });
}
