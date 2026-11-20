import Phaser from 'phaser';
import { PAL, THEME_PALETTES } from './palette';
import {
  CRYPT_CANDLE_OFFSET,
  CRYPT_CANDLE_THRESHOLD,
  drawCarvedFace,
  drawFloorTile,
  drawHedge,
  drawSpiritCandle,
  drawWallTile,
  tileHash,
} from './drawing';
import { TILE_SIZE } from '../core/config';
import type { Grid, RoomLayout, ThemeId, Vec2 } from '../core/types';

/** A fixed light in the room, from its theme (R15.8). The scene adds flicker. */
export interface ThemeLight {
  pos: Vec2;
  radius: number;
  strength: number;
  color: number;
  haloAlpha: number;
}

export interface StaticLayer {
  layer: Phaser.GameObjects.RenderTexture;
  lights: ThemeLight[];
}

// Chance for a wall or floor tile to hold a theme light. Tuned to give about 6 to 12 lights per room.
const SPIRIT_CANDLE_CHANCE = 0.14;
const STAINED_GLASS_CHANCE = 0.024;
const CARVED_PUMPKIN_CHANCE = 0.45;
const STAINED_GLASS_COLORS: readonly number[] = [0xff6b9a, 0x6ec6ff, 0xffd166, 0xb388ff];

function isInteriorWall(grid: Grid, col: number, row: number): boolean {
  if (col <= 0 || row <= 0 || col >= grid.cols - 1 || row >= grid.rows - 1) return false;
  return !grid.walkable[row * grid.cols + col];
}

/** Draws any theme light on this tile and returns it. Only looks; it never changes the rules. */
function themeLight(g: Phaser.GameObjects.Graphics, theme: ThemeId, col: number, row: number, wall: boolean): ThemeLight | null {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const roll = tileHash(col, row, 5);
  switch (theme) {
    case 'graveyard': {
      // Spirit candles on rounded headstones (tileHash < 0.55 picks that shape in drawTombstone).
      if (!wall || tileHash(col, row) >= 0.55 || roll >= SPIRIT_CANDLE_CHANCE) return null;
      const top = y + TILE_SIZE * 0.14;
      drawSpiritCandle(g, x + TILE_SIZE / 2, top);
      return { pos: { x: x + TILE_SIZE / 2, y: top - 8 }, radius: 46, strength: 0.6, color: 0x9ff5d8, haloAlpha: 0.45 };
    }
    case 'chapel': {
      if (wall || roll >= STAINED_GLASS_CHANCE) return null;
      const color = STAINED_GLASS_COLORS[Math.floor(tileHash(col, row, 6) * STAINED_GLASS_COLORS.length)];
      return { pos: { x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 }, radius: 56, strength: 0.45, color, haloAlpha: 0.35 };
    }
    case 'pumpkinPatch': {
      // Pumpkin piles are walls with tileHash < 0.28 (see drawWallTile).
      if (!wall || tileHash(col, row) >= 0.28 || roll >= CARVED_PUMPKIN_CHANCE) return null;
      const cx = x + TILE_SIZE * 0.4;
      const cy = y + TILE_SIZE * 0.62;
      drawCarvedFace(g, cx, cy, TILE_SIZE * 0.32);
      return { pos: { x: cx, y: cy }, radius: 50, strength: 0.6, color: PAL.pumpkin, haloAlpha: 0.5 };
    }
    case 'crypt': {
      // Every candle drawFloorTile draws also gives light.
      if (wall || tileHash(col, row, 3) <= CRYPT_CANDLE_THRESHOLD) return null;
      const pos = { x: x + TILE_SIZE * CRYPT_CANDLE_OFFSET.x, y: y + TILE_SIZE * CRYPT_CANDLE_OFFSET.y - 9 };
      return { pos, radius: 34, strength: 0.45, color: PAL.candle, haloAlpha: 0.32 };
    }
  }
}

/**
 * Draws the static part of a room (floor, border, walls, and theme lights) once into a RenderTexture.
 * The floor is drawn first for every tile, then walls on top, so wall shadows fall across the floor.
 * Returns the layer and the room's theme lights.
 */
export function buildStaticLayer(scene: Phaser.Scene, layout: RoomLayout): StaticLayer {
  const { grid } = layout;
  const palette = THEME_PALETTES[layout.theme];
  const width = grid.cols * TILE_SIZE;
  const height = grid.rows * TILE_SIZE;
  const g = scene.make.graphics({}, false);
  const lights: ThemeLight[] = [];
  const doorKey = layout.doorTile.row * grid.cols + layout.doorTile.col;

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
        continue;
      }
      const wall = isInteriorWall(grid, col, row);
      if (wall) {
        drawWallTile(g, x, y, TILE_SIZE, h, palette, {
          left: isInteriorWall(grid, col - 1, row),
          right: isInteriorWall(grid, col + 1, row),
          up: isInteriorWall(grid, col, row - 1),
          down: isInteriorWall(grid, col, row + 1),
        });
      }
      if (row * grid.cols + col === doorKey) continue;
      const light = themeLight(g, layout.theme, col, row, wall);
      if (light) lights.push(light);
    }
  }

  const layer = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(0);
  layer.draw(g, 0, 0);
  g.destroy();
  return { layer, lights };
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
