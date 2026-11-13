# Implementation Plan: Lantern Run (roguelike)

Each task lists the requirements it covers (see `requirements.md`). Checked items are in the
repo. Items marked "superseded" were built for the three-night version and are replaced by a later task.

## Phase A: Core logic for the roguelike (pure, tested)

- [x] 1. Core foundations
  - Shared types, base tuning constants, vector helpers, pure seeded RNG.
  - Covers: R7.6 (determinism).
- [x] 2. Grid and collision
  - Walkability, circle collision with sub-steps and wall sliding, BFS path and distance map.
  - Covers: R2.3, R2.4, R4.4.
- [x] 3. Flame and candy
  - Decay, clamped add and damage, low-flame check, candy pickup radius.
  - Covers: R3.1, R3.2, R3.4, R4.1, R4.3.
  - Note: restore and decay values are passed in through modifiers after task 11.
- [x] 4. Regular ghosts
  - Patrol loop, chase inside the trigger radius, blink teleport, contact detection, hit immunity.
  - Covers: R5.1 to R5.6.
- [x] 5. Blow ability
  - Radial push, stops at walls, cooldown helpers.
  - Covers: R6.2, R6.3, R6.4.
  - Note: radius and cooldown are passed in through modifiers after task 11.
- [x] 6. Room generation (replaces `night.ts`)
  - `generateRoom(roomIndex, seed)` with theme choice, layout, candy goal, ghost counts, and optional boss.
  - Covers: R7.2, R7.5, R7.6, R8.1, R8.2, R10.1, R4.4.
  - Superseded: `night.ts` (three-night generator). Its carving and placement logic is reused.
- [x] 7. Boss (new)
  - `stepBoss` chases the player at 55 px/s without a trigger radius. `bossTouchesPlayer` with 1 s immunity.
  - Covers: R10.2, R10.3.
- [x] 8. Upgrades (new)
  - Catalog of five upgrades, `applyUpgrades`, `offerUpgrades` with a seeded shuffle.
  - Covers: R9.1 to R9.5.
- [x] 9. Run loop v2 (replaces `run.ts` nights)
  - `createRun`, `stepRun` with rooms, status `choosing` and terminal states, `chooseUpgrade`.
  - Scoring: candy 1, trial room 10, boss 50.
  - Covers: R1.2 to R1.6, R3.3, R11.1 to R11.3.
- [x] 10. Core tests for tasks 6 to 9
  - Update property tests for the new room generator, upgrades, boss, run flow, and scoring.
  - Covers: the testing table in design.md section 8.
  - Old night and retry tests are removed.

## Phase B: Presentation for the roguelike

- [x] 11. Playable prototype with placeholder art
  - Keyboard movement, Space blow, HUD, retry on Enter, win message, camera shake on contact.
  - Superseded in part by tasks 12 to 16 (retry is replaced by run end).
- [x] 12. Procedural cartoon art (first pass)
  - Floor, hedge border, tombstones, pumpkin player, ghosts, candy, door, bats, fog, vignette.
  - Covers: R13.3 (partial). Needs theme variants (task 14).
- [x] 13. Theme palettes and decor
  - Graveyard, Chapel, Pumpkin Patch, Crypt palettes. Pillar and hay bale decor for Chapel and Pumpkin Patch.
  - Covers: R8.1 to R8.3.
- [x] 14. Boss art and room transition
  - Pumpkin King drawn larger with a crown and angry eyes. 400 ms fade between rooms.
  - Covers: R10 (visual), R13.4.
- [x] 15. Upgrade choice overlay
  - Three cards with a drawn icon, name, and description. Click or keys 1, 2, 3.
  - Covers: R9.2, R13.5.
- [x] 16. HUD v2
  - Top bar with room x / 4, theme name, candy goal, score, blow ring, and upgrade icons.
  - Covers: R7.2, R13.3.
- [x] 17. Result scene
  - Win and loss screens with rooms cleared, score, upgrades, Play Again, Menu.
  - Covers: R1.6, R11.4.

## Phase C: Product features

- [x] 18. Menu with best score and local save
  - Covers: R1.1, R11.4, R11.5.
- [x] 19. Pause and auto-pause
  - Covers: R12.1, R12.2.
- [x] 20. Mute toggle
  - Covers: R12.3. Depends on task 22.
- [x] 21. Touch controls
  - Joystick and blow button for touch devices. Tap to choose upgrades.
  - Covers: R2.2, R6.1, R9.2.
- [x] 22. Audio (synthesized in code, no audio files)
  - Candy, blow, ghost contact, boss contact, upgrade pick, room clear, run end.
  - Covers: R13.6, R12.3.
- [x] 23. Responsive check (500 px phone-width view shows the whole menu, letterboxed. Text is small on phones; a larger HUD for small screens is a later polish item)
  - Canvas scaling from 360 px to 1920 px, HUD not cropped, sub-path build.
  - Covers: R13.1, R13.2.
- [x] 24. Kiro hooks
  - `PostFileSave` on `.ts` runs typecheck. `PostTaskExec` runs tests. Files in `.kiro/hooks/`.
- [x] 25. Deploy and README (live at https://hyy12345678.github.io/lantern-run/ from the gh-pages branch, built by hand. Automatic deploy needs the `workflow` token scope: run `gh auth refresh -h github.com -s workflow`, then commit `.github/workflows/deploy.yml`)
  - GitHub Pages build, live link in README, Kiro usage section.

## Schedule

- Phase A (tasks 6 to 10): by 2026-11-17.
- Phase B (tasks 13 to 17): by 2026-11-24.
- Phase C (tasks 18 to 25): by 2026-11-29.
- Feature freeze: 2026-11-30. Submission: 2026-12-03 (deadline 2026-12-04 14:00 PT).
- If Phase B runs late, drop task 14 (boss art and fade) first. Keep the upgrade overlay and result scene.
