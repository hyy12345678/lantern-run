// Session settings shared by every scene. Nothing here is saved between visits.

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

let reducedMotion = prefersReducedMotion();

export function isReducedMotion(): boolean {
  return reducedMotion;
}

export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

/**
 * Time to pass to drawing functions. With reduced motion it is frozen at 0,
 * which stops bobbing, flicker, fog drift, and floating particles.
 */
export function animTime(time: number): number {
  return reducedMotion ? 0 : time;
}
