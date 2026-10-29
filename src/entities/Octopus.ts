import Phaser from 'phaser';
import { createSwimmer, stepSwimmer, type Bounds, type SwimmerState } from '../systems/movement';
import { approachFactor } from '../systems/camera';
import { clamp, lerp, type Vec2 } from '../systems/vector';
import type { PlayerDef } from '../data';

export const animKey = (player: PlayerDef, name: string): string => `${player.id}_${name}`;

/** Legt die Animationen aus data/player.json an (Reihen im Spritesheet). */
export function createOctopusAnimations(scene: Phaser.Scene, player: PlayerDef): void {
  const texture = scene.textures.get(player.sprite);
  const cols = Math.floor(texture.getSourceImage().width / player.frameWidth);
  for (const a of player.animations) {
    const key = animKey(player, a.key);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(player.sprite, {
        start: a.row * cols,
        end: a.row * cols + a.frames - 1,
      }),
      frameRate: a.fps,
      repeat: a.repeat,
    });
  }
}

/**
 * Der Spieler-Oktopus. Bewegung läuft im festen Takt über systems/movement.ts,
 * gezeichnet wird interpoliert, dazu Neigung und Squash als reine Optik.
 */
export class Octopus {
  readonly sprite: Phaser.GameObjects.Sprite;
  private prev: SwimmerState;
  private curr: SwimmerState;
  private squash = 0;
  private tilt = 0;
  private turning = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly def: PlayerDef,
    private readonly bounds: Bounds,
    private readonly stepDt: number,
  ) {
    this.curr = createSwimmer(x, y);
    this.prev = this.curr;
    this.sprite = scene.add.sprite(x, y, def.sprite, 0).setScale(def.scale).setDepth(10);
    this.sprite.play(animKey(def, 'idle'));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.turning = false;
    });
  }

  get state(): SwimmerState {
    return this.curr;
  }

  /** Ein fester Physik-Schritt. */
  step(input: Vec2, dt: number): void {
    this.prev = this.curr;
    this.curr = stepSwimmer(this.curr, input, this.def.movement, this.bounds, dt);
  }

  /** Interpolierte Position für die Darstellung. */
  renderPosition(alpha: number): Vec2 {
    return { x: lerp(this.prev.x, this.curr.x, alpha), y: lerp(this.prev.y, this.curr.y, alpha) };
  }

  render(alpha: number, frameDt: number): void {
    const pos = this.renderPosition(alpha);
    const s = this.curr;
    const d = this.def;
    this.sprite.setPosition(pos.x, pos.y);

    // Umdrehen mit kurzer Dreh-Animation.
    const flip = s.facing === -1;
    if (flip !== this.sprite.flipX) {
      this.sprite.setFlipX(flip);
      this.turning = true;
      this.sprite.play(animKey(d, 'turn'));
    }

    const speed = Math.hypot(s.vx, s.vy);
    if (!this.turning) {
      const anim = speed > d.swimAnimationMinSpeed ? 'swim' : 'idle';
      this.sprite.play(animKey(d, anim), true);
    }

    // In Schwimmrichtung lehnen.
    const k = approachFactor(d.squash.rate, frameDt);
    const targetTilt = clamp(s.vx * d.tilt.perSpeed, -d.tilt.maxDegrees, d.tilt.maxDegrees);
    this.tilt += (targetTilt - this.tilt) * k;
    this.sprite.setAngle(this.tilt);

    // Squash & Stretch aus der Beschleunigung des letzten Schritts.
    const ax = Math.abs(s.vx - this.prev.vx) / this.stepDt;
    const ay = Math.abs(s.vy - this.prev.vy) / this.stepDt;
    const targetSquash = clamp((ay - ax) * d.squash.perAcceleration, -d.squash.amount, d.squash.amount);
    this.squash += (targetSquash - this.squash) * k;
    this.sprite.setScale(d.scale * (1 - this.squash), d.scale * (1 + this.squash));
  }
}
