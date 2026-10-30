import Phaser from 'phaser';
import { createRng } from '../systems/rng';
import { markSeen } from '../systems/story';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { el } from '../ui/dom';
import { typeRichText } from '../ui/rich';
import { play } from '../audio/sfx';
import { anims } from '../data';

/** Story-Marke: Intro gesehen (in save.story.seen). */
export const INTRO_ID = 'intro_backstory';

interface ShotDef {
  ms: number;
  build: () => void;
}

/**
 * Backstory als gespielte Szene (Vorbild: die Zwischensequenzen von Dave the Diver):
 * Der echte Fischer Bert zieht einen Oktopus im Netz an Bord, rutscht auf dessen Tinte aus,
 * fällt über Bord und treibt zufrieden in Rente. Der Oktopus übernimmt Boot, Mantel und Namen.
 * Jede Einstellung baut ihre Bühne neu, Kamera und Figuren bewegen sich über die ganze Dauer.
 */
export class IntroScene extends Phaser.Scene {
  private stage!: Phaser.GameObjects.Container;
  private ui!: HTMLDivElement;
  private sub!: HTMLDivElement;
  private finishTyping: (() => void) | null = null;
  private shot = -1;
  private done = false;
  private waveG: Phaser.GameObjects.Graphics | null = null;
  private time0 = 0;
  private rng = createRng('intro');

  constructor() {
    super('Intro');
  }

  /** Bühnenmaß: Entwurf für 360×280, passt sich hochkant und quer an. */
  private get u(): number {
    return Math.min(this.W / 360, this.H / 280);
  }

  create(): void {
    this.done = false;
    this.shot = -1;
    const root = document.getElementById('ui') as HTMLElement;
    root.replaceChildren();
    root.className = 'intro-ui';
    this.ui = el('div', 'intro');
    const top = el('div', 'intro-bar top');
    const bottom = el('div', 'intro-bar bottom');
    this.sub = el('div', 'intro-sub');
    const skip = el('button', 'button intro-skip');
    skip.type = 'button';
    skip.textContent = t('intro.skip');
    skip.addEventListener('click', () => this.finish());
    top.append(skip);
    bottom.append(this.sub);
    this.ui.append(top, bottom);
    root.append(this.ui);
    this.cameras.main.setBackgroundColor('#000');
    this.makeAnims();
    this.layout();
    this.next();
    const onResize = () => {
      this.layout();
      if (!this.done) this.show(this.shot);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    if (location.hash.includes('debug')) (window as unknown as { inkognitoIntro: unknown }).inkognitoIntro = { shot: (i: number) => this.show(i) };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.ui.remove();
    });
  }

  /**
   * Kinobalken: oben Platz für „Überspringen“, unten für den Untertitel.
   * Die Bühne ist nur der Bereich dazwischen, so verdeckt der Text nie eine Figur und nichts wird angeschnitten.
   */
  private layout(): void {
    const { width, height } = this.scale;
    const top = Math.max(40, Math.round(height * 0.06));
    const bottom = Math.max(height > width ? 150 : 84, Math.round(height * (height > width ? 0.2 : 0.22)));
    this.ui.style.setProperty('--top', `${top}px`);
    this.ui.style.setProperty('--bottom', `${bottom}px`);
    this.cameras.main.setViewport(0, top, width, height - top - bottom).setZoom(1).setScroll(0, 0);
  }

  /** Berts Acting-Streifen fürs Intro: Frames aus dem Bild, Tempo aus data/anims.json (hier etwas ruhiger). */
  private makeAnims(): void {
    const speed: Record<string, number> = { raw: 0.5, dressup: 0.4, busted: 0.6, happy: 0.85, shock: 0.75 };
    for (const [name, k] of Object.entries(speed)) {
      const a = anims[`bert_${name}`];
      if (!a || this.anims.exists(`in-octo-${name}`)) continue;
      this.anims.create({ key: `in-octo-${name}`, frames: this.anims.generateFrameNumbers(`anim_bert_${name}`), frameRate: a.fps * k, repeat: a.loop ? -1 : 0 });
    }
  }

  /** Einzelbild `i` eines Streifens, begrenzt auf die vorhandenen Frames. */
  private frameOf(texture: string, i: number): number {
    return Math.min(i, this.textures.get(texture).frameTotal - 2);
  }

  // ------------------------------------------------------------ Ablauf

  private readonly shots: ShotDef[] = [
    { ms: 6500, build: () => this.shotFisher() },
    { ms: 7000, build: () => this.shotDeep() },
    { ms: 6500, build: () => this.shotHaul() },
    { ms: 7000, build: () => this.shotSlip() },
    { ms: 7000, build: () => this.shotRetire() },
    { ms: 6500, build: () => this.shotAlone() },
    { ms: 7500, build: () => this.shotDress() },
    { ms: 4500, build: () => this.shotNormal() },
    { ms: 5500, build: () => this.shotTitle() },
  ];

  private next(): void {
    this.show(this.shot + 1);
  }

  /** Baut Einstellung `i` neu auf (auch nach Drehen des Geräts). */
  private show(i: number): void {
    if (this.done) return;
    this.shot = i;
    if (this.shot >= this.shots.length) return this.finish();
    const s = this.shots[this.shot]!;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.stage?.destroy();
    this.waveG = null;
    this.stage = this.add.container(0, 0);
    this.subtitle('');
    s.build();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.time.delayedCall(s.ms, () => {
      if (this.done) return;
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.next());
    });
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.finishTyping?.();
    const save = loadSave();
    writeSave(markSeen(save, INTRO_ID));
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Fishing'));
  }

  private subtitle(text: string, delay = 0): void {
    this.time.delayedCall(delay, () => {
      this.finishTyping?.();
      this.sub.classList.toggle('hidden', !text);
      this.finishTyping = text ? typeRichText(this.sub, text) : null;
    });
  }

  // ------------------------------------------------------------ Bausteine

  private get W(): number {
    return this.scale.width;
  }
  /** Höhe der Bühne zwischen den Balken. */
  private get H(): number {
    return this.cameras.main.height;
  }

  /** Himmel, Meer und eine wogende Oberfläche; Horizont bei `hy` (Anteil der Höhe). */
  private seaAndSky(hy = 0.56): number {
    const { W, H } = this;
    const horizon = H * hy;
    const g = this.add.graphics();
    g.fillGradientStyle(0x7fd6e6, 0x7fd6e6, 0xd8f4f0, 0xd8f4f0, 1);
    g.fillRect(0, 0, W, horizon);
    g.fillGradientStyle(0x3cb6c8, 0x3cb6c8, 0x0f4f7a, 0x0f4f7a, 1);
    g.fillRect(0, horizon, W, H - horizon);
    const clouds = this.add.graphics();
    clouds.fillStyle(0xffffff, 0.85);
    for (let i = 0; i < 5; i++) {
      const x = this.rng.range(0, W);
      const y = this.rng.range(H * 0.08, horizon * 0.6);
      for (let k = 0; k < 4; k++) clouds.fillCircle(x + k * 16 * this.u, y + Math.sin(k) * 4, (12 + k * 3) * this.u);
    }
    this.tweens.add({ targets: clouds, x: 30 * this.u, duration: 8000 });
    this.waveG = this.add.graphics();
    this.stage.add([g, clouds, this.waveG]);
    this.time0 = this.time.now;
    return horizon;
  }

  update(time: number): void {
    if (!this.waveG) return;
    const horizon = this.waveG.getData('horizon') as number | undefined;
    if (horizon === undefined) return;
    const t0 = (time - this.time0) / 1000;
    const g = this.waveG;
    g.clear();
    g.fillStyle(0xe8fffb, 0.9);
    for (let x = 0; x < this.W; x += 6) g.fillRect(x, horizon - 2 + Math.round(Math.sin(x * 0.04 + t0 * 2) * 2), 6, 3);
  }

  private boat(x: number, y: number, s: number): Phaser.GameObjects.Image {
    const b = this.add.image(x, y, 'boat_1').setOrigin(0.5, 1).setScale(s);
    this.tweens.add({ targets: b, y: y - 3 * this.u, angle: 1.2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.stage.add(b);
    return b;
  }

  private fisher(x: number, y: number, s: number, anim: string): Phaser.GameObjects.Sprite {
    const f = this.add.sprite(x, y, 'life_angler_fish', 0).setOrigin(0.5, 1).setScale(s);
    f.play(anim);
    this.stage.add(f);
    return f;
  }

  private splash(x: number, y: number, n = 16): void {
    for (let i = 0; i < n; i++) {
      const d = this.add.circle(x, y, this.rng.range(2, 5) * this.u, 0xe8fffb);
      this.stage.add(d);
      const a = this.rng.range(-Math.PI * 0.9, -Math.PI * 0.1);
      const v = this.rng.range(40, 110) * this.u;
      this.tweens.add({ targets: d, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v, alpha: 0, duration: 700, ease: 'Quad.Out', onComplete: () => d.destroy() });
    }
    play('splash');
  }

  private bubble(x: number, y: number, text: string, delay: number, ms = 2600): void {
    this.time.delayedCall(delay, () => {
      const label = this.add
        .text(0, 0, text.replace(/\*/g, ''), { fontFamily: '"Nunito", sans-serif', fontSize: `${Math.round(15 * Math.max(1, this.u))}px`, fontStyle: '800', color: '#0e1a2b', wordWrap: { width: Math.min(190 * this.u, this.W - 48) }, align: 'center' })
        .setOrigin(0.5, 1);
      const w = label.width + 16;
      const h = label.height + 12;
      const bx = Phaser.Math.Clamp(x, w / 2 + 8, this.W - w / 2 - 8);
      y = Math.max(y, h + 8);
      const g = this.add.graphics();
      g.fillStyle(0x0e1a2b, 1).fillRoundedRect(-w / 2 - 2, -h - 2, w + 4, h + 4, 9);
      g.fillStyle(0xfffaf0, 1).fillRoundedRect(-w / 2, -h, w, h, 8);
      g.fillStyle(0x0e1a2b, 1).fillTriangle(x - bx - 7, 0, x - bx + 7, 0, x - bx, 11);
      g.fillStyle(0xfffaf0, 1).fillTriangle(x - bx - 5, -1, x - bx + 5, -1, x - bx, 8);
      label.setPosition(0, -6);
      const box = this.add.container(bx, y, [g, label]).setScale(0.2);
      this.stage.add(box);
      this.tweens.add({ targets: box, scale: 1, duration: 220, ease: 'Back.Out' });
      play('talk');
      this.time.delayedCall(ms, () => this.tweens.add({ targets: box, scale: 0, alpha: 0, duration: 180, onComplete: () => box.destroy() }));
    });
  }

  // ------------------------------------------------------------ Einstellungen

  /** 1: Der echte Bert angelt gemütlich. */
  private shotFisher(): void {
    const u = this.u;
    const horizon = this.seaAndSky();
    this.waveG!.setData('horizon', horizon);
    const b = this.boat(this.W / 2, horizon + 18 * u, 3 * u);
    const f = this.fisher(b.x - 30 * u, horizon - 34 * u, 2.2 * u, 'life-angler-fish');
    this.tweens.add({ targets: f, y: f.y - 3 * u, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const line = this.add.graphics();
    line.lineStyle(1.5, 0xf2fbff, 0.9).lineBetween(f.x + 40 * u, f.y - 60 * u, f.x + 70 * u, horizon + 60 * u);
    this.stage.addAt(line, 3);
    this.subtitle(t('intro.s1'), 600);
  }

  /** 2: Unten auf dem Felsen ein Oktopus, der die Farbe wechselt. Dann sinkt ein Netz. */
  private shotDeep(): void {
    const { W, H, u } = this;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a8fb0, 0x2a8fb0, 0x061a2e, 0x061a2e, 1);
    g.fillRect(0, 0, W, H);
    const rays = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      rays.fillStyle(0xcffaff, 0.07);
      const x = W * (0.15 + i * 0.18);
      rays.fillTriangle(x, 0, x + 40 * u, 0, x + 120 * u, H);
    }
    const floorY = H * 0.78;
    const bed = this.add.tileSprite(0, floorY, W / 2, 68, 'seabed').setOrigin(0).setScale(2);
    const weeds = [W * 0.12, W * 0.28, W * 0.82].map((x) => {
      const w = this.add.image(x, floorY + 24, 'decor_seaweed').setOrigin(0.5, 1).setScale(2.4 * u);
      this.tweens.add({ targets: w, angle: { from: -5, to: 5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return w;
    });
    const coral = this.add.image(W * 0.66, floorY + 22, 'decor_coral_pink').setOrigin(0.5, 1).setScale(2 * u);
    const octo = this.add.sprite(W / 2, floorY + 18, 'anim_bert_raw', 0).setOrigin(0.5, 0.95).setScale(1.5 * u);
    octo.play('in-octo-raw');
    this.stage.add([g, rays, bed, ...weeds, coral, octo]);
    for (let i = 0; i < 14; i++) {
      const bb = this.add.circle(this.rng.range(0, W), H + 10, this.rng.range(2, 4) * u).setStrokeStyle(1.5, 0xdffaff).setFillStyle();
      this.stage.add(bb);
      this.tweens.add({ targets: bb, y: -20, x: bb.x + 20, duration: this.rng.range(4000, 7000), delay: this.rng.range(0, 4000) });
    }
    // Netz sinkt von oben herab
    const net = this.add.graphics();
    net.lineStyle(2, 0x2a2a1a, 0.85);
    const nw = 150 * u;
    for (let k = 0; k <= 10; k++) {
      net.lineBetween(-nw / 2 + (k * nw) / 10, 0, -nw / 2 + (k * nw) / 10 + (k - 5) * 3, 130 * u);
      net.lineBetween(-nw / 2 - 10, (k * 130 * u) / 10, nw / 2 + 10, (k * 130 * u) / 10);
    }
    net.lineStyle(4, 0x8a6a3a, 1).lineBetween(-nw / 2 - 12, 130 * u, nw / 2 + 12, 130 * u);
    const netBox = this.add.container(W / 2, -160 * u, [net]);
    this.stage.add(netBox);
    this.tweens.add({ targets: netBox, y: floorY - 150 * u, delay: 3300, duration: 2600, ease: 'Sine.Out' });
    this.time.delayedCall(5900, () => {
      this.cameras.main.shake(250, 0.006);
      play('bite');
      octo.stop();
      octo.setFrame(this.frameOf('anim_bert_raw', 4));
    });
    this.subtitle(t('intro.s2'), 500);
  }

  /** 3: Bert zieht. Das Netz fliegt mit dem Oktopus an Deck. */
  private shotHaul(): void {
    const u = this.u;
    const horizon = this.seaAndSky(0.5);
    this.waveG!.setData('horizon', horizon);
    const b = this.boat(this.W * 0.42, horizon + 18 * u, 3.4 * u);
    const f = this.fisher(b.x - 34 * u, horizon - 38 * u, 2.4 * u, 'life-angler-hook');
    f.setFlipX(false);
    const sx = this.W * 0.86;
    const octo = this.add.sprite(sx, horizon + 30 * u, 'anim_bert_raw', this.frameOf('anim_bert_raw', 4)).setOrigin(0.5, 0.9).setScale(0.9 * u);
    const net = this.add.graphics();
    net.lineStyle(1.5, 0x2a2a1a, 0.9);
    for (let k = -4; k <= 4; k++) {
      net.lineBetween(k * 9 * u, -40 * u, k * 6 * u, 10 * u);
      net.lineBetween(-36 * u, k * 6 * u - 15 * u, 36 * u, k * 6 * u - 15 * u);
    }
    const catchBox = this.add.container(sx, horizon + 40 * u, [octo, net]).setAlpha(0);
    octo.setPosition(0, 0);
    this.stage.add(catchBox);
    this.time.delayedCall(1600, () => {
      play('reel');
      catchBox.setAlpha(1);
      this.splash(sx, horizon + 4 * u, 22);
      const to = { x: b.x + 30 * u, y: horizon - 30 * u };
      const from = { x: catchBox.x, y: catchBox.y };
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1300,
        ease: 'Sine.InOut',
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          catchBox.x = from.x + (to.x - from.x) * k;
          catchBox.y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 80 * u;
          catchBox.angle = k * 360;
        },
        onComplete: () => {
          catchBox.angle = 0;
          this.tweens.add({ targets: catchBox, scaleY: 0.7, scaleX: 1.25, duration: 90, yoyo: true });
          this.cameras.main.shake(200, 0.005);
          play('full');
        },
      });
    });
    this.subtitle(t('intro.s3'), 400);
  }

  /** 4: Tinte! Bert rutscht aus und fliegt über Bord. */
  private shotSlip(): void {
    const u = this.u;
    const horizon = this.seaAndSky(0.62);
    this.waveG!.setData('horizon', horizon);
    const b = this.boat(this.W * 0.5, horizon + 18 * u, 4.2 * u);
    const deckY = horizon - 40 * u;
    const octo = this.add.sprite(b.x + 70 * u, deckY + 18 * u, 'anim_bert_shock', 0).setOrigin(0.5, 1).setScale(1.1 * u);
    const f = this.fisher(b.x - 70 * u, deckY + 6 * u, 3 * u, 'life-angler-walk');
    this.stage.add(octo);
    // Bert geht neugierig auf den Fang zu
    this.tweens.add({ targets: f, x: b.x + 10 * u, duration: 1800, ease: 'Linear' });
    this.time.delayedCall(1800, () => {
      f.play('life-angler-idle');
      octo.play('in-octo-shock');
      play('bite', 0.6);
      // Tintenwolke auf dem Deck
      for (let i = 0; i < 10; i++) {
        const c = this.add.circle(octo.x - 20 * u, deckY + 10 * u, 6 * u, 0x2a1f3a, 0.95);
        this.stage.add(c);
        this.tweens.add({ targets: c, x: octo.x - this.rng.range(30, 110) * u, y: deckY + this.rng.range(-4, 14) * u, scale: this.rng.range(1.5, 3), duration: 600, delay: i * 40, ease: 'Quad.Out' });
      }
    });
    this.time.delayedCall(3000, () => {
      f.play('life-angler-fall');
      play('wrong');
      const from = { x: f.x, y: f.y };
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1500,
        ease: 'Sine.In',
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          f.x = from.x - k * 150 * u;
          f.y = from.y - Math.sin(k * Math.PI * 0.8) * 90 * u + k * k * 120 * u;
          f.angle = -k * 300;
        },
        onComplete: () => {
          this.splash(f.x, horizon + 4 * u, 30);
          this.cameras.main.shake(300, 0.008);
          f.setVisible(false);
        },
      });
    });
    this.subtitle(t('intro.s4'), 500);
  }

  /** 5: Bert treibt am Rettungsring davon. Glücklich. */
  private shotRetire(): void {
    const u = this.u;
    const horizon = this.seaAndSky(0.45);
    this.waveG!.setData('horizon', horizon);
    const b = this.boat(this.W * 0.85, horizon + 14 * u, 2 * u);
    b.setAlpha(0.95);
    const ring = this.add.graphics();
    ring.lineStyle(7 * u, 0xd9503f, 1).strokeCircle(0, 0, 13 * u);
    ring.lineStyle(7 * u, 0xffffff, 1);
    for (let k = 0; k < 4; k++) ring.beginPath().arc(0, 0, 13 * u, (k * Math.PI) / 2, (k * Math.PI) / 2 + 0.6).strokePath();
    const f = this.add.sprite(0, -6 * u, 'life_angler_idle', 0).setOrigin(0.5, 1).setScale(2.4 * u).play('life-angler-idle');
    const swimmer = this.add.container(this.W * 0.55, horizon + 60 * u, [f, ring]);
    this.stage.add(swimmer);
    this.tweens.add({ targets: swimmer, y: swimmer.y - 5 * u, angle: { from: -6, to: 6 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: swimmer, x: this.W * 0.2, duration: 7000, ease: 'Linear' });
    this.time.delayedCall(1800, () => this.bubble(swimmer.x - 40 * u, swimmer.y - 60 * u, t('intro.bubble.fisher'), 0, 3000));
    this.subtitle(t('intro.s5'), 3600);
  }

  /** 6: Der Oktopus allein an Deck. Das Funkgerät knackt. */
  private shotAlone(): void {
    const u = this.u;
    const horizon = this.seaAndSky(0.68);
    this.waveG!.setData('horizon', horizon);
    const b = this.boat(this.W * 0.5, horizon + 18 * u, 4.6 * u);
    const deckY = horizon - 44 * u;
    const octo = this.add.sprite(b.x - 30 * u, deckY + 26 * u, 'anim_bert_raw', 0).setOrigin(0.5, 1).setScale(1 * u).play('in-octo-raw');
    this.stage.add(octo);
    this.tweens.add({ targets: octo, scaleX: { from: 1 * u, to: -1 * u }, duration: 900, yoyo: true, repeat: 2, hold: 500 });
    const radio = this.add.rectangle(b.x + 60 * u, deckY - 20 * u, 22 * u, 16 * u, 0x2a3a4a).setStrokeStyle(2, 0x0e1a2b);
    const led = this.add.circle(radio.x + 6 * u, radio.y - 3 * u, 2.5 * u, 0xff6b6b);
    const antenna = this.add.rectangle(radio.x - 6 * u, radio.y - 16 * u, 2 * u, 16 * u, 0x0e1a2b);
    this.stage.add([radio, led, antenna]);
    this.tweens.add({ targets: led, alpha: 0.2, duration: 250, yoyo: true, repeat: -1, delay: 2000 });
    this.time.delayedCall(2000, () => {
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 160, () => play('talk', 0.5));
      this.tweens.add({ targets: radio, x: radio.x + 2, duration: 50, yoyo: true, repeat: 6 });
    });
    this.bubble(radio.x, radio.y - 24 * u, t('intro.bubble.radio'), 2300, 3500);
    this.subtitle(t('intro.s6'), 300);
  }

  /** 7: Großaufnahme: Mantel, Hut, Brille, Nase, Bart, Teil für Teil. */
  private shotDress(): void {
    const { W, H, u } = this;
    const g = this.add.graphics();
    g.fillStyle(0x141418, 1).fillRect(0, 0, W, H);
    for (let r = 10; r > 0; r--) {
      g.fillStyle(0xfff6d0, 0.025);
      g.fillCircle(W / 2, H * 0.55, r * 24 * u);
    }
    const s = Math.min(W, H * 0.9) / 96 * 0.75;
    const octo = this.add.sprite(W / 2, H * 0.86, 'anim_bert_dressup', 0).setOrigin(0.5, 1).setScale(s).play('in-octo-dressup');
    this.stage.add([g, octo]);
    play('chest');
    // Bei jedem Teil ein kleiner Ruck und ein Ton
    for (let k = 1; k <= 5; k++)
      this.time.delayedCall(k * 1000, () => {
        this.tweens.add({ targets: octo, scaleY: s * 1.05, duration: 90, yoyo: true });
        play('tap', 1 + k * 0.1);
      });
    this.subtitle(t('intro.s7'), 300);
  }

  /** 8: Ins Funkgerät: „Alles … normal!“ */
  private shotNormal(): void {
    const { W, H } = this;
    const g = this.add.graphics();
    g.fillStyle(0x141418, 1).fillRect(0, 0, W, H);
    g.fillStyle(0xfff6d0, 0.12).fillTriangle(W / 2 - 40, 0, W / 2 + 40, 0, W / 2 + 200, H);
    g.fillStyle(0xfff6d0, 0.12).fillTriangle(W / 2 - 40, 0, W / 2 - 200, H, W / 2 + 200, H);
    const s = Math.min(W * 0.6, H * 0.62) / 96;
    const octo = this.add.sprite(W / 2, H * 0.98, 'anim_bert_busted', 0).setOrigin(0.5, 1).setScale(s).play('in-octo-busted');
    this.stage.add([g, octo]);
    this.bubble(W / 2, H * 0.98 - 96 * s - 6, t('intro.bubble.octo'), 700, 3200);
  }

  /** 9: Titelkarte mit Bert, Konfetti und Fanfare. */
  private shotTitle(): void {
    const { W, H, u } = this;
    const g = this.add.graphics();
    for (let y = 0; y < H; y += 18 * u)
      for (let x = ((y / (18 * u)) % 2) * 9 * u; x < W; x += 18 * u) {
        g.fillStyle(0xffb238, 0.9).fillCircle(x, y, 5 * u);
        g.fillStyle(0xfff6c0, 1).fillCircle(x, y, 2 * u);
      }
    const bg = this.add.rectangle(0, 0, W, H, 0x3a1c08).setOrigin(0);
    const s = Math.min(W * 0.62, H * 0.6) / 96;
    const octo = this.add.sprite(W / 2, H * 0.98, 'anim_bert_happy', 0).setOrigin(0.5, 1).setScale(s).play('in-octo-happy');
    const title = this.add
      .text(W / 2, H * 0.17, t('intro.title'), { fontFamily: '"Baloo 2", sans-serif', fontSize: `${Math.round(Math.min(W * 0.11, H * 0.14))}px`, fontStyle: '800', color: '#ffd23f', stroke: '#0e1a2b', strokeThickness: 10 })
      .setOrigin(0.5)
      .setScale(0);
    this.stage.add([bg, g, octo, title]);
    this.tweens.add({ targets: title, scale: 1, angle: { from: -10, to: -3 }, duration: 500, ease: 'Back.Out', delay: 300 });
    play('fanfare');
    for (let i = 0; i < 40; i++) {
      const c = this.add.rectangle(this.rng.range(0, W), -10, 6 * u, 4 * u, Phaser.Display.Color.HSVToRGB(this.rng.next(), 0.8, 1).color);
      this.stage.add(c);
      this.tweens.add({ targets: c, y: H + 20, angle: 720, x: c.x + this.rng.range(-40, 40), duration: this.rng.range(2200, 4200), delay: this.rng.range(0, 1500) });
    }
    this.subtitle(t('intro.s8'), 1200);
  }
}
