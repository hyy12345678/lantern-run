import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { readBestScore } from '../storage/bestScore';
import { Backdrop } from '../ui/Backdrop';
import { drawCandy, drawDoor, drawGhost, drawPumpkin, drawUpgradeIcon } from '../ui/drawing';
import { BRUSH_KEY, BRUSH_RADIUS, ensureBrush } from '../ui/Lantern';
import { FONT, PAL, TITLE_FONT } from '../ui/palette';
import { animTime, isReducedMotion } from '../ui/settings';
import { addSettingsToggles } from '../ui/SoundToggle';
import { ensureFxTextures, TEX } from '../ui/textures';

type Key = Phaser.Input.Keyboard.Key;

interface Step {
  x: number;
  title: string;
  detail: string;
}

/** The intro plays once per browser session (R15.6). */
let introPlayed = false;

// Intro timing, in ms from the start.
const SPARK_AT = [120, 330] as const;
const IGNITE_AT = 420;
const REVEAL_AT = 480;
const REVEAL_MS = 1100;
const TITLE_AT = 1050;
const MENU_AT = 1500;
const INTRO_DEPTH = 30;

/**
 * Title scene: the logo, a three-step "how to play" row, the best score, and the start prompt.
 * The first visit in a session opens with the lantern lighting up in the dark.
 * Enter or a tap on the prompt starts a run.
 */
export class MenuScene extends Phaser.Scene {
  private startKey!: Key;
  private backdrop!: Backdrop;
  private pumpkin!: Phaser.GameObjects.Graphics;
  private icons!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private menuParts: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];
  private promptTween: Phaser.Tweens.Tween | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private steps: Step[] = [];
  /** 0 = unlit, 1 = fully lit. Animated during the intro. */
  private lanternLevel = 1;
  private intro: { shroud: Phaser.GameObjects.RenderTexture; brush: Phaser.GameObjects.Image; reveal: { r: number } } | null = null;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.backdrop = new Backdrop(this);
    this.pumpkin = this.add.graphics().setDepth(9);
    this.icons = this.add.graphics().setDepth(9);
    this.menuParts = [this.icons];

    this.title = this.add
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

    this.prompt = this.text(width / 2, height * 0.87, 'PRESS ENTER OR TAP TO START', 26, PAL.text).setInteractive({
      useHandCursor: true,
    });
    this.prompt.on('pointerdown', () => {
      if (!this.intro) this.startRun();
    });

    this.text(width * 0.4, height * 0.955, 'Move: WASD or arrows    Blow: Space    Pause: Esc', 18, PAL.textSoft);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for MenuScene');
    this.startKey = keyboard.addKey('ENTER');
    addSettingsToggles(this, (reduced) => this.setPromptPulse(!reduced));

    if (!introPlayed && !isReducedMotion()) this.playIntro();
    else this.setPromptPulse(!isReducedMotion());
    introPlayed = true;
  }

  update(time: number): void {
    const { width, height } = this.scale;
    const t = animTime(time);
    this.backdrop.update(t);

    const pumpkinY = height * 0.13 + Math.sin(t * 0.002) * 6;
    this.pumpkin.clear();
    drawPumpkin(this.pumpkin, width / 2, pumpkinY, 34, this.lanternLevel, t);

    if (this.intro) {
      const { shroud, brush, reveal } = this.intro;
      shroud.clear();
      shroud.fill(0x000000, 1);
      if (reveal.r > 0) {
        brush.setScale(reveal.r / BRUSH_RADIUS);
        shroud.erase(brush, width / 2, pumpkinY);
      }
    }

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

    if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
      if (this.intro) this.finishIntro();
      else this.startRun();
    }
  }

  /**
   * Darkness, two sparks, the lantern catches, the light spreads from it, then the title and the menu
   * fade in (R15.6). Any key or tap skips to the end.
   */
  private playIntro(): void {
    const { width, height } = this.scale;
    ensureBrush(this);
    ensureFxTextures(this);
    const shroud = this.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(INTRO_DEPTH);
    const brush = this.make.image({ x: 0, y: 0, key: BRUSH_KEY }, false);
    const reveal = { r: 0 };
    this.intro = { shroud, brush, reveal };
    this.lanternLevel = 0;
    this.title.setAlpha(0);
    for (const part of this.menuParts) part.setAlpha(0);

    const sparks = this.add.particles(0, 0, TEX.spark, {
      emitting: false,
      lifespan: { min: 250, max: 500 },
      speed: { min: 60, max: 160 },
      scale: { start: 0.45, end: 0 },
      tint: [PAL.candle, 0xffffff, PAL.pumpkin],
      blendMode: Phaser.BlendModes.ADD,
    });
    sparks.setDepth(INTRO_DEPTH + 1);
    const at = { x: width / 2, y: height * 0.13 };
    for (const ms of SPARK_AT) this.time.delayedCall(ms, () => sparks.emitParticleAt(at.x, at.y - 16, 10));
    this.time.delayedCall(IGNITE_AT, () => {
      playSound('ignite');
      this.tweens.add({ targets: this, lanternLevel: 1, duration: 500, ease: 'Quad.easeOut' });
    });
    this.tweens.add({
      targets: reveal,
      r: Math.hypot(width, height) * 1.1,
      delay: REVEAL_AT,
      duration: REVEAL_MS,
      ease: 'Cubic.easeIn',
    });
    this.time.delayedCall(TITLE_AT, () => {
      this.title.setScale(1.15);
      this.tweens.add({ targets: this.title, alpha: 1, scale: 1, duration: 500, ease: 'Back.easeOut' });
    });
    this.time.delayedCall(MENU_AT, () => {
      this.tweens.add({ targets: this.menuParts, alpha: 1, duration: 400 });
    });
    this.time.delayedCall(REVEAL_AT + REVEAL_MS, () => this.finishIntro());
    this.input.once('pointerdown', () => this.finishIntro());
  }

  /** Ends the intro now, whether it ran to the end or was skipped. */
  private finishIntro(): void {
    if (!this.intro) return;
    const { shroud, brush } = this.intro;
    this.intro = null;
    shroud.destroy();
    brush.destroy();
    this.tweens.killTweensOf([this, this.title, ...this.menuParts]);
    this.lanternLevel = 1;
    this.title.setAlpha(1).setScale(1);
    for (const part of this.menuParts) part.setAlpha(1);
    this.setPromptPulse(!isReducedMotion());
  }

  /** The start prompt pulses gently. Reduced motion keeps it still. */
  private setPromptPulse(on: boolean): void {
    this.promptTween?.remove();
    this.promptTween = null;
    this.prompt.setAlpha(1);
    if (on) this.promptTween = this.tweens.add({ targets: this.prompt, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
  }

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = this.add
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
    this.menuParts.push(text);
    return text;
  }

  private startRun(): void {
    this.scene.start('RunScene');
  }
}
