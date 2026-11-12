import {
  BOSS_HIT_IMMUNITY_SEC,
  BOSS_CONTACT_DAMAGE,
  BOSS_ROOM_INDEX,
  DOOR_REACH_RADIUS,
  FLAME_START,
  GHOST_HIT_IMMUNITY_SEC,
  PLAYER_RADIUS,
} from './config';
import { applyBlow, canBlow, tickCooldown } from './blow';
import { collectCandies } from './candy';
import { bossTouchesPlayer, stepBoss } from './boss';
import { stepGhost, touchesPlayer } from './ghost';
import { moveWithCollision } from './grid';
import { addFlame, decayFlame } from './flame';
import { generateRoom } from './room';
import { addBossClearScore, addCandyScore, addRoomClearScore } from './score';
import { applyUpgrades, BASE_MODIFIERS, offerUpgrades } from './upgrades';
import type { Modifiers, UpgradeId } from './upgrades';
import { clampLength, distance, scale } from './vec';
import type { RoomLayout, Vec2 } from './types';

export type RoomIndex = 1 | 2 | 3 | 4;

/**
 * playing: the room is running.
 * choosing: the player is picking one of `choices`. stepRun does nothing until chooseUpgrade.
 * won, lost: terminal.
 */
export type RunStatus = 'playing' | 'choosing' | 'won' | 'lost';

export interface RunState {
  seed: number;
  roomIndex: RoomIndex;
  roomsCleared: number;
  player: Vec2;
  flame: number;
  candiesInRoom: number;
  runScore: number;
  blowCooldown: number;
  upgrades: UpgradeId[];
  /** Filled while status is `choosing`. */
  choices: UpgradeId[];
  modifiers: Modifiers;
  layout: RoomLayout;
  status: RunStatus;
}

/** Input for one frame. `move` components are in [-1, 1]. `blow` is true on the frame the button was pressed. */
export interface RunInput {
  move: Vec2;
  blow: boolean;
}

export type RunEvent =
  | { type: 'candyCollected'; total: number }
  | { type: 'ghostHit'; ghostId: number }
  | { type: 'bossHit' }
  | { type: 'blowUsed' }
  | { type: 'roomCleared'; room: RoomIndex }
  | { type: 'upgradeOffered'; choices: UpgradeId[] }
  | { type: 'runWon' }
  | { type: 'runLost' };

export interface RunStep {
  state: RunState;
  events: RunEvent[];
}

interface CarryOver {
  seed: number;
  roomIndex: RoomIndex;
  roomsCleared: number;
  runScore: number;
  upgrades: UpgradeId[];
  modifiers: Modifiers;
}

/** Starts a room with flame at 100, no candy, and no blow cooldown. Run score and upgrades carry over. */
function enterRoom(carry: CarryOver): RunState {
  const layout = generateRoom(carry.roomIndex, carry.seed);
  return {
    seed: carry.seed,
    roomIndex: carry.roomIndex,
    roomsCleared: carry.roomsCleared,
    player: layout.start,
    flame: FLAME_START,
    candiesInRoom: 0,
    runScore: carry.runScore,
    blowCooldown: 0,
    upgrades: carry.upgrades,
    choices: [],
    modifiers: carry.modifiers,
    layout,
    status: 'playing',
  };
}

function nextRoomIndex(index: RoomIndex): RoomIndex {
  return (index + 1) as RoomIndex;
}

export function createRun(seed: number): RunState {
  return enterRoom({
    seed,
    roomIndex: 1,
    roomsCleared: 0,
    runScore: 0,
    upgrades: [],
    modifiers: BASE_MODIFIERS,
  });
}

/** Takes an offered upgrade and starts the next room. Ignored unless the state is `choosing` and `id` is offered. */
export function chooseUpgrade(state: RunState, id: UpgradeId): RunState {
  if (state.status !== 'choosing' || !state.choices.includes(id)) return state;
  const upgrades = [...state.upgrades, id];
  return enterRoom({
    seed: state.seed,
    roomIndex: nextRoomIndex(state.roomIndex),
    roomsCleared: state.roomsCleared,
    runScore: state.runScore,
    upgrades,
    modifiers: applyUpgrades(upgrades),
  });
}

/** Advances the run by `dt` seconds. Returns the new state and the events that happened this frame. */
export function stepRun(state: RunState, input: RunInput, dt: number): RunStep {
  if (state.status !== 'playing') return { state, events: [] };

  const events: RunEvent[] = [];
  const { layout, modifiers: m } = state;
  const { grid } = layout;

  // Movement. Input is clamped to unit length so diagonals are not faster.
  const direction = clampLength(input.move, 1);
  const player = moveWithCollision(grid, state.player, scale(direction, m.playerSpeed * dt), PLAYER_RADIUS);

  // Flame decays, then candy restores it.
  let flame = decayFlame(state.flame, dt, m.flameDecayPerSec);
  const { remaining, collected } = collectCandies(player, layout.candies);
  let candiesInRoom = state.candiesInRoom;
  let runScore = state.runScore;
  for (let i = 0; i < collected.length; i++) {
    candiesInRoom += 1;
    events.push({ type: 'candyCollected', total: candiesInRoom });
  }
  if (collected.length > 0) {
    flame = addFlame(flame, collected.length * m.candyRestore);
    runScore = addCandyScore(runScore, collected.length);
  }

  // Blow ability.
  let blowCooldown = tickCooldown(state.blowCooldown, dt);
  let ghosts = layout.ghosts;
  if (input.blow && canBlow(blowCooldown)) {
    ghosts = applyBlow(player, ghosts, grid, m.blowRadius);
    blowCooldown = m.blowCooldownSec;
    events.push({ type: 'blowUsed' });
  }

  // Regular ghosts move, then damage the player on contact (with per-ghost immunity).
  ghosts = ghosts.map((ghost) => stepGhost(ghost, player, grid, dt));
  ghosts = ghosts.map((ghost) => {
    if (!touchesPlayer(ghost, player) || ghost.hitCooldown > 0) return ghost;
    flame = addFlame(flame, -m.ghostDamage);
    events.push({ type: 'ghostHit', ghostId: ghost.id });
    return { ...ghost, hitCooldown: GHOST_HIT_IMMUNITY_SEC };
  });

  // The boss, if this room has one.
  let boss = layout.boss;
  if (boss) {
    boss = stepBoss(boss, player, grid, dt);
    if (bossTouchesPlayer(boss, player) && boss.hitCooldown <= 0) {
      flame = addFlame(flame, -BOSS_CONTACT_DAMAGE);
      events.push({ type: 'bossHit' });
      boss = { ...boss, hitCooldown: BOSS_HIT_IMMUNITY_SEC };
    }
  }

  const next: RunState = {
    ...state,
    player,
    flame,
    candiesInRoom,
    runScore,
    blowCooldown,
    layout: { ...layout, candies: remaining, ghosts, boss },
  };

  if (flame <= 0) {
    events.push({ type: 'runLost' });
    return { state: { ...next, status: 'lost' }, events };
  }

  const atDoor = distance(player, layout.door) <= DOOR_REACH_RADIUS;
  if (!atDoor || candiesInRoom < layout.candyGoal) return { state: next, events };

  if (state.roomIndex === BOSS_ROOM_INDEX) {
    events.push({ type: 'roomCleared', room: BOSS_ROOM_INDEX }, { type: 'runWon' });
    return {
      state: { ...next, runScore: addBossClearScore(runScore), roomsCleared: BOSS_ROOM_INDEX, status: 'won' },
      events,
    };
  }

  events.push({ type: 'roomCleared', room: state.roomIndex });
  const clearedScore = addRoomClearScore(runScore);
  const roomsCleared = state.roomIndex;
  const choices = offerUpgrades(state.upgrades, state.seed, state.roomIndex);
  if (choices.length > 0) {
    events.push({ type: 'upgradeOffered', choices });
    return {
      state: { ...next, runScore: clearedScore, roomsCleared, choices, status: 'choosing' },
      events,
    };
  }

  // Every upgrade is already taken, so skip the choice and go straight to the next room.
  const loaded = enterRoom({
    seed: state.seed,
    roomIndex: nextRoomIndex(state.roomIndex),
    roomsCleared,
    runScore: clearedScore,
    upgrades: state.upgrades,
    modifiers: state.modifiers,
  });
  return { state: loaded, events };
}
