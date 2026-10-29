import Phaser from 'phaser';
import { inRect, isTap, joystickZone, orientationOf, readStick, type JoystickParams, type TapParams } from '../systems/joystick';
import type { Vec2 } from '../systems/vector';
import type { Insets } from '../ui/safeArea';
import type { JoystickView } from '../ui/JoystickView';

/**
 * Schwebender Joystick: erscheint dort, wo der Daumen in der Joystick-Zone aufsetzt
 * (hochkant untere Hälfte, quer linke Hälfte). Ohne Berührung ruht er sichtbar am Rand.
 */
export class TouchJoystick {
  value: Vec2 = { x: 0, y: 0 };
  /** Wurde der Joystick schon einmal benutzt? (für den Einstiegshinweis) */
  used = false;

  /** Wird bei einem kurzen Tipp in der Joystick-Zone aufgerufen (Bildschirmkoordinaten). */
  onTap: ((point: Vec2) => void) | null = null;

  private pointerId: number | null = null;
  private downAt = 0;
  private start: Vec2 = { x: 0, y: 0 };
  private maxMoved = 0;
  private origin: Vec2 = { x: 0, y: 0 };
  private rest: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: JoystickView,
    private readonly params: JoystickParams & { restMargin: number; tap: TapParams },
  ) {
    const input = scene.input;
    input.addPointer(2);
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.release, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
      input.off(Phaser.Input.Events.GAME_OUT, this.release, this);
    });
  }

  /** Ruheposition neu berechnen (nach Größen- oder Ausrichtungswechsel). */
  layout(width: number, height: number, safe: Insets): void {
    const m = this.params.restMargin;
    this.rest =
      orientationOf(width, height) === 'portrait'
        ? { x: width / 2, y: height - safe.bottom - m }
        : { x: safe.left + m, y: height - safe.bottom - m };
    if (this.pointerId === null) this.view.show(this.rest, { x: 0, y: 0 }, false);
  }

  get restPosition(): Vec2 {
    return this.rest;
  }

  release(): void {
    this.pointerId = null;
    this.value = { x: 0, y: 0 };
    this.view.show(this.rest, { x: 0, y: 0 }, false);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    // Maus steuert nicht den Joystick, sie zielt (Desktop nutzt WASD).
    if (this.pointerId !== null || !pointer.wasTouch) return;
    const { width, height } = this.scene.scale;
    if (!inRect(joystickZone(width, height), pointer.x, pointer.y)) return;
    this.pointerId = pointer.id;
    this.origin = { x: pointer.x, y: pointer.y };
    this.start = { x: pointer.x, y: pointer.y };
    this.downAt = this.scene.time.now;
    this.maxMoved = 0;
    this.view.show(this.origin, { x: 0, y: 0 }, true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.maxMoved = Math.max(this.maxMoved, Math.hypot(pointer.x - this.start.x, pointer.y - this.start.y));
    if (this.maxMoved > this.params.tap.maxMove) this.used = true;
    const reading = readStick(this.origin, { x: pointer.x, y: pointer.y }, this.params);
    this.origin = reading.origin;
    this.value = reading.value;
    this.view.show(this.origin, reading.knob, true);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const tap = isTap(this.scene.time.now - this.downAt, this.maxMoved, this.params.tap);
    this.release();
    if (tap) this.onTap?.({ x: pointer.x, y: pointer.y });
  }
}
