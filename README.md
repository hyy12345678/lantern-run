# Lantern Run

A Halloween browser game for [Kiroween 2026](https://kiroween.devpost.com/). Carry a flame through a foggy village, collect candy, dodge ghosts, and reach the church door on three nights.

> Status: project scaffold. Gameplay is built out from `.kiro/specs/lantern-run/`.

## Play

- Live build: _link added after GitHub Pages deploy_

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # TypeScript check
npm run test       # Vitest + fast-check
npm run build      # production build into dist/
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD | Joystick |
| Blow (push ghosts away) | Space | Blow button |
| Pause | Esc / P | Pause icon |
| Mute | M | Speaker icon |

## How Kiro was used

Specs, steering, and hooks live in `.kiro/`. This section will be expanded before submission.

- `.kiro/specs/lantern-run/`: requirements and design
- `.kiro/steering/`: product, tech, and style rules

## License

MIT. See [LICENSE](LICENSE). Third-party assets are listed in [public/assets/CREDITS.md](public/assets/CREDITS.md).
