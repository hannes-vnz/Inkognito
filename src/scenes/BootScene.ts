import Phaser from 'phaser';
import { buildings, fish, game, npcs, player, predators, reef, zones } from '../data';
import { createSheetAnimations } from '../entities/Octopus';

/** Lädt alle Grafiken aus /assets (Dateinamen laut Asset-Regeln) und legt Animationen an. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet(player.sprite, `sprites/${player.sprite}.png`, {
      frameWidth: player.frameWidth,
      frameHeight: player.frameHeight,
    });
    for (const f of [...fish, ...predators]) {
      this.load.spritesheet(f.sprite, `sprites/${f.sprite}.png`, { frameWidth: f.frame.width, frameHeight: f.frame.height });
    }
    this.load.image('fx_bubble', 'sprites/fx_bubble.png');
    this.load.image('fx_catch_bubble', 'sprites/fx_catch_bubble.png');
    for (const layer of [...zones.flatMap((z) => z.background), ...reef.background]) {
      this.load.image(layer.key, `backgrounds/${layer.key}.png`);
    }
    for (const b of buildings) this.load.image(b.sprite, `sprites/${b.sprite}.png`);
    for (const n of npcs) this.load.spritesheet(n.sprite, `sprites/${n.sprite}.png`, { frameWidth: n.frame.width, frameHeight: n.frame.height });
  }

  create(): void {
    createSheetAnimations(this, player.sprite, player.frameWidth, player.id, player.animations);
    for (const f of [...fish, ...predators]) createSheetAnimations(this, f.sprite, f.frame.width, f.sprite, game.fish.animations);
    for (const n of npcs) createSheetAnimations(this, n.sprite, n.frame.width, n.sprite, [{ key: 'idle', row: 0, frames: 4, fps: 4, repeat: -1 }]);
    document.getElementById('loading')?.remove();
    this.scene.start('Riff', {});
  }
}
