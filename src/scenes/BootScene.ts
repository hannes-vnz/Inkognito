import Phaser from 'phaser';
import { fish, game, player, zones } from '../data';
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
    for (const f of fish) {
      this.load.spritesheet(f.sprite, `sprites/${f.sprite}.png`, { frameWidth: f.frame.width, frameHeight: f.frame.height });
    }
    this.load.image('fx_bubble', 'sprites/fx_bubble.png');
    this.load.image('fx_catch_bubble', 'sprites/fx_catch_bubble.png');
    for (const zone of zones) {
      for (const layer of zone.background) this.load.image(layer.key, `backgrounds/${layer.key}.png`);
    }
  }

  create(): void {
    createSheetAnimations(this, player.sprite, player.frameWidth, player.id, player.animations);
    for (const f of fish) createSheetAnimations(this, f.sprite, f.frame.width, f.sprite, game.fish.animations);
    document.getElementById('loading')?.remove();
    this.scene.start('Dive', { zoneId: 'kelp' });
  }
}
