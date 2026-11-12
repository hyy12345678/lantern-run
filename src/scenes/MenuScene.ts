import Phaser from 'phaser';
import { readBestScore } from '../storage/bestScore';
import { Backdrop } from '../ui/Backdrop';
import { drawPumpkin } from '../ui/drawing';
import { FONT, PAL } from '../ui/palette';
import { addSoundToggle } from '../ui/SoundToggle';

type Key = Phaser.Input.Keyboard.Key;

/** Title scene. Enter or a tap on the prompt starts a run. Shows the best score saved in this browser. */
export class MenuScene extends Phaser.Scene {
  private startKey!: Key;
  private backdrop!: Backdrop;
  private pumpkin!: Phaser.GameObjects.Graphics;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.backdrop = new Backdrop(this);
    this.pumpkin = this.add.graphics().setDepth(9);

    this.add
      .text(width / 2, height * 0.4, 'LANTERN RUN', {
        fontFamily: FONT,
        fontSize: '84px',
        fontStyle: 'bold',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 7, color: '#000000', blur: 0, stroke: true, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(10);

    const best = readBestScore();
    const bestText = !best.available
      ? 'Best score unavailable in this browser'
      : best.value === null
        ? 'No best score yet'
        : `BEST SCORE ${best.value}`;
    this.add
      .text(width / 2, height * 0.56, bestText, {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#1b0f24',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const prompt = this.add
      .text(width / 2, height * 0.74, 'PRESS ENTER OR TAP TO START', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: PAL.textHex,
        stroke: '#1b0f24',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    prompt.on('pointerdown', () => this.startRun());
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

    this.add
      .text(width / 2, height * 0.9, 'Move: WASD or arrows     Blow ghosts away: Space     Pause: Esc', {
        fontFamily: FONT,
        fontSize: '16px',
        color: PAL.textSoft,
        stroke: '#1b0f24',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for MenuScene');
    this.startKey = keyboard.addKey('ENTER');
    addSoundToggle(this);
  }

  update(time: number): void {
    const { width, height } = this.scale;
    this.backdrop.update(time);

    this.pumpkin.clear();
    const bob = Math.sin(time * 0.002) * 6;
    drawPumpkin(this.pumpkin, width / 2, height * 0.16 + bob, 34, 1, time);

    if (Phaser.Input.Keyboard.JustDown(this.startKey)) this.startRun();
  }

  private startRun(): void {
    this.scene.start('RunScene');
  }
}
