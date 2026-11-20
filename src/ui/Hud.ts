import Phaser from 'phaser';
import { FLAME_MAX, ROOM_COUNT } from '../core/config';
import { isLowFlame } from '../core/flame';
import type { RunState } from '../core/run';
import { THEME_NAMES } from '../core/themes';
import { drawCandy, drawPumpkin, drawUpgradeIcon } from './drawing';
import { FONT, PAL } from './palette';

const BAR_HEIGHT = 32;
const MID = BAR_HEIGHT / 2;
/** Style guide: HUD text at least 18 px at the 960 x 544 base size (R14.8). */
const HUD_FONT_PX = 18;

// Left to right. Positions are tuned for the 960 px base width and checked by screenshot.
const FLAME_BAR = { x: 38, y: 10, width: 128, height: 12 };
const FLAME_NUMBER_X = 174;
const UPGRADE_X = 222;
const UPGRADE_SLOT = 24;
const SCORE_X = 304;
const ROOM_X = 420;
const THEME_GAP = 10;
const CANDY_ICON_X = 712;
const CANDY_TEXT_X = 734;
const BLOW_RING_RIGHT = 16;
const BLOW_TEXT_RIGHT = 34;

/** Top bar: flame bar with its number, upgrades, score, room and theme, candy goal, and blow readiness. */
export class Hud {
  private readonly icons: Phaser.GameObjects.Graphics;
  private readonly flameText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly roomText: Phaser.GameObjects.Text;
  private readonly themeText: Phaser.GameObjects.Text;
  private readonly candyText: Phaser.GameObjects.Text;
  private readonly blowText: Phaser.GameObjects.Text;
  private readonly width: number;
  private readonly lastTexts = new Map<Phaser.GameObjects.Text, string>();
  private readonly lastColors = new Map<Phaser.GameObjects.Text, string>();

  constructor(scene: Phaser.Scene) {
    this.width = scene.scale.width;
    this.icons = scene.add.graphics().setDepth(10);
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: `${HUD_FONT_PX}px`,
      fontStyle: 'bold',
      color: PAL.text,
      stroke: '#1b0f24',
      strokeThickness: 4,
    };
    const text = (x: number, color: string, originX = 0): Phaser.GameObjects.Text =>
      scene.add.text(x, MID, '', { ...style, color }).setOrigin(originX, 0.5).setDepth(11);
    this.flameText = text(FLAME_NUMBER_X, PAL.candyText);
    this.scoreText = text(SCORE_X, PAL.text);
    this.roomText = text(ROOM_X, PAL.accentText);
    this.themeText = text(ROOM_X, PAL.textSoft);
    this.candyText = text(CANDY_TEXT_X, PAL.text);
    this.blowText = text(this.width - BLOW_TEXT_RIGHT, PAL.text, 1);
  }

  update(state: RunState, time: number): void {
    const g = this.icons;
    g.clear();

    g.fillStyle(PAL.ink, 0.9);
    g.fillRect(0, 0, this.width, BAR_HEIGHT);
    g.lineStyle(2, PAL.pumpkin, 0.8);
    g.lineBetween(0, BAR_HEIGHT, this.width, BAR_HEIGHT);

    // Flame bar and number.
    const flame01 = state.flame / FLAME_MAX;
    const low = isLowFlame(state.flame);
    drawPumpkin(g, 19, MID, 9, flame01, time);
    g.fillStyle(PAL.stoneDark, 1);
    g.fillRoundedRect(FLAME_BAR.x, FLAME_BAR.y, FLAME_BAR.width, FLAME_BAR.height, 4);
    g.fillStyle(low ? PAL.danger : PAL.candy, 1);
    g.fillRoundedRect(FLAME_BAR.x, FLAME_BAR.y, Math.max(0, FLAME_BAR.width * flame01), FLAME_BAR.height, 4);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(FLAME_BAR.x + 2, FLAME_BAR.y + 2, Math.max(0, FLAME_BAR.width * flame01 - 4), 3, 2);
    this.set(this.flameText, String(Math.ceil(state.flame)), low ? PAL.warnText : PAL.candyText);

    // Held upgrades.
    state.upgrades.forEach((id, i) => {
      drawUpgradeIcon(g, UPGRADE_X + i * UPGRADE_SLOT + UPGRADE_SLOT / 2, MID, 18, id);
    });

    this.set(this.scoreText, `SCORE ${state.runScore}`);

    // Room and theme, side by side.
    this.set(this.roomText, `ROOM ${state.roomIndex}/${ROOM_COUNT}`);
    this.themeText.setX(this.roomText.x + this.roomText.width + THEME_GAP);
    this.set(this.themeText, THEME_NAMES[state.layout.theme].toUpperCase());

    // Candy goal. Turns gold once the door is open.
    drawCandy(g, CANDY_ICON_X, MID, PAL.candyColors[0], time, 0);
    const met = state.candiesInRoom >= state.layout.candyGoal;
    this.set(this.candyText, `${state.candiesInRoom} / ${state.layout.candyGoal}`, met ? PAL.candyText : PAL.text);

    // Blow readiness ring. The cooldown fraction uses the current (possibly upgraded) cooldown.
    const cooldown = state.modifiers.blowCooldownSec;
    const blowFraction = state.blowCooldown > 0 ? 1 - state.blowCooldown / cooldown : 1;
    const ringX = this.width - BLOW_RING_RIGHT;
    g.lineStyle(4, PAL.stoneDark, 1);
    g.strokeCircle(ringX, MID, 9);
    if (blowFraction > 0) {
      const ready = blowFraction >= 1;
      g.lineStyle(3, ready ? PAL.candy : PAL.accent, 1);
      g.beginPath();
      g.arc(ringX, MID, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * blowFraction, false);
      g.strokePath();
    }
    this.set(this.blowText, state.blowCooldown > 0 ? `BLOW ${state.blowCooldown.toFixed(1)}s` : 'BLOW READY');
  }

  private set(target: Phaser.GameObjects.Text, value: string, color?: string): void {
    if (this.lastTexts.get(target) !== value) {
      this.lastTexts.set(target, value);
      target.setText(value);
    }
    if (color !== undefined && this.lastColors.get(target) !== color) {
      this.lastColors.set(target, color);
      target.setColor(color);
    }
  }
}
