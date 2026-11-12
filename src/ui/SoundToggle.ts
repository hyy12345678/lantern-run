import Phaser from 'phaser';
import { isMuted, setMuted } from '../audio/sfx';
import { FONT, PAL } from './palette';

/**
 * Sound on/off label in the bottom-right corner. Click it or press M.
 * The M key is removed when the scene shuts down.
 */
export function addSoundToggle(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const { width, height } = scene.scale;
  const label = scene.add
    .text(width - 12, height - 10, '', {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: PAL.textHex,
      stroke: '#1b0f24',
      strokeThickness: 4,
    })
    .setOrigin(1, 1)
    .setDepth(50)
    .setInteractive({ useHandCursor: true });

  const refresh = (): void => {
    label.setText(isMuted() ? 'SOUND OFF (M)' : 'SOUND ON (M)');
  };
  const toggle = (): void => {
    setMuted(!isMuted());
    refresh();
  };

  refresh();
  label.on('pointerdown', toggle);
  const key = scene.input.keyboard?.addKey('M');
  key?.on('down', toggle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    key?.off('down', toggle);
  });
  return label;
}
