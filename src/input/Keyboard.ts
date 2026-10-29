import Phaser from 'phaser';
import { keysToVector } from '../systems/joystick';
import type { Vec2 } from '../systems/vector';

/** WASD und Pfeiltasten für den Desktop. */
export class KeyboardControls {
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'e' | 'enter', Phaser.Input.Keyboard.Key> | null;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    this.keys = kb
      ? (kb.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.UP,
          down: Phaser.Input.Keyboard.KeyCodes.DOWN,
          left: Phaser.Input.Keyboard.KeyCodes.LEFT,
          right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
          w: Phaser.Input.Keyboard.KeyCodes.W,
          a: Phaser.Input.Keyboard.KeyCodes.A,
          s: Phaser.Input.Keyboard.KeyCodes.S,
          d: Phaser.Input.Keyboard.KeyCodes.D,
          space: Phaser.Input.Keyboard.KeyCodes.SPACE,
          e: Phaser.Input.Keyboard.KeyCodes.E,
          enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        }) as KeyboardControls['keys'])
      : null;
  }

  read(): Vec2 {
    const k = this.keys;
    if (!k) return { x: 0, y: 0 };
    return keysToVector(
      k.left.isDown || k.a.isDown,
      k.right.isDown || k.d.isDown,
      k.up.isDown || k.w.isDown,
      k.down.isDown || k.s.isDown,
    );
  }

  /** Leertaste: einmal pro Drücken. */
  firePressed(): boolean {
    return this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.space) : false;
  }

  /** E oder Enter: Aktion im Riff (reden, einziehen lassen, tauchen). */
  actionPressed(): boolean {
    return this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.e) || Phaser.Input.Keyboard.JustDown(this.keys.enter) : false;
  }
}
