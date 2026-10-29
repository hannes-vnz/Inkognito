import Phaser from 'phaser';
import { player, zones } from '../data';
import { createOctopusAnimations } from '../entities/Octopus';

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
    this.load.image('fx_bubble', 'sprites/fx_bubble.png');
    for (const zone of zones) {
      for (const layer of zone.background) {
        this.load.image(layer.key, `backgrounds/${layer.key}.png`);
      }
    }
  }

  create(): void {
    createOctopusAnimations(this, player);
    document.getElementById('loading')?.remove();
    this.scene.start('Dive', { zoneId: 'kelp' });
  }
}
