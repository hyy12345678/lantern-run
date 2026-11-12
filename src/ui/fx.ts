import Phaser from 'phaser';

/** Small colored dots that fly outward and fade. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const reach = 26 + Math.random() * 26;
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

/** Full-screen tint that fades out. */
export function flashScreen(scene: Phaser.Scene, color: number, alpha: number): void {
  const { width, height } = scene.scale;
  const rect = scene.add.rectangle(width / 2, height / 2, width, height, color, alpha).setDepth(30);
  scene.tweens.add({
    targets: rect,
    alpha: 0,
    duration: 320,
    onComplete: () => rect.destroy(),
  });
}

/**
 * Fades to black, runs `onMidpoint` while the screen is dark, then fades back in.
 * Used between rooms so the layout swap is hidden.
 */
export function transition(scene: Phaser.Scene, onMidpoint: () => void, halfMs = 200): void {
  const { width, height } = scene.scale;
  const curtain = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(40);
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
        onComplete: () => curtain.destroy(),
      });
    },
  });
}
