import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { addBossClearScore, addCandyScore, addRoomClearScore, mergeBestScore } from '../src/core/score';
import { SCORE_PER_BOSS_CLEAR, SCORE_PER_CANDY, SCORE_PER_ROOM_CLEAR } from '../src/core/config';

describe('score', () => {
  it('mergeBestScore returns the larger of stored and run scores', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }), (stored, run) => {
        return mergeBestScore(stored, run) === Math.max(stored, run);
      }),
    );
  });

  it('treats a missing stored score as 0', () => {
    expect(mergeBestScore(null, 12)).toBe(12);
    expect(mergeBestScore(null, 0)).toBe(0);
  });

  it('adds candy, room-clear, and boss-clear points using the configured values', () => {
    expect(addCandyScore(0, 3)).toBe(3 * SCORE_PER_CANDY);
    expect(addRoomClearScore(5)).toBe(5 + SCORE_PER_ROOM_CLEAR);
    expect(addBossClearScore(5)).toBe(5 + SCORE_PER_BOSS_CLEAR);
  });
});
