import Phaser from 'phaser';
import { UPGRADES } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { drawUpgradeIcon } from './drawing';
import { FONT, PAL } from './palette';

const CARD_W = 230;
const CARD_H = 300;
const CARD_GAP = 30;
const DEPTH = 30;

/** Three upgrade cards shown after a trial room. Click a card or press 1, 2, or 3 to pick it. */
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

    const backdrop = this.scene.add.rectangle(width / 2, height / 2, width, height, PAL.ink, 0.82).setDepth(DEPTH);
    const title = this.text(width / 2, 92, 'CHOOSE AN UPGRADE', 34, PAL.textHex).setOrigin(0.5).setDepth(DEPTH + 1);
    const subtitle = this.text(width / 2, 134, 'Upgrades last for the rest of the run', 16, PAL.textSoft)
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    this.objects.push(backdrop, title, subtitle);

    const totalWidth = choices.length * CARD_W + (choices.length - 1) * CARD_GAP;
    const firstX = width / 2 - totalWidth / 2 + CARD_W / 2;
    choices.forEach((id, index) => {
      this.objects.push(this.createCard(id, index, firstX + index * (CARD_W + CARD_GAP), height / 2 + 40));
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
    const card = this.scene.add.container(x, y).setDepth(DEPTH + 1);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a1f3d, 0.97);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    bg.lineStyle(3, PAL.pumpkin, 1);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);

    const icon = this.scene.add.graphics();
    drawUpgradeIcon(icon, 0, -60, 70, id);

    const name = this.text(0, 22, def.name, 22, PAL.textHex).setOrigin(0.5);
    const description = this.text(0, 66, def.description, 15, PAL.textSoft, CARD_W - 40).setOrigin(0.5, 0);
    const key = this.text(0, CARD_H / 2 - 16, `Press ${index + 1}`, 14, PAL.accentText).setOrigin(0.5);

    card.add([bg, icon, name, description, key]);
    card.setSize(CARD_W, CARD_H);
    card.setInteractive(new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    card.on('pointerover', () => card.setScale(1.04));
    card.on('pointerout', () => card.setScale(1));
    card.on('pointerdown', () => this.pick(index));
    return card;
  }

  private text(x: number, y: number, value: string, size: number, color: string | number, wrapWidth?: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color,
      stroke: '#1b0f24',
      strokeThickness: 4,
      align: 'center',
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
    });
  }
}
