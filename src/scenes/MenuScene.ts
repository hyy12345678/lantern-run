import Phaser from 'phaser';
import { readBestScore } from '../storage/bestScore';
import { Backdrop } from '../ui/Backdrop';
import { drawCandy, drawDoor, drawGhost, drawPumpkin, drawUpgradeIcon } from '../ui/drawing';
import { FONT, PAL, TITLE_FONT } from '../ui/palette';
import { animTime, isReducedMotion } from '../ui/settings';
import { addSettingsToggles } from '../ui/SoundToggle';

type Key = Phaser.Input.Keyboard.Key;

interface Step {
  x: number;
  title: string;
  detail: string;
}

/**
 * Title scene: the logo, a three-step "how to play" row, the best score, and the start prompt.
 * Enter or a tap on the prompt starts a run.
 */
export class MenuScene extends Phaser.Scene {
  private startKey!: Key;
  private backdrop!: Backdrop;
  private pumpkin!: Phaser.GameObjects.Graphics;
  private icons!: Phaser.GameObjects.Graphics;
  private promptTween: Phaser.Tweens.Tween | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private steps: Step[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.backdrop = new Backdrop(this);
    this.pumpkin = this.add.graphics().setDepth(9);
    this.icons = this.add.graphics().setDepth(9);

    this.add
      .text(width / 2, height * 0.36, 'Lantern Run', {
        fontFamily: TITLE_FONT,
        fontSize: '104px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 7, color: '#000000', blur: 0, stroke: true, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.text(width / 2, height * 0.48, 'Keep your flame alive through four haunted rooms.', 20, PAL.textSoft);

    this.steps = [
      { x: width * 0.2, title: 'Collect candy', detail: 'to open the door' },
      { x: width * 0.45, title: 'Dodge ghosts', detail: 'Space blows them away' },
      { x: width * 0.7, title: 'Pick upgrades', detail: 'and beat the King' },
    ];
    for (const step of this.steps) {
      this.text(step.x, height * 0.66, step.title, 20, PAL.text);
      this.text(step.x, height * 0.705, step.detail, 18, PAL.textSoft);
    }

    const best = readBestScore();
    const bestText = !best.available
      ? 'Best score unavailable in this browser'
      : best.value === null
        ? 'No best score yet'
        : `BEST SCORE ${best.value}`;
    this.text(width / 2, height * 0.79, bestText, 20, PAL.candyText);

    this.prompt = this.text(width / 2, height * 0.87, 'PRESS ENTER OR TAP TO START', 26, PAL.text)
      .setInteractive({ useHandCursor: true });
    this.prompt.on('pointerdown', () => this.startRun());
    this.setPromptPulse(!isReducedMotion());

    this.text(width * 0.4, height * 0.955, 'Move: WASD or arrows    Blow: Space    Pause: Esc', 18, PAL.textSoft);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for MenuScene');
    this.startKey = keyboard.addKey('ENTER');
    addSettingsToggles(this, (reduced) => this.setPromptPulse(!reduced));
  }

  update(time: number): void {
    const { width, height } = this.scale;
    const t = animTime(time);
    this.backdrop.update(t);

    this.pumpkin.clear();
    drawPumpkin(this.pumpkin, width / 2, height * 0.13 + Math.sin(t * 0.002) * 6, 34, 1, t);

    // Step icons. They move a little, unless reduced motion is on.
    const g = this.icons;
    g.clear();
    const iconY = height * 0.585;
    const [candy, ghost, upgrade] = this.steps;
    drawCandy(g, candy.x - 26, iconY, PAL.candyColors[0], t, 0);
    drawDoor(g, candy.x + 10, iconY - 18, 32, t, false);
    drawGhost(g, ghost.x, iconY, 15, 'chase', t, 0.7, { chasing: true });
    g.fillStyle(0x2a1f3d, 1);
    g.fillRoundedRect(upgrade.x - 18, iconY - 24, 36, 48, 6);
    g.lineStyle(2, PAL.pumpkin, 1);
    g.strokeRoundedRect(upgrade.x - 18, iconY - 24, 36, 48, 6);
    drawUpgradeIcon(g, upgrade.x, iconY, 26, 'brightWick');

    if (Phaser.Input.Keyboard.JustDown(this.startKey)) this.startRun();
  }

  /** The start prompt pulses gently. Reduced motion keeps it still. */
  private setPromptPulse(on: boolean): void {
    this.promptTween?.remove();
    this.promptTween = null;
    this.prompt.setAlpha(1);
    if (on) this.promptTween = this.tweens.add({ targets: this.prompt, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
  }

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#1b0f24',
        strokeThickness: size >= 24 ? 6 : 4,
      })
      .setOrigin(0.5)
      .setDepth(10);
  }

  private startRun(): void {
    this.scene.start('RunScene');
  }
}
