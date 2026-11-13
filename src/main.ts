import Phaser from 'phaser';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from './core/config';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { RunScene } from './scenes/RunScene';

// Dev aids for testing: `?scene=RunScene|ResultScene` opens that scene first.
// Combine with `seed=N&room=R` (run scene) or `choose=1` to open the upgrade cards directly.
const SCENES = { MenuScene, RunScene, ResultScene };
const requested = new URLSearchParams(window.location.search).get('scene');
const first = requested !== null && requested in SCENES ? (requested as keyof typeof SCENES) : 'MenuScene';
const order = [SCENES[first], ...Object.values(SCENES).filter((s) => s !== SCENES[first])];

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: MAP_COLS * TILE_SIZE,
  height: MAP_ROWS * TILE_SIZE,
  backgroundColor: '#0b0614',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Phaser tracks one touch point by default, so a second finger (e.g. a BLOW tap while the
  // joystick is held) was ignored. Three points cover a thumb on the joystick, a thumb on BLOW, and spare.
  input: {
    activePointers: 3,
  },
  scene: order,
};

// Wait for the bundled Fredoka font so the first text render uses it.
const fontLoads = Promise.all([
  document.fonts.load('bold 24px Fredoka'),
  document.fonts.load('16px Fredoka'),
]).catch(() => undefined);

fontLoads.finally(() => {
  new Phaser.Game(config);
});
