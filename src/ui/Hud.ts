import Phaser from 'phaser';
import { BLOW_COOLDOWN_SEC, FLAME_MAX, ROOM_COUNT } from '../core/config';
import { isLowFlame } from '../core/flame';
import type { RunState } from '../core/run';
import { THEME_NAMES } from '../core/themes';
import { drawCandy, drawPumpkin, drawUpgradeIcon } from './drawing';
import { FONT, PAL } from './palette';

const BAR_HEIGHT = 32;
const FLAME_BAR = { x: 40, y: 10, width: 160, height: 12 };
const ROOM_X = 216;
const THEME_X = 318;
const CANDY_ICON_X = 462;
const CANDY_TEXT_X = 484;
const SCORE_X = 560;
const UPGRADE_X = 640;
const UPGRADE_SLOT = 24;
const BLOW_TEXT_RIGHT_OFFSET = 36;

/** Top bar drawn over the border hedge: flame, room, theme, candy, score, held upgrades, and blow readiness. */
export class Hud {
  private readonly icons: Phaser.GameObjects.Graphics;
  private readonly roomText: Phaser.GameObjects.Text;
  private readonly themeText: Phaser.GameObjects.Text;
  private readonly candyText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly blowText: Phaser.GameObjects.Text;
  private readonly width: number;
  private lastTexts: string[] = ['', '', '', '', ''];

  constructor(scene: Phaser.Scene) {
    this.width = scene.scale.width;
    this.icons = scene.add.graphics().setDepth(10);
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: PAL.text,
      stroke: '#1b0f24',
      strokeThickness: 4,
    };
    const mid = BAR_HEIGHT / 2;
    this.roomText = scene.add.text(ROOM_X, mid, '', { ...style, color: PAL.accentText }).setOrigin(0, 0.5).setDepth(11);
    this.themeText = scene.add
      .text(THEME_X, mid, '', { ...style, fontSize: '13px', color: PAL.textSoft })
      .setOrigin(0, 0.5)
      .setDepth(11);
    this.candyText = scene.add.text(CANDY_TEXT_X, mid, '', style).setOrigin(0, 0.5).setDepth(11);
    this.scoreText = scene.add.text(SCORE_X, mid, '', style).setOrigin(0, 0.5).setDepth(11);
    this.blowText = scene
      .add.text(this.width - BLOW_TEXT_RIGHT_OFFSET, mid, '', style)
      .setOrigin(1, 0.5)
      .setDepth(11);
  }

  update(state: RunState, time: number): void {
    const g = this.icons;
    g.clear();

    g.fillStyle(PAL.ink, 0.88);
    g.fillRect(0, 0, this.width, BAR_HEIGHT);
    g.lineStyle(2, PAL.pumpkin, 0.8);
    g.lineBetween(0, BAR_HEIGHT, this.width, BAR_HEIGHT);

    const flame01 = state.flame / FLAME_MAX;
    drawPumpkin(g, 20, BAR_HEIGHT / 2, 9, flame01, time);

    g.fillStyle(PAL.stoneDark, 1);
    g.fillRoundedRect(FLAME_BAR.x, FLAME_BAR.y, FLAME_BAR.width, FLAME_BAR.height, 4);
    const fillColor = isLowFlame(state.flame) ? PAL.danger : PAL.candy;
    g.fillStyle(fillColor, 1);
    g.fillRoundedRect(FLAME_BAR.x, FLAME_BAR.y, Math.max(0, FLAME_BAR.width * flame01), FLAME_BAR.height, 4);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(FLAME_BAR.x + 2, FLAME_BAR.y + 2, Math.max(0, FLAME_BAR.width * flame01 - 4), 3, 2);

    drawCandy(g, CANDY_ICON_X, BAR_HEIGHT / 2, PAL.candyColors[0], time, 0);

    state.upgrades.forEach((id, i) => {
      drawUpgradeIcon(g, UPGRADE_X + i * UPGRADE_SLOT + UPGRADE_SLOT / 2, BAR_HEIGHT / 2, 18, id);
    });

    const blowFraction = state.blowCooldown > 0 ? 1 - state.blowCooldown / BLOW_COOLDOWN_SEC : 1;
    const ringX = this.width - 16;
    const ringY = BAR_HEIGHT / 2;
    g.lineStyle(4, PAL.stoneDark, 1);
    g.strokeCircle(ringX, ringY, 9);
    if (blowFraction > 0) {
      const ready = blowFraction >= 1;
      g.lineStyle(3, ready ? PAL.candy : PAL.accent, 1);
      g.beginPath();
      g.arc(ringX, ringY, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * blowFraction, false);
      g.strokePath();
    }

    this.setText(0, this.roomText, `ROOM ${state.roomIndex} / ${ROOM_COUNT}`);
    this.setText(1, this.themeText, THEME_NAMES[state.layout.theme].toUpperCase());
    this.setText(2, this.candyText, `${state.candiesInRoom} / ${state.layout.candyGoal}`);
    this.setText(3, this.scoreText, `SCORE ${state.runScore}`);
    this.setText(4, this.blowText, state.blowCooldown > 0 ? `BLOW ${state.blowCooldown.toFixed(1)}s` : 'BLOW READY');
  }

  private setText(slot: number, target: Phaser.GameObjects.Text, value: string): void {
    if (this.lastTexts[slot] === value) return;
    this.lastTexts[slot] = value;
    target.setText(value);
  }
}
