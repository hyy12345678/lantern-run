import { BEST_SCORE_KEY } from '../core/config';
import { mergeBestScore } from '../core/score';

export interface BestScoreRead {
  /** False when localStorage cannot be used (private mode, blocked storage, or no storage in the browser). */
  available: boolean;
  value: number | null;
}

export function readBestScore(): BestScoreRead {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return { available: true, value: Number.isFinite(parsed) ? parsed : null };
  } catch {
    return { available: false, value: null };
  }
}

/** Saves `runScore` if it beats the stored best. Returns the best score after saving. */
export function recordRunScore(runScore: number): BestScoreRead {
  const current = readBestScore();
  if (!current.available) return current;
  const best = mergeBestScore(current.value, runScore);
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(best));
    return { available: true, value: best };
  } catch {
    return { available: false, value: null };
  }
}
