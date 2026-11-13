# Lantern Run

A Halloween roguelike for [Kiroween 2026](https://kiroween.devpost.com/). You are a jack-o'-lantern carrying a flame through four rooms. Collect candy to meet each room's goal, dodge ghosts, pick an upgrade after each trial room, and defeat the Pumpkin King to win. Losing the flame ends the run.

## Play

- Live build: https://hyy12345678.github.io/lantern-run/
- Works in the browser with no login and no network calls at runtime.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # TypeScript check
npm run test       # Vitest + fast-check property tests
npm run build      # production build into dist/
```

Dev aids, for testing and screenshots only:

- `?scene=RunScene` opens a run directly. `&seed=N&room=R` starts in room R of seed N.
- `?choose=1` opens the upgrade cards at once.
- `?touch=1` shows the touch controls on a desktop.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | Joystick (bottom left) |
| Blow (push ghosts away) | Space | Blow button (bottom right) |
| Choose upgrade | 1, 2, 3 or click a card | Tap a card |
| Pause / resume | Esc or P | Pauses automatically when the tab is hidden |
| Quit to menu (while paused) | Q | |
| Sound on/off | M or click the label | Tap the label |

## Run structure

- Four rooms: three trial rooms (Graveyard, Chapel, Pumpkin Patch) and the boss room (Crypt).
- Each room starts with the flame at 100. The room is cleared by collecting its candy goal and reaching the door.
- After each trial room, pick one of three upgrades. Each upgrade can be taken once per run.
- The best score is saved in the browser's local storage.

## How Kiro was used

The project was built in Kiro with a spec-driven workflow:

- **Spec:** `.kiro/specs/lantern-run/` holds `requirements.md` (13 requirement groups with acceptance criteria), `design.md` (modules, data types, tuning values, test plan), and `tasks.md` (the implementation plan with status). The spec was rewritten once when the game changed from three nights to a roguelike, and the task list tracks that change.
- **Steering:** `.kiro/steering/` holds `product.md` (scope rules and judging priorities), `tech.md` (stack and code rules, such as keeping `src/core/` free of Phaser imports and requiring a seeded RNG), and `style-guide.md` (palette, motion limits, HUD layout).
- **Hooks:** `.kiro/hooks/` runs the TypeScript check on every `.ts` save, and runs the test suite after each spec task.
- **Property-based tests:** `tests/` uses fast-check to check rules such as flame bounds, deterministic level generation, ghost movement, and blow behavior. They run after each change to the core logic.

_Add your own notes here before submission: which Kiro features were tried, what worked, and what did not._

## License

MIT. See [LICENSE](LICENSE). Third-party assets are listed in [public/assets/CREDITS.md](public/assets/CREDITS.md). Sound effects are synthesized in code and use no audio files.
