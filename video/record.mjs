// Records the game in real time through the Chrome DevTools Protocol screencast.
// Writes JPEG frames with timestamps, and the game's VIDEO_EVENT log lines with timestamps.
//
// usage: node video/record.mjs <url> <outDir> <stopAfterEvent|-> <extraMsAfterStop> <maxMs> [chromeFlag ...]
// The recording stops `extraMsAfterStop` ms after the named VIDEO_EVENT, or at `maxMs`.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, outDir, stopEvent, extraArg, maxArg, ...flags] = process.argv.slice(2);
const extraMs = Number(extraArg);
const maxMs = Number(maxArg);
mkdirSync(join(outDir, 'frames'), { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'rec-'))}`,
    '--window-size=1920,1080',
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    ...flags,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  } catch {
    await sleep(100);
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const frames = [];
const events = [];
let start = 0;
let stopAt = Infinity;

const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = msg.params;
    const t = metadata.timestamp * 1000 - start;
    const file = `f${String(frames.length).padStart(6, '0')}.jpg`;
    writeFileSync(join(outDir, 'frames', file), Buffer.from(data, 'base64'));
    frames.push({ file, t });
    send('Page.screencastFrameAck', { sessionId });
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? '').join(' ');
    if (text.startsWith('VIDEO_EVENT ')) {
      const name = text.slice('VIDEO_EVENT '.length);
      const t = Date.now() - start;
      events.push({ name, t });
      console.log(`event ${name} at ${t} ms`);
      if (name === stopEvent) stopAt = Math.min(stopAt, t + extraMs);
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    console.log('EXCEPTION', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
start = Date.now();
await send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
await send('Page.navigate', { url });

while (Date.now() - start < Math.min(maxMs, stopAt)) await sleep(50);
await send('Page.stopScreencast');
await sleep(200);
writeFileSync(join(outDir, 'frames.json'), JSON.stringify(frames));
writeFileSync(join(outDir, 'events.json'), JSON.stringify(events, null, 1));
const span = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
console.log(`recorded ${frames.length} frames over ${(span / 1000).toFixed(1)} s (${(frames.length / (span / 1000)).toFixed(1)} fps)`);
ws.close();
chrome.kill('SIGKILL');
process.exit(0);
