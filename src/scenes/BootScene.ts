import Phaser from 'phaser';
import { anims, npcs, player, sheets, species } from '../data';
import { loadSave } from '../storage';
import { INTRO_ID } from './IntroScene';
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
    for (const name of ['bg_sea_0', 'bg_sea_1', 'bg_harbor_0', 'bg_deep_far', 'bg_deep_rocks']) this.load.image(name, `backgrounds/${name}.png`);
    for (const [key, d] of Object.entries(sheets)) this.load.spritesheet(key, d.file, { frameWidth: d.frame[0], frameHeight: d.frame[1] });
    // Acting-Bildstreifen: quadratische Frames, Größe ergibt sich aus der Bildhöhe (siehe create)
    for (const [key, a] of Object.entries(anims)) this.load.image(`anim_${key}_strip`, a.file);
    this.load.image('life_rowboat', 'life/life_rowboat.png');
    for (const name of ['decor_arch', 'decor_coral_pink', 'decor_coral_yellow', 'decor_log', 'decor_ruins', 'decor_seaweed', 'decor_totem', 'seabed', 'harbor_hut', 'harbor_barrel', 'harbor_barrel_small'])
      this.load.image(name, `decor/${name}.png`);
    for (const id of [...npcs.map((n) => n.id), 'bert']) {
      this.load.image(`portrait_${id}`, `sprites/portrait_${id}.png`);
      for (const face of ['happy', 'annoyed', 'shock']) this.load.image(`portrait_${id}_${face}`, `sprites/portrait_${id}_${face}.png`);
    }
  }

  create(): void {
    createSheetAnimations(this, player.sprite, player.frameWidth, player.id, player.animations);
    for (const s of species) createSheetAnimations(this, s.sprite, s.frame.width, s.sprite, FISH_ANIMATIONS);
    for (const n of npcs) createSheetAnimations(this, n.sprite, n.frame.width, n.sprite, n.animations);
    for (const key of Object.keys(anims)) {
      const img = this.textures.get(`anim_${key}_strip`).getSourceImage() as HTMLImageElement;
      this.textures.addSpriteSheet(`anim_${key}`, img, { frameWidth: img.height, frameHeight: img.height });
    }
    for (const [key, d] of Object.entries(sheets)) {
      const last = this.textures.get(key).frameTotal - 2;
      for (const [name, a] of Object.entries(d.anims))
        this.anims.create({ key: name, frames: this.anims.generateFrameNumbers(key, { start: a.from ?? 0, end: a.to ?? last }), frameRate: a.fps, repeat: a.once ? 0 : -1 });
    }
    document.getElementById('loading')?.remove();
    // Ganz am Anfang: wie aus einem Oktopus Kapitän Bert wurde
    const save = loadSave();
    this.scene.start(!save.story.seen.includes(INTRO_ID) && save.stats.casts === 0 ? 'Intro' : 'Fishing');
  }
}
