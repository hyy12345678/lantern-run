// Seeded PRNG (mulberry32) written as pure functions. The RNG state lives in game state,
// so the same seed always produces the same run.

export interface Draw {
  value: number;
  state: number;
}

const INCREMENT = 0x6d2b79f5;

/** Returns a float in [0, 1) and the next RNG state. */
export function drawFloat(state: number): Draw {
  const next = (state + INCREMENT) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** Returns an integer in [min, max] (inclusive) and the next RNG state. Requires max >= min. */
export function drawInt(state: number, min: number, max: number): Draw {
  const draw = drawFloat(state);
  const span = max - min + 1;
  const offset = Math.min(span - 1, Math.floor(draw.value * span));
  return { value: min + offset, state: draw.state };
}

/** Combines a run seed with a stream index so each room or upgrade draw gets its own stream. */
export function mixSeed(seed: number, stream: number): number {
  return (seed + Math.imul(stream, 0x9e3779b9)) >>> 0;
}

/** Returns a new array with the items in a seeded random order (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], state: number): { value: T[]; state: number } {
  const pool = [...items];
  let s = state;
  for (let i = pool.length - 1; i > 0; i--) {
    const draw = drawInt(s, 0, i);
    s = draw.state;
    [pool[i], pool[draw.value]] = [pool[draw.value], pool[i]];
  }
  return { value: pool, state: s };
}
