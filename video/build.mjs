// Assembles the demo video from recorded gameplay, rendered cards, narration, and synthesized sound.
//
// usage: node video/build.mjs <main|long> <workDir> <out.mp4>
// workDir holds: rec-run/, rec-out/, rec-touch/ (from record.mjs), cards/ (from cards.mjs),
// and narr/ (one WAV per narration line, plus durations.json).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cut, work, out] = process.argv.slice(2);
const RATE = 48000;
const FPS = 60;
const tmp = join(work, `build-${cut}`);
mkdirSync(tmp, { recursive: true });
const narrDur = JSON.parse(readFileSync(join(work, 'narr/durations.json'), 'utf8'));
narrDur.madeInCode ??= 6.28;

// ---------------------------------------------------------------- timeline

/** Clip times are in seconds of the recording. Narration `at` is seconds from the segment start. */
const run = (from, to, narration) => ({ kind: 'clip', dir: 'rec-run', from, to, narration });
const card = (name, narrationId, extra = 1.6) => ({
  kind: 'card',
  name,
  dur: Number((narrDur[narrationId] + extra).toFixed(2)),
  narration: [{ id: narrationId, at: 0.7 }],
});

// Times inside the gameplay recording, taken from rec-run/events.json.
const runNarration = (withUpgradeLine) => [
  { id: 'menu', at: 0.9 },
  { id: 'dark', at: 7.9 },
  { id: 'candy', at: 12.7 },
  { id: 'upgrade', at: 18.5 },
  { id: 'ghosts', at: 27.0 },
  { id: 'patch', at: 30.4 },
  { id: 'smart', at: 34.8 },
  { id: 'graveyard', at: 43.0 },
  ...(withUpgradeLine ? [{ id: 'upgrades', at: 47.0 }] : []),
  { id: 'boss', at: 62.4 },
  { id: 'win', at: 80.8 },
  { id: 'result', at: 84.5 },
];

const RUN_FROM = 0.25;
const RUN_TO = 89.6;
const timelines = {
  // About 2:30. For submission: Kiroween asks for under three minutes.
  main: [
    card('title', 'title', 2.0),
    { ...run(RUN_FROM, RUN_TO), narration: runNarration(true) },
    { kind: 'clip', dir: 'rec-out', from: 0.3, to: 7.8, narration: [{ id: 'lose', at: 0.6 }] },
    { kind: 'clip', dir: 'rec-touch', from: 0.3, to: 5.9, narration: [{ id: 'touch', at: 0.5 }] },
    card('kiroSpec', 'kiroSpec'),
    card('kiroSteering', 'kiroSteering'),
    card('kiroHooks', 'kiroHooks', 1.8),
    card('kiroPbt', 'kiroPbt'),
    card('outro', 'outro', 2.2),
  ],
  // Over three minutes, as requested. Adds the upgrades, made-in-code, accessibility, and lessons cards.
  long: [
    card('title', 'title', 2.0),
    { ...run(RUN_FROM, RUN_TO), narration: runNarration(false) },
    { kind: 'clip', dir: 'rec-out', from: 0.3, to: 7.8, narration: [{ id: 'lose', at: 0.6 }] },
    card('upgrades', 'upgrades', 3.4),
    { kind: 'clip', dir: 'rec-touch', from: 0.3, to: 5.9, narration: [{ id: 'touch', at: 0.5 }] },
    card('madeInCode', 'madeInCode'),
    card('access', 'access'),
    card('kiroSpec', 'kiroSpec'),
    card('kiroSteering', 'kiroSteering'),
    card('kiroHooks', 'kiroHooks', 1.8),
    card('kiroPbt', 'kiroPbt'),
    card('worked', 'worked', 1.8),
    card('outro', 'outro', 2.2),
  ],
};
const segments = timelines[cut];

// ---------------------------------------------------------------- video segments

const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const x264 = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const FADE = 0.35;
/** A subtitle stays this long after its line ends. The next line never starts before it is gone. */
const SUB_HOLD = 0.2;

let cursor = 0;
const cues = []; // { id, start } in final seconds
const files = [];
segments.forEach((seg, i) => {
  const file = join(tmp, `seg${String(i).padStart(2, '0')}.mp4`);
  let dur;
  if (seg.kind === 'card') {
    dur = seg.dur;
    ff([
      '-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', join(work, 'cards', `card-${seg.name}.png`),
      '-vf', `fade=in:st=0:d=${FADE},fade=out:st=${(dur - FADE).toFixed(3)}:d=${FADE}`, ...x264, file,
    ]);
  } else {
    const frames = JSON.parse(readFileSync(join(work, seg.dir, 'frames.json'), 'utf8')).filter(
      (f) => f.t >= seg.from * 1000 && f.t <= seg.to * 1000,
    );
    const list = frames
      .map((f, k) => {
        const next = frames[k + 1];
        const d = next ? (next.t - f.t) / 1000 : 1 / FPS;
        return `file '${join(work, seg.dir, 'frames', f.file)}'\nduration ${d.toFixed(5)}`;
      })
      .join('\n');
    const listFile = join(tmp, `seg${i}.txt`);
    writeFileSync(listFile, `${list}\nfile '${join(work, seg.dir, 'frames', frames[frames.length - 1].file)}'\n`);
    dur = (frames[frames.length - 1].t - frames[0].t) / 1000 + 1 / FPS;
    ff([
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-vf', `fps=${FPS},fade=in:st=0:d=${FADE},fade=out:st=${(dur - FADE).toFixed(3)}:d=${FADE}`, ...x264, file,
    ]);
    seg.offset = seg.from;
  }
  for (const n of seg.narration ?? []) cues.push({ id: n.id, start: cursor + n.at });
  seg.start = cursor;
  seg.dur = dur;
  cursor += dur;
  files.push(file);
});
const total = cursor;

// Narration must never overlap: push a line later if the previous one is still speaking.
cues.sort((a, b) => a.start - b.start);
for (let k = 1; k < cues.length; k++) {
  const prevEnd = cues[k - 1].start + narrDur[cues[k - 1].id] + SUB_HOLD + 0.1;
  if (cues[k].start < prevEnd) cues[k].start = prevEnd;
}

const concatList = join(tmp, 'segments.txt');
writeFileSync(concatList, files.map((f) => `file '${f}'`).join('\n'));
const silent = join(tmp, 'video.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', silent]);

// ---------------------------------------------------------------- audio

const samples = new Float32Array(Math.ceil((total + 1) * RATE));

/** Reads a 16-bit mono WAV written by ffmpeg. */
function readWav(file) {
  const buf = readFileSync(file);
  let pos = 12;
  while (pos < buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') {
      const data = new Float32Array(size / 2);
      for (let i = 0; i < data.length; i++) data[i] = buf.readInt16LE(pos + 8 + i * 2) / 32768;
      return data;
    }
    pos += 8 + size;
  }
  throw new Error(`no data chunk in ${file}`);
}

function addAt(start, data, gain) {
  const offset = Math.round(start * RATE);
  for (let i = 0; i < data.length && offset + i < samples.length; i++) samples[offset + i] += data[i] * gain;
}

// The game's own sound recipes, read from src/audio/sfx.ts so the video sounds like the game.
const sfxSource = readFileSync('src/audio/sfx.ts', 'utf8');
const recipeStart = sfxSource.indexOf('const RECIPES');
const recipeBody = sfxSource.slice(sfxSource.indexOf('{', recipeStart), sfxSource.indexOf('\n};', recipeStart) + 2);
const RECIPES = new Function(`return ${recipeBody.replace(/\/\/[^\n]*/g, '')};`)();

const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  triangle: (p) => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  sawtooth: (p) => 2 * (p % 1) - 1,
};

/** Renders one recipe the way sfx.ts plays it: exponential pitch slides and an exponential envelope. */
function renderSound(name) {
  const notes = RECIPES[name];
  const length = Math.max(...notes.map((n) => n.start + n.dur)) + 0.05;
  const data = new Float32Array(Math.ceil(length * RATE));
  for (const n of notes) {
    let phase = 0;
    const first = Math.round(n.start * RATE);
    const count = Math.round(n.dur * RATE);
    for (let i = 0; i < count; i++) {
      const t = i / RATE;
      const k = t / n.dur;
      const freq = n.slideTo ? n.freq * (n.slideTo / n.freq) ** k : n.freq;
      phase += freq / RATE;
      const attack = Math.min(1, t / 0.01);
      const env = t < 0.01 ? 0.0001 * (n.gain / 0.0001) ** attack : n.gain * (0.0001 / n.gain) ** ((t - 0.01) / (n.dur - 0.01));
      data[first + i] += wave[n.type](phase) * env;
    }
  }
  return data;
}
const soundCache = new Map();
const sound = (name) => soundCache.get(name) ?? soundCache.set(name, renderSound(name)).get(name);

const EVENT_SOUNDS = {
  candyCollected: 'candy',
  blowUsed: 'blow',
  ghostHit: 'hit',
  bossHit: 'bossHit',
  pick: 'pick',
  runWon: 'runEnd',
  doorOpen: 'doorOpen',
  bossWindup: 'bossWindup',
  bossIntro: 'bossIntro',
  emberSaved: 'ember',
};
const SFX_GAIN = 1.6;
for (const seg of segments) {
  if (seg.kind !== 'clip') continue;
  const at = (recordingSec) => seg.start + recordingSec - seg.from;
  const inClip = (recordingSec) => recordingSec >= seg.from && recordingSec <= seg.to;
  if (seg.dir === 'rec-run') {
    // The menu intro lights the lantern about 0.9 s into the recording.
    addAt(at(0.9), sound('ignite'), SFX_GAIN);
    for (const e of JSON.parse(readFileSync(join(work, 'rec-run/events.json'), 'utf8'))) {
      const s = e.t / 1000;
      const name = EVENT_SOUNDS[e.name] ?? (e.name.startsWith('roomCleared') && e.name !== 'roomCleared4' ? 'roomClear' : null);
      if (name && inClip(s)) addAt(at(s), sound(name), SFX_GAIN);
    }
  } else if (seg.dir === 'rec-out') {
    // Flame 4 at 1.5 per second goes out about 2.7 s after the room starts, which is about 3.3 s in.
    addAt(at(3.3), sound('flameOut'), SFX_GAIN);
  }
}

// A quiet, slow drone under everything, made here, so there is no copyrighted music.
for (let i = 0; i < samples.length; i++) {
  const t = i / RATE;
  const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.07 * t);
  const fade = Math.min(1, t / 2, Math.max(0, (total - t) / 2));
  samples[i] +=
    fade * swell * 0.022 * (Math.sin(2 * Math.PI * 55 * t) + 0.7 * Math.sin(2 * Math.PI * 82.41 * t) + 0.4 * Math.sin(2 * Math.PI * 110.6 * t));
}

const NARRATION_GAIN = 0.9;
for (const cue of cues) addAt(cue.start, readWav(join(work, 'narr', `${cue.id}.wav`)), NARRATION_GAIN);

let peak = 0;
for (const v of samples) peak = Math.max(peak, Math.abs(v));
const scale = peak > 0.95 ? 0.95 / peak : 1;
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0, 'ascii');
wav.writeUInt32LE(36 + samples.length * 2, 4);
wav.write('WAVEfmt ', 8, 'ascii');
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36, 'ascii');
wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * scale)) * 32767), 44 + i * 2);
const audio = join(tmp, 'audio.wav');
writeFileSync(audio, wav);

// ---------------------------------------------------------------- subtitles and final mux

const inputs = ['-i', silent, '-i', audio];
const chain = [];
let last = '0:v';
cues.forEach((cue, k) => {
  // A still image is a one-frame stream, which overlay stops using after its first frame.
  // Loop it at 1 fps for the whole video (cheap: one decode per second), and show it only while
  // its line is spoken. Overlay reuses the latest subtitle frame for every video frame.
  inputs.push('-loop', '1', '-framerate', '1', '-t', (total + 1).toFixed(3), '-i', join(work, 'cards', `sub-${cue.id}.png`));
  const end = cue.start + narrDur[cue.id] + SUB_HOLD;
  const label = `v${k}`;
  chain.push(`[${last}][${k + 2}:v]overlay=0:0:enable='between(t,${cue.start.toFixed(3)},${end.toFixed(3)})'[${label}]`);
  last = label;
});
ff([
  ...inputs,
  '-filter_complex', `${chain.join(';')};[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
  '-map', `[${last}]`, '-map', '[a]',
  ...x264, '-c:a', 'aac', '-b:a', '192k', '-ar', String(RATE), '-movflags', '+faststart', '-t', total.toFixed(3), out,
]);

writeFileSync(
  join(tmp, 'timeline.json'),
  JSON.stringify({ total, segments: segments.map((s) => ({ kind: s.kind, name: s.name ?? s.dir, start: s.start, dur: s.dur })), cues }, null, 1),
);
console.log(`${cut}: ${total.toFixed(1)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}) -> ${out}`);
