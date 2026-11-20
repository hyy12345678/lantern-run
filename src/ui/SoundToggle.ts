import Phaser from 'phaser';
import { isMuted, setMuted } from '../audio/sfx';
import { FONT, PAL } from './palette';
import { isReducedMotion, setReducedMotion } from './settings';

/** Above the pause screen (60), so the settings stay usable while paused (R14.7). */
const DEPTH = 65;
const LINE_HEIGHT = 22;

function addToggle(
  scene: Phaser.Scene,
  y: number,
  key: string,
  label: () => string,
  toggle: () => void,
): Phaser.GameObjects.Text {
  const { width } = scene.scale;
  const text = scene.add
    .text(width - 12, y, '', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: PAL.text,
      stroke: '#1b0f24',
      strokeThickness: 4,
    })
    .setOrigin(1, 1)
    .setDepth(DEPTH)
    .setInteractive({ useHandCursor: true });

  const onToggle = (): void => {
    toggle();
    text.setText(label());
  };
  text.setText(label());
  text.on('pointerdown', onToggle);
  const keyObject = scene.input.keyboard?.addKey(key);
  keyObject?.on('down', onToggle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    keyObject?.off('down', onToggle);
  });
  return text;
}

/**
 * Sound and motion settings in the bottom-right corner. Click or tap a label, or press M or R.
 * `onMotionChange` lets a scene react, e.g. by stopping a looping tween.
 */
export function addSettingsToggles(scene: Phaser.Scene, onMotionChange?: (reduced: boolean) => void): void {
  const { height } = scene.scale;
  addToggle(scene, height - 8, 'M', () => (isMuted() ? 'SOUND OFF (M)' : 'SOUND ON (M)'), () => setMuted(!isMuted()));
  addToggle(
    scene,
    height - 8 - LINE_HEIGHT,
    'R',
    () => (isReducedMotion() ? 'MOTION REDUCED (R)' : 'MOTION FULL (R)'),
    () => {
      setReducedMotion(!isReducedMotion());
      onMotionChange?.(isReducedMotion());
    },
  );
}
