import Phaser from 'phaser';
import { npcs, player, species } from '../data';
import { createSheetAnimations, FISH_ANIMATIONS } from '../entities/Octopus';

/** Lädt alle Grafiken aus /assets (Dateinamen laut Asset-Regeln) und legt Animationen an. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet(player.sprite, `sprites/${player.sprite}.png`, { frameWidth: player.frameWidth, frameHeight: player.frameHeight });
    for (const s of species) this.load.spritesheet(s.sprite, `sprites/${s.sprite}.png`, { frameWidth: s.frame.width, frameHeight: s.frame.height });
    for (const n of npcs) this.load.spritesheet(n.sprite, `sprites/${n.sprite}.png`, { frameWidth: n.frame.width, frameHeight: n.frame.height });
    for (const name of ['boat_1', 'boat_top', 'buoy', 'fx_crate', 'fx_bottle', 'hook', 'fx_bubble']) this.load.image(name, `sprites/${name}.png`);
    for (const name of ['bg_sea_0', 'bg_sea_1']) this.load.image(name, `backgrounds/${name}.png`);
  }

  create(): void {
    createSheetAnimations(this, player.sprite, player.frameWidth, player.id, player.animations);
    for (const s of species) createSheetAnimations(this, s.sprite, s.frame.width, s.sprite, FISH_ANIMATIONS);
    for (const n of npcs) createSheetAnimations(this, n.sprite, n.frame.width, n.sprite, n.animations);
    document.getElementById('loading')?.remove();
    this.scene.start('Fishing');
  }
}
