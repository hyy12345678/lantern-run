// Renders the title, info, and Kiro cards for the demo video as 1920x1080 PNGs, plus a
// transparent subtitle PNG for each narration line. Kiro cards quote the real files in the repo.
//
// usage: node video/cards.mjs <outDir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outDir = process.argv[2];
mkdirSync(outDir, { recursive: true });
const root = resolve('.');
const font = (file) => `file://${join(root, 'public/assets/fonts', file)}`;
const shot = (file) => `file://${join(root, 'screenshots', file)}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const css = `
@font-face { font-family: Fredoka; src: url('${font('Fredoka.ttf')}'); font-weight: 300 700; }
@font-face { font-family: Creepster; src: url('${font('Creepster-Regular.ttf')}'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1920px; height: 1080px; overflow: hidden; font-family: Fredoka, sans-serif; color: #f5f0ff;
  background: radial-gradient(ellipse at 50% 30%, #3a1f55 0%, #140a24 60%, #07040e 100%); }
.bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(3px) brightness(0.35); }
.wrap { position: absolute; inset: 0; padding: 60px 120px; display: flex; flex-direction: column; }
h1 { font-family: Creepster, Fredoka; color: #ffb347; font-weight: 400; font-size: 84px; letter-spacing: 2px;
  text-shadow: 0 8px 0 #000, 0 0 40px rgba(255,138,0,0.35); }
.kicker { color: #ffb347; font-size: 30px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 10px; }
.sub { color: #c9b8e6; font-size: 34px; font-weight: 600; margin-top: 18px; }
.cols { display: flex; gap: 60px; margin-top: 34px; flex: 1; min-height: 0; }
.col { flex: 1; min-width: 0; }
.label { color: #c9b8e6; font-size: 26px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 14px; }
pre { background: rgba(10,6,20,0.85); border: 2px solid #ff8a00; border-radius: 18px; padding: 22px 28px;
  font-family: Menlo, monospace; font-size: 22px; line-height: 1.42; color: #f5f0ff; white-space: pre-wrap; overflow: hidden; }
pre .k { color: #ffd166; } pre .c { color: #a58fbf; } pre .ok { color: #7bd389; font-weight: 700; }
ul { list-style: none; padding: 0; }
li { font-size: 36px; font-weight: 600; line-height: 1.35; margin: 0 0 22px 0; padding-left: 52px; position: relative; }
li::before { content: ''; position: absolute; left: 4px; top: 16px; width: 22px; height: 22px; border-radius: 50%;
  background: radial-gradient(circle, #ffd166 0%, #ff8a00 60%, transparent 70%); }
li.warn::before { background: radial-gradient(circle, #ff8b8b 0%, #c1121f 60%, transparent 70%); }
.big { font-size: 64px; font-weight: 700; color: #ffd166; }
.center { align-items: center; justify-content: center; text-align: center; }
.url { font-size: 46px; font-weight: 700; color: #ffd166; margin-top: 18px; }
.small { font-size: 28px; color: #c9b8e6; margin-top: 30px; }
`;

const page = (body, bg) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${bg ? `<div class="bg" style="background-image:url('${bg}')"></div>` : ''}<div class="wrap">${body}</div></body></html>`;

// ---------------------------------------------------------------- real excerpts from the repo

const kiroFiles = execFileSync('git', ['ls-files', '.kiro']).toString().trim().split('\n');
const requirements = readFileSync('.kiro/specs/lantern-run/requirements.md', 'utf8');
const r15 = requirements.slice(requirements.indexOf('### Requirement 15'));
const r15Lines = r15.split('\n').filter((l) => /^[123]\. /.test(l)).slice(0, 3);
const requirementGroups = (requirements.match(/^### Requirement \d+/gm) ?? []).length;
const taskCount = (readFileSync('.kiro/specs/lantern-run/tasks.md', 'utf8').match(/^- \[[ x]\] \d+\./gm) ?? []).length;
const tech = readFileSync('.kiro/steering/tech.md', 'utf8');
const layoutRule = tech.split('\n').find((l) => l.includes('MUST NOT import from `phaser`'));
const codeRules = tech.slice(tech.indexOf('## Code rules'), tech.indexOf('## Testing rules')).trim();
// The first line of each rule, so the card stays short enough to sit above the subtitles.
const ruleLines = codeRules.split('\n').slice(1);
const rules = [];
for (const line of ruleLines) {
  if (line.startsWith('- ')) rules.push(line);
  else if (line.startsWith('  ') && rules.length) rules[rules.length - 1] += ` ${line.trim()}`;
}
const keyRules = ['## Code rules', ...rules.slice(0, 4)];
const hookA = readFileSync('.kiro/hooks/typecheck-on-save.json', 'utf8').trim();
const hookB = readFileSync('.kiro/hooks/test-after-task.json', 'utf8').trim();
const visTest = readFileSync('tests/visibility.test.ts', 'utf8');
const propStart = visTest.indexOf("  it('never lets light pass through");
const propText = visTest.slice(propStart, visTest.indexOf('\n', visTest.indexOf('fc.assert(', propStart) + 200) + 1);
const testSummary = readFileSync(join(outDir, '..', 'test-summary.txt'), 'utf8').trim();

const highlight = (code) =>
  esc(code)
    .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
    .replace(/\b(it|fc\.assert|fc\.property|return|const)\b/g, '<span class="k">$1</span>');

// ---------------------------------------------------------------- cards

const cards = {
  title: page(
    `<div class="wrap center"><div class="kicker">Kiroween 2026 · Costume Contest</div><h1 style="font-size:180px">Lantern Run</h1>
     <div class="sub" style="font-size:44px">A Halloween roguelike built with Kiro</div></div>`,
    shot('boss.png'),
  ),
  madeInCode: page(
    `<div class="kicker">Made in code</div><h1>No image or audio files</h1>
     <div class="cols"><div class="col"><ul>
       <li>Every sprite, room, and light is drawn with Phaser Graphics</li>
       <li>Every sound is synthesized with the Web Audio API</li>
       <li>Two open fonts: Fredoka and Creepster (SIL OFL)</li>
       <li>Levels are generated from a seed, so each run is new</li>
     </ul></div></div>`,
    shot('patch.png'),
  ),
  access: page(
    `<div class="kicker">Accessibility</div><h1>Spooky, and readable</h1>
     <div class="cols"><div class="col"><ul>
       <li>Reduced motion follows the browser setting, and toggles with R</li>
       <li>Hits pulse the screen edges, never the whole screen</li>
       <li>HUD text is 18 px or larger, with high contrast</li>
       <li>Keyboard, or touch with a joystick and a blow button</li>
     </ul></div></div>`,
    shot('room.png'),
  ),
  kiroSpec: page(
    `<div class="kicker">Built with Kiro · Spec</div><h1>Spec first, then code</h1>
     <div class="cols">
       <div class="col" style="flex:0.8"><div class="label">.kiro/ in the repo</div><pre>${kiroFiles.map(esc).join('\n')}</pre>
         <div class="small">${requirementGroups} requirement groups · ${taskCount} tasks</div></div>
       <div class="col"><div class="label">requirements.md · Requirement 15</div><pre>${esc(r15Lines.join('\n\n'))}</pre></div>
     </div>`,
  ),
  kiroSteering: page(
    `<div class="kicker">Built with Kiro · Steering</div><h1>The rules Kiro follows</h1>
     <div class="cols"><div class="col"><div class="label">.kiro/steering/tech.md</div>
       <pre>${esc(layoutRule ?? '')}\n\n${esc(keyRules.join('\n'))}</pre></div></div>`,
  ),
  kiroHooks: page(
    `<div class="kicker">Built with Kiro · Hooks</div><h1>Checks that run themselves</h1>
     <div class="cols">
       <div class="col"><div class="label">typecheck-on-save.json</div><pre>${esc(hookA)}</pre></div>
       <div class="col"><div class="label">test-after-task.json</div><pre>${esc(hookB)}</pre></div>
     </div>`,
  ),
  kiroPbt: page(
    `<div class="kicker">Built with Kiro · Property-based tests</div><h1>Rules, checked hundreds of ways</h1>
     <div class="cols">
       <div class="col" style="flex:2.4"><div class="label">tests/visibility.test.ts</div><pre>${highlight(propText)}</pre></div>
       <div class="col"><div class="label">npm run test</div><pre><span class="ok">${esc(testSummary.replace(/\s+\(/g, ' ('))}</span></pre></div>
     </div>`,
  ),
  upgrades: page(
    `<div class="kicker">Eight upgrades</div><h1>Every run builds differently</h1>
     <div class="cols">
       <div class="col"><ul>
         <li>Bright Wick: candy restores 5 more flame</li>
         <li>Swift Feet: move 15% faster</li>
         <li>Quick Breath: bigger blow, faster recharge</li>
         <li>Thick Wax: your flame burns 25% slower</li>
       </ul></div>
       <div class="col"><ul>
         <li>Iron Pumpkin: ghosts take 10 less flame</li>
         <li>Sweet Tooth: grab candy from twice as far</li>
         <li class="warn">Hungry Flame: +15 flame per candy, burns 50% faster</li>
         <li>Last Ember: a dying flame relights once per room</li>
       </ul></div>
     </div>`,
  ),
  worked: page(
    `<div class="kicker">Building with Kiro</div><h1>What worked, and what didn't</h1>
     <div class="cols"><div class="col"><ul>
       <li>Specs broke the game into tasks and tracked progress</li>
       <li>Steering kept code and visuals consistent</li>
       <li>Hooks automated type checks and tests</li>
       <li class="warn">Pivoting to a roguelike meant rewriting the spec</li>
       <li class="warn">Tests can't tell you if it's fun. Playtesting can.</li>
     </ul></div></div>`,
  ),
  outro: page(
    `<div class="wrap center"><h1 style="font-size:150px">Lantern Run</h1>
     <div class="sub">Play free in your browser</div>
     <div class="url">hyy12345678.github.io/lantern-run</div>
     <div class="small">Source: github.com/hyy12345678/lantern-run · TypeScript · Phaser 3 · Built with Kiro</div></div>`,
    shot('patch.png'),
  ),
};

function render(name, html, transparent) {
  const htmlFile = join(outDir, `${name}.html`);
  writeFileSync(htmlFile, html);
  const args = ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--window-size=1920,1080', '--virtual-time-budget=2000',
    `--screenshot=${join(outDir, `${name}.png`)}`];
  if (transparent) args.push('--default-background-color=00000000');
  execFileSync(CHROME, [...args, `file://${htmlFile}`], { stdio: 'ignore' });
}

for (const [name, html] of Object.entries(cards)) render(`card-${name}`, html, false);

// ---------------------------------------------------------------- subtitles

const narration = JSON.parse(readFileSync('video/narration.json', 'utf8')).lines;
const subCss = `@font-face { font-family: Fredoka; src: url('${font('Fredoka.ttf')}'); font-weight: 300 700; }
html, body { margin: 0; width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
.s { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); width: max-content; max-width: 1640px; text-align: center;
  font-family: Fredoka, sans-serif; font-weight: 600; font-size: 38px; line-height: 1.28; color: #fff;
  background: rgba(8,4,16,0.8); padding: 12px 30px; border-radius: 16px; }
.s.top { top: 18px; bottom: auto; }`;
// Lines spoken over the result screen sit at the top, so they do not cover its text.
const TOP_LINES = new Set(['win', 'result']);
for (const [id, text] of Object.entries(narration)) {
  const cls = TOP_LINES.has(id) ? 's top' : 's';
  render(`sub-${id}`, `<!doctype html><html><head><meta charset="utf-8"><style>${subCss}</style></head><body><div class="${cls}">${esc(text)}</div></body></html>`, true);
}
console.log(`rendered ${Object.keys(cards).length} cards and ${Object.keys(narration).length} subtitles`);
