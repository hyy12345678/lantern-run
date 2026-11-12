import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { chooseUpgrade, createRun, stepRun } from '../src/core/run';
import type { RunInput, RunState } from '../src/core/run';
import { applyUpgrades } from '../src/core/upgrades';
import type { UpgradeId } from '../src/core/upgrades';
import { generateRoom } from '../src/core/room';
import { isWalkablePoint } from '../src/core/grid';
import { FLAME_MAX, FLAME_MIN, ROOM_CANDY_GOALS, QUICK_BREATH_COOLDOWN_SEC } from '../src/core/config';

const NO_INPUT: RunInput = { move: { x: 0, y: 0 }, blow: false };
const inputArb = fc.record({
  move: fc.record({ x: fc.double({ min: -1, max: 1, noNaN: true }), y: fc.double({ min: -1, max: 1, noNaN: true }) }),
  blow: fc.boolean(),
});

/** A state placed at the door of `roomIndex` with the candy goal already collected. */
function atDoorWithGoal(seed: number, roomIndex: 1 | 2 | 3 | 4): RunState {
  const base = createRun(seed);
  const layout = generateRoom(roomIndex, seed);
  return {
    ...base,
    roomIndex,
    layout,
    player: layout.door,
    candiesInRoom: ROOM_CANDY_GOALS[roomIndex - 1],
  };
}

describe('run loop', () => {
  it('keeps flame in range, the player on walkable ground, and status valid across random play', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.array(inputArb, { minLength: 1, maxLength: 300 }), (seed, inputs) => {
        let state: RunState = createRun(seed);
        for (const input of inputs) {
          if (state.status === 'choosing') state = chooseUpgrade(state, state.choices[0]);
          state = stepRun(state, input, 1 / 60).state;
          if (state.flame < FLAME_MIN || state.flame > FLAME_MAX) return false;
          if (!isWalkablePoint(state.layout.grid, state.player)) return false;
          if (state.status === 'lost' || state.status === 'won') break;
        }
        return true;
      }),
      { numRuns: 30 },
    );
  });

  it('collecting a candy adds one candy, one point, and restores flame', () => {
    const state = createRun(1);
    const withCandy: RunState = {
      ...state,
      flame: 60,
      layout: { ...state.layout, candies: [state.player] },
    };
    const { state: next, events } = stepRun(withCandy, NO_INPUT, 0);
    expect(next.candiesInRoom).toBe(1);
    expect(next.runScore).toBe(1);
    expect(next.flame).toBe(75);
    expect(next.layout.candies).toHaveLength(0);
    expect(events).toContainEqual({ type: 'candyCollected', total: 1 });
  });

  it('clearing a trial room with the goal met offers upgrades and adds 10 points', () => {
    const { state: next, events } = stepRun(atDoorWithGoal(3, 1), NO_INPUT, 0);
    expect(next.status).toBe('choosing');
    expect(next.choices).toHaveLength(3);
    expect(next.runScore).toBe(10);
    expect(next.roomsCleared).toBe(1);
    expect(events).toContainEqual({ type: 'roomCleared', room: 1 });
    expect(events.some((e) => e.type === 'upgradeOffered')).toBe(true);
  });

  it('does not clear a room when candies are below the goal', () => {
    const state = atDoorWithGoal(3, 1);
    const short = { ...state, candiesInRoom: ROOM_CANDY_GOALS[0] - 1 };
    const { state: next, events } = stepRun(short, NO_INPUT, 0);
    expect(next.status).toBe('playing');
    expect(next.roomIndex).toBe(1);
    expect(events.some((e) => e.type === 'roomCleared')).toBe(false);
  });

  it('picking an upgrade starts the next room at full flame with the upgrade applied', () => {
    const cleared = stepRun(atDoorWithGoal(5, 1), NO_INPUT, 0).state;
    const picked = cleared.choices[0];
    const next = chooseUpgrade(cleared, picked);
    expect(next.status).toBe('playing');
    expect(next.roomIndex).toBe(2);
    expect(next.upgrades).toEqual([picked]);
    expect(next.flame).toBe(FLAME_MAX);
    expect(next.candiesInRoom).toBe(0);
    expect(next.runScore).toBe(10);
    expect(next.modifiers).toEqual(applyUpgrades([picked]));
  });

  it('ignores an upgrade that was not offered', () => {
    const cleared = stepRun(atDoorWithGoal(5, 1), NO_INPUT, 0).state;
    const notOffered = (['brightWick', 'swiftFeet', 'quickBreath', 'thickWax', 'ironPumpkin'] as UpgradeId[]).find(
      (id) => !cleared.choices.includes(id),
    );
    expect(notOffered).toBeDefined();
    expect(chooseUpgrade(cleared, notOffered as UpgradeId)).toBe(cleared);
  });

  it('does nothing while the upgrade choice is open', () => {
    const cleared = stepRun(atDoorWithGoal(5, 1), NO_INPUT, 0).state;
    const { state, events } = stepRun(cleared, { move: { x: 1, y: 0 }, blow: true }, 0.5);
    expect(state).toBe(cleared);
    expect(events).toEqual([]);
  });

  it('winning the boss room gives the boss clear bonus and ends the run as won', () => {
    const { state: next, events } = stepRun(atDoorWithGoal(9, 4), NO_INPUT, 0);
    expect(next.status).toBe('won');
    expect(next.roomsCleared).toBe(4);
    expect(next.runScore).toBe(50);
    expect(events).toContainEqual({ type: 'runWon' });
  });

  it('losing all flame ends the run as lost', () => {
    const state = createRun(2);
    const dying: RunState = { ...state, flame: 1 };
    const { state: next, events } = stepRun(dying, NO_INPUT, 1);
    expect(next.status).toBe('lost');
    expect(events).toContainEqual({ type: 'runLost' });
  });

  it('ignores input once the run has ended', () => {
    const state: RunState = { ...createRun(2), status: 'lost' };
    const { state: next, events } = stepRun(state, { move: { x: 1, y: 0 }, blow: true }, 0.1);
    expect(next).toBe(state);
    expect(events).toEqual([]);
  });

  it('uses the blow ability once, then waits for the cooldown', () => {
    const state = createRun(4);
    const first = stepRun(state, { move: { x: 0, y: 0 }, blow: true }, 0.016);
    expect(first.events).toContainEqual({ type: 'blowUsed' });
    expect(first.state.blowCooldown).toBeGreaterThan(0);
    const second = stepRun(first.state, { move: { x: 0, y: 0 }, blow: true }, 0.016);
    expect(second.events.some((e) => e.type === 'blowUsed')).toBe(false);
  });

  it('Quick Breath sets the cooldown to its upgraded value', () => {
    const state: RunState = { ...createRun(4), modifiers: applyUpgrades(['quickBreath']) };
    const { state: next } = stepRun(state, { move: { x: 0, y: 0 }, blow: true }, 0);
    expect(next.blowCooldown).toBe(QUICK_BREATH_COOLDOWN_SEC);
  });

  it('Thick Wax slows flame decay', () => {
    const state: RunState = { ...createRun(4), modifiers: applyUpgrades(['thickWax']) };
    const { state: next } = stepRun(state, NO_INPUT, 1);
    expect(next.flame).toBeCloseTo(FLAME_MAX - 1.125);
  });
});
