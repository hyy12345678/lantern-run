# Design: Lantern Run

Source of truth for requirements: `requirements.md` in this folder.
Tuning constants live in `src/core/config.ts`. Values here must match that file.

## 1. Architecture

```
            +-------------------+
            |  Phaser scenes    |   src/scenes/  (thin: input, rendering, audio)
            |  Menu, Night,     |
            |  Result           |
            +---------+---------+
                      | calls
            +---------v---------+
            |  Pure core        |   src/core/    (no phaser imports)
            |  flame, candy,    |
            |  ghosts, blow,    |
            |  night, score,    |
            |  rng, config      |
            +-------------------+
```

The scene owns a `RunState` value and calls `core` once per frame with `dt`.
Core returns a new state and a list of events (`candyCollected`, `ghostHit`,
`nightCleared`, `runFailed`). The scene plays audio and visuals for each event.

## 2. Modules

| File | Responsibility |
|---|---|
| `src/core/config.ts` | All tuning constants (speeds, decay rate, cooldowns, goals, ghost counts). |
| `src/core/rng.ts` | Seeded PRNG (mulberry32). `nextFloat()`, `nextInt(min, max)`. |
| `src/core/grid.ts` | Tile map: `isWalkable(x, y)`, `tileAt(px, py)`, `findPath(from, to)` (BFS). |
| `src/core/flame.ts` | `decayFlame(flame, dt)`, `addFlame(flame, amount)` (clamped 0..100). |
| `src/core/candy.ts` | `collectCandies(player, candies)` returns `{ remaining, collected }`. |
| `src/core/ghost.ts` | `stepGhost(ghost, player, grid, dt, rng)` for patrol, chase, blink. |
| `src/core/blow.ts` | `canBlow(cooldownLeft)`, `applyBlow(player, ghosts, grid)`, `tickCooldown(cd, dt)`. |
| `src/core/night.ts` | `generateNight(index, seed)` returns map, start, door, candies, ghosts. |
| `src/core/score.ts` | `addCandyPoint`, `addNightClearPoint`, `mergeBestScore(stored, run)`. |
| `src/core/run.ts` | `createRun(seed)`, `stepRun(state, input, dt)` returns `{ state, events }`. |
| `src/scenes/MenuScene.ts` | Start button, best score, mute toggle. |
| `src/scenes/NightScene.ts` | Renders map, player, ghosts, candies, HUD. Reads input. |
| `src/scenes/ResultScene.ts` | Fail or win screen, run score, Play Again. |
| `src/ui/Hud.ts` | Flame bar, candy counter, night label, cooldown indicator. |
| `src/ui/Joystick.ts` | Virtual joystick for touch input. |
| `src/ui/Fog.ts` | Slow drifting fog layers. |

## 3. Key types

```ts
export type Vec2 = { x: number; y: number };

export type GhostKind = 'patrol' | 'chase' | 'blink';

export interface Ghost {
  id: number;
  kind: GhostKind;
  pos: Vec2;
  pathIndex: number;      // patrol only
  blinkTimer: number;     // blink only, seconds until next teleport
  hitCooldown: number;    // seconds until this ghost can damage again
}

export interface NightLayout {
  index: 1 | 2 | 3;
  grid: Grid;             // walkable tiles
  start: Vec2;
  door: Vec2;
  candyGoal: number;      // 5, 8, 12
  candies: Vec2[];
  ghosts: Ghost[];
  patrolPaths: Vec2[][];
}

export interface RunState {
  seed: number;
  nightIndex: 1 | 2 | 3;
  player: Vec2;
  flame: number;          // 0..100
  candiesThisNight: number;
  runScore: number;
  blowCooldown: number;   // seconds left, 0 means ready
  layout: NightLayout;
  status: 'playing' | 'paused' | 'failed' | 'won';
}

export type RunEvent =
  | { type: 'candyCollected'; total: number }
  | { type: 'ghostHit'; ghostId: number }
  | { type: 'blowUsed' }
  | { type: 'nightCleared'; night: 1 | 2 | 3 }
  | { type: 'runFailed' }
  | { type: 'runWon' };
```

## 4. Config values (`src/core/config.ts`)

| Key | Value | Spec ref |
|---|---|---|
| `PLAYER_SPEED` | 120 px/s | R2.1 |
| `FLAME_START` | 100 | R1.2 |
| `FLAME_DECAY_PER_SEC` | 1.5 | R3.1 |
| `FLAME_LOW_THRESHOLD` | 25 | R3.4 |
| `CANDY_PICKUP_RADIUS` | 24 px | R4.1 |
| `CANDY_FLAME_RESTORE` | 15 | R4.2 |
| `PATROL_SPEED` | 40 px/s | R5.1 |
| `CHASE_SPEED` | 50 px/s | R5.2 |
| `CHASE_TRIGGER_RADIUS` | 160 px | R5.2 |
| `BLINK_INTERVAL_SEC` | 3 | R5.3 |
| `BLINK_RANGE` | 200 px | R5.3 |
| `GHOST_CONTACT_DAMAGE` | 25 | R5.4 |
| `GHOST_HIT_IMMUNITY_SEC` | 1 | R5.5 |
| `BLOW_RADIUS` | 120 px | R6.1 |
| `BLOW_PUSH_DISTANCE` | 160 px | R6.1 |
| `BLOW_COOLDOWN_SEC` | 5 | R6.3 |
| `NIGHT_CANDY_GOALS` | [5, 8, 12] | R7.2 |
| `NIGHT_GHOST_COUNTS` | [2, 3, 4] | R7.5 |
| `SCORE_PER_CANDY` | 1 | R8.1 |
| `SCORE_PER_NIGHT_CLEAR` | 10 | R8.2 |
| `BEST_SCORE_KEY` | `lanternRun.bestScore` | R8.3 |

## 5. Level generation

- Map is a fixed-size grid (e.g. 30 x 17 tiles at 32 px). Layout is built by `generateNight`.
- Generation steps, all driven by the seeded RNG:
  1. Fill the grid with walkable tiles, then place wall blocks randomly (about 18% density).
  2. Carve a guaranteed path from start to door (keeps the night solvable).
  3. Place the door on the far side.
  4. Place candies on walkable tiles, at least 3 tiles from start, and reachable (checked with BFS).
     Count is `candyGoal + 3` so a player has spare candies.
  5. Place ghosts on walkable tiles at least 6 tiles from start. Assign kinds in rotation: patrol, chase, blink.
  6. Patrol ghosts get a path of 2 to 4 walkable waypoints found with BFS.
- Determinism: same `(index, seed)` gives identical output (R7.6).

## 6. Testing strategy

Property-based tests with fast-check (100+ runs each). Each property maps to a requirement.

| Property | Requirement |
|---|---|
| For any sequence of decay, add, and clamp operations, flame stays within [0, 100] | R3.2 |
| Decay with no candy never increases flame | R3.1 |
| `addFlame(f, 15)` returns `min(100, f + 15)` for any `f` in [0, 100] | R4.2 |
| For any seed and night index, `generateNight` returns the same layout twice | R7.6 |
| For any generated layout, the door is reachable from start via BFS | R4.4 |
| For any generated layout, all candies are on walkable tiles and reachable from start | R4.4 |
| For any ghost on a chase path within 160 px, one step does not increase distance to the player | R5.2 |
| For any ghost, after any step, the ghost is on a walkable tile | R5.6 |
| `applyBlow` moves only ghosts within 120 px, and each moved ghost is at most 160 px farther away | R6.1 |
| `applyBlow` never places a ghost on a wall | R6.2 |
| `canBlow` is false for any cooldown > 0, and `tickCooldown` reaches 0 after 5 seconds | R6.3, R6.4 |
| `mergeBestScore(s, r)` returns `max(s, r)` | R8.3 |
| Run score equals candies collected plus 10 for each cleared night | R8.1, R8.2 |

Unit tests cover edge cases: no ghosts, zero flame, cooldown exactly 0, empty candy list.
Scenes are verified by playing the production build, not by automated tests.

## 7. Input mapping

| Input | Desktop | Touch |
|---|---|---|
| Move | Arrows or WASD | Joystick, bottom left |
| Blow | Space | Button, bottom right |
| Pause | Escape or P | Pause icon, top center |
| Mute | M | Speaker icon on menu and HUD |

## 8. Out of scope for MVP
- Multiplayer, accounts, leaderboard server.
- Level editor.
- Endless mode (stretch list in PLAN.md).
