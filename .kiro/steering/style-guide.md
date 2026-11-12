# Visual and Audio Style Guide

## Palette
| Role | Hex | Use |
|---|---|---|
| Night sky / background | `#0b0614` | Default background |
| Fog | `#2a1f3d` | Fog layers, shadows |
| Pumpkin orange | `#ff8a00` | Player, titles, primary buttons |
| Candle yellow | `#ffd166` | Flame, candy highlights |
| Ghost teal | `#bde0fe` | Ghosts |
| Warning red | `#c1121f` | Flame low, damage flash (never gore) |
| Text primary | `#f5f0ff` | Body text |
| Text secondary | `#a58fbf` | Hints, captions |

Text contrast on the background must be at least 4.5:1 (WCAG AA).

## Typography
- One display font for titles, one plain font for HUD and body text.
- Both fonts must be OFL or CC0 and listed in `CREDITS.md`.
- HUD text is at least 18px at 960x540 base resolution.

## Motion rules
- Lantern flicker: 0.5 to 2 Hz, amplitude small. The flame must still be readable
  when flickering.
- Fog drifts slowly (under 20 px/s). Never full-screen flashing.
- Screen shake: at most 200 ms, only on ghost contact. Respect a reduced-motion toggle.
- Every ability (blow) has a visible cooldown indicator.

## HUD layout
- Top left: flame bar (with a number label).
- Top right: candy counter and current night (e.g. "Night 2 / 3").
- Bottom: on-screen controls on touch devices only.

## Audio rules
- CC0 or otherwise free-to-use sources only. No copyrighted music in the demo video.
- Sound effects: candy pickup, blow, ghost contact, flame out, night clear.
- A mute toggle is always visible on the menu and the game screen.

## Spooky without gore
- Ghosts are soft shapes with glow, not monsters with teeth or blood.
- The game ends with a warm result screen, not a harsh one.
