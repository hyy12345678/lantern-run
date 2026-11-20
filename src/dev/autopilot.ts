// Dev aid for recording the demo video: a simple bot that plays the game.
// It only reads game state and returns input, so it uses the same rules as a person.
// Not part of the game itself. Enabled with `?autopilot=1`.

import { BOSS_RADIUS, GHOST_CONTACT_RADIUS, TILE_SIZE } from '../core/config';
import { findPath, isWalkableTile, tileAt, tileCenter } from '../core/grid';
import type { RunInput, RunState } from '../core/run';
import type { Grid, Tile, Vec2 } from '../core/types';
import type { UpgradeId } from '../core/upgrades';
import { distance, length, scale, sub } from '../core/vec';

/** Tiles this close to a ghost count as blocked when planning, so the bot walks around ghosts. */
const GHOST_AVOID_PX = 52;
const BOSS_AVOID_PX = 70;
/** Blow when a ghost gets this close and the ability is ready. */
const BLOW_TRIGGER_PX = 64;
/** Step to the side of the boss's dash line when closer than this to it. */
const DASH_DODGE_PX = 44;
/** How close to a waypoint counts as arrived. */
const ARRIVE_PX = 6;

/** Walkable grid with tiles near danger marked as walls, for planning only. */
function dangerGrid(state: RunState, goal: Tile): Grid {
  const { grid, ghosts, boss } = state.layout;
  const walkable = [...grid.walkable];
  const block = (pos: Vec2, radius: number): void => {
    const reach = Math.ceil(radius / TILE_SIZE);
    const centre = tileAt(pos);
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const tile = { col: centre.col + dc, row: centre.row + dr };
        if (tile.col === goal.col && tile.row === goal.row) continue;
        if (distance(tileCenter(tile), pos) <= radius && isWalkableTile(grid, tile)) {
          walkable[tile.row * grid.cols + tile.col] = false;
        }
      }
    }
  };
  for (const ghost of ghosts) block(ghost.pos, GHOST_AVOID_PX);
  if (boss) block(boss.pos, BOSS_AVOID_PX);
  return { ...grid, walkable };
}

/** Shortest route to the goal, avoiding danger if possible. */
function route(state: RunState, goal: Tile): Tile[] | null {
  const start = tileAt(state.player);
  const safe = dangerGrid(state, goal);
  if (isWalkableTile(safe, start)) {
    const path = findPath(safe, start, goal);
    if (path) return path;
  }
  return findPath(state.layout.grid, start, goal);
}

function steer(from: Vec2, to: Vec2): Vec2 {
  const offset = sub(to, from);
  const len = length(offset);
  return len < 0.001 ? { x: 0, y: 0 } : scale(offset, 1 / len);
}

/** Order the bot prefers upgrades in. It favours ones that are interesting to watch. */
const PICK_ORDER: readonly UpgradeId[] = ['hungryFlame', 'lastEmber', 'sweetTooth', 'quickBreath', 'thickWax', 'swiftFeet', 'brightWick', 'ironPumpkin'];

/** Which offered upgrade the bot takes. */
export function autopilotPick(choices: readonly UpgradeId[]): UpgradeId {
  return PICK_ORDER.find((id) => choices.includes(id)) ?? choices[0];
}

/** Picks the next input: go for the nearest candy until the goal is met, then for the door. */
export function autopilotInput(state: RunState): RunInput {
  const { player, layout } = state;

  // Dodge a boss dash: step sideways off the warning line.
  const boss = layout.boss;
  if (boss && boss.phase === 'windup') {
    const toPlayer = sub(player, boss.pos);
    const along = toPlayer.x * boss.dashDir.x + toPlayer.y * boss.dashDir.y;
    const side = { x: -boss.dashDir.y, y: boss.dashDir.x };
    const across = toPlayer.x * side.x + toPlayer.y * side.y;
    if (along > -BOSS_RADIUS && Math.abs(across) < DASH_DODGE_PX) {
      const dir = across >= 0 ? side : scale(side, -1);
      return { move: dir, blow: false };
    }
  }

  const goalMet = state.candiesInRoom >= layout.candyGoal;
  let target: Vec2 = layout.door;
  if (!goalMet && layout.candies.length > 0) {
    let best = Infinity;
    for (const candy of layout.candies) {
      const path = route(state, tileAt(candy));
      const cost = path ? path.length : Infinity;
      if (cost < best) {
        best = cost;
        target = candy;
      }
    }
  }

  const path = route(state, tileAt(target));
  let waypoint = target;
  if (path && path.length > 1) {
    // Head for the next tile centre, or straight for the target on the last tile.
    waypoint = path.length > 2 || distance(player, tileCenter(path[1])) > ARRIVE_PX ? tileCenter(path[1]) : target;
  }

  const nearGhost = layout.ghosts.some((g) => distance(g.pos, player) < BLOW_TRIGGER_PX + GHOST_CONTACT_RADIUS * 0.2);
  const nearBoss = boss !== null && distance(boss.pos, player) < BLOW_TRIGGER_PX + BOSS_RADIUS;
  return { move: steer(player, waypoint), blow: (nearGhost || nearBoss) && state.blowCooldown <= 0 };
}
