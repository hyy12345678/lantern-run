import Phaser from 'phaser';
import { PAL, THEME_PALETTES } from './palette';
import { drawFloorTile, drawHedge, drawWallTile, tileHash } from './drawing';
import { TILE_SIZE } from '../core/config';
import type { Grid, RoomLayout } from '../core/types';

function isInteriorWall(grid: Grid, col: number, row: number): boolean {
  if (col <= 0 || row <= 0 || col >= grid.cols - 1 || row >= grid.rows - 1) return false;
  return !grid.walkable[row * grid.cols + col];
}

/**
 * Draws the static part of a room (floor, border, and walls in the room's theme) once into a RenderTexture.
 * The floor is drawn first for every tile, then walls on top, so wall shadows fall across the floor.
 * Entities are drawn each frame on top of it.
 */
export function buildStaticLayer(scene: Phaser.Scene, layout: RoomLayout): Phaser.GameObjects.RenderTexture {
  const { grid } = layout;
  const palette = THEME_PALETTES[layout.theme];
  const width = grid.cols * TILE_SIZE;
  const height = grid.rows * TILE_SIZE;
  const g = scene.make.graphics({}, false);

  const isBorder = (col: number, row: number): boolean =>
    row === 0 || col === 0 || row === grid.rows - 1 || col === grid.cols - 1;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (isBorder(col, row)) continue;
      drawFloorTile(g, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, col, row, palette);
    }
  }

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const h = tileHash(col, row);
      if (isBorder(col, row)) {
        drawHedge(g, x, y, TILE_SIZE, h, palette);
      } else if (isInteriorWall(grid, col, row)) {
        drawWallTile(g, x, y, TILE_SIZE, h, palette, {
          left: isInteriorWall(grid, col - 1, row),
          right: isInteriorWall(grid, col + 1, row),
          up: isInteriorWall(grid, col, row - 1),
          down: isInteriorWall(grid, col, row + 1),
        });
      }
    }
  }

  const rt = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(0);
  rt.draw(g, 0, 0);
  g.destroy();
  return rt;
}

/** Dark frame around the screen. Drawn once and sits above the world, below the HUD. */
export function buildVignette(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(7);
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const alpha = 0.09 * (1 - i / steps) ** 2;
    g.lineStyle(6, PAL.ink, alpha);
    g.strokeRect(i * 6, i * 6, width - i * 12, height - i * 12);
  }
  return g;
}
