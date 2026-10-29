import Phaser from 'phaser';
import type { Rng } from '../systems/rng';

interface Bubble {
  img: Phaser.GameObjects.Image;
  age: number;
  life: number;
  vx: number;
  wobble: number;
}

interface BubbleParams {
  maxCount: number;
  perSecondAtMaxSpeed: number;
  riseSpeed: number;
  lifeSeconds: number;
}

/** Blasen beim Schwimmen: Menge steigt mit der Geschwindigkeit. */
export class BubbleTrail {
  private readonly pool: Bubble[] = [];
  private spawnBudget = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
    private readonly p: BubbleParams,
    private readonly texture: string,
  ) {}

  update(dt: number, x: number, y: number, vx: number, vy: number, speedRatio: number): void {
    this.spawnBudget += this.p.perSecondAtMaxSpeed * speedRatio * speedRatio * dt;
    while (this.spawnBudget >= 1) {
      this.spawnBudget -= 1;
      this.spawn(x - vx * 0.08, y - vy * 0.08 + 12);
    }
    for (const b of this.pool) {
      if (!b.img.visible) continue;
      b.age += dt;
      if (b.age >= b.life) {
        b.img.setVisible(false);
        continue;
      }
      const t = b.age / b.life;
      b.img.x += (b.vx + Math.sin(b.age * 8 + b.wobble) * 18) * dt;
      b.img.y -= this.p.riseSpeed * dt;
      b.vx *= 0.96;
      b.img.setAlpha(1 - t * t);
    }
  }

  /** Plopp: mehrere Blasen auf einmal, z. B. beim Fang. */
  burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) this.spawn(x, y, this.rng.range(-140, 140));
  }

  private spawn(x: number, y: number, vx?: number): void {
    let b = this.pool.find((p) => !p.img.visible);
    if (!b) {
      if (this.pool.length >= this.p.maxCount) return;
      b = { img: this.scene.add.image(0, 0, this.texture).setDepth(9), age: 0, life: 1, vx: 0, wobble: 0 };
      this.pool.push(b);
    }
    b.age = 0;
    b.life = this.p.lifeSeconds * this.rng.range(0.6, 1.1);
    b.vx = vx ?? this.rng.range(-20, 20);
    b.wobble = this.rng.range(0, Math.PI * 2);
    b.img
      .setPosition(x + this.rng.range(-10, 10), y + this.rng.range(-6, 6))
      .setScale(this.rng.pick([1, 2, 2, 3]))
      .setAlpha(1)
      .setVisible(true);
  }
}
