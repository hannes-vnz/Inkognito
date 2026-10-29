import Phaser from 'phaser';
import { bottles, timeParams, homeOf, mapParams, prestigeParams, seaById, seas, species, spotById, spotsIn, upgradeById } from '../data';
import { isNight } from '../systems/legend';
import { canMoveOn, knownInSea, moveOn, nextSea } from '../systems/prestige';
import type { SpotDef } from '../systems/seaMap';
import { Sheet } from '../ui/Sheet';
import { clampToRange, flotsam, flotsamTaken, spotAt, spotUnlocked, stepBoat, takeFlotsam, type Boat, type Flotsam, type Point } from '../systems/seaMap';
import { buyUpgrade, isMaxed, upgradeCost, upgradeValue } from '../systems/economy';
import { createRng } from '../systems/rng';
import type { Save } from '../systems/save';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { MapUi } from '../ui/MapUi';
import { play } from '../audio/sfx';

const BOAT_SCALE = 2;

/**
 * Seekarte von oben: Kutter frei fahren (Daumen ziehen oder Pfeiltasten), Bojen sind Angelplätze.
 * Die Motor-Reichweite um den Hafen bestimmt, wie weit man rauskommt; Treibgut gibt Münzen.
 */
export class SeaMapScene extends Phaser.Scene {
  private save!: Save;
  private ui!: MapUi;
  private home!: SpotDef;
  private seaSpots: SpotDef[] = [];
  private sheet!: Sheet;
  private boat!: Boat;
  private boatSprite!: Phaser.GameObjects.Image;
  private wake!: Phaser.GameObjects.Graphics;
  private rangeRing!: Phaser.GameObjects.Graphics;
  private target: Point | null = null;
  private crates = new Map<number, { piece: Flotsam; sprite: Phaser.GameObjects.Image }>();
  private buoys = new Map<string, { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  private limitedSaid = 0;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private wakeDots: { x: number; y: number; age: number }[] = [];

  constructor() {
    super('SeaMap');
  }

  private get range(): number {
    return upgradeValue(upgradeById('engine'), this.save.upgrades.engine);
  }

  create(): void {
    this.save = loadSave(Date.now());
    this.home = homeOf(this.save.sea.current);
    this.seaSpots = spotsIn(this.save.sea.current);
    this.crates = new Map();
    this.buoys = new Map();
    this.keys = [];
    this.wakeDots = [];
    this.target = null;
    const start = spotById(this.save.map.spot);
    this.boat = { x: start.x + 40, y: start.y + 10, heading: -Math.PI / 4 };

    const root = document.getElementById('ui') as HTMLElement;
    root.replaceChildren();
    root.className = 'map-ui';
    this.ui = new MapUi(root, upgradeById('engine'), {
      back: () => this.leave(this.save.map.spot),
      fish: () => {
        const here = this.spotHere();
        if (here) this.leave(here.id);
      },
      buyEngine: () => this.buyEngine(),
      prestige: () => this.offerPrestige(),
    });

    this.sheet = new Sheet(root);
    this.drawSea();
    this.rangeRing = this.add.graphics().setDepth(2);
    this.drawRange();
    for (const s of this.seaSpots) {
      const icon = this.add.image(s.x, s.y, 'buoy').setScale(3).setOrigin(0.5, 0.8).setDepth(3);
      this.tweens.add({ targets: icon, angle: { from: -6, to: 6 }, duration: 900 + s.x, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const label = this.add
        .text(s.x, s.y - 62, t(s.nameKey), { fontFamily: '"Baloo 2", sans-serif', fontSize: '18px', fontStyle: '800', color: '#fffaf0', stroke: '#0e1a2b', strokeThickness: 5 })
        .setOrigin(0.5, 1)
        .setDepth(6);
      this.buoys.set(s.id, { icon, label });
    }
    this.spawnFlotsam();

    this.wake = this.add.graphics().setDepth(4);
    this.boatSprite = this.add.image(this.boat.x, this.boat.y, 'boat_top').setScale(BOAT_SCALE).setDepth(5);
    this.tweens.add({ targets: this.boatSprite, scale: BOAT_SCALE * 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    if (isNight(this.save.stats.casts, timeParams)) {
      // Nacht: dunkler Schleier über der Karte, die Bojen-Namen bleiben lesbar
      this.add.rectangle(0, 0, 4000, 4000, 0x0b1630, 0.5).setOrigin(0).setScrollFactor(0).setDepth(4.5);
    }
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1f6f9a');
    cam.setBounds(-200, -200, mapParams.worldSize + 400, mapParams.worldSize + 400);
    cam.startFollow(this.boatSprite, true, 0.12, 0.12);

    const input = this.input;
    const aim = (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.sheet.open) this.target = { x: p.worldX, y: p.worldY };
    };
    input.on(Phaser.Input.Events.POINTER_DOWN, aim);
    input.on(Phaser.Input.Events.POINTER_MOVE, aim);
    input.on(Phaser.Input.Events.POINTER_UP, () => (this.target = null));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN);
      input.off(Phaser.Input.Events.POINTER_MOVE);
      input.off(Phaser.Input.Events.POINTER_UP);
      this.ui.destroy();
    });
    this.refresh();
  }

  /** Meer mit Wellenstrichen, Inseln am Hafen und dunkler Hochsee. */
  private drawSea(): void {
    const g = this.add.graphics().setDepth(0);
    const size = mapParams.worldSize;
    const rng = createRng('sea-map');
    // Tiefe nach Entfernung vom Hafen: je weiter weg, desto dunkler (Farben aus den Zonen des Meeres)
    const zones = seaById(this.save.sea.current).zones;
    const near = Phaser.Display.Color.HexStringToColor(zones[0]!.water[0]);
    const far = Phaser.Display.Color.HexStringToColor(zones[zones.length - 1]!.water[1]);
    for (let r = size * 1.6; r > 0; r -= 60) {
      const k = Math.min(1, r / (size * 1.4));
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        near,
        far,
        100,
        Math.round(k * 100),
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillCircle(this.home.x, this.home.y, r);
    }
    g.fillStyle(0xffffff, 0.18);
    for (let i = 0; i < 260; i++) g.fillRect(rng.range(-200, size + 200), rng.range(-200, size + 200), rng.range(6, 16), 2);
    // Küste mit Hafen unten links
    const land = this.add.graphics().setDepth(1);
    for (const [x, y, rx, ry, col] of [
      [-60, 1260, 380, 300, 0xe8d29a],
      [-80, 1280, 350, 270, 0x6fbf5a],
      [-150, 800, 230, 200, 0xe8d29a],
      [-170, 800, 205, 178, 0x6fbf5a],
      [700, 1060, 70, 40, 0xe8d29a],
      [700, 1058, 52, 28, 0x6fbf5a],
      [1050, 600, 50, 34, 0xe8d29a],
      [1050, 598, 36, 22, 0x4f9f4a],
    ] as const) {
      land.fillStyle(col, 1);
      land.fillEllipse(x, y, rx * 2, ry * 2);
    }
    land.fillStyle(0x6b4a2b, 1);
    land.fillRect(this.home.x - 60, this.home.y + 6, 10, 44);
  }

  /** Reichweite: gestrichelter Ring, dahinter Nebel. */
  private drawRange(): void {
    const g = this.rangeRing;
    g.clear();
    const r = this.range;
    g.lineStyle(3000, 0x0b1a2e, 0.55);
    g.strokeCircle(this.home.x, this.home.y, r + 1500);
    g.fillStyle(0xffffff, 0.5);
    for (let a = 0; a < Math.PI * 2; a += 0.04) g.fillCircle(this.home.x + Math.cos(a) * r, this.home.y + Math.sin(a) * r, 2.5);
  }

  private spawnFlotsam(): void {
    for (const c of this.crates.values()) c.sprite.destroy();
    this.crates.clear();
    for (const piece of flotsam(`${this.save.createdAt}-flotsam-${this.save.stats.casts}`, this.home, this.range, mapParams)) {
      if (flotsamTaken(this.save, piece.id)) continue;
      const sprite = this.add.image(piece.x, piece.y, piece.bottle ? 'fx_bottle' : 'fx_crate').setScale(2).setDepth(3);
      this.tweens.add({ targets: sprite, y: piece.y - 4, angle: 8, duration: 1100 + piece.id * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.crates.set(piece.id, { piece, sprite });
    }
  }

  private spotHere() {
    const s = spotAt(this.boat, this.seaSpots, mapParams.spotRadius);
    return s && spotUnlocked(s, this.home, this.range) ? s : null;
  }

  private nextSpot() {
    if (isMaxed(upgradeById('engine'), this.save.upgrades.engine)) return null;
    const next = upgradeValue(upgradeById('engine'), this.save.upgrades.engine + 1);
    return this.seaSpots.find((s) => !spotUnlocked(s, this.home, this.range) && spotUnlocked(s, this.home, next)) ?? null;
  }

  private refresh(): void {
    this.ui.update(this.save, this.nextSpot());
    const sea = seaById(this.save.sea.current);
    const next = nextSea(seas, sea.id);
    this.ui.showPrestige(
      next && sea.nextKnown !== null ? { known: knownInSea(this.save, species, sea.id), need: sea.nextKnown, nextName: t(next.nameKey) } : null,
      canMoveOn(this.save, seas, species),
    );
    for (const s of this.seaSpots) {
      const b = this.buoys.get(s.id)!;
      const open = spotUnlocked(s, this.home, this.range);
      b.icon.setTint(open ? 0xffffff : 0x6a7a8a);
      b.label.setAlpha(open ? 1 : 0.55);
    }
  }

  private buyEngine(): void {
    const def = upgradeById('engine');
    const level = this.save.upgrades.engine;
    if (isMaxed(def, level) || this.save.coins < upgradeCost(def, level)) return;
    const unlocked = this.nextSpot();
    this.save = buyUpgrade(this.save, def, Date.now());
    writeSave(this.save);
    play('upgrade');
    this.drawRange();
    this.spawnFlotsam();
    this.refresh();
    if (unlocked) {
      play('levelUp');
      const b = this.buoys.get(unlocked.id)!;
      this.tweens.add({ targets: b.icon, scale: 5, duration: 220, yoyo: true, ease: 'Back.Out' });
      this.cameras.main.flash(200, 255, 230, 120);
      this.ui.say(t('spot.arrive', { name: t(unlocked.nameKey), max: unlocked.maxMeters.toLocaleString('de-DE') }), 3);
    }
  }

  private readBottle(letter: string, coins: number): void {
    this.target = null;
    play('chest');
    let portrait: string | undefined;
    try {
      portrait = this.textures.getBase64('portrait_bert_shock');
    } catch {
      portrait = undefined;
    }
    this.sheet.show(t('bottle.title'), `${t(letter)} ${t('bottle.reward', { coins })}`, [{ label: t('bottle.ok'), onSelect: () => this.sheet.close() }], undefined, portrait);
  }

  /** Prestige: erklären, was bleibt und was neu beginnt, dann ins nächste Meer. */
  private offerPrestige(): void {
    const next = nextSea(seas, this.save.sea.current);
    if (!next || !canMoveOn(this.save, seas, species)) return;
    this.target = null;
    play('tap');
    const bonus = Math.round(prestigeParams.coinBonusPerSea * 100);
    this.sheet.show(
      t('prestige.title'),
      t('prestige.text', { sea: t(next.nameKey), desc: t(next.descKey), bonus }),
      [
        {
          label: t('prestige.go'),
          onSelect: () => {
            this.sheet.close();
            const home = homeOf(next.id);
            this.save = moveOn(this.save, next.id, home.id, Date.now());
            writeSave(this.save);
            play('fanfare');
            this.cameras.main.flash(400, 255, 255, 255);
            this.ui.say(t('prestige.arrive', { sea: t(next.nameKey), bonus: bonus * this.save.sea.left.length }), 4);
            this.time.delayedCall(900, () => this.leave(home.id));
          },
        },
        { label: t('prestige.stay'), onSelect: () => this.sheet.close() },
      ],
    );
  }

  private leave(spotId: string): void {
    this.save = { ...this.save, map: { ...this.save.map, spot: spotId } };
    writeSave(this.save);
    play('splash');
    this.cameras.main.fadeOut(250, 11, 53, 80);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Fishing'));
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    let target = this.target;
    const kb = this.input.keyboard;
    if (kb) {
      if (this.keys.length === 0) this.keys = ['LEFT', 'RIGHT', 'UP', 'DOWN'].map((k) => kb.addKey(k));
      const [l, r, u, d] = this.keys.map((k) => (k.isDown ? 1 : 0)) as [number, number, number, number];
      if (l || r || u || d) target = { x: this.boat.x + (r - l) * 100, y: this.boat.y + (d - u) * 100 };
    }
    const moved = stepBoat(this.boat, target, mapParams.boatSpeed, dt);
    const clamped = clampToRange(moved, this.home, this.range, mapParams.worldSize);
    if (clamped.limited && this.time.now - this.limitedSaid > 4000) {
      this.limitedSaid = this.time.now;
      this.ui.say(t('map.range'), 2.5);
      this.cameras.main.shake(120, 0.004);
    }
    const moving = clamped.x !== this.boat.x || clamped.y !== this.boat.y;
    this.boat = { x: clamped.x, y: clamped.y, heading: moved.heading };
    this.boatSprite.setPosition(this.boat.x, this.boat.y).setRotation(this.boat.heading);

    // Kielwasser
    if (moving) this.wakeDots.push({ x: this.boat.x - Math.cos(this.boat.heading) * 26, y: this.boat.y - Math.sin(this.boat.heading) * 26, age: 0 });
    this.wake.clear();
    for (const w of this.wakeDots) {
      w.age += dt;
      this.wake.fillStyle(0xffffff, Math.max(0, 0.5 - w.age * 0.5));
      this.wake.fillCircle(w.x, w.y, 3 + w.age * 8);
    }
    this.wakeDots = this.wakeDots.filter((w) => w.age < 1);

    // Treibgut einsammeln
    for (const [id, c] of this.crates) {
      if (Math.hypot(c.piece.x - this.boat.x, c.piece.y - this.boat.y) > mapParams.flotsamRadius) continue;
      const letter = bottles[this.save.map.bottlesRead % bottles.length]!;
      this.save = takeFlotsam(this.save, c.piece);
      writeSave(this.save);
      this.crates.delete(id);
      play('coin');
      const cam = this.cameras.main;
      this.ui.floater(t('map.flotsam', { coins: c.piece.coins }), c.piece.x - cam.worldView.x, c.piece.y - cam.worldView.y - 20, '#ffd23f');
      this.tweens.add({ targets: c.sprite, scale: 0, angle: 180, duration: 250, onComplete: () => c.sprite.destroy() });
      if (c.piece.bottle) this.readBottle(letter, c.piece.coins);
      this.refresh();
    }

    this.ui.showSpot(this.spotHere());
  }
}
