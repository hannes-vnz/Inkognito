import Phaser from 'phaser';
import { animKey } from './Octopus';
import { approachFactor } from '../systems/camera';
import { lerp } from '../systems/vector';
import type { FishDef, FishState } from '../systems/fish';

interface FishSprite {
  sprite: Phaser.GameObjects.Sprite;
  facing: 1 | -1;
  /** 0..1, beim Umdrehen kurz gestaucht (Squash). */
  turn: number;
}

/** Zeichnet alle freien Fische eines Tauchgangs, verwaltet Sprites nach uid. */
export class FishLayer {
  private readonly sprites = new Map<number, FishSprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly defs: ReadonlyMap<string, FishDef>,
    private readonly scale: number,
  ) {}

  render(fish: readonly FishState[], alpha: number, dt: number): void {
    const seen = new Set<number>();
    for (const f of fish) {
      seen.add(f.uid);
      let v = this.sprites.get(f.uid);
      if (!v) {
        const def = this.defs.get(f.fishId)!;
        const sprite = this.scene.add.sprite(f.x, f.y, def.sprite, 0).setDepth(8).setScale(this.scale);
        sprite.play(animKey(def.sprite, 'swim'));
        v = { sprite, facing: f.facing, turn: 1 };
        this.sprites.set(f.uid, v);
      }
      if (v.facing !== f.facing) {
        v.facing = f.facing;
        v.turn = 0.25;
      }
      v.turn += (1 - v.turn) * approachFactor(10, dt);
      const speed = Math.hypot(f.vx, f.vy);
      const def = this.defs.get(f.fishId)!;
      v.sprite.play(animKey(def.sprite, speed > 25 ? 'swim' : 'idle'), true);
      v.sprite
        .setPosition(lerp(f.px, f.x, alpha), lerp(f.py, f.y, alpha))
        .setFlipX(f.facing === -1)
        .setScale(this.scale * v.turn, this.scale * (2 - v.turn))
        .setAngle(Math.max(-25, Math.min(25, (f.vy / Math.max(30, Math.abs(f.vx))) * 20)) * f.facing);
    }
    for (const [uid, v] of this.sprites) {
      if (seen.has(uid)) continue;
      v.sprite.destroy();
      this.sprites.delete(uid);
    }
  }
}
