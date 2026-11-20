import Phaser from 'phaser';
import { ROOM_COUNT } from '../core/config';
import { UPGRADES } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { readBestScore } from '../storage/bestScore';
import { Backdrop } from '../ui/Backdrop';
import { drawPumpkin, drawUpgradeIcon } from '../ui/drawing';
import { FONT, PAL, TITLE_FONT } from '../ui/palette';
import { animTime } from '../ui/settings';
import { addSettingsToggles } from '../ui/SoundToggle';

type Key = Phaser.Input.Keyboard.Key;

/** Passed from RunScene when a run ends. */
export interface ResultData {
  status: 'won' | 'lost';
  roomsCleared: number;
  runScore: number;
  upgrades: UpgradeId[];
}

/** Shown when the scene is opened directly for testing without run data. */
const SAMPLE_RESULT: ResultData = {
  status: 'lost',
  roomsCleared: 2,
  runScore: 25,
  upgrades: ['brightWick', 'hungryFlame', 'lastEmber'],
};

const ICON_SIZE = 44;
const ICON_SPACING = 150;

/**
 * End-of-run summary: outcome, rooms cleared, score, and the upgrades taken.
 * A warm screen either way (style guide). Enter starts a new run, Esc goes to the menu.
 */
export class ResultScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private pumpkin!: Phaser.GameObjects.Graphics;
  private won = false;
  private enterKey!: Key;
  private escKey!: Key;

  constructor() {
    super('ResultScene');
  }

  create(passed?: Partial<ResultData>): void {
    // Phaser passes an empty object when no data is given, so fill in the sample values.
    const data: ResultData = { ...SAMPLE_RESULT, ...passed };
    const { width, height } = this.scale;
    this.backdrop = new Backdrop(this, 0.12);
    this.pumpkin = this.add.graphics().setDepth(9);
    this.won = data.status === 'won';

    this.add
      .text(width / 2, height * 0.16, this.won ? 'The King retreats!' : 'The flame went out', {
        fontFamily: TITLE_FONT,
        fontSize: '64px',
        color: this.won ? PAL.accentText : PAL.warnText,
        stroke: '#1b0f24',
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.text(
      width / 2,
      height * 0.26,
      this.won ? 'You carried the light all the way home.' : 'Rest a moment, then light it again.',
      20,
      PAL.textSoft,
    );

    this.text(width / 2, height * 0.35, `Rooms cleared: ${data.roomsCleared} / ${ROOM_COUNT}`, 24, PAL.text);
    this.text(width / 2, height * 0.45, `SCORE ${data.runScore}`, 44, PAL.candyText);
    const best = readBestScore();
    const newBest = best.available && data.runScore > 0 && best.value === data.runScore;
    this.text(
      width / 2,
      height * 0.53,
      !best.available ? 'Best score unavailable in this browser' : newBest ? 'NEW BEST!' : `Best: ${best.value ?? data.runScore}`,
      20,
      newBest ? PAL.accentText : PAL.textSoft,
    );

    this.text(width / 2, height * 0.62, 'UPGRADES TAKEN', 18, PAL.textSoft);
    if (data.upgrades.length === 0) {
      this.text(width / 2, height * 0.71, 'None', 20, PAL.textSoft);
    } else {
      const totalWidth = (data.upgrades.length - 1) * ICON_SPACING;
      data.upgrades.forEach((id, i) => {
        const x = width / 2 - totalWidth / 2 + i * ICON_SPACING;
        const y = height * 0.7;
        drawUpgradeIcon(this.add.graphics().setDepth(10), x, y, ICON_SIZE, id);
        this.text(x, y + 38, UPGRADES[id].name, 18, PAL.text);
      });
    }

    const again = this.text(width / 2, height * 0.9, 'Press Enter or tap to play again     Esc for the menu', 20, PAL.text);
    again.setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.scene.start('RunScene'));

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for ResultScene');
    this.enterKey = keyboard.addKey('ENTER');
    this.escKey = keyboard.addKey('ESC');
    addSettingsToggles(this);
  }

  update(time: number): void {
    const t = animTime(time);
    this.backdrop.update(t);
    // A lit pumpkin for a win, a softly glowing one for a loss. Never a harsh ending.
    this.pumpkin.clear();
    // Sitting on the hill by the tree, clear of the moon and the text.
    const { width, height } = this.scale;
    drawPumpkin(this.pumpkin, width * 0.16, height * 0.8, 24, this.won ? 1 : 0.25, t);
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.scene.start('RunScene');
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.scene.start('MenuScene');
  }

  /** Text sits above the backdrop's bats and fog (depth 3). */
  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#1b0f24',
        strokeThickness: size >= 24 ? 6 : 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }
}
