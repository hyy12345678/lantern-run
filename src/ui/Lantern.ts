import Phaser from 'phaser';
import { FLAME_MAX } from '../core/config';
import type { Vec2 } from '../core/types';
import { PAL } from './palette';

const BRUSH_KEY = 'lantern-light-brush';
const BRUSH_RADIUS = 128;
/** How dark the unlit parts of the room are. Below 1 so walls stay faintly visible. */
const DARKNESS_ALPHA = 0.78;
/** Light radius at flame 0 and at full flame (R14.1). */
const LIGHT_MIN = 80;
const LIGHT_MAX = 230;

export interface Glow {
  pos: Vec2;
  radius: number;
  /** 0 to 1. How much of the darkness the glow removes at its centre. */
  strength: number;
}

/** Light radius in pixels for a flame value. */
export function lightRadius(flame: number): number {
  return LIGHT_MIN + (LIGHT_MAX - LIGHT_MIN) * Math.max(0, Math.min(1, flame / FLAME_MAX));
}

/** Creates the soft radial brush once per game. White in the middle, fading to clear at the edge. */
function ensureBrush(scene: Phaser.Scene): void {
  if (scene.textures.exists(BRUSH_KEY)) return;
  const size = BRUSH_RADIUS * 2;
  const canvas = scene.textures.createCanvas(BRUSH_KEY, size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();
  const gradient = ctx.createRadialGradient(BRUSH_RADIUS, BRUSH_RADIUS, 0, BRUSH_RADIUS, BRUSH_RADIUS, BRUSH_RADIUS);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.75, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
}

/**
 * Darkness over the room with holes of light: the lantern around the player, and small glows
 * at ghosts, the boss, candy, and the door so they stay readable (R14.1, R14.2).
 * Sits above the world and below the HUD.
 */
export class Lantern {
  private readonly layer: Phaser.GameObjects.RenderTexture;
  private readonly brush: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, width: number, height: number, depth: number) {
    ensureBrush(scene);
    this.layer = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(depth);
    this.brush = scene.make.image({ x: 0, y: 0, key: BRUSH_KEY, add: false });
  }

  /** Redraws the darkness. `flicker` is a small multiplier around 1 for the lantern radius. */
  update(player: Vec2, flame: number, flicker: number, glows: readonly Glow[]): void {
    this.layer.clear();
    this.layer.fill(PAL.night, DARKNESS_ALPHA);
    this.erase(player, lightRadius(flame) * flicker, 1);
    for (const glow of glows) this.erase(glow.pos, glow.radius, glow.strength);
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  private erase(pos: Vec2, radius: number, strength: number): void {
    this.brush.setScale(radius / BRUSH_RADIUS).setAlpha(strength);
    this.layer.erase(this.brush, pos.x, pos.y);
  }
}
