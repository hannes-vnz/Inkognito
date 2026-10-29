import Phaser from 'phaser';
import type { Rng } from '../systems/rng';

interface Flake {
  x: number;
  y: number;
  size: number;
  alpha: number;
  drift: number;
}

/** Meeresschnee: feine Schwebeteilchen, leicht parallax zur Kamera. */
export class MarineSnow {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly flakes: Flake[];
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    rng: Rng,
    count: number,
    private readonly parallax: number,
    private readonly driftSpeed: number,
  ) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(50);
    this.flakes = Array.from({ length: count }, () => ({
      x: rng.range(0, 4096),
      y: rng.range(0, 4096),
      size: rng.pick([1, 1, 2, 2, 3]),
      alpha: rng.range(0.25, 0.65),
      drift: rng.range(0.4, 1.2),
    }));
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, dt: number): void {
    this.time += dt;
    const w = camera.width;
    const h = camera.height;
    const g = this.g;
    g.clear();
    for (const f of this.flakes) {
      const x = mod(f.x - camera.scrollX * this.parallax + Math.sin(this.time * 0.5 + f.y) * 6, w);
      const y = mod(f.y - camera.scrollY * this.parallax + this.time * this.driftSpeed * f.drift, h);
      g.fillStyle(0xeafcff, f.alpha);
      g.fillRect(Math.round(x), Math.round(y), f.size, f.size);
    }
  }
}

const mod = (v: number, m: number): number => ((v % m) + m) % m;
