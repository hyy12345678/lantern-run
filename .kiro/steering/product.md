# Product: Lantern Run

## Vision
A short, atmospheric browser game for Kiroween 2026 (Costume Contest category).
The player is a jack-o'-lantern carrying a flame through a fog-covered village
at night. The flame is the only resource that matters: keep it lit, collect
candy, and reach the church door.

## Scope rules (non-negotiable for the hackathon)
- MVP is defined in `.kiro/specs/lantern-run/requirements.md`. Do not add features
  outside the spec without updating the spec first.
- Pure front-end. No login, no backend, no network calls at runtime.
- Must work on desktop (keyboard) and mobile (touch joystick and a blow button).
- Roguelike run: four rooms (three trial rooms, then the Pumpkin King). Flame resets each room.
  Losing the flame ends the run. Upgrades are chosen between trial rooms.
- Feature freeze date: 2026-11-30. After that, only bug fixes and content polish.

## Audience and judging
- Judges score on: potential impact, technological implementation (how well Kiro
  is used), design, innovation, and presentation.
- The Costume Contest category rewards a polished, haunting UI. Every screen
  should look intentional, not like a prototype.
- The game must be playable in under 3 minutes so the demo video can show a full night.

## Tone and content
- Spooky, not gory. Fog, candles, pumpkins, ghosts, bats. No blood, no jump scares
  that rely on loud noises.
- Safe for work. Rules disqualify offensive or discriminatory content.
- In-game text and public-facing docs (README, submission text) are in English.
  Internal planning docs (PLAN.md, steering, specs) may be in Chinese.

## Game feel
- Failure is fast and clear: the flame goes out and the run ends on a summary screen.
- Difficulty rises by room, and upgrades let the player shape the run. A player should be
  able to read the danger from the screen.
- Every input gets immediate visual or audio feedback.
