import Phaser from 'phaser';
import type { RunInput } from '../core/run';
import type { Vec2 } from '../core/types';
import { FONT, PAL } from './palette';

const JOY_RADIUS = 60;
const KNOB_RADIUS = 26;
const BLOW_RADIUS = 46;
const EDGE_MARGIN = 110;

/** True on touch devices, or when the URL has `?touch` (for testing on a desktop). */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || new URLSearchParams(window.location.search).has('touch');
}

/**
 * On-screen joystick (bottom left) and blow button (bottom right) for touch devices.
 * Movement is held while the finger is down. Blow fires once per tap.
 */
export class TouchControls {
  private readonly joyCenter: Vec2;
  private readonly blowCenter: Vec2;
  private readonly knob: Phaser.GameObjects.Arc;
  private joyPointer: number | null = null;
  private move: Vec2 = { x: 0, y: 0 };
  private blowPressed = false;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.joyCenter = { x: EDGE_MARGIN, y: height - EDGE_MARGIN };
    this.blowCenter = { x: width - EDGE_MARGIN, y: height - EDGE_MARGIN };

    scene.add
      .circle(this.joyCenter.x, this.joyCenter.y, JOY_RADIUS, PAL.ink, 0.45)
      .setStrokeStyle(3, PAL.pumpkin, 0.7)
      .setDepth(40);
    this.knob = scene.add.circle(this.joyCenter.x, this.joyCenter.y, KNOB_RADIUS, PAL.pumpkin, 0.8).setDepth(41);

    scene.add
      .circle(this.blowCenter.x, this.blowCenter.y, BLOW_RADIUS, PAL.candy, 0.35)
      .setStrokeStyle(3, PAL.candy, 0.8)
      .setDepth(40);
    scene.add
      .text(this.blowCenter.x, this.blowCenter.y, 'BLOW', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: PAL.textHex,
        stroke: '#1b0f24',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(41);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
    });
  }

  /** Returns the current movement and clears the pending blow tap. */
  read(): Pick<RunInput, 'move' | 'blow'> {
    const blow = this.blowPressed;
    this.blowPressed = false;
    return { move: this.move, blow };
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (distance(pointer, this.blowCenter) <= BLOW_RADIUS) {
      this.blowPressed = true;
      return;
    }
    if (this.joyPointer === null && distance(pointer, this.joyCenter) <= JOY_RADIUS * 1.5) {
      this.joyPointer = pointer.id;
      this.updateJoystick(pointer);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joyPointer) this.updateJoystick(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joyPointer) return;
    this.joyPointer = null;
    this.move = { x: 0, y: 0 };
    this.knob.setPosition(this.joyCenter.x, this.joyCenter.y);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.joyCenter.x;
    const dy = pointer.y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    const scale = len > JOY_RADIUS ? JOY_RADIUS / len : 1;
    const x = dx * scale;
    const y = dy * scale;
    this.move = { x: x / JOY_RADIUS, y: y / JOY_RADIUS };
    this.knob.setPosition(this.joyCenter.x + x, this.joyCenter.y + y);
  }
}

function distance(pointer: Phaser.Input.Pointer, center: Vec2): number {
  return Math.hypot(pointer.x - center.x, pointer.y - center.y);
}
