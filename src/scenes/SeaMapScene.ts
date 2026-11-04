import Phaser from 'phaser';
import { bottles, timeParams, homeOf, mapParams, prestigeParams, seaById, seas, species, spotById, spotsIn, upgradeById } from '../data';
import { isLegend, isNight } from '../systems/legend';
import { canMoveOn, missingLegend, knownInSea, moveOn, nextSea } from '../systems/prestige';
import { distance, flotsam, flotsamTaken, spotUnlocked, takeFlotsam, type Flotsam, type Point, type SpotDef } from '../systems/seaMap';
import { routeBetween, routeCurve, routeLayout } from '../systems/route';
import { Sheet } from '../ui/Sheet';
import { buyUpgrade, isMaxed, upgradeCost, upgradeValue } from '../systems/economy';
import { createRng } from '../systems/rng';
import type { Save } from '../systems/save';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { MapUi } from '../ui/MapUi';
import { play } from '../audio/sfx';

const SPACING = 150;
const NODE_R = 34;
/** Meere, die nach den spielbaren noch kommen (Teaser auf der Route). */
const FUTURE = [
  { key: 'map.future.3', icon: '🧊' },
  { key: 'map.future.4', icon: '✨' },
  { key: 'map.future.5', icon: '🌋' },
  { key: 'map.future.6', icon: '🦖' },
];

interface Station {
  kind: 'spot' | 'sea' | 'future';
  spot?: SpotDef;
  seaId?: string;
  name: string;
  icon: string;
  state: 'here' | 'open' | 'locked' | 'ready' | 'soon';
  sub: string;
  badge?: string;
  ring?: Phaser.GameObjects.Arc;
}

/**
 * Seekarte als Route nach Norden (wie Level-Karten in Mobile-Spielen): unten der Heimathafen,
 * darüber die Plätze des Meeres als runde Symbole, ganz oben die nächsten Meere.
 * Station antippen: der Kutter fährt die Route entlang und angelt dort los. Ziehen scrollt die Karte.
 */
export class SeaMapScene extends Phaser.Scene {
  private save!: Save;
  private ui!: MapUi;
  private sheet!: Sheet;
  private home!: SpotDef;
  private stations: Station[] = [];
  private nodes: Point[] = [];
  private boat!: Phaser.GameObjects.Image;
  private boatAt = 0;
  private travelling = false;
  private dragY: number | null = null;
  private dragged = 0;
  private crates = new Map<number, Phaser.GameObjects.Image>();

  constructor() {
    super('SeaMap');
  }

  private get range(): number {
    return upgradeValue(upgradeById('engine'), this.save.upgrades.engine);
  }

  create(): void {
    this.save = loadSave(Date.now());
    this.home = homeOf(this.save.sea.current);
    this.travelling = false;
    this.crates = new Map();

    const root = document.getElementById('ui') as HTMLElement;
    root.replaceChildren();
    root.className = 'map-ui';
    this.ui = new MapUi(root, upgradeById('engine'), {
      back: () => this.leave(this.save.map.spot),
      buyEngine: () => this.buyEngine(),
      prestige: () => this.offerPrestige(),
    });
    this.sheet = new Sheet(root);

    this.buildStations();
    const W = this.scale.width;
    const layout = routeLayout(this.stations.length, W, SPACING);
    this.nodes = layout.nodes;
    this.drawSea(W, layout.height);
    this.drawRoute();
    this.drawStations();
    this.spawnFlotsam();

    this.boatAt = Math.max(0, this.stations.findIndex((s) => s.spot?.id === this.save.map.spot));
    const at = this.nodes[this.boatAt]!;
    this.boat = this.add.image(at.x + (at.x > this.scale.width / 2 ? -66 : 66), at.y + 6, 'boat_top').setScale(2).setDepth(6).setRotation(-Math.PI / 2);
    this.tweens.add({ targets: this.boat, scale: 2.1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    if (isNight(this.save.stats.casts, timeParams)) this.add.rectangle(0, 0, W, layout.height, 0x0b1630, 0.35).setOrigin(0).setDepth(4.5);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#1f6f9a');
    cam.setBounds(0, 0, W, layout.height);
    cam.centerOn(W / 2, at.y - this.scale.height * 0.1);
    this.setupInput();
    this.refresh();
    const toast = this.registry.get('mapToast') as string | undefined;
    if (toast) {
      this.registry.set('mapToast', undefined);
      this.time.delayedCall(300, () => this.ui.say(toast, 3));
    }
    if (this.registry.get('firstTrip')) {
      this.registry.set('firstTrip', false);
      this.time.delayedCall(500, () => this.ui.say(t('tut.firstTrip'), 4));
    }
    if (location.hash.includes('debug')) (window as unknown as { inkognitoMap: unknown }).inkognitoMap = { pick: (i: number) => this.pick(i), stations: () => this.stations.map((x) => x.name) };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui.destroy());
  }

  // ---------------------------------------------------------------- Stationen

  /** Heimathafen, die Plätze nach Reichweite sortiert, dann das nächste Meer und die kommenden. */
  private buildStations(): void {
    const sea = seaById(this.save.sea.current);
    const spots = spotsIn(sea.id)
      .filter((s) => !s.harbor)
      .sort((a, b) => distance(a, this.home) - distance(b, this.home));
    const tip = this.save.perks.tip;
    const legend = missingLegend(this.save, species, sea.id);
    const spotStation = (s: SpotDef): Station => {
      const open = spotUnlocked(s, this.home, this.range);
      return {
        kind: 'spot',
        spot: s,
        name: t(s.nameKey),
        icon: s.icon,
        state: s.id === this.save.map.spot ? 'here' : open ? 'open' : 'locked',
        sub: open ? t('map.depth', { max: s.maxMeters.toLocaleString('de-DE') }) : t('map.needEngineShort'),
        badge:
          tip?.spot === s.id
            ? t('map.badge.swarm')
            : legend && isLegend(legend) && legend.legend.spot === s.id && this.save.legend.hints[sea.id]
              ? t('map.badge.legend')
              : undefined,
      };
    };
    this.stations = [spotStation(this.home), ...spots.map(spotStation)];
    const index = seas.findIndex((x) => x.id === sea.id);
    const next = nextSea(seas, sea.id);
    if (next) {
      const ready = canMoveOn(this.save, seas, species);
      this.stations.push({ kind: 'sea', seaId: next.id, name: t('map.section.sea', { n: index + 2, name: t(next.nameKey) }), icon: next.icon, state: ready ? 'ready' : 'locked', sub: ready ? t('map.gate.ready') : t('map.gate.locked') });
    }
    // Die Meere, die noch gebaut werden, als Ausblick ganz oben
    for (const f of FUTURE) {
      const n = Number(f.key.split('.').pop());
      if (n > seas.length) this.stations.push({ kind: 'future', name: t('map.section.sea', { n, name: t(f.key) }), icon: f.icon, state: 'soon', sub: t('map.soon') });
    }
  }

  // ---------------------------------------------------------------- Zeichnen

  /** Meer von hellem Küstenwasser (unten) zu dunkler Hochsee (Norden), Wellen, Inselchen, Kompass. */
  private drawSea(W: number, H: number): void {
    const g = this.add.graphics().setDepth(0);
    const bottom = Phaser.Display.Color.HexStringToColor('#7fdcd8');
    const top = Phaser.Display.Color.HexStringToColor('#123a6e');
    for (let y = 0; y < H; y += 24) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, H, y);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, y, W, 25);
    }
    const rng = createRng('route-sea');
    const waves = this.add.graphics().setDepth(1);
    waves.lineStyle(2, 0xffffff, 0.22);
    for (let i = 0; i < Math.round(H / 26); i++) {
      const x = rng.range(10, W - 30);
      const y = rng.range(40, H - 20);
      waves.beginPath().arc(x, y, 8, Math.PI * 1.1, Math.PI * 1.9).strokePath();
      waves.beginPath().arc(x + 14, y, 8, Math.PI * 1.1, Math.PI * 1.9).strokePath();
    }
    // Inselchen am Rand, damit die Route nicht im Leeren hängt
    const land = this.add.graphics().setDepth(1);
    for (let i = 0; i < Math.round(H / 260); i++) {
      const left = i % 2 === 0;
      const x = left ? rng.range(-20, W * 0.12) : rng.range(W * 0.88, W + 20);
      const y = rng.range(120, H - 160);
      land.fillStyle(0xe8d29a, 1).fillEllipse(x, y, 90, 50);
      land.fillStyle(0x6fbf5a, 1).fillEllipse(x, y - 4, 66, 32);
      this.add.text(x, y - 10, rng.next() < 0.5 ? '🌴' : '🪨', { fontSize: '22px' }).setOrigin(0.5).setDepth(1.1);
    }
    // Heimatküste ganz unten
    land.fillStyle(0xe8d29a, 1).fillEllipse(W / 2, H + 40, W * 1.4, 180);
    land.fillStyle(0x6fbf5a, 1).fillEllipse(W / 2, H + 60, W * 1.3, 150);
    // Kompass: Norden ist oben
    this.add.text(W - 34, 70, '🧭', { fontSize: '30px' }).setOrigin(0.5).setDepth(2);
    this.add
      .text(W - 34, 100, t('map.north'), { fontFamily: '"Baloo 2", sans-serif', fontSize: '14px', fontStyle: '800', color: '#fffaf0', stroke: '#0e1a2b', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(2);
  }

  /** Gepunktete Route; Abschnitte zu gesperrten Stationen blasser. */
  private drawRoute(): void {
    const g = this.add.graphics().setDepth(2);
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const pts = routeCurve(this.nodes[i]!, this.nodes[i + 1]!, 22);
      const open = ['here', 'open', 'ready'].includes(this.stations[i + 1]!.state);
      g.fillStyle(0x0e1a2b, open ? 0.35 : 0.15);
      for (const p of pts) g.fillCircle(p.x + 1, p.y + 2, 5);
      g.fillStyle(0xfffaf0, open ? 0.95 : 0.35);
      for (const p of pts) g.fillCircle(p.x, p.y, 4);
    }
  }

  /** Runde Symbole mit Namen; antippbar. */
  private drawStations(): void {
    const colors = { here: 0x7bd88f, open: 0xffd23f, ready: 0xff8ab8, locked: 0x8a93a3, soon: 0x5a6a80 } as const;
    this.stations.forEach((s, i) => {
      const p = this.nodes[i]!;
      this.add.circle(p.x + 2, p.y + 5, NODE_R, 0x0e1a2b, 0.45).setDepth(3);
      const ring = this.add.circle(p.x, p.y, NODE_R, colors[s.state]).setStrokeStyle(4, 0x0e1a2b).setDepth(3.1);
      this.add.circle(p.x, p.y, NODE_R - 8, 0xfffaf0, s.state === 'locked' || s.state === 'soon' ? 0.55 : 1).setDepth(3.2);
      this.add
        .text(p.x, p.y + 1, s.state === 'locked' || s.state === 'soon' ? '🔒' : s.icon, { fontSize: '28px' })
        .setOrigin(0.5)
        .setDepth(3.3)
        .setAlpha(s.state === 'soon' ? 0.7 : 1);
      if (s.state === 'locked' && s.kind !== 'future') this.add.text(p.x + 20, p.y - 22, s.icon, { fontSize: '16px' }).setOrigin(0.5).setDepth(3.4);
      const labelX = p.x + (i === 0 ? 0 : p.x < this.scale.width / 2 ? 0 : 0);
      this.add
        .text(labelX, p.y + NODE_R + 6, s.name, { fontFamily: '"Baloo 2", sans-serif', fontSize: '17px', fontStyle: '800', color: '#fffaf0', stroke: '#0e1a2b', strokeThickness: 5, align: 'center', wordWrap: { width: 170 } })
        .setOrigin(0.5, 0)
        .setDepth(3.5);
      this.add
        .text(labelX, p.y + NODE_R + 28, s.sub, { fontFamily: '"Nunito", sans-serif', fontSize: '13px', fontStyle: '800', color: '#dff6ff', stroke: '#0e1a2b', strokeThickness: 4, align: 'center', wordWrap: { width: 170 } })
        .setOrigin(0.5, 0)
        .setDepth(3.5);
      if (s.badge) {
        const b = this.add
          .text(p.x + NODE_R - 4, p.y - NODE_R + 2, s.badge, { fontFamily: '"Baloo 2", sans-serif', fontSize: '13px', fontStyle: '800', color: '#0e1a2b', backgroundColor: '#ffd23f', padding: { x: 6, y: 1 } })
          .setOrigin(0, 0.5)
          .setDepth(3.6);
        this.tweens.add({ targets: b, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      if (s.state === 'ready' || (this.registry.get('firstTrip') && i === 1)) {
        this.tweens.add({ targets: ring, scale: 1.15, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      s.ring = ring;
      ring.setInteractive(new Phaser.Geom.Circle(NODE_R, NODE_R, NODE_R + 12), Phaser.Geom.Circle.Contains);
      ring.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.dragged < 10 && this.pick(i));
    });
  }

  /** Treibgut liegt neben der Route zwischen erreichbaren Stationen; antippen sammelt es ein. */
  private spawnFlotsam(): void {
    for (const c of this.crates.values()) c.destroy();
    this.crates.clear();
    const reachable = this.stations.filter((s) => s.state === 'here' || s.state === 'open').length;
    if (reachable < 2) return;
    const rng = createRng(`${this.save.createdAt}-route-${this.save.stats.casts}`);
    // Höchstens zwei Fundstücke je Abschnitt, damit die Route übersichtlich bleibt
    const pieces = flotsam(`${this.save.createdAt}-flotsam-${this.save.stats.casts}`, this.home, this.range, mapParams).slice(0, (reachable - 1) * 2);
    for (const piece of pieces) {
      if (flotsamTaken(this.save, piece.id)) continue;
      // Mitte eines Abschnitts, seitlich neben der Route, nie auf einer Station
      const seg = piece.id % (reachable - 1);
      const pts = routeCurve(this.nodes[seg]!, this.nodes[seg + 1]!);
      const p = pts[Math.round((pts.length - 1) * rng.range(0.25, 0.42))]!;
      const x = Phaser.Math.Clamp(p.x + (rng.next() < 0.5 ? -1 : 1) * rng.range(60, 100), 30, this.scale.width - 30);
      const sprite = this.add.image(x, p.y, piece.bottle ? 'fx_bottle' : 'fx_crate').setScale(2.5).setDepth(4);
      this.tweens.add({ targets: sprite, y: p.y - 5, angle: 8, duration: 1100 + piece.id * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      sprite.setInteractive({ useHandCursor: true });
      sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.dragged < 10 && this.collect(piece, sprite));
      this.crates.set(piece.id, sprite);
    }
  }

  // ---------------------------------------------------------------- Bedienung

  /** Ziehen scrollt nach Norden/Süden; kurzes Antippen zählt als Tipp. */
  private setupInput(): void {
    const input = this.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragY = p.y;
      this.dragged = 0;
    });
    input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.dragY === null || !p.isDown || this.sheet.open) return;
      const dy = p.y - this.dragY;
      this.dragY = p.y;
      this.dragged += Math.abs(dy);
      this.cameras.main.scrollY -= dy;
    });
    input.on(Phaser.Input.Events.POINTER_UP, () => (this.dragY = null));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN);
      input.off(Phaser.Input.Events.POINTER_MOVE);
      input.off(Phaser.Input.Events.POINTER_UP);
    });
  }

  private pick(i: number): void {
    if (this.travelling || this.sheet.open) return;
    const s = this.stations[i]!;
    if (s.kind === 'future') return this.ui.say(t('map.soonSay', { name: s.name }), 3);
    if (s.kind === 'sea') {
      if (s.state === 'ready') return this.offerPrestige();
      play('error');
      return this.ui.say(this.gateText(), 3.5);
    }
    if (s.state === 'locked') {
      play('error');
      this.tweens.add({ targets: s.ring, x: s.ring!.x + 6, duration: 50, yoyo: true, repeat: 3 });
      return this.ui.say(t('map.locked', { name: s.name }), 3);
    }
    play('tap');
    if (i === this.boatAt) return this.leave(s.spot!.id);
    this.sail(i, () => this.leave(s.spot!.id));
  }

  /** Was zum nächsten Meer noch fehlt. */
  private gateText(): string {
    const sea = seaById(this.save.sea.current);
    const known = knownInSea(this.save, species, sea.id);
    const legend = missingLegend(this.save, species, sea.id);
    if (sea.nextKnown !== null && known < sea.nextKnown) return t('prestige.progress', { known, need: sea.nextKnown });
    return legend && isLegend(legend) ? t('prestige.legend', { legend: t(legend.legend.nameKey) }) : t('map.gate.locked');
  }

  /** Kutter fährt die Route entlang zur Station `to`, die Kamera folgt. */
  private sail(to: number, done: () => void): void {
    this.travelling = true;
    const path = routeBetween(this.nodes, this.boatAt, to);
    const name = this.stations[to]!.name;
    this.ui.say(t('map.sailing', { name }), 2);
    this.cameras.main.startFollow(this.boat, true, 0.1, 0.1);
    const duration = Math.min(2600, 260 * Math.abs(to - this.boatAt) + 500);
    this.tweens.addCounter({
      from: 0,
      to: path.length - 1,
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const a = path[Math.floor(k)]!;
        const b = path[Math.min(path.length - 1, Math.floor(k) + 1)]!;
        const f = k - Math.floor(k);
        const x = a.x + (b.x - a.x) * f;
        const y = a.y + (b.y - a.y) * f;
        if (b.x !== a.x || b.y !== a.y) this.boat.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
        this.boat.setPosition(x, y);
      },
      onComplete: () => {
        this.boatAt = to;
        done();
      },
    });
  }

  private collect(piece: Flotsam, sprite: Phaser.GameObjects.Image): void {
    if (this.travelling) return;
    const letter = bottles[this.save.map.bottlesRead % bottles.length]!;
    this.save = takeFlotsam(this.save, piece);
    writeSave(this.save);
    this.crates.delete(piece.id);
    play('coin');
    const cam = this.cameras.main;
    this.ui.floater(t('map.flotsam', { coins: piece.coins }), sprite.x - cam.worldView.x, sprite.y - cam.worldView.y - 20, '#ffd23f');
    this.tweens.add({ targets: sprite, scale: 0, angle: 180, duration: 250, onComplete: () => sprite.destroy() });
    if (piece.bottle) this.readBottle(letter, piece.coins);
    this.refresh();
  }

  private nextSpot(): SpotDef | null {
    if (isMaxed(upgradeById('engine'), this.save.upgrades.engine)) return null;
    const next = upgradeValue(upgradeById('engine'), this.save.upgrades.engine + 1);
    return spotsIn(this.save.sea.current).find((s) => !spotUnlocked(s, this.home, this.range) && spotUnlocked(s, this.home, next)) ?? null;
  }

  private refresh(): void {
    this.ui.update(this.save, this.nextSpot());
    const sea = seaById(this.save.sea.current);
    const next = nextSea(seas, sea.id);
    const legend = missingLegend(this.save, species, sea.id);
    this.ui.showPrestige(
      next && sea.nextKnown !== null
        ? { known: knownInSea(this.save, species, sea.id), need: sea.nextKnown, nextName: t(next.nameKey), legend: legend && isLegend(legend) ? t(legend.legend.nameKey) : null }
        : null,
      canMoveOn(this.save, seas, species),
    );
  }

  /** Motor kaufen: neue Station wird erreichbar, die Karte baut sich neu auf. */
  private buyEngine(): void {
    const def = upgradeById('engine');
    const level = this.save.upgrades.engine;
    if (isMaxed(def, level) || this.save.coins < upgradeCost(def, level) || this.travelling) return;
    const unlocked = this.nextSpot();
    this.save = buyUpgrade(this.save, def, Date.now());
    writeSave(this.save);
    play('upgrade');
    if (unlocked) {
      play('levelUp');
      this.cameras.main.flash(200, 255, 230, 120);
      this.registry.set('mapToast', t('spot.arrive', { name: t(unlocked.nameKey), max: unlocked.maxMeters.toLocaleString('de-DE') }));
    }
    this.scene.restart();
  }

  private readBottle(letter: string, coins: number): void {
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
    play('tap');
    const bonus = Math.round(prestigeParams.coinBonusPerSea * 100);
    this.sheet.show(t('prestige.title'), t('prestige.text', { sea: t(next.nameKey), desc: t(next.descKey), bonus }), [
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
    ]);
  }

  private leave(spotId: string): void {
    this.save = { ...this.save, map: { ...this.save.map, spot: spotById(spotId).id } };
    writeSave(this.save);
    play('splash');
    this.cameras.main.fadeOut(250, 11, 53, 80);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Fishing'));
  }
}
