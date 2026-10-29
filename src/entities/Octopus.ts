import type Phaser from 'phaser';
import type { AnimationDef } from '../data';

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

/** Reihen der Fisch-Spritesheets (idle, swim, turn, catch). */
export const FISH_ANIMATIONS: AnimationDef[] = [
  { key: 'idle', row: 0, frames: 4, fps: 6, repeat: -1 },
  { key: 'swim', row: 1, frames: 4, fps: 10, repeat: -1 },
  { key: 'turn', row: 2, frames: 4, fps: 12, repeat: 0 },
  { key: 'catch', row: 3, frames: 4, fps: 12, repeat: -1 },
];
