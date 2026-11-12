import { SCORE_PER_BOSS_CLEAR, SCORE_PER_CANDY, SCORE_PER_ROOM_CLEAR } from './config';

export function addCandyScore(score: number, candies: number): number {
  return score + candies * SCORE_PER_CANDY;
}

export function addRoomClearScore(score: number): number {
  return score + SCORE_PER_ROOM_CLEAR;
}

export function addBossClearScore(score: number): number {
  return score + SCORE_PER_BOSS_CLEAR;
}

/** Returns the larger of the stored best score and the run score. A missing stored score counts as 0. */
export function mergeBestScore(stored: number | null, runScore: number): number {
  return Math.max(stored ?? 0, runScore);
}
