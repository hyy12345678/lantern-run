// Shared types for the pure core. No Phaser imports allowed in src/core/.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Tile {
  col: number;
  row: number;
}

// Row-major walkability map. walkable[row * cols + col] is true when the tile can be entered.
export interface Grid {
  cols: number;
  rows: number;
  walkable: boolean[];
}

export type GhostKind = 'patrol' | 'chase' | 'blink';

export interface Ghost {
  id: number;
  kind: GhostKind;
  pos: Vec2;
  /** Patrol only: tile-center waypoints forming a loop. Empty for other kinds. */
  path: Vec2[];
  /** Patrol only: index into `path` of the current target. */
  pathIndex: number;
  /** Blink only: seconds until the next teleport. */
  blinkTimer: number;
  /** Seconds until this ghost can damage the player again. */
  hitCooldown: number;
  /** RNG state, advanced whenever the ghost draws a random number. */
  rngState: number;
}

export interface Boss {
  pos: Vec2;
  /** Seconds until the boss can damage the player again. */
  hitCooldown: number;
}

export type ThemeId = 'graveyard' | 'chapel' | 'pumpkinPatch' | 'crypt';

export interface RoomLayout {
  roomIndex: 1 | 2 | 3 | 4;
  theme: ThemeId;
  grid: Grid;
  start: Vec2;
  door: Vec2;
  doorTile: Tile;
  candyGoal: number;
  candies: Vec2[];
  ghosts: Ghost[];
  /** Present only in the boss room. */
  boss: Boss | null;
}
