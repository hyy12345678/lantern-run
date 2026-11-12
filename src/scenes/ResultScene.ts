import Phaser from 'phaser';
import { ROOM_COUNT } from '../core/config';
import { UPGRADES } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { readBestScore } from '../storage/bestScore';
import { Backdrop } from '../ui/Backdrop';
import { drawUpgradeIcon } from '../ui/drawing';
import { FONT, PAL } from '../ui/palette';

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
  upgrades: ['brightWick', 'swiftFeet', 'ironPumpkin'],
};

const ICON_SIZE = 44;
const ICON_SPACING = 130;

/** End-of-run summary: outcome, rooms cleared, score, and the upgrades taken. Enter starts a new run. */
export class ResultScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private enterKey!: Key;
  private escKey!: Key;

  constructor() {
    super('ResultScene');
  }

  create(passed?: Partial<ResultData>): void {
    // Phaser passes an empty object when no data is given, so fill in the sample values.
    const data: ResultData = { ...SAMPLE_RESULT, ...passed };
    const { width, height } = this.scale;
    this.backdrop = new Backdrop(this, 0.9);

    const won = data.status === 'won';
    const title = won ? 'THE PUMPKIN KING RETREATS!' : 'THE FLAME WENT OUT';
    const titleColor = won ? PAL.accentText : '#ff6b6b';
    this.text(width / 2, height * 0.16, title, 46, titleColor, 9);

    this.text(width / 2, height * 0.28, `Rooms cleared: ${data.roomsCleared} / ${ROOM_COUNT}`, 26, PAL.textHex, 6);
    this.text(width / 2, height * 0.38, `SCORE ${data.runScore}`, 44, '#ffd166', 8);
    const best = readBestScore();
    this.text(
      width / 2,
      height * 0.455,
      best.available ? `Best: ${best.value ?? data.runScore}` : 'Best score unavailable in this browser',
      18,
      PAL.textSoft,
      4,
    );

    this.text(width / 2, height * 0.54, 'UPGRADES TAKEN', 18, PAL.textSoft, 4);
    if (data.upgrades.length === 0) {
      this.text(width / 2, height * 0.64, 'None', 22, PAL.textSoft, 4);
    } else {
      const totalWidth = (data.upgrades.length - 1) * ICON_SPACING;
      data.upgrades.forEach((id, i) => {
        const x = width / 2 - totalWidth / 2 + i * ICON_SPACING;
        const y = height * 0.64;
        const icon = this.add.graphics();
        drawUpgradeIcon(icon, x, y, ICON_SIZE, id);
        this.text(x, y + 40, UPGRADES[id].name, 16, PAL.textHex, 4);
      });
    }

    const again = this.text(width / 2, height * 0.86, 'Press Enter or tap to play again     Esc for the menu', 20, PAL.textHex, 5);
    again.setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.scene.start('RunScene'));

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for ResultScene');
    this.enterKey = keyboard.addKey('ENTER');
    this.escKey = keyboard.addKey('ESC');
  }

  update(time: number): void {
    this.backdrop.update(time);
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.scene.start('RunScene');
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.scene.start('MenuScene');
  }

  /** Text sits above the backdrop's bats and fog (depth 3). */
  private text(x: number, y: number, value: string, size: number, color: string, stroke: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#1b0f24',
        strokeThickness: stroke,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }
}
