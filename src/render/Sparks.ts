import Phaser from 'phaser';
import type { Rng } from '../systems/rng';

interface Spark {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  age: number;
  life: number;
  gravity: number;
}

export interface SparkStyle {
  tint: number;
  /** Anfangstempo (Einheiten pro Sekunde). */
  speed: [number, number];
  /** Winkelbereich in Grad, 0 = rechts, -90 = hoch. */
  angle: [number, number];
  gravity: number;
  life: [number, number];
  scale: [number, number];
}

/**
 * Kleine Partikel-Explosionen (Spritzer, Funken, Sterne) aus einem Pool.
 * Eigener Zufall über den Seed-RNG statt Phasers Emitter.
 */
export class Sparks {
  private readonly pool: Spark[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
    private readonly texture: string,
    private readonly depth: number,
    private readonly max = 120,
  ) {}

  burst(x: number, y: number, count: number, style: SparkStyle): void {
    for (let i = 0; i < count; i++) {
      let s = this.pool.find((p) => !p.img.visible);
      if (!s) {
        if (this.pool.length >= this.max) return;
        s = { img: this.scene.add.image(0, 0, this.texture).setDepth(this.depth), vx: 0, vy: 0, age: 0, life: 1, gravity: 0 };
        this.pool.push(s);
      }
      const a = Phaser.Math.DegToRad(this.rng.range(style.angle[0], style.angle[1]));
      const v = this.rng.range(style.speed[0], style.speed[1]);
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.age = 0;
      s.life = this.rng.range(style.life[0], style.life[1]);
      s.gravity = style.gravity;
      s.img
        .setPosition(x, y)
        .setTint(style.tint)
        .setScale(this.rng.range(style.scale[0], style.scale[1]))
        .setAlpha(1)
        .setVisible(true);
    }
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (!s.img.visible) continue;
      s.age += dt;
      if (s.age >= s.life) {
        s.img.setVisible(false);
        continue;
      }
      s.vy += s.gravity * dt;
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      const k = s.age / s.life;
      s.img.setAlpha(1 - k * k);
    }
  }
}
