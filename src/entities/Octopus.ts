import Phaser from 'phaser';
import type { SwimmerState } from '../systems/movement';
import { approachFactor } from '../systems/camera';
import { clamp, lerp, type Vec2 } from '../systems/vector';
import type { AnimationDef, PlayerDef } from '../data';

export const animKey = (prefix: string, name: string): string => `${prefix}_${name}`;

/** Legt Animationen aus Spritesheet-Reihen an (eine Reihe pro Animation, siehe Asset-Regeln). */
export function createSheetAnimations(
  scene: Phaser.Scene,
  texture: string,
  frameWidth: number,
  prefix: string,
  animations: readonly AnimationDef[],
): void {
  const cols = Math.floor(scene.textures.get(texture).getSourceImage().width / frameWidth);
  for (const a of animations) {
    const key = animKey(prefix, a.key);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { start: a.row * cols, end: a.row * cols + a.frames - 1 }),
      frameRate: a.fps,
      repeat: a.repeat,
    });
  }
}

export const lerpPos = (prev: Vec2, curr: Vec2, alpha: number): Vec2 => ({
  x: lerp(prev.x, curr.x, alpha),
  y: lerp(prev.y, curr.y, alpha),
});

/**
 * Darstellung des Spieler-Oktopus. Die Bewegung rechnet systems/dive.ts,
 * hier kommen Interpolation, Animation, Neigung und Squash dazu.
 */
export class Octopus {
  readonly sprite: Phaser.GameObjects.Sprite;
  private squash = 0;
  private tilt = 0;
  private turning = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly def: PlayerDef,
    private readonly stepDt: number,
  ) {
    this.sprite = scene.add.sprite(x, y, def.sprite, 0).setScale(def.scale).setDepth(10);
    this.sprite.play(animKey(def.id, 'idle'));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.turning = false;
    });
  }

  /** Kurze Greif-Animation, z. B. beim Schuss. */
  playCatch(): void {
    this.turning = true;
    this.sprite.play(animKey(this.def.id, 'catch'));
  }

  render(prev: SwimmerState, curr: SwimmerState, alpha: number, frameDt: number): Vec2 {
    const pos = lerpPos(prev, curr, alpha);
    const d = this.def;
    this.sprite.setPosition(pos.x, pos.y);

    const flip = curr.facing === -1;
    if (flip !== this.sprite.flipX) {
      this.sprite.setFlipX(flip);
      this.turning = true;
      this.sprite.play(animKey(d.id, 'turn'));
    }

    const speed = Math.hypot(curr.vx, curr.vy);
    if (!this.turning) this.sprite.play(animKey(d.id, speed > d.swimAnimationMinSpeed ? 'swim' : 'idle'), true);

    const k = approachFactor(d.squash.rate, frameDt);
    const targetTilt = clamp(curr.vx * d.tilt.perSpeed, -d.tilt.maxDegrees, d.tilt.maxDegrees);
    this.tilt += (targetTilt - this.tilt) * k;
    this.sprite.setAngle(this.tilt);

    const ax = Math.abs(curr.vx - prev.vx) / this.stepDt;
    const ay = Math.abs(curr.vy - prev.vy) / this.stepDt;
    const targetSquash = clamp((ay - ax) * d.squash.perAcceleration, -d.squash.amount, d.squash.amount);
    this.squash += (targetSquash - this.squash) * k;
    this.sprite.setScale(d.scale * (1 - this.squash), d.scale * (1 + this.squash));
    return pos;
  }
}
