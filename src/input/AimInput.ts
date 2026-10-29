import Phaser from 'phaser';
import { inRect, joystickZone, orientationOf } from '../systems/joystick';
import type { Vec2 } from '../systems/vector';

/**
 * Zielen und Schießen.
 * Hochkant: kurz tippen, Ziel = Tippstelle (in der Joystick-Zone über TouchJoystick.onTap).
 * Quer: rechter Daumen zieht zum Zielen, loslassen schießt.
 * Maus: Klick schießt auf den Mauszeiger.
 */
export class AimInput {
  /** Wurde schon einmal geschossen? (für den Einstiegshinweis) */
  used = false;
  /** Bildschirmposition, solange quer gezielt wird. */
  aiming: Vec2 | null = null;

  private pending: Vec2 | null = null;
  private aimPointerId: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    });
  }

  /** Schuss in Weltkoordinaten anfordern (z. B. Leertaste). */
  fireAtWorld(point: Vec2): void {
    const cam = this.scene.cameras.main;
    this.pending = { x: point.x - cam.scrollX, y: point.y - cam.scrollY };
    this.used = true;
  }

  /** Schuss auf eine Bildschirmposition (z. B. Tipp in der Joystick-Zone). */
  fireAtScreen(point: Vec2): void {
    this.pending = { x: point.x, y: point.y };
    this.used = true;
  }

  /** Holt einen angeforderten Schuss als Weltposition ab. */
  take(): Vec2 | null {
    if (!this.pending) return null;
    const cam = this.scene.cameras.main;
    const p = { x: this.pending.x + cam.scrollX, y: this.pending.y + cam.scrollY };
    this.pending = null;
    return p;
  }

  release(): void {
    this.pending = null;
    this.aiming = null;
    this.aimPointerId = null;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const { width, height } = this.scene.scale;
    if (pointer.wasTouch && inRect(joystickZone(width, height), pointer.x, pointer.y)) return;
    if (!pointer.wasTouch || orientationOf(width, height) === 'portrait') {
      this.pending = { x: pointer.x, y: pointer.y };
      this.used = true;
      return;
    }
    if (this.aimPointerId !== null) return;
    this.aimPointerId = pointer.id;
    this.aiming = { x: pointer.x, y: pointer.y };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.aimPointerId) this.aiming = { x: pointer.x, y: pointer.y };
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.aimPointerId) return;
    this.pending = this.aiming;
    this.used = true;
    this.aiming = null;
    this.aimPointerId = null;
  }
}
