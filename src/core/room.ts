import {
  BLINK_INTERVAL_SEC,
  BOSS_MIN_TILE_DIST,
  BOSS_ROOM_INDEX,
  CANDY_MIN_TILE_DIST,
  CANDY_SPARE_COUNT,
  GHOST_MIN_TILE_DIST,
  MAP_COLS,
  MAP_ROWS,
  PATROL_WAYPOINT_MAX,
  PATROL_WAYPOINT_MIN,
  ROOM_CANDY_GOALS,
  ROOM_GHOST_COUNTS,
  BOSS_WALL_DENSITY,
  WALL_DENSITY,
  WALL_SEGMENT_ATTEMPTS,
  WALL_SEGMENT_MAX,
  WALL_SEGMENT_MIN,
} from './config';
import { createBoss } from './boss';
import { createGrid, distanceMap, findPath, inBounds, tileCenter, tileIndex } from './grid';
import { drawFloat, drawInt, mixSeed, shuffled } from './rng';
import { BOSS_THEME, TRIAL_THEMES } from './themes';
import type { Ghost, GhostKind, Grid, RoomLayout, Tile, ThemeId, Vec2 } from './types';

const GHOST_KIND_ROTATION: readonly GhostKind[] = ['patrol', 'chase', 'blink'];
const START_COL = 2;
const DOOR_COL = MAP_COLS - 3;

/** Random stream used only for the order of trial themes, separate from the room layouts. */
const THEME_STREAM = 200;

/** The three trial themes in a seeded order, so each run visits every trial theme once (R8.1). */
export function trialThemeOrder(seed: number): ThemeId[] {
  return shuffled(TRIAL_THEMES, mixSeed(seed, THEME_STREAM)).value;
}

/**
 * Builds one room deterministically from (roomIndex, seed).
 * The door is always reachable from the start, and all candies, ghosts, and the boss sit on reachable tiles.
 */
export function generateRoom(roomIndex: 1 | 2 | 3 | 4, seed: number): RoomLayout {
  let rng = mixSeed(seed, roomIndex);
  const nextFloat = (): number => {
    const draw = drawFloat(rng);
    rng = draw.state;
    return draw.value;
  };
  const nextInt = (min: number, max: number): number => {
    const draw = drawInt(rng, min, max);
    rng = draw.state;
    return draw.value;
  };

  const theme: ThemeId = roomIndex === BOSS_ROOM_INDEX ? BOSS_THEME : trialThemeOrder(seed)[roomIndex - 1];

  const grid = createGrid(MAP_COLS, MAP_ROWS, true);
  const set = (tile: Tile, walkable: boolean): void => {
    if (inBounds(grid, tile)) grid.walkable[tileIndex(grid, tile)] = walkable;
  };

  // Solid border, then random interior walls.
  for (let col = 0; col < MAP_COLS; col++) {
    set({ col, row: 0 }, false);
    set({ col, row: MAP_ROWS - 1 }, false);
  }
  for (let row = 0; row < MAP_ROWS; row++) {
    set({ col: 0, row }, false);
    set({ col: MAP_COLS - 1, row }, false);
  }
  const density = roomIndex === BOSS_ROOM_INDEX ? BOSS_WALL_DENSITY : WALL_DENSITY;
  placeWallSegments(grid, density, nextFloat, nextInt);

  const start: Tile = { col: START_COL, row: Math.floor(MAP_ROWS / 2) };
  const doorTile: Tile = { col: DOOR_COL, row: nextInt(2, MAP_ROWS - 3) };

  // Keep the start area open so a room never begins boxed in. Removing walls cannot disconnect anything.
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      set({ col: start.col + dCol, row: start.row + dRow }, true);
    }
  }
  set(doorTile, true);

  const dist = distanceMap(grid, start);
  const pathDist = (tile: Tile): number => dist[tileIndex(grid, tile)];
  const open: Tile[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = { col, row };
      if (pathDist(tile) < 0) continue;
      if (col === doorTile.col && row === doorTile.row) continue;
      open.push(tile);
    }
  }

  const candyGoal = ROOM_CANDY_GOALS[roomIndex - 1];
  const candyTiles = pickDistinct(
    open.filter((t) => pathDist(t) >= CANDY_MIN_TILE_DIST),
    candyGoal + CANDY_SPARE_COUNT,
    nextInt,
  );
  const candyKeys = new Set(candyTiles.map((t) => tileIndex(grid, t)));

  const ghostCount = ROOM_GHOST_COUNTS[roomIndex - 1];
  const ghostStarts = pickDistinct(
    open.filter((t) => pathDist(t) >= GHOST_MIN_TILE_DIST && !candyKeys.has(tileIndex(grid, t))),
    ghostCount,
    nextInt,
  );
  const occupied = new Set<number>([...candyKeys, ...ghostStarts.map((t) => tileIndex(grid, t))]);

  const ghosts: Ghost[] = ghostStarts.map((startTile, i) => {
    const kind = GHOST_KIND_ROTATION[i % GHOST_KIND_ROTATION.length];
    const path = kind === 'patrol' ? buildPatrolPath(grid, startTile, open, nextInt) : [];
    return {
      id: i,
      kind,
      pos: tileCenter(startTile),
      path,
      pathIndex: 0,
      blinkTimer: BLINK_INTERVAL_SEC,
      hitCooldown: 0,
      rngState: mixSeed(rng, i + 1),
    };
  });

  let boss: RoomLayout['boss'] = null;
  if (roomIndex === BOSS_ROOM_INDEX) {
    const bossCandidates = open.filter(
      (t) => pathDist(t) >= BOSS_MIN_TILE_DIST && !occupied.has(tileIndex(grid, t)),
    );
    // The map is large enough that candidates always exist. The fallback keeps the type non-null.
    const [bossTile] = pickDistinct(bossCandidates, 1, nextInt);
    boss = createBoss(tileCenter(bossTile ?? open[open.length - 1]));
  }

  return {
    roomIndex,
    theme,
    grid,
    start: tileCenter(start),
    door: tileCenter(doorTile),
    doorTile,
    candyGoal,
    candies: candyTiles.map(tileCenter),
    ghosts,
    boss,
  };
}

/**
 * Places straight wall segments until about `density` of the interior is wall.
 * A segment is placed only when none of its tiles or their eight neighbours is already a wall,
 * and it never touches the border. Wall pieces are therefore isolated straight lines, which
 * cannot close off any area, so every walkable tile stays reachable.
 */
function placeWallSegments(
  grid: Grid,
  density: number,
  nextFloat: () => number,
  nextInt: (min: number, max: number) => number,
): void {
  const interior = (grid.cols - 2) * (grid.rows - 2);
  const target = Math.round(interior * density);
  // Segments start two tiles in from the edge, so a walkable tile always separates them from the border.
  const minCell = 2;
  let walls = 0;
  for (let attempt = 0; attempt < WALL_SEGMENT_ATTEMPTS && walls < target; attempt++) {
    const horizontal = nextFloat() < 0.5;
    const len = nextInt(WALL_SEGMENT_MIN, WALL_SEGMENT_MAX);
    const maxCol = grid.cols - 1 - minCell - (horizontal ? len - 1 : 0);
    const maxRow = grid.rows - 1 - minCell - (horizontal ? 0 : len - 1);
    if (maxCol < minCell || maxRow < minCell) continue;
    const col = nextInt(minCell, maxCol);
    const row = nextInt(minCell, maxRow);
    const tiles: Tile[] = [];
    for (let i = 0; i < len; i++) {
      tiles.push(horizontal ? { col: col + i, row } : { col, row: row + i });
    }
    if (!tiles.every((t) => hasClearance(grid, t))) continue;
    for (const t of tiles) grid.walkable[tileIndex(grid, t)] = false;
    walls += len;
  }
}

/** True when the tile and its eight neighbours are all walkable. */
function hasClearance(grid: Grid, tile: Tile): boolean {
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      const near = { col: tile.col + dCol, row: tile.row + dRow };
      if (!inBounds(grid, near) || !grid.walkable[tileIndex(grid, near)]) return false;
    }
  }
  return true;
}

function buildPatrolPath(
  grid: Grid,
  startTile: Tile,
  open: readonly Tile[],
  nextInt: (min: number, max: number) => number,
): Vec2[] {
  const waypointCount = nextInt(PATROL_WAYPOINT_MIN, PATROL_WAYPOINT_MAX);
  const others = pickDistinct(
    open.filter((t) => t.col !== startTile.col || t.row !== startTile.row),
    waypointCount - 1,
    nextInt,
  );
  const waypoints = [startTile, ...others];

  // Join consecutive waypoints with BFS routes. Each route's last tile is the next route's first,
  // so every tile appears once in the loop.
  const points: Vec2[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const from = waypoints[i];
    const to = waypoints[(i + 1) % waypoints.length];
    const route = findPath(grid, from, to) ?? [from];
    for (const tile of route.slice(0, -1)) points.push(tileCenter(tile));
  }
  return points;
}

/** Picks up to `count` distinct items with a partial Fisher-Yates shuffle. */
function pickDistinct<T>(items: readonly T[], count: number, nextInt: (min: number, max: number) => number): T[] {
  const pool = [...items];
  const picked = Math.min(count, pool.length);
  for (let i = 0; i < picked; i++) {
    const j = nextInt(i, pool.length - 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, picked);
}
