import Phaser from 'phaser';
import { animKey } from './Octopus';
import { approachFactor } from '../systems/camera';
import { lerp } from '../systems/vector';

/** Was die Ebene zum Zeichnen braucht: Fische und Räuber erfüllen das beide. */
export interface Swimmer {
  uid: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
}

interface FishSprite {
  sprite: Phaser.GameObjects.Sprite;
  facing: 1 | -1;
  /** 0..1, beim Umdrehen kurz gestaucht (Squash). */
  turn: number;
}

/** Zeichnet Fische oder Räuber eines Tauchgangs, verwaltet Sprites nach uid. */
export class FishLayer<T extends Swimmer> {
  private readonly sprites = new Map<number, FishSprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spriteOf: (item: T) => string,
    private readonly scale: number,
    private readonly depth = 8,
    /** Optional: Färbung und Drehung je Zustand (z. B. betäubt). */
    private readonly styleOf?: (item: T) => { tint?: number; angle?: number },
  ) {}

  render(fish: readonly T[], alpha: number, dt: number): void {
    const seen = new Set<number>();
    for (const f of fish) {
      seen.add(f.uid);
      let v = this.sprites.get(f.uid);
      if (!v) {
        const key = this.spriteOf(f);
        const sprite = this.scene.add.sprite(f.x, f.y, key, 0).setDepth(this.depth).setScale(this.scale);
        sprite.play(animKey(key, 'swim'));
        v = { sprite, facing: f.facing, turn: 1 };
        this.sprites.set(f.uid, v);
      }
      if (v.facing !== f.facing) {
        v.facing = f.facing;
        v.turn = 0.25;
      }
      v.turn += (1 - v.turn) * approachFactor(10, dt);
      const speed = Math.hypot(f.vx, f.vy);
      v.sprite.play(animKey(this.spriteOf(f), speed > 25 ? 'swim' : 'idle'), true);
      const style = this.styleOf?.(f);
      v.sprite
        .setPosition(lerp(f.px, f.x, alpha), lerp(f.py, f.y, alpha))
        .setFlipX(f.facing === -1)
        .setScale(this.scale * v.turn, this.scale * (2 - v.turn))
        .setAngle(style?.angle ?? Math.max(-25, Math.min(25, (f.vy / Math.max(30, Math.abs(f.vx))) * 20)) * f.facing);
      if (style?.tint !== undefined) v.sprite.setTint(style.tint);
      else v.sprite.clearTint();
    }
    for (const [uid, v] of this.sprites) {
      if (seen.has(uid)) continue;
      v.sprite.destroy();
      this.sprites.delete(uid);
    }
  }
}
