# Design: Lantern Run (roguelike)

Source of truth for requirements: `requirements.md` in this folder.
Tuning constants live in `src/core/config.ts`. Values here must match that file.

## 1. Architecture

```
            +-----------------------+
            |  Phaser scenes        |  src/scenes/  (thin: input, rendering, audio)
            |  Menu, Run, Result    |
            +-----------+-----------+
                        | calls
            +-----------v-----------+
            |  UI helpers           |  src/ui/      (drawing, HUD, overlays, fx)
            +-----------+-----------+
                        | reads
            +-----------v-----------+
            |  Pure core            |  src/core/    (no phaser imports, tested)
            |  run, room, ghost,    |
            |  blow, upgrades,      |
            |  boss, flame, candy,  |
            |  grid, rng, config    |
            +-----------------------+
```

The scene owns a `RunState` and calls `stepRun(state, input, dt)` once per frame.
Core returns the next state and events. The scene plays visuals and audio for each event.
Core never reads the clock or `Math.random`.

## 2. Modules

| File | Responsibility |
|---|---|
| `src/core/config.ts` | Base tuning values. Modifiers from upgrades are applied on top. |
| `src/core/rng.ts` | Pure seeded PRNG: `drawFloat(state)`, `drawInt(state, min, max)`. |
| `src/core/grid.ts` | Walkability, collision sweep, BFS path and distance map. |
| `src/core/flame.ts` | `decayFlame`, `addFlame` (clamped 0..100), `isLowFlame`. |
| `src/core/candy.ts` | `collectCandies(player, candies, radius)`. |
| `src/core/ghost.ts` | `stepGhost(ghost, player, grid, dt)` for patrol, chase, blink. `touchesPlayer`. |
| `src/core/boss.ts` | `stepBoss(boss, player, grid, dt)`, `bossTouchesPlayer`. |
| `src/core/blow.ts` | `canBlow`, `applyBlow(player, ghosts, grid, modifiers)`, `tickCooldown`. |
| `src/core/themes.ts` | Theme ids and their names. Colors live in the UI layer. |
| `src/core/room.ts` | `generateRoom(roomIndex, seed)` returns a `RoomLayout`. Replaces `night.ts`. |
| `src/core/upgrades.ts` | Upgrade catalog, `applyUpgrades(upgrades)` returns `Modifiers`, `offerUpgrades(taken, seed, roomIndex)`. |
| `src/core/score.ts` | `addCandyScore`, `addRoomClearScore`, `addBossClearScore`, `mergeBestScore`. |
| `src/core/run.ts` | `createRun(seed)`, `stepRun(state, input, dt)`, `chooseUpgrade(state, id)`. |
| `src/scenes/MenuScene.ts` | Title, Start, best score. |
| `src/scenes/RunScene.ts` | Renders the room, reads input, shows the upgrade overlay and pause. |
| `src/scenes/ResultScene.ts` | Win or loss summary, Play Again, Menu. |
| `src/ui/palette.ts` | Base colors and per-theme palettes. |
| `src/ui/drawing.ts` | Procedural art: floor, hedge, tombstone, pillar, hay bale, door, pumpkin, ghost, boss, candy, bat, fog. |
| `src/ui/map.ts` | `buildStaticLayer(scene, room)` into a RenderTexture, vignette. |
| `src/ui/Hud.ts` | Top bar: flame, room number, candy goal, score, blow ring, upgrade icons. |
| `src/ui/UpgradeOverlay.ts` | Three upgrade cards with drawn icons. |
| `src/ui/fx.ts` | Bursts, rings, screen flash, fade transition. |
| `src/ui/Backdrop.ts` | Title-screen sky, stars, moon, bats, fog. |

## 3. Key types

```ts
export interface Vec2 { x: number; y: number }
export interface Tile { col: number; row: number }
export interface Grid { cols: number; rows: number; walkable: boolean[] }

export type GhostKind = 'patrol' | 'chase' | 'blink';

export interface Ghost {
  id: number;
  kind: GhostKind;
  pos: Vec2;
  path: Vec2[];          // patrol loop (tile centers), empty otherwise
  pathIndex: number;
  blinkTimer: number;
  hitCooldown: number;
  rngState: number;
}

export interface Boss {
  pos: Vec2;
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
  boss: Boss | null;     // only in room 4
}

export type UpgradeId = 'brightWick' | 'swiftFeet' | 'quickBreath' | 'thickWax' | 'ironPumpkin';

export interface Modifiers {
  playerSpeed: number;        // px/s, base 120
  candyRestore: number;       // base 15
  flameDecayPerSec: number;   // base 1.5
  blowRadius: number;         // base 120
  blowCooldownSec: number;    // base 5
  ghostDamage: number;        // base 25
}

export type RunStatus = 'playing' | 'choosing' | 'won' | 'lost';

export interface RunState {
  seed: number;
  roomIndex: 1 | 2 | 3 | 4;
  roomsCleared: number;       // 0..4
  player: Vec2;
  flame: number;              // 0..100
  candiesInRoom: number;
  runScore: number;
  blowCooldown: number;       // seconds left, 0 means ready
  upgrades: UpgradeId[];
  choices: UpgradeId[];       // filled while status is 'choosing'
  modifiers: Modifiers;       // derived from upgrades, kept for speed
  layout: RoomLayout;
  status: RunStatus;
}

export interface RunInput { move: Vec2; blow: boolean }

export type RunEvent =
  | { type: 'candyCollected'; total: number }
  | { type: 'ghostHit'; ghostId: number }
  | { type: 'bossHit' }
  | { type: 'blowUsed' }
  | { type: 'roomCleared'; room: 1 | 2 | 3 | 4 }
  | { type: 'upgradeOffered'; choices: UpgradeId[] }
  | { type: 'runWon' }
  | { type: 'runLost' };
```

`status` values:
- `playing`: `stepRun` advances the room.
- `choosing`: upgrade offer is open. `stepRun` does nothing until `chooseUpgrade`.
- `won` and `lost`: terminal. `stepRun` does nothing.

Pause is not in core. The scene stops calling `stepRun` while paused.

## 4. Config and modifiers

Base values live in `config.ts`. `applyUpgrades` returns `Modifiers` built from these.

| Key | Base | Upgrade | Spec ref |
|---|---|---|---|
| `PLAYER_SPEED` | 120 px/s | Swift Feet: 138 | R2.1, R9.1 |
| `CANDY_FLAME_RESTORE` | 15 | Bright Wick: 20 | R4.2, R9.1 |
| `FLAME_DECAY_PER_SEC` | 1.5 | Thick Wax: 1.125 | R3.1, R9.1 |
| `BLOW_RADIUS` | 120 px | Quick Breath: 150 | R6.1, R9.1 |
| `BLOW_COOLDOWN_SEC` | 5 | Quick Breath: 3.5 | R6.3, R9.1 |
| `GHOST_CONTACT_DAMAGE` | 25 | Iron Pumpkin: 15 | R5.4, R9.1 |
| `BOSS_CONTACT_DAMAGE` | 35 | none | R10.3 |
| `BOSS_SPEED` | 55 px/s | none | R10.2 |
| `ROOM_CANDY_GOALS` | [5, 8, 10, 10] | none | R7.2 |
| `ROOM_GHOST_COUNTS` | [2, 3, 4, 2] | none | R7.5 |
| `BOSS_MIN_TILE_DIST` | 8 | none | R10.1 |
| `FLAME_START` | 100 | none | R3.3 |
| `SCORE_PER_CANDY` | 1 | none | R11.1 |
| `SCORE_PER_ROOM_CLEAR` | 10 | none | R11.2 |
| `SCORE_PER_BOSS_CLEAR` | 50 | none | R11.3 |
| `BEST_SCORE_KEY` | `lanternRun.bestScore` | none | R11.4 |

Other values (speeds of ghosts, contact radius, blink range, grid size, wall density, etc.)
keep their earlier values. See `config.ts`.

## 5. Room generation

`generateRoom(roomIndex, seed)` is deterministic. Its random stream starts from `mixSeed(seed, roomIndex)`.

1. Choose the theme. Rooms 1 to 3 pick from `[graveyard, chapel, pumpkinPatch]`. Room 4 is `crypt`.
2. Fill a grid of 30 x 17 tiles. Border tiles are walls. Interior walls are placed at about 18% density.
3. Carve a guaranteed route from the start (row 8, column 2) to the door (column 27, random row).
   Clear a 3 x 3 area around the start.
4. Candies: `goal + 3` distinct walkable tiles, at least 3 BFS steps from the start.
5. Regular ghosts: `ROOM_GHOST_COUNTS[roomIndex - 1]` distinct walkable tiles, at least 6 BFS steps from the start.
   Kinds rotate: patrol, chase, blink. Patrol loops are built from 2 to 4 BFS-joined waypoints.
6. Boss (room 4 only): one walkable tile at least `BOSS_MIN_TILE_DIST` BFS steps from the start.

## 6. Upgrades

```ts
const CATALOG: Record<UpgradeId, { name: string; description: string; apply(m: Modifiers): Modifiers }>
```

- `applyUpgrades(ids)` starts from base modifiers and applies each id once. Order does not matter.
- `offerUpgrades(taken, seed, roomIndex)`: candidates are catalog ids not in `taken`. Draw three
  with a Fisher-Yates shuffle using `mixSeed(seed, 100 + roomIndex)`. If fewer than three remain,
  return all of them. If none remain, return `[]` and the run skips the choice.

## 7. Run loop

`stepRun(state, input, dt)` when status is `playing`:

1. Move the player with `moveWithCollision` at `modifiers.playerSpeed`.
2. Decay flame at `modifiers.flameDecayPerSec`.
3. Collect candies in range. Each one adds `modifiers.candyRestore` flame and 1 point.
4. Tick the blow cooldown. If blow is pressed and ready, push ghosts with `modifiers.blowRadius` and
   start `modifiers.blowCooldownSec`.
5. Step regular ghosts. Apply contact damage (`modifiers.ghostDamage`, 1 s immunity per ghost).
6. If the room has a boss, step it and apply boss contact damage (35, 1 s immunity).
7. If flame is 0 or less, status becomes `lost` and the event `runLost` is emitted.
8. If the player is within `DOOR_REACH_RADIUS` of the door and `candiesInRoom >= goal`:
   - Room 1 to 3: add 10 points, `roomsCleared + 1`, emit `roomCleared`.
     If `offerUpgrades` returns choices, status becomes `choosing`, `choices` is set, and `upgradeOffered` is emitted.
     If it returns none, load the next room directly.
   - Room 4: add 50 points, `roomsCleared = 4`, status `won`, emit `runWon`.

`chooseUpgrade(state, id)`: requires status `choosing` and `id` in `choices`. Adds the upgrade,
recomputes modifiers, loads the next room (flame 100, candy 0, blow cooldown 0, same run score), and
returns status `playing`.

Loading a room keeps the run seed and increments `roomIndex`. The room layout comes from `generateRoom`.

## 8. Testing strategy

Property-based tests use fast-check. Each property maps to a requirement.

| Property | Requirement |
|---|---|
| Flame stays in [0, 100] across any sequence of decay and add operations | R3.2 |
| Decay with no candy never increases flame | R3.1 |
| `generateRoom(i, s)` returns the same layout twice | R7.6 |
| For any generated room, the door is reachable from the start via BFS | R4.4 |
| For any generated room, every candy is walkable and reachable | R4.4 |
| Candy count equals `goal + 3`; regular ghost count equals the table value | R7.2, R7.5 |
| Room 4 has a boss on a walkable tile at least 8 BFS steps from the start; rooms 1 to 3 have none | R10.1 |
| Chase ghosts never get farther from the player in one step | R5.2 |
| Blink destinations are walkable and within range | R5.3 |
| `applyBlow` moves only ghosts within the radius, outward, at most the push distance | R6.1 |
| `applyBlow` never places a ghost on a wall | R6.2 |
| `tickCooldown` reaches 0 after a full cooldown | R6.3, R6.4 |
| `applyUpgrades([])` equals the base modifiers; each upgrade changes exactly its stat | R9.1 |
| `offerUpgrades` returns distinct ids, none already taken, at most three, and is deterministic | R9.2, R9.4 |
| Theme choice is deterministic for a seed; room 4 is always `crypt` | R8.1, R8.2 |
| Score: candies + 10 per trial room + 50 for the boss equals the run score at a win | R11.1 to R11.3 |
| `stepRun` in status `choosing`, `won`, or `lost` returns the same state | R1.3 |
| Clearing a trial room with no upgrades left loads the next room without a choice | R9.2 |
| Losing the flame sets status `lost` and emits `runLost` | R1.5 |

Scenes are verified by playing the build and with headless screenshots. Automated tests cover core only.

## 9. Input mapping

| Input | Desktop | Touch |
|---|---|---|
| Move | Arrows or WASD | Joystick, bottom left |
| Blow | Space | Button, bottom right |
| Pause | Escape or P | Pause icon, top center |
| Mute | M | Speaker icon in the top bar |
| Choose upgrade | 1, 2, 3 or click a card | Tap a card |

## 10. Out of scope for MVP

- Meta progression across runs.
- Minions spawned by the boss.
- Minimap, endless mode, leaderboard server, accounts.

## 11. Migration notes (from the three-night version)

- `night.ts` becomes `room.ts`. `generateNight` becomes `generateRoom`. Layout fields and carving steps stay the same.
- `RunState.nightIndex`, `candiesThisNight`, `nightStartScore`, and the `retryNight` function are removed.
- `NightScene` becomes `RunScene`. `ResultScene` is new.
- Existing core tests for flame, candy, ghosts, blow, grid, and rng still apply. Tests for night generation and run flow are rewritten.
