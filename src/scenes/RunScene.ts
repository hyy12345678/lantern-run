import Phaser from 'phaser';
import {
  BLINK_INTERVAL_SEC,
  BOSS_CONTACT_DAMAGE,
  BOSS_DASH_SEC,
  BOSS_DASH_SPEED,
  BOSS_RADIUS,
  BOSS_WINDUP_SEC,
  FLAME_MAX,
  MAP_COLS,
  MAP_ROWS,
  ROOM_COUNT,
  TILE_SIZE,
} from '../core/config';
import { isLowFlame } from '../core/flame';
import { isChasing } from '../core/ghost';
import { generateRoom } from '../core/room';
import { chooseUpgrade, createRun, stepRun } from '../core/run';
import type { RoomIndex, RunEvent, RunInput, RunState } from '../core/run';
import { THEME_NAMES } from '../core/themes';
import type { BossPhase, ThemeId } from '../core/types';
import { UPGRADE_IDS } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { playSound } from '../audio/sfx';
import { recordRunScore } from '../storage/bestScore';
import { Banner } from '../ui/Banner';
import {
  drawCandy,
  drawDashWarning,
  drawDoor,
  drawFireflies,
  drawFog,
  drawGhost,
  drawPumpkin,
  drawPumpkinKing,
} from '../ui/drawing';
import { burst, edgePulse, floatText, ring, transition } from '../ui/fx';
import { Hud } from '../ui/Hud';
import { Lantern } from '../ui/Lantern';
import type { Glow } from '../ui/Lantern';
import { buildStaticLayer, buildVignette } from '../ui/map';
import { FONT, PAL, TITLE_FONT } from '../ui/palette';
import { animTime, isReducedMotion } from '../ui/settings';
import { addSettingsToggles } from '../ui/SoundToggle';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import type { TouchFrame } from '../ui/TouchControls';
import { UpgradeOverlay } from '../ui/UpgradeOverlay';
import type { ResultData } from './ResultScene';

type Key = Phaser.Input.Keyboard.Key;

const WIDTH = MAP_COLS * TILE_SIZE;
const HEIGHT = MAP_ROWS * TILE_SIZE;
const MAX_FRAME_SECONDS = 0.05;
const MESSAGE_SECONDS = 2.2;
const ENDING_DELAY_MS = 1400;
const PLAYER_DRAW_RADIUS = 15;
const GHOST_DRAW_RADIUS = 14;
const BOSS_DRAW_RADIUS = 24;
const HURT_FLASH_MS = 300;
/** Seconds before a blink ghost teleports when it starts to fade out (R14.5). */
const BLINK_WARN_SEC = 0.6;
const LOW_FLAME_PULSE_MS = 1100;
const FIREFLY_COUNT = 12;
/** Bob of the pumpkin while it moves, in px. */
const BOB_PX = 3;

// Layer order. The darkness covers the world; glows, warnings, and labels sit above it.
const DEPTH = {
  fog: 2,
  entities: 4,
  darkness: 6,
  vignette: 7,
  fireflies: 8,
  warnings: 9,
  doorLabel: 12,
  message: 20,
};

const FIREFLY_COLORS: Record<ThemeId, number> = {
  graveyard: 0xc9ffb0,
  chapel: 0xffe6a8,
  pumpkinPatch: 0xffd166,
  crypt: 0xff9a6b,
};

interface MoveKeys {
  left: Key[];
  right: Key[];
  up: Key[];
  down: Key[];
}

/**
 * Dev aids for screenshots and testing:
 * `?seed=N&room=R` starts directly in room R of seed N.
 * `&bossPhase=windup` puts the Pumpkin King mid wind-up. `&freeze=1` stops the room from advancing.
 * Without these parameters the run starts normally from room 1 with a random seed.
 */
function startState(seed: number, room: number | null, params: URLSearchParams): RunState {
  if (room === null || room < 1 || room > ROOM_COUNT) return createRun(seed);
  const roomIndex = room as RoomIndex;
  const layout = generateRoom(roomIndex, seed);
  if (layout.boss && params.get('bossPhase') === 'windup') {
    const dx = layout.start.x - layout.boss.pos.x;
    const dy = layout.start.y - layout.boss.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    layout.boss = { ...layout.boss, phase: 'windup', phaseTimer: BOSS_WINDUP_SEC * 0.4, dashDir: { x: dx / len, y: dy / len } };
  }
  return { ...createRun(seed), roomIndex, roomsCleared: roomIndex - 1, layout, player: layout.start };
}

function roomBannerText(state: RunState): [string, string] {
  const { roomIndex, layout } = state;
  if (layout.boss) {
    return ['The Crypt', `The Pumpkin King awaits. Collect ${layout.candyGoal} candy and escape.`];
  }
  const goal = `Collect ${layout.candyGoal} candy, then reach the door`;
  return [THEME_NAMES[layout.theme], `Room ${roomIndex} of ${ROOM_COUNT}  ·  ${goal}`];
}

/**
 * Plays a run one room at a time. Handles the lantern light, the upgrade choice, room transitions,
 * pause, touch controls, sound, feedback effects, and the end of the run.
 */
export class RunScene extends Phaser.Scene {
  private state!: RunState;
  private mapLayer!: Phaser.GameObjects.RenderTexture;
  private mapRoomIndex = 0;
  private fogLayer!: Phaser.GameObjects.Graphics;
  private entities!: Phaser.GameObjects.Graphics;
  private warnings!: Phaser.GameObjects.Graphics;
  private fireflies!: Phaser.GameObjects.Graphics;
  private lantern!: Lantern;
  private hud!: Hud;
  private banner!: Banner;
  private upgradeOverlay!: UpgradeOverlay;
  private messagePanel!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.Text;
  private doorLabel!: Phaser.GameObjects.Text;
  private doorLabelText = '';
  private messageUntil = 0;
  private ending = false;
  private paused = false;
  private frozen = false;
  private pauseLayer!: Phaser.GameObjects.Container;
  private touch: TouchControls | null = null;
  private touchFrame: TouchFrame | undefined;
  private moveKeys!: MoveKeys;
  private blowKey!: Key;
  private pickKeys!: Key[];
  private pauseKeys!: Key[];
  private quitKey!: Key;

  // Feedback state the core does not need to know about.
  private moving = false;
  private hurtUntil = 0;
  private doorWasOpen = false;
  private nextLowPulse = 0;
  private lastBossPhase: BossPhase | null = null;
  private lastBlinkTimers = new Map<number, number>();

  constructor() {
    super('RunScene');
  }

  create(data: { seed?: number } = {}): void {
    const params = new URLSearchParams(window.location.search);
    const seed = data.seed ?? (Number(params.get('seed')) || Math.floor(Math.random() * 0xffffffff));
    const room = params.has('room') ? Number(params.get('room')) : null;
    this.state = startState(seed, room, params);
    this.frozen = params.has('freeze');
    this.messageUntil = 0;
    this.ending = false;
    this.paused = false;
    this.moving = false;
    this.hurtUntil = 0;
    this.doorWasOpen = false;
    this.nextLowPulse = 0;
    this.lastBossPhase = this.state.layout.boss?.phase ?? null;
    this.lastBlinkTimers = new Map();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for RunScene');
    this.moveKeys = {
      left: [keyboard.addKey('A'), keyboard.addKey('LEFT')],
      right: [keyboard.addKey('D'), keyboard.addKey('RIGHT')],
      up: [keyboard.addKey('W'), keyboard.addKey('UP')],
      down: [keyboard.addKey('S'), keyboard.addKey('DOWN')],
    };
    this.blowKey = keyboard.addKey('SPACE');
    this.pickKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    this.pauseKeys = [keyboard.addKey('ESC'), keyboard.addKey('P')];
    this.quitKey = keyboard.addKey('Q');

    this.buildMap();
    this.mapRoomIndex = this.state.roomIndex;
    this.fogLayer = this.add.graphics().setDepth(DEPTH.fog);
    this.entities = this.add.graphics().setDepth(DEPTH.entities);
    this.lantern = new Lantern(this, WIDTH, HEIGHT, DEPTH.darkness);
    buildVignette(this, WIDTH, HEIGHT).setDepth(DEPTH.vignette);
    this.fireflies = this.add.graphics().setDepth(DEPTH.fireflies);
    this.warnings = this.add.graphics().setDepth(DEPTH.warnings);
    this.hud = new Hud(this);
    this.banner = new Banner(this);
    this.upgradeOverlay = new UpgradeOverlay(this);
    this.touch = isTouchDevice() ? new TouchControls(this) : null;
    addSettingsToggles(this);
    this.createPauseLayer();
    this.listenForHidden();

    this.messagePanel = this.add.graphics().setDepth(DEPTH.message);
    this.messageText = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', {
        fontFamily: TITLE_FONT,
        fontSize: '44px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.message + 1)
      .setVisible(false);

    this.doorLabel = this.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: PAL.text,
        stroke: '#1b0f24',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.doorLabel);

    // Dev aid: `&nobanner=1` skips the first room banner, for clean screenshots.
    if (!params.has('nobanner')) this.banner.show(...roomBannerText(this.state));

    if (params.has('choose')) {
      // Dev aid: open the upgrade cards straight away. Shows a trade-off card in the middle.
      this.upgradeOverlay.show([UPGRADE_IDS[0], 'hungryFlame', 'lastEmber'], (id) => this.pickUpgrade(id));
    }
    if (params.has('pause')) {
      // Dev aid: start paused, to check the pause screen.
      this.setPaused(true);
    }
  }

  update(time: number, deltaMs: number): void {
    // Read touch input once per frame. Both the keyboard and the touch pause button toggle pause.
    this.touchFrame = this.touch?.read();
    if (this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key)) || this.touchFrame?.pause) {
      this.setPaused(!this.paused);
    }

    if (this.paused) {
      if (Phaser.Input.Keyboard.JustDown(this.quitKey)) this.scene.start('MenuScene');
    } else if (this.state.status === 'playing' && !this.frozen) {
      const dt = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const before = this.state.player;
      const step = stepRun(this.state, this.readInput(), dt);
      this.state = step.state;
      this.moving = before.x !== this.state.player.x || before.y !== this.state.player.y;
      for (const event of step.events) this.onEvent(event, time);
      this.watchForCues(time);
    } else if (this.state.status === 'choosing' && this.upgradeOverlay.isOpen) {
      this.pickKeys.forEach((key, index) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.upgradeOverlay.pick(index);
      });
    }

    if (this.state.roomIndex !== this.mapRoomIndex) {
      // Mark the room as shown now, so the swap runs once. The new map is built while the screen is dark.
      this.mapRoomIndex = this.state.roomIndex;
      this.doorWasOpen = false;
      this.lastBossPhase = this.state.layout.boss?.phase ?? null;
      this.lastBlinkTimers = new Map();
      transition(this, () => {
        this.buildMap();
        this.banner.show(...roomBannerText(this.state));
      });
    }
    if (this.messageUntil > 0 && time > this.messageUntil) this.hideMessage();
    this.draw(time);
  }

  private buildMap(): void {
    this.mapLayer?.destroy();
    this.mapLayer = buildStaticLayer(this, this.state.layout);
  }

  private readInput(): RunInput {
    const axis = (negative: Key[], positive: Key[]): number =>
      (positive.some((k) => k.isDown) ? 1 : 0) - (negative.some((k) => k.isDown) ? 1 : 0);
    const keyboardMove = {
      x: axis(this.moveKeys.left, this.moveKeys.right),
      y: axis(this.moveKeys.up, this.moveKeys.down),
    };
    const touch = this.touchFrame;
    const touchMoving = touch !== undefined && (touch.move.x !== 0 || touch.move.y !== 0);
    return {
      move: touchMoving ? touch.move : keyboardMove,
      blow: Phaser.Input.Keyboard.JustDown(this.blowKey) || (touch?.blow ?? false),
    };
  }

  private pickUpgrade(id: UpgradeId): void {
    this.state = chooseUpgrade(this.state, id);
    this.hideMessage();
    playSound('pick');
  }

  private shake(ms: number, intensity: number): void {
    if (!isReducedMotion()) this.cameras.main.shake(ms, intensity);
  }

  private onEvent(event: RunEvent, time: number): void {
    const at = this.state.player;
    switch (event.type) {
      case 'candyCollected':
        burst(this, at.x, at.y, PAL.candy, 12);
        floatText(this, at.x, at.y, `+${this.state.modifiers.candyRestore}`, PAL.candyText);
        playSound('candy');
        break;
      case 'blowUsed':
        ring(this, at.x, at.y, PAL.candy, this.state.modifiers.blowRadius);
        ring(this, at.x, at.y, 0xffffff, this.state.modifiers.blowRadius * 0.65);
        playSound('blow');
        break;
      case 'ghostHit':
        this.hurt(time, this.state.modifiers.ghostDamage, 1);
        this.shake(140, 0.006);
        playSound('hit');
        break;
      case 'bossHit':
        this.hurt(time, BOSS_CONTACT_DAMAGE, 1.3);
        this.shake(180, 0.008);
        playSound('bossHit');
        break;
      case 'emberSaved':
        burst(this, at.x, at.y, PAL.ember, 28);
        ring(this, at.x, at.y, PAL.candle, 90);
        edgePulse(this, PAL.candle, 1.2);
        floatText(this, at.x, at.y - 10, 'LAST EMBER!', PAL.candyText, 24);
        playSound('ember');
        break;
      case 'roomCleared':
        burst(this, at.x, at.y, PAL.accent, 26);
        this.showMessage(`Room ${event.room} cleared`, time, MESSAGE_SECONDS);
        playSound('roomClear');
        break;
      case 'upgradeOffered':
        this.upgradeOverlay.show(event.choices, (id) => this.pickUpgrade(id));
        break;
      case 'runLost':
      case 'runWon':
        this.endRun(event.type === 'runWon' ? 'won' : 'lost');
        break;
      default:
        break;
    }
  }

  private hurt(time: number, damage: number, strength: number): void {
    const at = this.state.player;
    this.hurtUntil = time + HURT_FLASH_MS;
    edgePulse(this, PAL.danger, strength);
    floatText(this, at.x, at.y, `-${damage}`, PAL.warnText);
  }

  /** Effects that come from watching state change: the door opening, boss wind-up, blink teleports, low flame. */
  private watchForCues(time: number): void {
    const { layout } = this.state;
    const doorOpen = this.state.candiesInRoom >= layout.candyGoal;
    if (doorOpen && !this.doorWasOpen) {
      burst(this, layout.door.x, layout.door.y, PAL.candle, 22);
      floatText(this, layout.door.x, layout.door.y - 20, 'DOOR OPEN', PAL.candyText, 22);
      playSound('doorOpen');
    }
    this.doorWasOpen = doorOpen;

    const boss = layout.boss;
    if (boss && boss.phase !== this.lastBossPhase && boss.phase === 'windup') playSound('bossWindup');
    this.lastBossPhase = boss?.phase ?? null;

    for (const ghost of layout.ghosts) {
      if (ghost.kind !== 'blink') continue;
      const last = this.lastBlinkTimers.get(ghost.id);
      // The timer jumps back up when the ghost teleports. Puff where it appears.
      if (last !== undefined && last < BLINK_WARN_SEC && ghost.blinkTimer > BLINK_INTERVAL_SEC - 0.1) {
        burst(this, ghost.pos.x, ghost.pos.y, PAL.ghostBlink, 14);
      }
      this.lastBlinkTimers.set(ghost.id, ghost.blinkTimer);
    }

    if (isLowFlame(this.state.flame) && time > this.nextLowPulse) {
      edgePulse(this, PAL.danger, 0.45);
      this.nextLowPulse = time + LOW_FLAME_PULSE_MS;
    }
  }

  /** Saves the best score, waits briefly so the player sees the final frame, then opens the result screen. */
  private endRun(status: 'won' | 'lost'): void {
    if (this.ending) return;
    this.ending = true;
    const data: ResultData = {
      status,
      roomsCleared: this.state.roomsCleared,
      runScore: this.state.runScore,
      upgrades: [...this.state.upgrades],
    };
    recordRunScore(data.runScore);
    playSound('runEnd');
    if (status === 'won') this.showMessage('The Pumpkin King retreats!', this.time.now, Infinity);
    this.time.delayedCall(ENDING_DELAY_MS, () => this.scene.start('ResultScene', data));
  }

  private setPaused(value: boolean): void {
    // Pausing only makes sense during a room. The upgrade choice and the end of the run ignore it.
    if (value && this.state.status !== 'playing') return;
    this.paused = value;
    this.pauseLayer.setVisible(value);
  }

  /** Pauses when the browser tab is hidden or the window loses focus. */
  private listenForHidden(): void {
    const onVisibility = (): void => {
      if (document.hidden) this.setPaused(true);
    };
    const onBlur = (): void => this.setPaused(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    });
  }

  private createPauseLayer(): void {
    const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, PAL.ink, 0.72);
    const title = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 30, 'Paused', {
        fontFamily: TITLE_FONT,
        fontSize: '64px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 36, 'Esc or P to resume     Q to quit to menu', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: PAL.text,
        stroke: '#1b0f24',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    // Keyboard hint on keyboard devices. Tappable buttons on touch devices.
    const touchDevice = isTouchDevice();
    hint.setVisible(!touchDevice);
    const tapStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: PAL.text,
      stroke: '#1b0f24',
      strokeThickness: 5,
    };
    const tapResume = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 36, 'Tap to resume', tapStyle)
      .setOrigin(0.5)
      .setVisible(touchDevice)
      .setInteractive({ useHandCursor: true });
    tapResume.on('pointerdown', () => this.setPaused(false));
    const tapQuit = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, 'Tap here to quit to menu', { ...tapStyle, color: PAL.accentText })
      .setOrigin(0.5)
      .setVisible(touchDevice)
      .setInteractive({ useHandCursor: true });
    tapQuit.on('pointerdown', () => this.scene.start('MenuScene'));

    this.pauseLayer = this.add
      .container(0, 0, [dim, title, hint, tapResume, tapQuit])
      .setDepth(60)
      .setVisible(false);
  }

  private showMessage(text: string, time: number, seconds: number): void {
    this.messageText.setText(text).setVisible(true);
    this.messageUntil = seconds === Infinity ? Number.MAX_SAFE_INTEGER : time + seconds * 1000;
  }

  /** Updates the door label. Text and color only change when they differ, since each change re-renders the text. */
  private setDoorLabel(text: string, color: string, x: number, y: number): void {
    if (text !== this.doorLabelText) {
      this.doorLabelText = text;
      this.doorLabel.setText(text);
      this.doorLabel.setColor(color);
    }
    // Keep the label inside the screen when the door is near the right edge.
    const halfWidth = this.doorLabel.width / 2;
    this.doorLabel.setPosition(Math.min(x, WIDTH - halfWidth - 6), y);
  }

  private hideMessage(): void {
    this.messageText.setVisible(false);
    this.messagePanel.clear();
    this.messageUntil = 0;
  }

  private draw(time: number): void {
    const t = animTime(time);
    const { layout, player, flame } = this.state;
    const g = this.entities;
    g.clear();
    this.warnings.clear();
    const glows: Glow[] = [];

    // Door.
    const needed = Math.max(0, layout.candyGoal - this.state.candiesInRoom);
    const doorOpen = needed === 0;
    const doorX = layout.doorTile.col * TILE_SIZE;
    const doorY = layout.doorTile.row * TILE_SIZE;
    drawDoor(g, doorX, doorY, TILE_SIZE, t, doorOpen);
    glows.push({ pos: layout.door, radius: doorOpen ? 80 : 42, strength: doorOpen ? 0.95 : 0.55 });
    this.setDoorLabel(
      doorOpen ? 'DOOR OPEN' : `NEED ${needed} MORE CANDY`,
      doorOpen ? PAL.candyText : PAL.text,
      doorX + TILE_SIZE / 2,
      doorY - 4,
    );

    // Candy.
    layout.candies.forEach((candy, i) => {
      drawCandy(g, candy.x, candy.y, PAL.candyColors[i % PAL.candyColors.length], t, i * 1.7);
      glows.push({ pos: candy, radius: 28, strength: 0.5 });
    });

    // Ghosts, with cues for what they are about to do.
    for (const ghost of layout.ghosts) {
      const fade =
        ghost.kind === 'blink' && ghost.blinkTimer < BLINK_WARN_SEC ? 1 - ghost.blinkTimer / BLINK_WARN_SEC : 0;
      drawGhost(g, ghost.pos.x, ghost.pos.y, GHOST_DRAW_RADIUS, ghost.kind, t, ghost.id * 2.1, {
        chasing: isChasing(ghost, player),
        fade,
      });
      glows.push({ pos: ghost.pos, radius: 46, strength: 0.6 * (1 - fade) });
    }

    // The Pumpkin King, and the warning line before a dash.
    const boss = layout.boss;
    if (boss) {
      drawPumpkinKing(g, boss.pos.x, boss.pos.y, BOSS_DRAW_RADIUS, time, boss.phase, boss.dashDir);
      glows.push({ pos: boss.pos, radius: 96, strength: 0.85 });
      if (boss.phase === 'windup') {
        const reach = BOSS_DASH_SPEED * BOSS_DASH_SEC + BOSS_RADIUS;
        drawDashWarning(this.warnings, boss.pos, boss.dashDir, reach, 1 - boss.phaseTimer / BOSS_WINDUP_SEC);
      }
    }

    // Player.
    const bob = this.moving ? -Math.abs(Math.sin(t * 0.016)) * BOB_PX : 0;
    const flash = Math.max(0, (this.hurtUntil - time) / HURT_FLASH_MS);
    drawPumpkin(g, player.x, player.y + bob, PLAYER_DRAW_RADIUS, flame / FLAME_MAX, t, 0, flash);

    this.fogLayer.clear();
    drawFog(this.fogLayer, WIDTH, HEIGHT, t, 0.07);

    const flicker = 1 + Math.sin(t * 0.006) * 0.025 + Math.sin(t * 0.011) * 0.015;
    this.lantern.update(player, flame, flicker, glows);

    this.fireflies.clear();
    if (!isReducedMotion()) {
      drawFireflies(this.fireflies, WIDTH, HEIGHT, time, FIREFLY_COUNT, FIREFLY_COLORS[layout.theme]);
    }

    this.drawMessagePanel();
    this.hud.update(this.state, t);
  }

  private drawMessagePanel(): void {
    this.messagePanel.clear();
    if (!this.messageText.visible) return;
    const w = this.messageText.width + 64;
    const h = this.messageText.height + 30;
    const x = WIDTH / 2 - w / 2;
    const y = HEIGHT / 2 - h / 2;
    this.messagePanel.fillStyle(PAL.ink, 0.88);
    this.messagePanel.fillRoundedRect(x, y, w, h, 18);
    this.messagePanel.lineStyle(3, PAL.pumpkin, 1);
    this.messagePanel.strokeRoundedRect(x, y, w, h, 18);
  }
}
