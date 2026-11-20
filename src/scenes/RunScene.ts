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
import type { BossPhase, GhostKind, ThemeId, Vec2 } from '../core/types';
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
  tileHash,
} from '../ui/drawing';
import { burst, edgePulse, floatText, irisOpen, irisTransition, ring } from '../ui/fx';
import { Hud } from '../ui/Hud';
import { DARKNESS_ALPHA, Lantern, lightRadius } from '../ui/Lantern';
import type { LightSource } from '../ui/Lantern';
import { buildStaticLayer, buildVignette } from '../ui/map';
import type { ThemeLight } from '../ui/map';
import { FONT, PAL, TITLE_FONT } from '../ui/palette';
import { animTime, isReducedMotion } from '../ui/settings';
import { addSettingsToggles } from '../ui/SoundToggle';
import { ensureFxTextures, TEX } from '../ui/textures';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import type { TouchFrame } from '../ui/TouchControls';
import { UpgradeOverlay } from '../ui/UpgradeOverlay';
import type { ResultData } from './ResultScene';

type Key = Phaser.Input.Keyboard.Key;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

const WIDTH = MAP_COLS * TILE_SIZE;
const HEIGHT = MAP_ROWS * TILE_SIZE;
const MAX_FRAME_SECONDS = 0.05;
const MESSAGE_SECONDS = 2.2;
const PLAYER_DRAW_RADIUS = 15;
const GHOST_DRAW_RADIUS = 14;
const BOSS_DRAW_RADIUS = 24;
const HURT_FLASH_MS = 300;
/** Seconds before a blink ghost teleports when it starts to fade out (R14.5). */
const BLINK_WARN_SEC = 0.6;
const LOW_FLAME_PULSE_MS = 1100;
const FIREFLY_COUNT = 12;
const BOB_PX = 3;
/** Light rays per frame (R15.10). Fewer on touch devices to save power. */
const RAYS_DESKTOP = 288;
const RAYS_TOUCH = 180;
/** Length of the flame-out and win moments before the screen fades (R15.3). */
const ENDING_MS = 1500;
const ENDING_FADE_MS = 450;
const BOSS_INTRO_MS = 2200;
const LETTERBOX_PX = 62;
const EMBER_EVERY_MS = 55;
const EMBER_IDLE_EVERY_MS = 200;
const WISP_EVERY_MS = 90;
const SMOKE_EVERY_MS = 80;

// Layer order. The darkness covers the world; glows, warnings, and labels sit above it.
const DEPTH = {
  fog: 2,
  entities: 4,
  leaves: 5,
  darkness: 6,
  vignette: 7,
  halos: 7.5,
  fireflies: 8,
  particles: 8.5,
  warnings: 9,
  doorLabel: 12,
  flying: 15,
  message: 20,
  letterbox: 27,
};

const FIREFLY_COLORS: Record<ThemeId, number> = {
  graveyard: 0xc9ffb0,
  chapel: 0xffe6a8,
  pumpkinPatch: 0xffd166,
  crypt: 0xff9a6b,
};

const GHOST_COLORS: Record<GhostKind, number> = {
  patrol: PAL.ghostPatrol,
  chase: PAL.ghostChase,
  blink: PAL.ghostBlink,
};

interface MoveKeys {
  left: Key[];
  right: Key[];
  up: Key[];
  down: Key[];
}

interface Ending {
  kind: 'won' | 'lost';
  start: number;
}

/** Candy colour from its tile, so a candy keeps its colour when others are picked up. */
function candyColorIndex(candy: Vec2): number {
  const col = Math.floor(candy.x / TILE_SIZE);
  const row = Math.floor(candy.y / TILE_SIZE);
  return Math.floor(tileHash(col, row, 9) * PAL.candyColors.length);
}

/**
 * Dev aids for screenshots and testing:
 * `?seed=N&room=R` starts directly in room R of seed N.
 * `&bossPhase=windup` puts the Pumpkin King mid wind-up. `&freeze=1` stops the room from advancing.
 * `&nobanner=1` skips the opening iris, the room banner, and the boss intro.
 */
function startState(seed: number, room: number | null, params: URLSearchParams): RunState {
  const state = roomState(seed, room, params);
  // Dev aid: `&flame=N` sets the starting flame, e.g. 1 to see the flame go out.
  const flame = Number(params.get('flame'));
  const withFlame = params.has('flame') && Number.isFinite(flame) ? { ...state, flame } : state;
  // Dev aid: `&atDoor=1` starts at the door with the candy goal met, to test room changes.
  if (!params.has('atDoor')) return withFlame;
  return { ...withFlame, player: withFlame.layout.door, candiesInRoom: withFlame.layout.candyGoal };
}

function roomState(seed: number, room: number | null, params: URLSearchParams): RunState {
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
  const goal = `Collect ${layout.candyGoal} candy, then reach the door`;
  return [THEME_NAMES[layout.theme], `Room ${roomIndex} of ${ROOM_COUNT}  ·  ${goal}`];
}

/**
 * Plays a run one room at a time. Handles the lantern light, the upgrade choice, room transitions,
 * the boss intro, the end-of-run moments, pause, touch controls, sound, and feedback effects.
 */
export class RunScene extends Phaser.Scene {
  private state!: RunState;
  /** What is on screen. Lags behind `state` while the iris closes on the old room. */
  private shown!: RunState;
  private holdShown = false;
  private mapLayer!: Phaser.GameObjects.RenderTexture;
  private themeLights: ThemeLight[] = [];
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
  private ending: Ending | null = null;
  private paused = false;
  private frozen = false;
  private skipIntros = false;
  /** True while an iris or the boss intro is playing. The room does not advance. */
  private cinematic = false;
  private introEndsAt = 0;
  private letterbox: Phaser.GameObjects.GameObject[] = [];
  private pauseLayer!: Phaser.GameObjects.Container;
  private touch: TouchControls | null = null;
  private touchFrame: TouchFrame | undefined;
  private rayCount = RAYS_DESKTOP;
  private moveKeys!: MoveKeys;
  private blowKey!: Key;
  private confirmKey!: Key;
  private pickKeys!: Key[];
  private pauseKeys!: Key[];
  private quitKey!: Key;

  // Particles.
  private embers!: Emitter;
  private smoke!: Emitter;
  private wisps!: Record<GhostKind, Emitter>;
  private leaves: Emitter | null = null;
  private nextEmberAt = 0;
  private nextWispAt = 0;
  private nextSmokeAt = 0;

  // Feedback state the core does not need to know about.
  private moving = false;
  private hurtUntil = 0;
  private doorWasOpen = false;
  private nextLowPulse = 0;
  private bossGone = false;
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
    this.shown = this.state;
    this.holdShown = false;
    this.frozen = params.has('freeze');
    this.skipIntros = params.has('nobanner');
    this.messageUntil = 0;
    this.ending = null;
    this.paused = false;
    this.cinematic = false;
    this.moving = false;
    this.hurtUntil = 0;
    this.doorWasOpen = false;
    this.nextLowPulse = 0;
    this.bossGone = false;
    this.lastBossPhase = this.state.layout.boss?.phase ?? null;
    this.lastBlinkTimers = new Map();
    this.letterbox = [];
    this.rayCount = isTouchDevice() ? RAYS_TOUCH : RAYS_DESKTOP;

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for RunScene');
    this.moveKeys = {
      left: [keyboard.addKey('A'), keyboard.addKey('LEFT')],
      right: [keyboard.addKey('D'), keyboard.addKey('RIGHT')],
      up: [keyboard.addKey('W'), keyboard.addKey('UP')],
      down: [keyboard.addKey('S'), keyboard.addKey('DOWN')],
    };
    this.blowKey = keyboard.addKey('SPACE');
    this.confirmKey = keyboard.addKey('ENTER');
    this.pickKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    this.pauseKeys = [keyboard.addKey('ESC'), keyboard.addKey('P')];
    this.quitKey = keyboard.addKey('Q');

    ensureFxTextures(this);
    this.buildMap();
    this.mapRoomIndex = this.state.roomIndex;
    this.fogLayer = this.add.graphics().setDepth(DEPTH.fog);
    this.entities = this.add.graphics().setDepth(DEPTH.entities);
    this.lantern = new Lantern(this, WIDTH, HEIGHT, DEPTH.darkness, DEPTH.halos);
    buildVignette(this, WIDTH, HEIGHT).setDepth(DEPTH.vignette);
    this.fireflies = this.add.graphics().setDepth(DEPTH.fireflies);
    this.warnings = this.add.graphics().setDepth(DEPTH.warnings);
    this.createEmitters();
    this.hud = new Hud(this);
    this.banner = new Banner(this);
    this.upgradeOverlay = new UpgradeOverlay(this);
    this.touch = isTouchDevice() ? new TouchControls(this) : null;
    addSettingsToggles(this, () => this.refreshLeaves());
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

    if (!this.skipIntros) {
      this.cinematic = true;
      irisOpen(this, this.state.player, () => this.enterRoom());
    }

    if (params.has('fps')) {
      // Dev aid: `?fps=1` shows the frame rate, to check performance on a phone.
      const fps = this.add
        .text(WIDTH / 2, 44, '', { fontFamily: FONT, fontSize: '18px', color: PAL.candyText, backgroundColor: '#000000' })
        .setOrigin(0.5, 0)
        .setDepth(80);
      this.time.addEvent({ delay: 500, loop: true, callback: () => fps.setText(`${Math.round(this.game.loop.actualFps)} FPS · ${this.rayCount} rays`) });
    }
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

    if (this.introEndsAt > 0) {
      const skip = Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.blowKey);
      if (skip || time >= this.introEndsAt) this.endBossIntro();
    }

    if (this.paused) {
      if (Phaser.Input.Keyboard.JustDown(this.quitKey)) this.scene.start('MenuScene');
    } else if (this.state.status === 'playing' && !this.frozen && !this.cinematic) {
      const dt = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const before = this.state;
      const step = stepRun(this.state, this.readInput(), dt);
      this.state = step.state;
      if (!this.holdShown) this.shown = this.state;
      this.moving = before.player.x !== this.state.player.x || before.player.y !== this.state.player.y;
      if (this.state.roomIndex === before.roomIndex) this.flyCollectedCandy(before);
      for (const event of step.events) this.onEvent(event, time);
      this.watchForCues(time);
    } else if (this.state.status === 'choosing' && this.upgradeOverlay.isOpen) {
      this.pickKeys.forEach((key, index) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.upgradeOverlay.pick(index);
      });
    }

    if (this.state.roomIndex !== this.mapRoomIndex) this.changeRoom();
    if (this.messageUntil > 0 && time > this.messageUntil) this.hideMessage();
    this.emitParticles(time);
    this.draw(time);
  }

  // ------------------------------------------------------------ rooms and moments

  private buildMap(): void {
    this.mapLayer?.destroy();
    const built = buildStaticLayer(this, this.state.layout);
    this.mapLayer = built.layer;
    this.themeLights = built.lights;
    this.refreshLeaves();
  }

  /**
   * The state has moved to the next room. Keep showing the old room while the iris closes on it,
   * swap the map while the screen is black, then open on the new room (R15.4).
   */
  private changeRoom(): void {
    this.mapRoomIndex = this.state.roomIndex;
    const oldPlayer = this.shown.player;
    this.holdShown = true;
    this.cinematic = true;
    irisTransition(
      this,
      () => oldPlayer,
      () => this.state.player,
      () => {
        this.holdShown = false;
        this.shown = this.state;
        this.doorWasOpen = false;
        this.bossGone = false;
        this.lastBossPhase = this.state.layout.boss?.phase ?? null;
        this.lastBlinkTimers = new Map();
        this.buildMap();
      },
      () => this.enterRoom(),
    );
  }

  /** Called once the screen is open on a room: shows its banner, or the boss intro. */
  private enterRoom(): void {
    if (this.state.layout.boss && !this.skipIntros) {
      this.startBossIntro();
      return;
    }
    this.cinematic = false;
    if (!this.skipIntros) this.banner.show(...roomBannerText(this.state));
  }

  /** Letterbox bars and the King's name. The room does not advance until it ends (R15.5). */
  private startBossIntro(): void {
    this.cinematic = true;
    this.introEndsAt = this.time.now + BOSS_INTRO_MS;
    playSound('bossIntro');
    const reduced = isReducedMotion();
    const top = this.add.rectangle(WIDTH / 2, LETTERBOX_PX / 2, WIDTH, LETTERBOX_PX, 0x000000, 1).setDepth(DEPTH.letterbox);
    const bottom = this.add
      .rectangle(WIDTH / 2, HEIGHT - LETTERBOX_PX / 2, WIDTH, LETTERBOX_PX, 0x000000, 1)
      .setDepth(DEPTH.letterbox);
    const name = this.add
      .text(WIDTH / 2, HEIGHT * 0.3, 'The Pumpkin King', {
        fontFamily: TITLE_FONT,
        fontSize: '72px',
        color: PAL.accentText,
        stroke: '#1b0f24',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.letterbox);
    const goal = this.add
      .text(WIDTH / 2, HEIGHT * 0.3 + 56, `Collect ${this.state.layout.candyGoal} candy and escape. Step aside when he winds up.`, {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: PAL.text,
        stroke: '#1b0f24',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.letterbox);
    // Bottom left, clear of the settings toggles in the bottom-right corner.
    const hint = this.add
      .text(16, HEIGHT - LETTERBOX_PX / 2, isTouchDevice() ? 'Tap to skip' : 'Enter to skip', {
        fontFamily: FONT,
        fontSize: '18px',
        color: PAL.textSoft,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.letterbox + 1);
    this.letterbox = [top, bottom, name, goal, hint];
    if (!reduced) {
      top.setY(-LETTERBOX_PX / 2);
      bottom.setY(HEIGHT + LETTERBOX_PX / 2);
      this.tweens.add({ targets: top, y: LETTERBOX_PX / 2, duration: 300, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: bottom, y: HEIGHT - LETTERBOX_PX / 2, duration: 300, ease: 'Cubic.easeOut' });
      name.setScale(1.25).setAlpha(0);
      this.tweens.add({ targets: name, scale: 1, alpha: 1, duration: 500, delay: 200, ease: 'Back.easeOut' });
    }
    this.input.once('pointerdown', () => this.endBossIntro());
  }

  private endBossIntro(): void {
    if (this.introEndsAt === 0) return;
    this.introEndsAt = 0;
    const parts = this.letterbox;
    this.letterbox = [];
    this.tweens.add({ targets: parts, alpha: 0, duration: 250, onComplete: () => parts.forEach((p) => p.destroy()) });
    this.cinematic = false;
  }

  /**
   * Flame out: the light shrinks to nothing and smoke rises (R15.3).
   * Win: the room floods with light and the King vanishes. Both then fade to the result screen.
   */
  private startEnding(kind: 'won' | 'lost'): void {
    if (this.ending) return;
    this.ending = { kind, start: this.time.now };
    const data: ResultData = {
      status: kind,
      roomsCleared: this.state.roomsCleared,
      runScore: this.state.runScore,
      upgrades: [...this.state.upgrades],
    };
    recordRunScore(data.runScore);
    if (kind === 'lost') {
      playSound('flameOut');
      this.time.delayedCall(ENDING_MS * 0.35, () => this.showMessage('The flame went out', this.time.now, Infinity));
    } else {
      playSound('runEnd');
      const boss = this.state.layout.boss;
      if (boss) {
        burst(this, boss.pos.x, boss.pos.y, PAL.pumpkin, 30);
        ring(this, boss.pos.x, boss.pos.y, PAL.candle, 140);
      }
      this.bossGone = true;
      this.showMessage('The Pumpkin King retreats!', this.time.now, Infinity);
    }
    this.time.delayedCall(ENDING_MS, () => {
      this.cameras.main.fadeOut(ENDING_FADE_MS, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('ResultScene', data));
    });
  }

  /** 0 to 1 through the ending moment, or -1 when there is none. */
  private endingProgress(time: number): number {
    return this.ending ? Math.min(1, (time - this.ending.start) / ENDING_MS) : -1;
  }

  // ------------------------------------------------------------ input and events

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
        if (event.room !== ROOM_COUNT) this.showMessage(`Room ${event.room} cleared`, time, MESSAGE_SECONDS);
        playSound('roomClear');
        break;
      case 'upgradeOffered':
        this.upgradeOverlay.show(event.choices, (id) => this.pickUpgrade(id));
        break;
      case 'runLost':
      case 'runWon':
        this.startEnding(event.type === 'runWon' ? 'won' : 'lost');
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

  /** Each candy picked up this frame flies to the HUD counter, which pops when it lands (R15.7). */
  private flyCollectedCandy(before: RunState): void {
    const remaining = new Set(this.state.layout.candies);
    for (const candy of before.layout.candies) {
      if (remaining.has(candy)) continue;
      if (isReducedMotion()) continue;
      const icon = this.add.image(candy.x, candy.y, TEX.candy(candyColorIndex(candy))).setDepth(DEPTH.flying);
      const target = this.hud.candyTarget;
      this.tweens.add({
        targets: icon,
        x: target.x,
        y: target.y,
        scale: 0.55,
        duration: 480,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          icon.destroy();
          this.hud.bumpCandy();
        },
      });
    }
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

  // ------------------------------------------------------------ particles

  private createEmitters(): void {
    this.embers = this.add.particles(0, 0, TEX.spark, {
      emitting: false,
      lifespan: { min: 500, max: 900 },
      speedX: { min: -18, max: 18 },
      speedY: { min: -55, max: -25 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [PAL.candle, PAL.pumpkin, PAL.ember],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.embers.setDepth(DEPTH.particles);

    this.smoke = this.add.particles(0, 0, TEX.smoke, {
      emitting: false,
      lifespan: 1500,
      speedX: { min: -10, max: 10 },
      speedY: { min: -32, max: -16 },
      scale: { start: 0.5, end: 2.2 },
      alpha: { start: 0.55, end: 0 },
      tint: 0xa69fb8,
    });
    this.smoke.setDepth(DEPTH.particles);

    const wisp = (color: number): Emitter => {
      const emitter = this.add.particles(0, 0, TEX.smoke, {
        emitting: false,
        lifespan: 650,
        speedX: { min: -6, max: 6 },
        speedY: { min: 4, max: 14 },
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0.35, end: 0 },
        tint: color,
        blendMode: Phaser.BlendModes.ADD,
      });
      emitter.setDepth(DEPTH.particles);
      return emitter;
    };
    this.wisps = { patrol: wisp(GHOST_COLORS.patrol), chase: wisp(GHOST_COLORS.chase), blink: wisp(GHOST_COLORS.blink) };
  }

  /** Graveyard leaves fall under the darkness, so they only show inside the light (R15.8). */
  private refreshLeaves(): void {
    this.leaves?.destroy();
    this.leaves = null;
    if (!this.state || this.state.layout.theme !== 'graveyard' || isReducedMotion()) return;
    this.leaves = this.add.particles(0, -10, TEX.leaf, {
      x: { min: 0, max: WIDTH },
      lifespan: 22000,
      speedY: { min: 16, max: 28 },
      speedX: { min: -14, max: 14 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.8, max: 1.3 },
      tint: [0xa2683a, 0xc0562b, 0x8c8a3a],
      frequency: 450,
      advance: 18000,
    });
    this.leaves.setDepth(DEPTH.leaves);
  }

  private emitParticles(time: number): void {
    if (isReducedMotion() || this.paused) return;
    const { player, layout } = this.shown;
    const progress = this.endingProgress(time);

    if (this.ending?.kind === 'lost') {
      if (time >= this.nextSmokeAt && progress < 0.95) {
        this.smoke.emitParticleAt(player.x, player.y - 12, 1);
        this.nextSmokeAt = time + SMOKE_EVERY_MS;
      }
      return;
    }

    if (time >= this.nextEmberAt && this.state.flame > 0) {
      this.embers.emitParticleAt(player.x + (Math.random() - 0.5) * 8, player.y - 12, 1);
      this.nextEmberAt = time + (this.moving ? EMBER_EVERY_MS : EMBER_IDLE_EVERY_MS);
    }

    if (time >= this.nextWispAt) {
      for (const ghost of layout.ghosts) {
        if (ghost.kind === 'blink' && ghost.blinkTimer < BLINK_WARN_SEC) continue;
        this.wisps[ghost.kind].emitParticleAt(ghost.pos.x, ghost.pos.y + GHOST_DRAW_RADIUS * 0.8, 1);
      }
      this.nextWispAt = time + WISP_EVERY_MS;
    }
  }

  // ------------------------------------------------------------ pause

  private setPaused(value: boolean): void {
    // Pausing only makes sense during a room. The upgrade choice and the end of the run ignore it.
    if (value && (this.state.status !== 'playing' || this.ending)) return;
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

  // ------------------------------------------------------------ messages

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

  // ------------------------------------------------------------ drawing

  private draw(time: number): void {
    const t = animTime(time);
    const view = this.shown;
    const { layout, player, flame } = view;
    const g = this.entities;
    g.clear();
    this.warnings.clear();
    const sources: LightSource[] = [];
    const progress = this.endingProgress(time);
    const lost = this.ending?.kind === 'lost';
    const won = this.ending?.kind === 'won';
    // On a loss every light dims with the lantern.
    const dim = lost ? 1 - progress : 1;

    // Theme lights, with a gentle flicker of their own.
    this.themeLights.forEach((light, i) => {
      const flicker = 1 + Math.sin(t * 0.007 + i * 1.9) * 0.06;
      sources.push({
        pos: light.pos,
        radius: light.radius * flicker,
        strength: light.strength * dim,
        halo: { radius: light.radius * 0.8 * flicker, color: light.color, alpha: light.haloAlpha * dim },
      });
    });

    // Door.
    const needed = Math.max(0, layout.candyGoal - view.candiesInRoom);
    const doorOpen = needed === 0;
    const doorX = layout.doorTile.col * TILE_SIZE;
    const doorY = layout.doorTile.row * TILE_SIZE;
    drawDoor(g, doorX, doorY, TILE_SIZE, t, doorOpen);
    sources.push({
      pos: layout.door,
      radius: doorOpen ? 80 : 42,
      strength: (doorOpen ? 0.95 : 0.55) * dim,
      halo: doorOpen ? { radius: 70, color: PAL.candle, alpha: 0.55 * dim } : undefined,
    });
    this.setDoorLabel(
      doorOpen ? 'DOOR OPEN' : `NEED ${needed} MORE CANDY`,
      doorOpen ? PAL.candyText : PAL.text,
      doorX + TILE_SIZE / 2,
      doorY - 4,
    );
    this.doorLabel.setVisible(!this.ending);

    // Candy.
    for (const candy of layout.candies) {
      const color = PAL.candyColors[candyColorIndex(candy)];
      drawCandy(g, candy.x, candy.y, color, t, candy.x * 0.05);
      sources.push({ pos: candy, radius: 28, strength: 0.5 * dim, halo: { radius: 26, color, alpha: 0.45 * dim } });
    }

    // Ghosts, with cues for what they are about to do.
    for (const ghost of layout.ghosts) {
      const fade =
        ghost.kind === 'blink' && ghost.blinkTimer < BLINK_WARN_SEC ? 1 - ghost.blinkTimer / BLINK_WARN_SEC : 0;
      drawGhost(g, ghost.pos.x, ghost.pos.y, GHOST_DRAW_RADIUS, ghost.kind, t, ghost.id * 2.1, {
        chasing: !this.ending && isChasing(ghost, player),
        fade,
      });
      const glow = (1 - fade) * dim;
      sources.push({
        pos: ghost.pos,
        radius: 46,
        strength: 0.6 * glow,
        halo: { radius: 38, color: GHOST_COLORS[ghost.kind], alpha: 0.4 * glow },
      });
    }

    // The Pumpkin King, and the warning line before a dash.
    const boss = layout.boss;
    if (boss && !this.bossGone) {
      drawPumpkinKing(g, boss.pos.x, boss.pos.y, BOSS_DRAW_RADIUS, time, boss.phase, boss.dashDir);
      const intro = this.introEndsAt > 0;
      const windup = boss.phase === 'windup';
      sources.push({
        pos: boss.pos,
        radius: intro ? 140 : 96,
        strength: 0.9 * dim,
        // Wide but faint during the intro, so the light frames the King without washing out his face.
        halo: {
          radius: intro ? 150 : windup ? 110 : 84,
          color: windup ? PAL.danger : PAL.pumpkin,
          alpha: (intro ? 0.38 : 0.6) * dim,
        },
      });
      if (windup && !this.ending) {
        const reach = BOSS_DASH_SPEED * BOSS_DASH_SEC + BOSS_RADIUS;
        drawDashWarning(this.warnings, boss.pos, boss.dashDir, reach, 1 - boss.phaseTimer / BOSS_WINDUP_SEC);
      }
    }

    // Player.
    const flame01 = lost ? 0 : flame / FLAME_MAX;
    const bob = this.moving && !this.ending ? -Math.abs(Math.sin(t * 0.016)) * BOB_PX : 0;
    const flash = Math.max(0, (this.hurtUntil - time) / HURT_FLASH_MS);
    drawPumpkin(g, player.x, player.y + bob, PLAYER_DRAW_RADIUS, flame01, t, 0, flash);
    // A wide, faint halo: enough to glow without washing out the pumpkin's face.
    sources.push({ pos: player, radius: 0, strength: 0, halo: { radius: 56 + 34 * flame01, color: PAL.pumpkin, alpha: 0.2 * dim } });

    this.fogLayer.clear();
    drawFog(this.fogLayer, WIDTH, HEIGHT, t, 0.07);

    const flicker = 1 + Math.sin(t * 0.006) * 0.025 + Math.sin(t * 0.011) * 0.015;
    // The lantern shrinks to nothing as the flame goes out (R15.3).
    const radius = lightRadius(flame) * flicker * (lost ? (1 - progress) ** 1.5 : 1);
    this.lantern.update({
      grid: layout.grid,
      player,
      radius,
      sources,
      darkness: won ? DARKNESS_ALPHA * (1 - progress) : lost ? DARKNESS_ALPHA + (0.97 - DARKNESS_ALPHA) * progress : undefined,
      rayCount: this.rayCount,
    });

    this.fireflies.clear();
    if (!isReducedMotion() && !lost) {
      drawFireflies(this.fireflies, WIDTH, HEIGHT, time, FIREFLY_COUNT, FIREFLY_COLORS[layout.theme]);
    }

    this.drawMessagePanel();
    this.hud.update(view, t);
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
