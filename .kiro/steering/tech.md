# Tech Conventions

## Stack
- TypeScript (strict mode) + Phaser 3 (3.x line only, currently 3.90.x) + Vite.
- Tests: Vitest for runners, fast-check for property-based tests.
- Deploy: GitHub Pages from the built `dist/` folder. Vite `base` is `./`.
- Commands: `npm run dev`, `npm run typecheck`, `npm run test`, `npm run build`.

## Layout
- `src/core/`: pure game logic. Files here MUST NOT import from `phaser`.
  This keeps the rules testable without a browser.
- `src/scenes/`: Phaser scenes. Keep them thin: they wire input and rendering to `core/`.
- `src/ui/`: HUD, joystick, text and effect helpers.
- `tests/`: mirrors `src/core/`. One test file per core module.
- `public/assets/`: art and audio. Every file must be listed in `public/assets/CREDITS.md`
  with its source URL and license. Only CC0 or other licenses that allow commercial
  use with attribution.

## Code rules
- No `any`. Use explicit types for public functions.
- No magic numbers in logic. Put tuning values in `src/core/config.ts`.
- Randomness goes through a seeded RNG in `src/core/rng.ts`. Never call `Math.random()`
  inside core logic, so levels and tests are reproducible.
- Time is passed in as a `dt` (seconds). Core functions must not read the clock.
- Each core function that changes state returns new state instead of mutating inputs
  when practical. Scenes may hold mutable state; core should be easy to reason about.

## Testing rules
- Every rule in the spec's requirements that lives in `src/core/` needs at least one
  property-based test (fast-check) or one example test.
- Property tests use at least 100 runs by default.
- Do not write tests for Phaser rendering. Verify scenes by playing the build.

## Git rules
- Commit small, one task per commit where possible. Commit messages use the
  imperative mood, e.g. `add flame decay with property test`.
- `.kiro/` is always committed. Never add it to `.gitignore`.
- Never commit `node_modules/` or `dist/`.
