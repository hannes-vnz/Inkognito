import Phaser from 'phaser';
import { animKey } from './Octopus';
import { lerp } from '../systems/vector';
import type { Shot } from '../systems/bubbles';
import type { Carried } from '../systems/carry';
import type { FishDef } from '../systems/fish';

/** Fliegende Blasen der Blasenkanone. */
export class ShotLayer {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly texture: string,
  ) {}

  render(shots: readonly Shot[], alpha: number, life: number): void {
    const seen = new Set<number>();
    for (const s of shots) {
      seen.add(s.uid);
      let img = this.images.get(s.uid);
      if (!img) {
        img = this.scene.add.image(s.x, s.y, this.texture).setDepth(11);
        this.images.set(s.uid, img);
      }
      const t = s.age / life;
      img.setPosition(lerp(s.px, s.x, alpha), lerp(s.py, s.y, alpha)).setScale(3 + t * 2).setAlpha(1 - t * t * 0.6);
    }
    for (const [uid, img] of this.images) {
      if (seen.has(uid)) continue;
      img.destroy();
      this.images.delete(uid);
    }
  }
}

/** Gefangene Fische in Blasen, die hinter dem Oktopus herschweben. */
export class CarryLayer {
  private readonly items = new Map<number, Phaser.GameObjects.Container>();
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly defs: ReadonlyMap<string, FishDef>,
    private readonly bubbleTexture: string,
  ) {}

  render(carried: readonly Carried[], alpha: number, dt: number): void {
    this.time += dt;
    const seen = new Set<number>();
    carried.forEach((c, i) => {
      seen.add(c.uid);
      let item = this.items.get(c.uid);
      if (!item) {
        const def = this.defs.get(c.fishId)!;
        const fish = this.scene.add.sprite(0, 0, def.sprite, 0).setScale(2);
        fish.play(animKey(def.sprite, 'catch'));
        const bubble = this.scene.add.image(0, 0, this.bubbleTexture).setScale(2);
        item = this.scene.add.container(c.x, c.y, [fish, bubble]).setDepth(9).setScale(1.6);
        // Einfang-Plopp: kurz aufblähen, dann auf Normalgröße.
        this.scene.tweens.add({ targets: item, scale: 1, duration: 260, ease: 'Back.Out' });
        this.items.set(c.uid, item);
      }
      const bob = Math.sin(this.time * 2.4 + i * 0.9) * 3;
      item.setPosition(lerp(c.px, c.x, alpha), lerp(c.py, c.y, alpha) + bob);
      item.setAngle(Math.sin(this.time * 1.7 + i) * 8);
    });
    for (const [uid, item] of this.items) {
      if (seen.has(uid)) continue;
      item.destroy();
      this.items.delete(uid);
    }
  }
}
