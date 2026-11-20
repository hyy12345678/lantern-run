import Phaser from 'phaser';
import { FONT, PAL, TITLE_FONT } from './palette';
import { isReducedMotion } from './settings';

const HOLD_MS = 1700;
const FADE_MS = 280;
const DEPTH = 25;

/**
 * Room intro banner: a large title and a one-line goal, shown for about two seconds
 * without pausing the room (R14.3).
 */
export class Banner {
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly band: Phaser.GameObjects.Rectangle;
  private readonly titleY: number;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    const y = height * 0.3;
    this.titleY = y - 10;
    this.band = scene.add.rectangle(width / 2, y + 8, width, 112, PAL.ink, 0.62).setDepth(DEPTH).setAlpha(0);
    this.title = scene.add
      .text(width / 2, y - 10, '', {
        fontFamily: TITLE_FONT,
        fontSize: '56px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setAlpha(0);
    this.subtitle = scene.add
      .text(width / 2, y + 38, '', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: PAL.text,
        stroke: '#1b0f24',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setAlpha(0);
  }

  show(title: string, subtitle: string): void {
    const targets = [this.band, this.title, this.subtitle];
    this.scene.tweens.killTweensOf(targets);
    this.title.setText(title);
    this.subtitle.setText(subtitle);
    // Start from the stored rest position, so a banner cut short cannot leave the title out of place.
    this.title.setY(isReducedMotion() ? this.titleY : this.titleY - 12);
    this.scene.tweens.add({ targets, alpha: 1, duration: FADE_MS });
    this.scene.tweens.add({ targets: this.title, y: this.titleY, duration: FADE_MS, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets, alpha: 0, delay: FADE_MS + HOLD_MS, duration: FADE_MS });
  }
}
