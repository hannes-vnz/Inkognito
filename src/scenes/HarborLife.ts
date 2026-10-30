import Phaser from 'phaser';
import { chatter, harborLife, timeParams } from '../data';
import { announceLife, advanceChatter, lifeToAnnounce, lifeUnlocked, nextStep, pickChatter } from '../systems/harborLife';
import { isNight } from '../systems/legend';
import { createRng } from '../systems/rng';
import type { Save } from '../systems/save';
import { t } from '../i18n';
import { play } from '../audio/sfx';

export interface LifeHost {
  readonly save: Save;
  setSave(save: Save): void;
  /** Darf gerade geplaudert werden (an Deck, nichts offen)? */
  canTalk(): boolean;
  say(text: string): void;
  /** Sprite einer Hafen-Figur (Hilde, Bruno …), falls sie da ist. */
  npcSprite(id: string): Phaser.GameObjects.Sprite | undefined;
}

/** Wo im Hafen Platz ist (Weltkoordinaten). */
export interface LifeSpots {
  surface: number;
  worldW: number;
  /** Ende des Stegs bzw. der Hütte links. */
  pierEnd: number;
  boatRight: number;
  stallLeft: number;
}

const BUBBLE_MS = 2600;

/**
 * Hafenleben: Statisten mit eigenen Animationen (Angler, Kater, Krebs, Ruderer, Lichterkette),
 * die nach und nach auftauchen, und Running Gags als Sprechblasen zwischen den Figuren.
 */
export class HarborLife {
  private readonly actors = new Map<string, Phaser.GameObjects.Sprite>();
  private chatterIn = 6;
  private talking = false;
  private rng = createRng('harbor-life');
  private spots: LifeSpots | null = null;
  private built = false;
  private readonly spawnedAtBuild = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: LifeHost,
  ) {}

  build(spots: LifeSpots): void {
    this.rng = createRng(`harbor-life-${this.host.save.stats.casts}`);
    this.spots = spots;
    for (const l of lifeUnlocked(this.host.save, harborLife)) {
      this.spawn(l.id);
      this.spawnedAtBuild.add(l.id);
    }
    this.scene.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
  }

  /** Einen Bewohner in den Hafen setzen. */
  private spawn(id: string): void {
    const spots = this.spots!;
    const { surface } = spots;
    const night = isNight(this.host.save.stats.casts, timeParams);
    if (id === 'lights') this.lights(spots, night);
    if (id === 'hermit') {
      const crab = this.scene.add.sprite(spots.pierEnd + 6, surface + 2, 'life_hermit', 0).setOrigin(0.5, 1).setScale(0.75).setDepth(2.6);
      this.actors.set('hermit', crab);
      this.scene.time.addEvent({ delay: 7000, loop: true, callback: () => crab.play('life-hermit-raise') });
    }
    if (id === 'jens') {
      const jens = this.scene.add.sprite(spots.pierEnd - 40, surface - 4, 'life_angler_fish', 0).setOrigin(0.5, 1).setScale(1.5).setDepth(2.4);
      jens.play('life-angler-fish');
      this.actors.set('jens', jens);
      // Ab und zu beißt etwas an: kurzer Ruck, dann weiter angeln
      this.scene.time.addEvent({
        delay: 11000,
        loop: true,
        callback: () => {
          jens.play('life-angler-hook');
          jens.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => jens.play('life-angler-fish'));
        },
      });
    }
    if (id === 'ole') {
      const ole = this.scene.add.sprite(spots.worldW - 22, surface - 4, 'life_angler2_fish', 0).setOrigin(0.5, 1).setScale(1.5).setFlipX(true).setDepth(2.4);
      ole.play('life-angler2-fish');
      this.actors.set('ole', ole);
    }
    if (id === 'kruemel') this.cat(spots, night);
    if (id === 'rower') this.rower(spots);
    // Neu dazugekommen: kurz aufploppen lassen
    const s = this.actors.get(id);
    if (s && this.built) {
      const scale = s.scaleX;
      s.setScale(0);
      this.scene.tweens.add({ targets: s, scaleX: scale, scaleY: Math.abs(scale), duration: 300, ease: 'Back.Out' });
    }
  }

  /** Neue Bewohner ankündigen; wer erst seit diesem Besuch dazugehört, taucht jetzt auf. */
  announce(): void {
    this.built = true;
    const fresh = lifeToAnnounce(this.host.save, harborLife);
    if (fresh.length === 0) return;
    for (const l of fresh) if (!this.actors.has(l.id) && !this.spawnedAtBuild.has(l.id)) this.spawn(l.id);
    this.host.setSave(announceLife(this.host.save, fresh.map((l) => l.id)));
    this.host.say(t('life.new', { name: fresh.map((l) => t(l.nameKey)).join(', ') }));
    play('newSpecies', 1.1);
  }

  sprite(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.actors.get(id);
  }

  private lights(spots: LifeSpots, night: boolean): void {
    const g = this.scene.add.graphics().setDepth(-16.5);
    const x0 = 40;
    const x1 = spots.stallLeft;
    const y0 = spots.surface - 96;
    g.lineStyle(1, 0x2a2a3a, 0.8);
    const sag = (x: number) => y0 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 18;
    for (let x = x0; x < x1; x += 4) g.lineBetween(x, sag(x), x + 4, sag(x + 4));
    const colors = [0xffd23f, 0xff6b6b, 0x5ce1e6, 0x7bd88f];
    const bulbs: Phaser.GameObjects.Arc[] = [];
    for (let x = x0 + 10, i = 0; x < x1; x += 22, i++) {
      const b = this.scene.add.circle(x, sag(x) + 3, night ? 3 : 2, colors[i % colors.length]!, night ? 1 : 0.7).setDepth(-16.4);
      bulbs.push(b);
    }
    if (night) this.scene.tweens.add({ targets: bulbs, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, delay: (_t: unknown, _k: unknown, _v: unknown, i: number) => i * 90 });
  }

  /** Kater Krümel streift zwischen Boot und Fischstand herum, sitzt, schläft nachts. */
  private cat(spots: LifeSpots, night: boolean): void {
    const y = spots.surface - 4;
    const cat = this.scene.add.sprite(spots.boatRight + 20, y, 'life_cat', 0).setOrigin(0.5, 1).setScale(2).setDepth(2.7);
    this.actors.set('kruemel', cat);
    if (night) {
      cat.play('life-cat-sleep');
      return;
    }
    const wander = () => {
      const to = this.rng.range(spots.boatRight + 10, spots.stallLeft - 10);
      cat.setFlipX(to < cat.x);
      cat.play('life-cat-walk');
      this.scene.tweens.add({
        targets: cat,
        x: to,
        duration: Math.abs(to - cat.x) * 28 + 200,
        onComplete: () => {
          cat.play('life-cat-sit');
          this.scene.time.delayedCall(this.rng.range(3000, 7000), wander);
        },
      });
    };
    cat.play('life-cat-sit');
    this.scene.time.delayedCall(2000, wander);
  }

  /** Ruderboot zieht langsam durch die Bucht, mal hin, mal zurück. */
  private rower(spots: LifeSpots): void {
    const boat = this.scene.add.container(-90, spots.surface + 6).setDepth(-9.4).setScale(0.75);
    const hull = this.scene.add.image(0, 0, 'life_rowboat').setOrigin(0.5, 1);
    const man = this.scene.add.sprite(-4, -6, 'life_rower', 0).setOrigin(0.5, 1);
    man.play('life-rower');
    boat.add([man, hull]);
    const cross = (dir: 1 | -1) => {
      boat.setScale(0.75 * dir, 0.75);
      this.scene.tweens.add({
        targets: boat,
        x: dir > 0 ? spots.worldW + 90 : -90,
        duration: 38000,
        onComplete: () => this.scene.time.delayedCall(15000, () => cross(dir > 0 ? -1 : 1)),
      });
    };
    this.scene.tweens.add({ targets: boat, y: '+=2', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.time.delayedCall(4000, () => cross(1));
  }

  // ------------------------------------------------------------ Running Gags

  private speaker(id: string): Phaser.GameObjects.Sprite | undefined {
    return this.actors.get(id) ?? this.host.npcSprite(id);
  }

  /** Sprecher, die gerade sichtbar im Bild stehen. */
  private visibleSpeakers(): Set<string> {
    const view = this.scene.cameras.main.worldView;
    const out = new Set<string>();
    const ids = [...this.actors.keys(), 'hilde', 'bruno', 'qualle', 'knut', 'gisela', 'schulze'];
    for (const id of ids) {
      const s = this.speaker(id);
      if (s?.visible && s.x > view.x + 20 && s.x < view.right - 20) out.add(id);
    }
    return out;
  }

  private tick(): void {
    if (this.talking || !this.host.canTalk()) return;
    if (--this.chatterIn > 0) return;
    const save = this.host.save;
    const gag = pickChatter(save, chatter, this.visibleSpeakers(), `${save.createdAt}-chat-${save.stats.casts}-${this.chatterIn}`);
    this.chatterIn = Math.round(this.rng.range(10, 18));
    if (!gag) return;
    const lines = nextStep(save, gag);
    this.host.setSave(advanceChatter(save, gag.id));
    this.talking = true;
    lines.forEach((line, i) =>
      this.scene.time.delayedCall(i * (BUBBLE_MS - 600), () => {
        const s = this.speaker(line.speaker);
        if (s) this.bubble(s, t(line.textKey));
        if (i === lines.length - 1) this.scene.time.delayedCall(BUBBLE_MS, () => (this.talking = false));
      }),
    );
  }

  /** Sprechblase über einer Figur, ploppt auf und verschwindet wieder. */
  private bubble(s: Phaser.GameObjects.Sprite, text: string): void {
    play('talk', 0.9 + this.rng.range(0, 0.3));
    const label = this.scene.add
      .text(0, 0, text.replace(/\*/g, ''), { fontFamily: '"Nunito", sans-serif', fontSize: '13px', fontStyle: '800', color: '#0e1a2b', wordWrap: { width: 150 }, align: 'center' })
      .setOrigin(0.5, 1);
    const w = label.width + 14;
    const h = label.height + 10;
    const view = this.scene.cameras.main.worldView;
    const x = Phaser.Math.Clamp(s.x, view.x + w / 2 + 4, view.right - w / 2 - 4);
    // Oben liegt die Anzeige (Münzen, Tiefe): passt die Blase nicht darüber, hängt sie unter der Figur
    const above = s.y - s.displayHeight - 8 - h > view.y + 130;
    const y = above ? s.y - s.displayHeight - 8 : s.y + 14 + h;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0e1a2b, 1).fillRoundedRect(-w / 2 - 2, -h - 2, w + 4, h + 4, 8);
    bg.fillStyle(0xfffaf0, 1).fillRoundedRect(-w / 2, -h, w, h, 7);
    const tail = s.x - x;
    if (above) {
      bg.fillStyle(0x0e1a2b, 1).fillTriangle(tail - 6, 0, tail + 6, 0, tail, 9);
      bg.fillStyle(0xfffaf0, 1).fillTriangle(tail - 4, -1, tail + 4, -1, tail, 6);
    } else {
      bg.fillStyle(0x0e1a2b, 1).fillTriangle(tail - 6, -h, tail + 6, -h, tail, -h - 9);
      bg.fillStyle(0xfffaf0, 1).fillTriangle(tail - 4, -h + 1, tail + 4, -h + 1, tail, -h - 6);
    }
    label.setPosition(0, -5);
    const box = this.scene.add.container(x, y, [bg, label]).setDepth(13).setScale(0.2);
    this.scene.tweens.add({ targets: box, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.time.delayedCall(BUBBLE_MS, () => this.scene.tweens.add({ targets: box, scale: 0, alpha: 0, duration: 160, onComplete: () => box.destroy() }));
  }
}
