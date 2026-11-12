import Phaser from 'phaser';
import { FLAME_MAX, MAP_COLS, MAP_ROWS, TILE_SIZE } from '../core/config';
import { generateRoom } from '../core/room';
import { chooseUpgrade, createRun, stepRun } from '../core/run';
import type { RoomIndex, RunEvent, RunInput, RunState } from '../core/run';
import type { Vec2 } from '../core/types';
import { UPGRADE_IDS } from '../core/upgrades';
import type { UpgradeId } from '../core/upgrades';
import { playSound } from '../audio/sfx';
import { recordRunScore } from '../storage/bestScore';
import { drawCandy, drawDoor, drawFog, drawGhost, drawPumpkin, drawPumpkinKing } from '../ui/drawing';
import { burst, flashScreen, ring, transition } from '../ui/fx';
import { Hud } from '../ui/Hud';
import { buildStaticLayer, buildVignette } from '../ui/map';
import { FONT, PAL } from '../ui/palette';
import { addSoundToggle } from '../ui/SoundToggle';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { UpgradeOverlay } from '../ui/UpgradeOverlay';
import type { ResultData } from './ResultScene';

type Key = Phaser.Input.Keyboard.Key;

const WIDTH = MAP_COLS * TILE_SIZE;
const HEIGHT = MAP_ROWS * TILE_SIZE;
const MAX_FRAME_SECONDS = 0.05;
const MESSAGE_SECONDS = 2.5;
const ENDING_DELAY_MS = 1400;
const PLAYER_DRAW_RADIUS = 15;
const GHOST_DRAW_RADIUS = 14;
const BOSS_DRAW_RADIUS = 24;

interface MoveKeys {
  left: Key[];
  right: Key[];
  up: Key[];
  down: Key[];
}

/**
 * Dev aid for screenshots and testing: `?seed=N&room=R` starts directly in room R of seed N.
 * Without these parameters the run starts normally from room 1 with a random seed.
 */
function startState(seed: number, room: number | null): RunState {
  if (room === null || room < 1 || room > 4) return createRun(seed);
  const roomIndex = room as RoomIndex;
  const layout = generateRoom(roomIndex, seed);
  return { ...createRun(seed), roomIndex, roomsCleared: roomIndex - 1, layout, player: layout.start };
}

/**
 * Plays a run one room at a time. Handles the upgrade choice, room transitions, pause,
 * touch controls, sound, and the end of the run.
 */
export class RunScene extends Phaser.Scene {
  private state!: RunState;
  private mapLayer!: Phaser.GameObjects.RenderTexture;
  private mapRoomIndex = 0;
  private fogLayer!: Phaser.GameObjects.Graphics;
  private entities!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private upgradeOverlay!: UpgradeOverlay;
  private messagePanel!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.Text;
  private doorLabel!: Phaser.GameObjects.Text;
  private doorLabelText = '';
  private messageUntil = 0;
  private ending = false;
  private paused = false;
  private pauseLayer!: Phaser.GameObjects.Container;
  private touch: TouchControls | null = null;
  private moveKeys!: MoveKeys;
  private blowKey!: Key;
  private pickKeys!: Key[];
  private pauseKeys!: Key[];
  private quitKey!: Key;

  constructor() {
    super('RunScene');
  }

  create(data: { seed?: number } = {}): void {
    const params = new URLSearchParams(window.location.search);
    const seed = data.seed ?? (Number(params.get('seed')) || Math.floor(Math.random() * 0xffffffff));
    const room = params.has('room') ? Number(params.get('room')) : null;
    this.state = startState(seed, room);
    this.messageUntil = 0;
    this.ending = false;
    this.paused = false;

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
    this.fogLayer = this.add.graphics().setDepth(2);
    this.entities = this.add.graphics().setDepth(4);
    buildVignette(this, WIDTH, HEIGHT);
    this.hud = new Hud(this);
    this.upgradeOverlay = new UpgradeOverlay(this);
    this.touch = isTouchDevice() ? new TouchControls(this) : null;
    addSoundToggle(this);
    this.createPauseLayer();
    this.listenForHidden();

    if (params.has('choose')) {
      // Dev aid: open the upgrade cards straight away.
      this.upgradeOverlay.show(UPGRADE_IDS.slice(0, 3), (id) => this.pickUpgrade(id));
    }

    this.messagePanel = this.add.graphics().setDepth(20);
    this.messageText = this.add
      .text(WIDTH / 2, HEIGHT / 2, '', {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: 'bold',
        color: PAL.textHex,
        stroke: '#1b0f24',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);

    this.doorLabel = this.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: PAL.textHex,
        stroke: '#1b0f24',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(12);
  }

  update(time: number, deltaMs: number): void {
    if (this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) this.setPaused(!this.paused);

    if (this.paused) {
      if (Phaser.Input.Keyboard.JustDown(this.quitKey)) this.scene.start('MenuScene');
    } else if (this.state.status === 'playing') {
      const dt = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const before = this.state.player;
      const step = stepRun(this.state, this.readInput(), dt);
      this.state = step.state;
      for (const event of step.events) this.onEvent(event, time, before);
    } else if (this.state.status === 'choosing' && this.upgradeOverlay.isOpen) {
      this.pickKeys.forEach((key, index) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.upgradeOverlay.pick(index);
      });
    }

    if (this.state.roomIndex !== this.mapRoomIndex) {
      // Mark the room as shown now, so the swap runs once. The new map is built while the screen is dark.
      this.mapRoomIndex = this.state.roomIndex;
      transition(this, () => this.buildMap());
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
    const touch = this.touch?.read();
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

  private onEvent(event: RunEvent, time: number, at: Vec2): void {
    switch (event.type) {
      case 'candyCollected':
        burst(this, at.x, at.y, PAL.candy, 12);
        playSound('candy');
        break;
      case 'blowUsed':
        ring(this, at.x, at.y, PAL.candy, 130);
        ring(this, at.x, at.y, 0xffffff, 80);
        playSound('blow');
        break;
      case 'ghostHit':
        this.cameras.main.shake(140, 0.006);
        flashScreen(this, PAL.danger, 0.3);
        playSound('hit');
        break;
      case 'bossHit':
        this.cameras.main.shake(180, 0.008);
        flashScreen(this, PAL.danger, 0.35);
        playSound('bossHit');
        break;
      case 'roomCleared':
        burst(this, at.x, at.y, PAL.accent, 26);
        this.showMessage(`ROOM ${event.room} CLEARED`, time, MESSAGE_SECONDS);
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
    const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, PAL.ink, 0.7);
    const title = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 24, 'PAUSED', {
        fontFamily: FONT,
        fontSize: '52px',
        fontStyle: 'bold',
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
        color: PAL.textHex,
        stroke: '#1b0f24',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.pauseLayer = this.add.container(0, 0, [dim, title, hint]).setDepth(60).setVisible(false);
  }

  private showMessage(text: string, time: number, seconds: number): void {
    this.messageText.setText(text).setVisible(true);
    this.messageUntil = seconds === Infinity ? Number.MAX_SAFE_INTEGER : time + seconds * 1000;
  }

  private setDoorLabel(text: string, x: number, y: number): void {
    if (text !== this.doorLabelText) {
      this.doorLabelText = text;
      this.doorLabel.setText(text);
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
    const { layout, player, flame } = this.state;
    const g = this.entities;
    g.clear();

    const needed = Math.max(0, layout.candyGoal - this.state.candiesInRoom);
    const doorOpen = needed === 0;
    const doorX = layout.doorTile.col * TILE_SIZE;
    const doorY = layout.doorTile.row * TILE_SIZE;
    drawDoor(g, doorX, doorY, TILE_SIZE, time, doorOpen);
    this.setDoorLabel(doorOpen ? 'DOOR OPEN' : `NEED ${needed} MORE CANDY`, doorX + TILE_SIZE / 2, doorY - 4);
    layout.candies.forEach((candy, i) => {
      drawCandy(g, candy.x, candy.y, PAL.candyColors[i % PAL.candyColors.length], time, i * 1.7);
    });
    for (const ghost of layout.ghosts) {
      drawGhost(g, ghost.pos.x, ghost.pos.y, GHOST_DRAW_RADIUS, ghost.kind, time, ghost.id * 2.1);
    }
    if (layout.boss) {
      drawPumpkinKing(g, layout.boss.pos.x, layout.boss.pos.y, BOSS_DRAW_RADIUS, time);
    }
    drawPumpkin(g, player.x, player.y, PLAYER_DRAW_RADIUS, flame / FLAME_MAX, time);

    this.fogLayer.clear();
    drawFog(this.fogLayer, WIDTH, HEIGHT, time, 0.07);

    this.drawMessagePanel();
    this.hud.update(this.state, time);
  }

  private drawMessagePanel(): void {
    this.messagePanel.clear();
    if (!this.messageText.visible) return;
    const w = this.messageText.width + 56;
    const h = this.messageText.height + 36;
    const x = WIDTH / 2 - w / 2;
    const y = HEIGHT / 2 - h / 2;
    this.messagePanel.fillStyle(PAL.ink, 0.88);
    this.messagePanel.fillRoundedRect(x, y, w, h, 18);
    this.messagePanel.lineStyle(3, PAL.pumpkin, 1);
    this.messagePanel.strokeRoundedRect(x, y, w, h, 18);
  }
}
