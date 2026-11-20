import Phaser from 'phaser';
import { FLAME_MAX } from '../core/config';
import type { Grid, Vec2 } from '../core/types';
import { castLightRays } from '../core/visibility';

export const BRUSH_KEY = 'lantern-light-brush';
export const BRUSH_RADIUS = 128;
/** Cool night colour for the darkness, so the warm lantern light stands out (R15.2). */
const DARK_COLOR = 0x070b22;
export const DARKNESS_ALPHA = 0.8;
const WARM_COLOR = 0xff9a3c;
const WARM_ALPHA = 0.3;
/** Light radius at flame 0 and at full flame (R14.1). */
const LIGHT_MIN = 80;
const LIGHT_MAX = 230;
/** Shadow wedges reach this far past a wall, more than the screen diagonal. */
const SHADOW_FAR = 1400;
const HALO_POOL = 64;

/** One light source other than the lantern. Glows are not blocked by walls, so dangers stay readable. */
export interface LightSource {
  pos: Vec2;
  /** Radius of the hole it makes in the darkness. 0 for none. */
  radius: number;
  /** 0 to 1. How much darkness the hole removes at its centre. */
  strength: number;
  /** Additive halo drawn above the darkness. Omit for none. */
  halo?: { radius: number; color: number; alpha: number };
}

export interface LanternFrame {
  grid: Grid;
  player: Vec2;
  /** Lantern light radius in px, flicker included. 0 hides the lantern light. */
  radius: number;
  sources: readonly LightSource[];
  /** Defaults to DARKNESS_ALPHA. Lowered when the win floods the room with light. */
  darkness?: number;
  rayCount: number;
}

/** Light radius in pixels for a flame value. */
export function lightRadius(flame: number): number {
  return LIGHT_MIN + (LIGHT_MAX - LIGHT_MIN) * Math.max(0, Math.min(1, flame / FLAME_MAX));
}

/** Creates the soft radial brush once per game. White in the middle, fading to clear at the edge. */
export function ensureBrush(scene: Phaser.Scene): void {
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
 * Lighting for a room (design.md section 13):
 * a light mask (lantern with wall shadows, plus other sources), a cool darkness with the mask erased,
 * a warm additive tint under the darkness, and additive halos above it.
 */
export class Lantern {
  private readonly mask: Phaser.GameObjects.RenderTexture;
  private readonly darkness: Phaser.GameObjects.RenderTexture;
  private readonly warm: Phaser.GameObjects.RenderTexture;
  private readonly brush: Phaser.GameObjects.Image;
  private readonly shadows: Phaser.GameObjects.Graphics;
  private readonly halos: Phaser.GameObjects.Image[] = [];

  /** `depth` is the darkness. The warm tint sits just below it and the halos `haloDepth` above. */
  constructor(scene: Phaser.Scene, width: number, height: number, depth: number, haloDepth: number) {
    ensureBrush(scene);
    this.mask = scene.make.renderTexture({ x: 0, y: 0, width, height }, false).setOrigin(0, 0);
    this.warm = scene.add
      .renderTexture(0, 0, width, height)
      .setOrigin(0, 0)
      .setDepth(depth - 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.darkness = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(depth);
    this.brush = scene.make.image({ x: 0, y: 0, key: BRUSH_KEY }, false);
    this.shadows = scene.make.graphics({}, false);
    for (let i = 0; i < HALO_POOL; i++) {
      this.halos.push(
        scene.add.image(0, 0, BRUSH_KEY).setDepth(haloDepth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      );
    }
  }

  update(frame: LanternFrame): void {
    const { player, radius } = frame;
    this.buildShadows(frame);

    // 1. Light mask: lantern, minus shadows, plus the other sources.
    this.mask.clear();
    if (radius > 0) {
      this.stamp(this.mask, player, radius, 1, 0xffffff);
      this.mask.erase(this.shadows);
    }
    for (const source of frame.sources) {
      if (source.radius > 0 && source.strength > 0) this.stamp(this.mask, source.pos, source.radius, source.strength, 0xffffff);
    }

    // 2. Darkness with the light mask cut out.
    this.darkness.clear();
    this.darkness.fill(DARK_COLOR, frame.darkness ?? DARKNESS_ALPHA);
    this.darkness.erase(this.mask, 0, 0);

    // 3. Warm tint near the lantern, shadowed the same way.
    this.warm.clear();
    if (radius > 0) {
      this.stamp(this.warm, player, radius, WARM_ALPHA, WARM_COLOR);
      this.warm.erase(this.shadows);
    }

    // 4. Halos.
    let used = 0;
    for (const source of frame.sources) {
      if (!source.halo || used >= this.halos.length) continue;
      const { radius: r, color, alpha } = source.halo;
      this.halos[used++]
        .setPosition(source.pos.x, source.pos.y)
        .setScale(r / BRUSH_RADIUS)
        .setTint(color)
        .setAlpha(alpha)
        .setVisible(true);
    }
    for (let i = used; i < this.halos.length; i++) this.halos[i].setVisible(false);
  }

  /** Shadow wedges: for each pair of neighbouring rays where a wall cut the light, the area behind it. */
  private buildShadows(frame: LanternFrame): void {
    const g = this.shadows;
    g.clear();
    if (frame.radius <= 0) return;
    const { player } = frame;
    // Slightly longer than the light, so rays that reach the edge are not mistaken for blocked ones.
    const rays = castLightRays(frame.grid, player, frame.radius * 1.02, frame.rayCount);
    const far = (end: Vec2): Vec2 => {
      const dx = end.x - player.x;
      const dy = end.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: player.x + (dx / len) * SHADOW_FAR, y: player.y + (dy / len) * SHADOW_FAR };
    };
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i];
      const b = rays[(i + 1) % rays.length];
      if (!a.blocked && !b.blocked) continue;
      g.fillPoints([a.end, b.end, far(b.end), far(a.end)], true);
    }
  }

  private stamp(target: Phaser.GameObjects.RenderTexture, pos: Vec2, radius: number, alpha: number, tint: number): void {
    this.brush.setScale(radius / BRUSH_RADIUS).setAlpha(alpha).setTint(tint);
    target.draw(this.brush, pos.x, pos.y);
  }
}
