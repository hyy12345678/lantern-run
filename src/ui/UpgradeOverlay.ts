import Phaser from 'phaser';
import { UPGRADES } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { drawUpgradeIcon } from './drawing';
import { FONT, PAL, TITLE_FONT } from './palette';
import { isReducedMotion } from './settings';

const CARD_W = 250;
const CARD_H = 316;
const CARD_GAP = 24;
/** Vertical layout inside a card, from its centre. */
const ICON_Y = -86;
const NAME_Y = -16;
const DESCRIPTION_Y = 12;
const DEPTH = 30;

/**
 * Three upgrade cards shown after a trial room. Click a card or press 1, 2, or 3 to pick it.
 * Trade-off upgrades show their drawback on a separate line in the warning color (R9.7).
 */
export class UpgradeOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private choices: UpgradeId[] = [];
  private onPick: ((id: UpgradeId) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return this.objects.length > 0;
  }

  show(choices: UpgradeId[], onPick: (id: UpgradeId) => void): void {
    this.hide();
    this.choices = choices;
    this.onPick = onPick;
    const { width, height } = this.scene.scale;

    const backdrop = this.scene.add.rectangle(width / 2, height / 2, width, height, PAL.ink, 0.84).setDepth(DEPTH);
    const title = this.scene.add
      .text(width / 2, 76, 'CHOOSE AN UPGRADE', {
        fontFamily: TITLE_FONT,
        fontSize: '46px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    const subtitle = this.text(width / 2, 118, 'It lasts for the rest of the run', 18, PAL.textSoft)
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    this.objects.push(backdrop, title, subtitle);

    const totalWidth = choices.length * CARD_W + (choices.length - 1) * CARD_GAP;
    const firstX = width / 2 - totalWidth / 2 + CARD_W / 2;
    choices.forEach((id, index) => {
      const card = this.createCard(id, index, firstX + index * (CARD_W + CARD_GAP), height / 2 + 44);
      this.objects.push(card);
      if (!isReducedMotion()) {
        // Deal the cards in one after another. Only the position animates, so the cards are
        // visible and clickable from the first frame even if the tween is slow to run.
        const restY = card.y;
        card.setY(restY + 24);
        this.scene.tweens.add({ targets: card, y: restY, duration: 260, delay: 90 * index, ease: 'Back.easeOut' });
      }
    });
  }

  /** Picks the card at `index` (0-based). Ignored when the overlay is closed or the index is out of range. */
  pick(index: number): void {
    const id = this.choices[index];
    if (!this.isOpen || id === undefined) return;
    const callback = this.onPick;
    this.hide();
    callback?.(id);
  }

  hide(): void {
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.choices = [];
    this.onPick = null;
  }

  private createCard(id: UpgradeId, index: number, x: number, y: number): Phaser.GameObjects.Container {
    const def = UPGRADES[id];
    const tradeOff = def.drawback !== undefined;
    const card = this.scene.add.container(x, y).setDepth(DEPTH + 1);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a1f3d, 0.98);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    // Icon plate with a warm glow.
    bg.fillStyle(tradeOff ? PAL.ember : PAL.candle, 0.14);
    bg.fillCircle(0, ICON_Y, 48);
    bg.lineStyle(3, tradeOff ? PAL.danger : PAL.pumpkin, 1);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);

    const icon = this.scene.add.graphics();
    drawUpgradeIcon(icon, 0, ICON_Y, 66, id);

    const name = this.text(0, NAME_Y, def.name, 24, PAL.text).setOrigin(0.5);
    const description = this.text(0, DESCRIPTION_Y, def.description, 18, PAL.textSoft, CARD_W - 36).setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, name, description];
    if (def.drawback) {
      const drawback = this.text(0, description.y + description.height + 6, def.drawback, 18, PAL.warnText, CARD_W - 36);
      parts.push(drawback.setOrigin(0.5, 0));
    }
    if (tradeOff) {
      const tag = this.text(0, -CARD_H / 2 + 18, 'TRADE-OFF', 14, PAL.warnText).setOrigin(0.5);
      parts.push(tag);
    }
    const key = this.text(0, CARD_H / 2 - 20, `Press ${index + 1}`, 18, PAL.accentText).setOrigin(0.5);
    parts.push(key);

    card.add(parts);
    card.setSize(CARD_W, CARD_H);
    card.setInteractive(new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    card.on('pointerover', () => card.setScale(1.04));
    card.on('pointerout', () => card.setScale(1));
    card.on('pointerdown', () => this.pick(index));
    return card;
  }

  private text(x: number, y: number, value: string, size: number, color: string, wrapWidth?: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#1b0f24',
      strokeThickness: 4,
      align: 'center',
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
    });
  }
}
