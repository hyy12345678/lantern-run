// Sound effects synthesized with the Web Audio API. No audio files, so there are no licensing
// issues. The mute setting lasts for the browser session.

export type SoundName =
  | 'candy'
  | 'blow'
  | 'hit'
  | 'bossHit'
  | 'pick'
  | 'roomClear'
  | 'runEnd'
  | 'doorOpen'
  | 'ember'
  | 'bossWindup'
  | 'ignite'
  | 'bossIntro'
  | 'flameOut';

interface NoteSpec {
  freq: number;
  /** When set, the pitch glides to this frequency over the note. */
  slideTo?: number;
  start: number;
  dur: number;
  type: OscillatorType;
  gain: number;
}

const RECIPES: Record<SoundName, NoteSpec[]> = {
  candy: [
    { freq: 660, start: 0, dur: 0.08, type: 'triangle', gain: 0.15 },
    { freq: 990, start: 0.07, dur: 0.12, type: 'triangle', gain: 0.15 },
  ],
  blow: [{ freq: 520, slideTo: 140, start: 0, dur: 0.35, type: 'sawtooth', gain: 0.08 }],
  hit: [{ freq: 180, slideTo: 90, start: 0, dur: 0.2, type: 'square', gain: 0.12 }],
  bossHit: [{ freq: 110, slideTo: 55, start: 0, dur: 0.45, type: 'sawtooth', gain: 0.16 }],
  pick: [
    { freq: 523, start: 0, dur: 0.1, type: 'triangle', gain: 0.15 },
    { freq: 659, start: 0.09, dur: 0.1, type: 'triangle', gain: 0.15 },
    { freq: 784, start: 0.18, dur: 0.18, type: 'triangle', gain: 0.15 },
  ],
  roomClear: [
    { freq: 523, start: 0, dur: 0.12, type: 'triangle', gain: 0.15 },
    { freq: 659, start: 0.1, dur: 0.12, type: 'triangle', gain: 0.15 },
    { freq: 784, start: 0.2, dur: 0.12, type: 'triangle', gain: 0.15 },
    { freq: 1046, start: 0.3, dur: 0.3, type: 'triangle', gain: 0.15 },
  ],
  runEnd: [
    { freq: 392, start: 0, dur: 0.25, type: 'sine', gain: 0.18 },
    { freq: 330, start: 0.22, dur: 0.25, type: 'sine', gain: 0.18 },
    { freq: 262, start: 0.44, dur: 0.5, type: 'sine', gain: 0.18 },
  ],
  // A creak that rises, then a soft chime.
  doorOpen: [
    { freq: 140, slideTo: 260, start: 0, dur: 0.3, type: 'sawtooth', gain: 0.05 },
    { freq: 880, start: 0.28, dur: 0.35, type: 'sine', gain: 0.12 },
    { freq: 1320, start: 0.36, dur: 0.35, type: 'sine', gain: 0.08 },
  ],
  // A falling note caught and lifted back up.
  ember: [
    { freq: 520, slideTo: 200, start: 0, dur: 0.2, type: 'triangle', gain: 0.15 },
    { freq: 300, slideTo: 760, start: 0.2, dur: 0.35, type: 'triangle', gain: 0.16 },
  ],
  // Low rising growl that warns of the dash. Quiet on purpose: no loud jump scares.
  bossWindup: [{ freq: 70, slideTo: 150, start: 0, dur: 0.75, type: 'sawtooth', gain: 0.07 }],
  // A match strike, then a soft whoosh as the lantern catches.
  ignite: [
    { freq: 1800, slideTo: 600, start: 0, dur: 0.08, type: 'square', gain: 0.04 },
    { freq: 180, slideTo: 420, start: 0.12, dur: 0.6, type: 'triangle', gain: 0.12 },
  ],
  // Deep, quiet swell for the boss intro.
  bossIntro: [
    { freq: 55, slideTo: 82, start: 0, dur: 1.4, type: 'sawtooth', gain: 0.06 },
    { freq: 110, slideTo: 98, start: 0.5, dur: 1.0, type: 'triangle', gain: 0.07 },
  ],
  // A small breath that fades, for the flame going out.
  flameOut: [{ freq: 420, slideTo: 90, start: 0, dur: 0.9, type: 'sine', gain: 0.1 }],
};

let muted = false;
let context: AudioContext | null = null;

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
}

/** Creates the audio context on first use. Browsers only allow audio after a key press or click, which comes first. */
function getContext(): AudioContext | null {
  if (context === null) {
    try {
      context = new AudioContext();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const note of RECIPES[name]) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, t0);
    if (note.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(note.slideTo, t1);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(note.gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}
