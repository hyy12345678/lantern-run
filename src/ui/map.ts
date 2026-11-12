import Phaser from 'phaser';
import { PAL, THEME_PALETTES } from './palette';
import { drawFloorTile, drawHedge, drawWallTile, tileHash } from './drawing';
import { TILE_SIZE } from '../core/config';
import type { RoomLayout } from '../core/types';

/**
 * Draws the static part of a room (floor, border, and walls in the room's theme) once into a RenderTexture.
 * Entities are drawn each frame on top of it.
 */
export function buildStaticLayer(scene: Phaser.Scene, layout: RoomLayout): Phaser.GameObjects.RenderTexture {
  const { grid } = layout;
  const palette = THEME_PALETTES[layout.theme];
  const width = grid.cols * TILE_SIZE;
  const height = grid.rows * TILE_SIZE;
  const g = scene.make.graphics({}, false);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const h = tileHash(col, row);
      const isBorder = row === 0 || col === 0 || row === grid.rows - 1 || col === grid.cols - 1;
      if (isBorder) {
        drawHedge(g, x, y, TILE_SIZE, h, palette);
        continue;
      }
      drawFloorTile(g, x, y, TILE_SIZE, h, palette);
      if (!grid.walkable[row * grid.cols + col]) drawWallTile(g, x, y, TILE_SIZE, h, palette);
    }
  }

  const rt = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(0);
  rt.draw(g, 0, 0);
  g.destroy();
  return rt;
}

/** Dark frame around the screen. Drawn once and sits above the world, below the HUD. */
export function buildVignette(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(5);
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const alpha = 0.09 * (1 - i / steps) ** 2;
    g.lineStyle(6, PAL.ink, alpha);
    g.strokeRect(i * 6, i * 6, width - i * 12, height - i * 12);
  }
  return g;
}
