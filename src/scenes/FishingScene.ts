import Phaser from 'phaser';
import { baitById, dailyParams, fightParams, depthMapFor, juice, species, timeParams, fixedStepHz, mapParams, params, player, prestigeParams, seas, sets, speciesById, speciesIn, spotById, upgradeById, upgrades } from '../data';
import type { SeaDepthMap } from '../data';
import { prestigeBonus } from '../systems/prestige';
import { createFight, following, stepFight, type FightState } from '../systems/fight';
import { baitCallsLegend, baitSpecies, consumeBait } from '../systems/bait';
import { castsUntilSwitch, hookHolds, isNight, legendOf, legendSpawn, markSnapped, nightSpecies, type LegendDef } from '../systems/legend';
import { spotSpecies, type SpotDef } from '../systems/seaMap';
import { play } from '../audio/sfx';
import { claimDaily, dailyReward, dailyStreak, dayKey } from '../systems/daily';
import { showDailyCard } from '../ui/DailyCard';
import { newlyCompleted, setBonus, type SetDef } from '../systems/sets';
import { playReaction } from '../ui/ReactionShot';
import { animKey } from '../entities/Octopus';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
import { Sparks, type SparkStyle } from '../render/Sparks';
import { FixedStepper } from '../systems/movement';
import { createRng } from '../systems/rng';
import { metersToY, yToMeters, zoneIndexAt } from '../systems/depthMap';
import { createRound, releaseFish, stepRound, type RoundEvent, type RoundFish, type RoundState, type SpeciesDef } from '../systems/fishing';
import { buyUpgrade, collectIdle, fishValue, upgradeCost, upgradeValue, landCatch, type UpgradeDef } from '../systems/economy';
import type { Save } from '../systems/save';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { DeckUi } from '../ui/DeckUi';
import { Sheet } from '../ui/Sheet';
import { AccountMenu } from '../ui/AccountMenu';
import { showFactCard } from '../ui/FactCard';
import { showFishbook } from '../ui/Fishbook';
import { syncNow, type SyncResult } from '../online/sync';
import { onAuthChange } from '../online/cloud';
import { Harbor } from './Harbor';

type Mode = 'deck' | 'round' | 'finale';

const color = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;
/** Anteil der Bildschirmhöhe, an dem der Haken im Abstieg steht (darunter sieht man, was kommt). */
const HOOK_SCREEN_DESCENT = 0.32;
const HOOK_SCREEN_ASCENT = 0.62;

/**
 * Das Angel-Spiel: Bert wirft vom Boot aus, der Haken fällt durch die echten Meereszonen,
 * im Abstieg ausweichen, im Aufstieg einsammeln, im Finale fliegen die Fische an Deck.
 */
export class FishingScene extends Phaser.Scene {
  private save!: Save;
  private mode: Mode = 'deck';
  private round: RoundState | null = null;
  private stepper!: FixedStepper;
  private ui!: DeckUi;
  private sheet!: Sheet;
  private account!: AccountMenu;
  private bert!: Phaser.GameObjects.Sprite;
  private boat!: Phaser.GameObjects.Image;
  private hook!: Phaser.GameObjects.Image;
  private line!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private snow!: MarineSnow;
  private bubbles!: BubbleTrail;
  private fishSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private steerX: number | null = null;
  private camY = 0;
  private worldHeight = 0;
  private zoneShown = -1;
  private idleTimer = 0;
  private uiRoot!: HTMLElement;
  private harbor!: Harbor;
  private spot!: SpotDef;
  private depth!: SeaDepthMap;
  private sparks!: Sparks;
  /** Kurzes Einfrieren beim Biss (Sekunden), damit der Treffer sitzt. */
  private hitstop = 0;
  private sky!: Phaser.GameObjects.TileSprite;
  private wave!: Phaser.GameObjects.Graphics;
  private whale!: Phaser.GameObjects.Graphics;
  private rays!: Phaser.GameObjects.Graphics;
  private worldTime = 0;
  /** Hochkant ist der Hafen breiter als der Bildschirm (Promenade zum Wischen); Runden laufen im Bildschirmausschnitt um das Boot. */
  private worldW = 0;
  private offsetX = 0;
  private drag: { x: number; scroll: number } | null = null;
  private dragged = false;
  /** Parallax-Ebenen der Tiefe (Diving Pack): ferner Hintergrund und Felsbögen. */
  private deepFar!: Phaser.GameObjects.TileSprite;
  private deepRocks!: Phaser.GameObjects.TileSprite;
  /** Legende in dieser Runde (uid), ob sie schon gesichtet wurde, und welche Art. */
  private legendUid = -1;
  private legendSeen = false;
  private legend: LegendDef | null = null;
  /** Laufender Kampf mit der Legende (Runde pausiert solange). */
  private fight: FightState | null = null;
  private limitSaid = false;

  constructor() {
    super('Fishing');
  }

  create(data: { toast?: string } = {}): void {
    const now = Date.now();
    this.mode = 'deck';
    this.round = null;
    this.keys = [];
    this.fishSprites = new Map();
    this.save = loadSave(now);
    this.spot = spotById(this.save.map.spot);
    this.depth = depthMapFor(this.save.sea.current);
    this.worldW = this.spot.harbor && this.scale.width < 600 ? 720 : this.scale.width;
    this.offsetX = (this.worldW - this.scale.width) / 2;
    this.drag = null;
    this.dragged = false;
    this.limitSaid = false;

    this.uiRoot = document.getElementById('ui') as HTMLElement;
    this.uiRoot.replaceChildren();
    this.uiRoot.className = 'fishing';
    this.ui = new DeckUi(this.uiRoot, upgrades.filter((u) => u.id !== 'engine'), {
      cast: () => this.cast(),
      buy: (u) => this.buy(u),
      book: () => this.openFishbook(),
      map: () => this.openMap(),
    });
    this.sheet = new Sheet(this.uiRoot);
    this.account = new AccountMenu(this.uiRoot, this.sheet, (r) => this.applySync(r), (text) => this.ui.say(text, 3));

    this.stepper = new FixedStepper(fixedStepHz);
    const self = this;
    this.harbor = new Harbor(this, this.uiRoot, this.sheet, {
      get save() {
        return self.save;
      },
      setSave: (s) => {
        this.save = s;
        writeSave(s);
        this.refresh(true);
      },
      canTalk: () => this.mode === 'deck' && !this.overlayOpen() && !this.dragged,
      say: (text) => this.ui.say(text, 3.5),
    });
    this.buildWorld();
    this.setupInput();
    this.refresh();

    // Crew-Einnahmen seit dem letzten Besuch (Offline-Pop-up wie bei den Idle-Vorbildern).
    const idle = collectIdle(this.save, now, upgradeById('crew'), params, setBonus(this.save, sets, 'crew'));
    this.save = idle.save;
    writeSave(this.save);
    this.refresh();
    const intro = () => this.save.stats.casts === 0 && this.ui.showHint(t('ui.hint.cast'));
    const story = () => {
      if (this.spot.harbor)
        this.harbor.playNext(() => {
          intro();
          this.harbor.announceLife();
        });
      else if (!data.toast) this.ui.say(t('spot.arrive', { name: t(this.spot.nameKey), max: this.spot.maxMeters.toLocaleString('de-DE') }), 2.5);
      if (data.toast) {
        this.ui.say(data.toast, 3);
        play(isNight(this.save.stats.casts, timeParams) ? 'night' : 'newDay');
      }
    };
    const daily = () => this.showDaily(story);
    this.time.delayedCall(400, () => (idle.coins >= 1 ? this.showOffline(idle.coins, daily) : daily()));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.ui.destroy();
    });

    void syncNow().then((r) => this.applySync(r));
    const stopAuth = onAuthChange((user) => {
      if (user && window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        void this.account.afterLogin();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAuth);

    if (new URLSearchParams(window.location.search).has('debug') || window.location.hash === '#debug') {
      (window as unknown as { inkognito: unknown }).inkognito = { fishing: this };
    }
  }

  // ---------------------------------------------------------------- Welt

  /** Himmel, Inseln, Wasser mit echten Zonenfarben, Lichtstrahlen, Boot mit Bert, Haken und Leine. */
  private buildWorld(): void {
    const width = this.worldW;
    const surface = this.depth.surfaceY;
    this.worldHeight = metersToY(this.spot.maxMeters, this.depth) + 900;

    // Himmel und Inseln oberhalb der Wasserlinie
    // Himmel als Kachel, damit die Wolken langsam ziehen
    const skyScale = Math.max(width / 1920, 1) * 0.6;
    this.sky = this.add.tileSprite(0, surface + 30, width / skyScale, 1080, 'bg_sea_0').setOrigin(0, 1).setScale(skyScale).setDepth(-20);
    const islands = this.add.image(width / 2, surface + 6, 'bg_sea_1').setOrigin(0.5, 1).setDepth(-19);
    islands.setScale(Math.max(width / islands.width, 0.5) * 0.45);

    // Wasser: jede Zone als Verlauf in ihren echten Farben
    const water = this.add.graphics().setDepth(-10);
    this.depth.zones.forEach((z) => {
      const top = metersToY(z.depthMeters[0], this.depth);
      const bottom = metersToY(z.depthMeters[1], this.depth);
      const a = color(z.water[0]);
      const b = color(z.water[1]);
      water.fillGradientStyle(a, a, b, b, 1);
      water.fillRect(0, top, width, bottom - top + 1);
    });
    const last = this.depth.zones[this.depth.zones.length - 1]!;
    water.fillStyle(color(last.water[1]), 1);
    water.fillRect(0, metersToY(last.depthMeters[1], this.depth), width, 2000);

    // Lichtstrahlen in der Sonnenlichtzone, Leuchtpunkte in der Tiefe
    const fx = this.add.graphics().setDepth(-9);
    const rng = createRng('sea-fx');
    for (let i = 0; i < 6; i++) {
      const x = rng.range(-50, width);
      const w = rng.range(30, 80);
      fx.fillStyle(0xfff6d0, rng.range(0.05, 0.1));
      fx.fillTriangle(x, surface, x + w, surface, x + w * 3 + 120, metersToY(this.depth.zones[0]!.depthMeters[1] * 0.9, this.depth));
    }
    const sparkle = this.depth.zones.find((z) => z.sparkle);
    for (let i = 0; sparkle && i < 260; i++) {
      const y = rng.range(metersToY(sparkle.depthMeters[0], this.depth), this.worldHeight);
      fx.fillStyle(rng.pick([0x5cf2ff, 0xb07cff, 0x7dff8a]), rng.range(0.2, 0.7));
      fx.fillRect(rng.range(0, width), y, 2, 2);
    }
    // Zonengrenzen als feine Linien
    for (const z of this.depth.zones.slice(1)) {
      const y = metersToY(z.depthMeters[0], this.depth);
      fx.fillStyle(0xffffff, 0.12);
      for (let x = 0; x < width; x += 16) fx.fillRect(x, y, 8, 2);
    }
    // Nacht: Himmel und Wasser dunkler, Sterne, die Leuchtpunkte bleiben hell
    if (isNight(this.save.stats.casts, timeParams)) {
      const night = this.add.graphics();
      night.fillStyle(0x0b1630, 0.62).fillRect(0, 0, width, surface).setDepth(-17);
      const dark = this.add.graphics().setDepth(-9.5);
      dark.fillStyle(0x050b1a, 0.4).fillRect(0, surface, width, this.worldHeight);
      const stars = this.add.graphics().setDepth(-16);
      for (let i = 0; i < 60; i++) {
        stars.fillStyle(0xffffff, rng.range(0.4, 1));
        stars.fillRect(rng.range(0, width), rng.range(0, surface - 60), rng.pick([1, 2]), rng.pick([1, 2]));
      }
      const moonY = surface - Math.min(170, this.scale.height * 0.3);
      stars.fillStyle(0xfff6d0, 1).fillCircle(width * 0.45, moonY, 16);
      stars.fillStyle(0x0b1630, 1).fillCircle(width * 0.45 + 7, moonY - 4, 14);
    }
    // Wasseroberfläche
    // Wasseroberfläche: wird jeden Frame neu gezeichnet und wogt
    this.wave = this.add.graphics().setDepth(5);
    // Tiefe: Hintergrund mit Lichtstrahlen und Felsbögen, blenden mit der Tiefe ein (Kamera-fest, eigene Parallaxe)
    const sh = this.scale.height;
    this.deepFar = this.add.tileSprite(0, 0, this.scale.width / 2, sh / 2, 'bg_deep_far').setOrigin(0).setScale(2).setScrollFactor(0).setDepth(-9.8).setAlpha(0);
    this.deepRocks = this.add.tileSprite(0, 0, this.scale.width, sh, 'bg_deep_rocks').setOrigin(0).setScrollFactor(0).setDepth(-9.7).setAlpha(0);
    this.buildSeabed(width);
    // Ferner Wal-Schatten zieht langsam durch die oberen Zonen (Parallaxe)
    this.whale = this.add.graphics().setDepth(-9.6).setScrollFactor(1, 0.55).setAlpha(0.16);
    this.whale.fillStyle(0x0b1e45, 1);
    this.whale.fillEllipse(0, 0, 220, 60);
    this.whale.fillTriangle(-100, 0, -170, -34, -150, 0);
    this.whale.fillTriangle(-100, 0, -170, 30, -150, 0);
    this.whale.fillTriangle(-10, 20, 30, 50, 40, 20);
    this.whale.setPosition(-200, surface + 700);
    this.rays = fx;

    this.boat = this.add.image(width / 2, surface + 18, 'boat_1').setOrigin(0.5, 1).setScale(3).setDepth(4);
    this.bert = this.add.sprite(width / 2 - 54, surface - 36, player.sprite, 0).setOrigin(0.5, 1).setScale(2).setDepth(3);
    this.bert.play(animKey(player.id, 'idle'));
    if (this.spot.harbor) this.harbor.build(width, surface);
    else islands.setVisible(false);
    this.tweens.add({ targets: [this.boat, this.bert], y: '-=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.glow = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.line = this.add.graphics().setDepth(7);
    this.hook = this.add.image(this.rodTip().x, surface, 'hook').setScale(3).setDepth(9).setVisible(false);

    const fxRng = createRng('sea-snow');
    this.snow = new MarineSnow(this, fxRng, 60, 0.85, 8);
    this.sparks = new Sparks(this, fxRng, 'fx_bubble', 13);
    this.bubbles = new BubbleTrail(this, fxRng, { maxCount: 40, perSecondAtMaxSpeed: 14, riseSpeed: 70, lifeSeconds: 1.4 }, 'fx_bubble');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, width, this.worldHeight);
    cam.scrollX = this.offsetX;
    cam.setBackgroundColor('#2fb6b8');
    this.camY = this.deckCamY();
    cam.scrollY = this.camY;
  }

  /** Kamera an Deck: Wasserlinie bei etwa 45 % der Bildschirmhöhe. */
  private deckCamY(): number {
    return Math.max(0, this.depth.surfaceY - this.scale.height * 0.45);
  }

  private rodTip(): { x: number; y: number } {
    return { x: this.bert.x + 30, y: this.bert.y - 50 };
  }

  // ---------------------------------------------------------------- Eingabe

  private setupInput(): void {
    const input = this.input;
    const steer = (p: Phaser.Input.Pointer) => {
      if (this.mode === 'round' && p.isDown) this.steerX = p.x;
    };
    input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.mode === 'round') this.steerX = p.x;
      // An Deck: seitlich wischen, um den ganzen Hafen zu sehen
      this.dragged = false;
      this.drag = this.mode === 'deck' && this.worldW > this.scale.width ? { x: p.x, scroll: this.cameras.main.scrollX } : null;
    });
    input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown || this.mode !== 'deck') return;
      const dx = p.x - this.drag.x;
      if (Math.abs(dx) > 8) this.dragged = true;
      if (this.dragged) this.cameras.main.scrollX = Phaser.Math.Clamp(this.drag.scroll - dx, 0, this.worldW - this.scale.width);
    });
    input.on(Phaser.Input.Events.POINTER_UP, () => (this.drag = null));
    input.on(Phaser.Input.Events.POINTER_MOVE, steer);
    // Maus ohne gedrückte Taste lenkt auch (Desktop)
    input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.mode === 'round' && !p.wasTouch) this.steerX = p.x;
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.mode === 'deck' && !this.overlayOpen() && this.cast());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN);
      input.off(Phaser.Input.Events.POINTER_MOVE);
      input.off(Phaser.Input.Events.POINTER_UP);
      kb?.off('keydown-SPACE');
    });
  }

  private overlayOpen(): boolean {
    return this.sheet.open || this.uiRoot.querySelector('.overlay') !== null;
  }

  private keys: Phaser.Input.Keyboard.Key[] = [];

  private keySteer(dt: number): void {
    const kb = this.input.keyboard;
    if (!kb || !this.round) return;
    if (this.keys.length === 0) this.keys = ['LEFT', 'A', 'RIGHT', 'D'].map((k) => kb.addKey(k));
    const [l, a, r, d] = this.keys as [Phaser.Input.Keyboard.Key, Phaser.Input.Keyboard.Key, Phaser.Input.Keyboard.Key, Phaser.Input.Keyboard.Key];
    const left = l.isDown || a.isDown;
    const right = r.isDown || d.isDown;
    if (left || right) this.steerX = this.round.hookX + (right ? 1 : -1) * 900 * dt;
  }

  // ---------------------------------------------------------------- Ablauf

  private cast(): void {
    if (this.mode !== 'deck') return;
    this.ui.hideHint();
    const fullLine = upgradeValue(upgradeById('line'), this.save.upgrades.line);
    const line = Math.min(fullLine, this.spot.maxMeters);
    if (fullLine > line && !this.limitSaid) {
      this.limitSaid = true;
      this.ui.say(t('spot.limit', { name: t(this.spot.nameKey), max: this.spot.maxMeters.toLocaleString('de-DE') }), 4);
    }
    const hooks = upgradeValue(upgradeById('hook'), this.save.upgrades.hook);
    const night = isNight(this.save.stats.casts, timeParams);
    const bait = baitById(this.save.bait);
    const pool = baitSpecies(nightSpecies(spotSpecies(speciesIn(this.save.sea.current), this.spot, mapParams.boostWeight), night, timeParams), bait);
    const seed = `${this.save.createdAt}-${this.save.stats.casts}`;
    this.legend = legendOf(species, this.save.sea.current);
    const legendMeters = this.legend ? legendSpawn(seed, this.legend, this.spot.id, night, line, baitCallsLegend(bait)) : null;
    const extra = this.legend && legendMeters !== null ? [{ species: this.legend, meters: legendMeters }] : [];
    this.round = createRound(seed, this.scale.width, line, hooks, pool, this.depth, params, this.spot.current, extra);
    this.legendUid = extra.length ? this.round.fish[this.round.fish.length - 1]!.uid : -1;
    this.legendSeen = false;
    this.fight = null;
    this.ui.setFight(null, null);
    if (bait) {
      this.save = consumeBait(this.save);
      writeSave(this.save);
      this.refresh();
    }
    play('cast');
    this.round.hookX = this.rodTip().x - this.offsetX;
    this.tweens.add({ targets: this.cameras.main, scrollX: this.offsetX, duration: 250, ease: 'Sine.Out' });
    this.steerX = null;
    this.zoneShown = -1;
    this.mode = 'round';
    this.ui.setMode('round');
    this.burst(this.round.hookX + this.offsetX, this.depth.surfaceY, 18, juice.splash);
    this.bert.play(animKey(player.id, 'cast'));
    this.bert.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.bert.play(animKey(player.id, 'idle')));
    this.hook.setVisible(true);
    this.stepper.reset();
    if (this.save.stats.casts === 0) this.ui.showHint(t('ui.hint.steer'));
    for (const f of this.round.fish) this.spawnFishSprite(f);
  }

  private spawnFishSprite(f: RoundFish): void {
    const def = speciesById.get(f.speciesId)!;
    const s = this.add.sprite(f.x + this.offsetX, f.y, def.sprite, 0).setScale(params.spriteScale).setDepth(8);
    s.play(animKey(def.sprite, 'swim'));
    this.fishSprites.set(f.uid, s);
  }

  private handle(events: readonly RoundEvent[]): void {
    const r = this.round!;
    const screen = (y: number) => y - this.cameras.main.scrollY;
    for (const e of events) {
      switch (e.type) {
        case 'bite':
          this.cameras.main.shake(120, 0.006);
          play('bite');
          play('reel');
          if (this.snapIfTooWeak(e.uid)) break;
          if (e.uid === this.legendUid) this.startFight();
          this.celebrateRare(e.uid);
          this.hitstop = juice.hitstopSeconds;
          this.burst(r.hookX + this.offsetX, r.hookY, 14, juice.spark);
          {
            const s = this.fishSprites.get(e.uid);
            s?.setTintFill(0xffffff);
            this.time.delayedCall(90, () => s?.clearTint());
          }
          this.ui.floater(t('round.bite'), r.hookX, screen(r.hookY) - 30, '#ffd23f');
          navigator.vibrate?.(25);
          this.ui.hideHint();
          break;
        case 'lineEnd':
          this.ui.floater(t('round.lineEnd'), r.hookX, screen(r.hookY) - 30, '#ff6b6b');
          break;
        case 'catch': {
          if (this.snapIfTooWeak(e.uid)) break;
          if (e.uid === this.legendUid) this.startFight();
          const s = this.fishSprites.get(e.uid);
          if (s) this.tweens.add({ targets: s, scale: params.spriteScale * 1.4, duration: 90, yoyo: true });
          this.celebrateRare(e.uid);
          play('catch', 1 + r.caught.length * 0.08);
          this.burst(r.hookX + this.offsetX, r.hookY, 8, juice.spark);
          this.ui.floater(`${r.caught.length}`, r.hookX + 26, screen(r.hookY) - 10, '#ffffff');
          this.bubbles.burst(r.hookX + this.offsetX, r.hookY, 5);
          navigator.vibrate?.(12);
          break;
        }
        case 'full':
          this.ui.floater(t('round.full'), r.hookX, screen(r.hookY) - 40, '#7bd88f');
          play('full');
          break;
        case 'landed':
          this.burst(r.hookX + this.offsetX, this.depth.surfaceY, 22, juice.splash);
          play('splash');
          this.finale(e.species, e.deepestMeters);
          break;
      }
    }
  }

  /** Neue Zone erreicht: beim ersten Mal ein echter Fakt zur Zone (Lernen nebenbei). */
  private checkZone(): void {
    const r = this.round!;
    const m = yToMeters(r.hookY, this.depth);
    const i = zoneIndexAt(m, this.depth);
    if (i <= this.zoneShown) return;
    this.zoneShown = i;
    const z = this.depth.zones[i]!;
    if (i > 0) this.ui.banner(t(z.nameKey));
    if (i > 0 && z.depthMeters[0] > this.save.stats.deepestMeters) this.ui.say(t(z.enterKey), 3.2);
  }

  /** Finale an Deck: Fische fliegen ins Boot, Antippen im Flug gibt doppelten Wert. */
  private finale(caught: string[], deepest: number): void {
    this.mode = 'finale';
    this.hook.setVisible(false);
    const r = this.round!;
    const combos = new Set<number>();
    const flying = r.caught.map((f, i) => {
      const s = this.fishSprites.get(f.uid)!;
      this.fishSprites.delete(f.uid);
      const targetX = this.boat.x + (i % 2 ? 1 : -1) * (20 + i * 6);
      s.setDepth(12).setInteractive();
      s.once(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        combos.add(i);
        s.setTint(0xffe27a);
        play('coin', 1 + combos.size * 0.1);
        this.cameras.main.shake(60, 0.004);
        this.ui.floater(t('round.combo'), s.x - this.cameras.main.scrollX, s.y - this.cameras.main.scrollY - 20, '#ffd23f');
        this.bubbles.burst(s.x, s.y, 6);
      });
      this.tweens.add({
        targets: s,
        x: { from: s.x, to: targetX },
        y: { from: this.depth.surfaceY, to: this.depth.surfaceY - 40 },
        angle: { from: 0, to: (i % 2 ? 1 : -1) * 360 },
        duration: params.flightSeconds * 1000,
        delay: i * 120,
        ease: 'Linear',
        onUpdate: (tw) => {
          // Bogen: zuerst hoch hinaus, dann runter aufs Deck
          const p = tw.progress;
          s.y = this.depth.surfaceY - 40 - Math.sin(p * Math.PI) * (this.scale.height * 0.35);
        },
        onComplete: () => {
          // Aufprall an Deck: Münzen spritzen, Wert ploppt auf, Ton steigt mit jedem Fisch
          const def = speciesById.get(f.speciesId)!;
          const value = fishValue(def, this.save.fishbook[def.id] !== undefined, combos.has(i), params, setBonus(this.save, sets, 'coins') + prestigeBonus(this.save, prestigeParams));
          this.burst(s.x, s.y, 6, juice.coinSpark);
          this.ui.floater(`+${value}`, s.x - this.cameras.main.scrollX, s.y - this.cameras.main.scrollY - 24, '#ffd23f');
          play('coin', 1 + i * 0.07);
          s.setVisible(false);
        },
      });
      return s;
    });
    this.bert.play(animKey(player.id, caught.length > 0 ? 'cheer' : 'sweat'));
    if (caught.length === 0) this.ui.say(t('round.empty'), 2.5);
    // Running Gag: Ab und zu stürzt Gisela herab und schnappt sich einen Fisch (zählt trotzdem)
    if (this.spot.harbor && flying.length >= 2 && this.save.stats.casts % 5 === 4 && this.harbor.figure('gisela')?.visible) this.giselaSteals(flying[flying.length - 1]!);

    const total = (params.flightSeconds + caught.length * 0.12) * 1000 + 200;
    this.time.delayedCall(total, () => {
      for (const s of flying) s.destroy();
      const landed = landCatch(
        this.save,
        r.caught.map((f, i) => ({ speciesId: f.speciesId, combo: combos.has(i) })),
        deepest,
        speciesById,
        params,
        Date.now(),
        setBonus(this.save, sets, 'coins') + prestigeBonus(this.save, prestigeParams),
      );
      const completed = newlyCompleted(this.save, landed.save, sets);
      const switched = isNight(this.save.stats.casts, timeParams) !== isNight(landed.save.stats.casts, timeParams);
      const record = landed.save.stats.deepestMeters > this.save.stats.deepestMeters && this.save.stats.casts > 0;
      this.save = landed.save;
      writeSave(this.save);
      this.harbor.landed(caught);
      const boatScreenY = this.depth.surfaceY - this.cameras.main.scrollY;
      const boatScreenX = this.boat.x - this.cameras.main.scrollX;
      if (landed.coins > 0) {
        this.ui.floater(t('round.summary', { coins: landed.coins }), boatScreenX, boatScreenY - 90, '#ffd23f');
        this.ui.coinBurst(boatScreenX, boatScreenY - 40, Math.ceil(landed.coins / 10));
      }
      if (this.legend && caught.includes(this.legend.id)) {
        this.ui.shout(t(this.legend.legend.nameKey), '#c78cff');
        this.ui.confetti(boatScreenX, boatScreenY - 60, 40);
        this.cameras.main.flash(500, 255, 240, 200);
        play('fanfare');
      } else if (record) {
        this.ui.shout(t('round.record', { depth: Math.round(landed.save.stats.deepestMeters).toLocaleString('de-DE') }));
        this.ui.confetti(boatScreenX, boatScreenY - 60, 28);
        play('fanfare');
      }
      this.refresh(true);
      if (switched) {
        // Szene neu aufbauen, damit Himmel und Wasser zur Tageszeit passen
        const toast = t(isNight(this.save.stats.casts, timeParams) ? 'time.nightfall' : 'time.daybreak');
        this.endRound(landed.firstCatches, completed, () => this.scene.restart({ toast }));
      } else this.endRound(landed.firstCatches, completed);
    });
  }

  private endRound(firstCatches: string[], completedSets: SetDef[] = [], after?: () => void): void {
    for (const s of this.fishSprites.values()) s.destroy();
    this.fishSprites.clear();
    this.round = null;
    const next = () => {
      const id = firstCatches.shift();
      if (!id && completedSets.length > 0) {
        this.showSetComplete(completedSets.shift()!, next);
        return;
      }
      if (!id && after) {
        after();
        return;
      }
      if (!id) {
        this.mode = 'deck';
        this.ui.setMode('deck');
        this.bert.play(animKey(player.id, 'idle'));
        this.refresh();
        this.harbor.playNext(() => this.harbor.announceLife());
        return;
      }
      play('newSpecies');
      this.showFact(speciesById.get(id)!, true, next);
    };
    this.time.delayedCall(500, next);
  }

  /** Set komplett: Reaktions-Szene mit Bert, dann Karte mit dem dauerhaften Bonus. */
  private showSetComplete(set: SetDef, done: () => void): void {
    let portrait: string | undefined;
    try {
      portrait = this.textures.getBase64('portrait_bert_happy');
    } catch {
      portrait = undefined;
    }
    const bonus = t(`set.bonus.${set.bonus.type}`, { value: Math.round(set.bonus.value * 100) });
    const card = () =>
      this.sheet.show(t('set.complete.title'), t('set.complete.text', { name: t(set.nameKey), bonus }), [
        {
          label: t('fact.next'),
          onSelect: () => {
            this.sheet.close();
            done();
          },
        },
      ], undefined, portrait);
    play('fanfare');
    if (portrait) playReaction(this.uiRoot, portrait, { background: 'burst', mood: 'joy' }, t('reaction.set'), card);
    else card();
  }

  private showFact(def: SpeciesDef, isNew: boolean, done: () => void): void {
    showFactCard(this.uiRoot, def, this.imageOf(def), this.zoneName(def), isNew, done);
  }

  private imageOf(def: SpeciesDef): string | undefined {
    try {
      return this.textures.getBase64(def.sprite, 0);
    } catch {
      return undefined;
    }
  }

  private zoneName(def: SpeciesDef): string {
    const map = depthMapFor(def.sea);
    return t(map.zones[zoneIndexAt(def.depthMeters[0], map)]!.nameKey);
  }

  private burst(x: number, y: number, count: number, style: Omit<SparkStyle, 'tint'> & { tint: string }): void {
    this.sparks.burst(x, y, count, { ...style, tint: color(style.tint) });
  }

  /** Möwe Gisela fliegt vom Dach, packt einen Fisch mitten im Flug und verschwindet damit. */
  private giselaSteals(fish: Phaser.GameObjects.Sprite): void {
    const home = this.harbor.figure('gisela')!;
    const cam = this.cameras.main;
    this.time.delayedCall(params.flightSeconds * 450, () => {
      if (!fish.active) return;
      this.tweens.killTweensOf(fish);
      home.setVisible(false);
      const gull = this.add.sprite(home.x, home.y, home.texture.key, 8).setOrigin(0.5, 1).setScale(2).setDepth(14).setFlipX(true);
      gull.play(animKey(home.texture.key, 'react'));
      play('talk', 0.6);
      this.tweens.add({
        targets: gull,
        x: fish.x,
        y: fish.y + 20,
        duration: 320,
        ease: 'Quad.In',
        onComplete: () => {
          this.ui.floater(t('steal.floater'), fish.x - cam.scrollX, fish.y - cam.scrollY - 30, '#ff6b6b');
          this.cameras.main.shake(120, 0.004);
          play('bite', 1.4);
          const flyOff = { x: cam.scrollX - 80, y: cam.scrollY - 60 };
          this.tweens.add({ targets: [gull, fish], x: flyOff.x, y: flyOff.y, duration: 900, ease: 'Quad.Out' });
          this.time.delayedCall(2600, () => {
            gull.destroy();
            home.setVisible(true).setScale(0);
            this.tweens.add({ targets: home, scale: 2, duration: 250, ease: 'Back.Out' });
            this.ui.say(t('chatter.gisela_steal'), 2.5);
          });
        },
      });
    });
  }

  /** Legende am Haken, aber der Haken ist zu schwach: Leine reißt, sie schwimmt davon. */
  private snapIfTooWeak(uid: number): boolean {
    const r = this.round;
    if (!r || uid !== this.legendUid || !this.legend || hookHolds(this.legend, r.capacity)) return false;
    this.snap(uid);
    return true;
  }

  /** Legende am Haken: Kampf beginnt, die Runde wartet. */
  private startFight(): void {
    const r = this.round!;
    this.fight = createFight(r.hookX, r.rng, fightParams);
    this.ui.shout(t('fight.start'), '#c78cff');
    this.ui.setFight(0, this.fight.tension);
    play('bite', 0.6);
    navigator.vibrate?.([30, 30, 30, 30, 30]);
  }

  private updateFight(dt: number): void {
    const r = this.round!;
    const f = stepFight(this.fight!, this.steerX, r.width, r.rng, fightParams, dt);
    r.prevHookX = r.hookX;
    r.prevHookY = r.hookY;
    r.hookX = f.hookX;
    const legend = r.fish.find((x) => x.uid === this.legendUid);
    if (legend) {
      legend.px = legend.x;
      legend.py = legend.y;
      legend.x = f.fishX;
      legend.y = r.hookY + 40;
      legend.vx = f.fishVx;
    }
    this.ui.setFight(f.progress, f.tension);
    if (f.tension > 0.6) this.cameras.main.shake(80, 0.002 + f.tension * 0.006);
    this.line.setAlpha(following(f, fightParams) ? 1 : 0.6);
    if (f.result === 'won') {
      this.fight = null;
      this.ui.setFight(null, null);
      this.ui.shout(t('fight.won'), '#7bd88f');
      this.burst(r.hookX + this.offsetX, r.hookY, 30, juice.spark);
      play('fanfare');
    } else if (f.result === 'snapped') {
      this.fight = null;
      this.ui.setFight(null, null);
      this.snap(this.legendUid);
    }
  }

  private snap(uid: number): void {
    const r = this.round!;
    releaseFish(r, uid);
    this.save = markSnapped(this.save, this.save.sea.current);
    writeSave(this.save);
    this.cameras.main.shake(400, 0.012);
    play('wrong');
    navigator.vibrate?.([60, 40, 60]);
    this.ui.shout(t('legend.snap'), '#ff6b6b');
    this.fishSprites.get(uid)?.clearTint();
  }

  /** Seltene Art am Haken: Blitz, Schriftzug, heller Ton. */
  private celebrateRare(uid: number): void {
    const f = this.round?.fish.find((x) => x.uid === uid);
    const def = f && speciesById.get(f.speciesId);
    if (!def || def.weight > params.rareWeight) return;
    this.cameras.main.flash(180, 255, 240, 180);
    this.ui.shout(t('round.rare'), '#c78cff');
    play('newSpecies', 1.2);
    navigator.vibrate?.([20, 40, 20]);
  }

  private openMap(): void {
    if (this.mode !== 'deck' || this.overlayOpen()) return;
    play('tap');
    this.cameras.main.fadeOut(250, 11, 53, 80);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('SeaMap'));
  }

  private openFishbook(): void {
    const visited = [...this.save.sea.left, this.save.sea.current];
    const book = seas.filter((s) => visited.includes(s.id)).flatMap((s) => speciesIn(s.id));
    showFishbook(this.uiRoot, book, sets.filter((x) => visited.includes(x.sea)), this.save, (s) => this.imageOf(s), (s) => this.zoneName(s), (s) => this.showFact(s, false, () => this.openFishbook()));
  }

  private buy(u: UpgradeDef): void {
    if (this.mode !== 'deck') return;
    const level = this.save.upgrades[u.id];
    if (this.save.coins < upgradeCost(u, level)) return;
    this.save = buyUpgrade(this.save, u, Date.now());
    writeSave(this.save);
    this.bert.play(animKey(player.id, 'cheer'));
    play('upgrade');
    this.ui.confetti(this.boat.x - this.cameras.main.scrollX, this.depth.surfaceY - this.cameras.main.scrollY - 40);
    this.time.delayedCall(700, () => this.mode === 'deck' && this.bert.play(animKey(player.id, 'idle')));
    this.bubbles.burst(this.boat.x, this.depth.surfaceY, 10);
    this.refresh(true);
  }

  /** Tagesbonus einmal pro Kalendertag, erst ab dem zweiten Wurf (der Anfang gehört Hilde). */
  private showDaily(done: () => void): void {
    const now = new Date();
    const today = dayKey(now.getTime(), now.getTimezoneOffset());
    const streak = dailyStreak(this.save, today);
    if (streak === null || this.save.stats.casts < 2) {
      done();
      return;
    }
    const crew = upgradeValue(upgradeById('crew'), this.save.upgrades.crew);
    const rewards = dailyParams.base.map((_, i) => dailyReward(i + 1, crew, dailyParams));
    const reset = this.save.daily.streak > 0 && streak === 1;
    play('chest');
    showDailyCard(this.uiRoot, streak, rewards, reset, (x, y) => {
      const r = claimDaily(this.save, today, crew, dailyParams);
      if (r) {
        this.save = r.save;
        writeSave(this.save);
        this.ui.coinBurst(x, y, Math.ceil(r.coins / 8));
        this.ui.confetti(x, y);
        this.refresh(true);
      }
      this.time.delayedCall(900, done);
    });
  }

  private showOffline(coins: number, done: () => void): void {
    let portrait: string | undefined;
    try {
      portrait = this.textures.getBase64('portrait_bert_happy');
    } catch {
      portrait = undefined;
    }
    this.sheet.show(
      t('offline.title'),
      `${t('offline.text', { coins })} ${t('offline.comment')}`,
      [
        {
          label: t('offline.ok'),
          onSelect: () => {
            this.sheet.close();
            done();
          },
        },
      ],
      undefined,
      portrait,
    );
  }

  /** Meeresboden am tiefsten Punkt des Platzes: Fels mit Korallen, Seetang und Ruinen. */
  private buildSeabed(width: number): void {
    const y = metersToY(this.spot.maxMeters, this.depth);
    const bed = this.add.tileSprite(0, y, width / 2, 68, 'seabed').setOrigin(0, 0).setScale(2).setDepth(-8);
    const dark = this.add.graphics().setDepth(-8.1);
    dark.fillStyle(0x0b1a1e, 1).fillRect(0, y + 120, width, 2000);
    const rng = createRng(`seabed-${this.spot.id}`);
    const big = rng.pick(['decor_ruins', 'decor_totem', 'decor_arch']);
    this.add.image(rng.range(width * 0.2, width * 0.8), y + 24, big).setOrigin(0.5, 1).setScale(1).setDepth(-8.2).setTint(0xb0c8d0);
    for (let x = 10; x < width; x += rng.range(40, 90)) {
      const key = rng.pick(['decor_coral_pink', 'decor_coral_yellow', 'decor_seaweed', 'decor_seaweed', 'decor_log']);
      const img = this.add.image(x, y + 30, key).setOrigin(0.5, 1).setScale(key === 'decor_log' ? 1 : 2).setDepth(-7.9);
      if (key === 'decor_seaweed') this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: rng.range(1600, 2600), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    bed.setTint(0xd8e8e0);
  }

  /** Wolken ziehen, Wellen wogen, Lichtstrahlen flackern, der Wal zieht vorbei. */
  private animateWorld(dt: number): void {
    this.worldTime += dt;
    const time = this.worldTime;
    this.sky.tilePositionX += dt * 6;
    const surface = this.depth.surfaceY;
    const width = this.worldW;
    this.wave.clear();
    this.wave.fillStyle(0xe8fffb, 0.9);
    for (let x = 0; x < width; x += 8) this.wave.fillRect(x, surface - 3 + Math.round(Math.sin(x * 0.05 + time * 2) * 2), 8, 3);
    this.wave.fillStyle(0xffffff, 0.5);
    for (let x = 0; x < width; x += 48) this.wave.fillRect(x + ((time * 20) % 48), surface + 2 + Math.round(Math.sin(x + time * 3)), 6, 2);
    this.rays.setAlpha(0.75 + Math.sin(time * 1.3) * 0.25);
    // Tiefen-Ebenen: ab der zweiten Zone sichtbar, eigene langsame Parallaxe, tiefer dunkler
    const cam = this.cameras.main;
    const zoneTop = metersToY(this.depth.zones[1]?.depthMeters[0] ?? Infinity, this.depth);
    const k = Phaser.Math.Clamp((cam.scrollY + cam.height - zoneTop) / 1400, 0, 1);
    const deep = Phaser.Math.Clamp((cam.scrollY - zoneTop) / (this.depth.unitsPerZone * 3), 0, 1);
    const shade = Phaser.Display.Color.GetColor(255 - deep * 150, 255 - deep * 140, 255 - deep * 90);
    this.deepFar.setAlpha(k * 0.45).setTint(shade);
    this.deepFar.tilePositionY = cam.scrollY * 0.12;
    this.deepRocks.setAlpha(k * 0.6).setTint(shade);
    this.deepRocks.tilePositionY = cam.scrollY * 0.45;
    this.whale.x += dt * 18;
    if (this.whale.x > width + 260) this.whale.x = -260;
  }

  private timeLabel(): string {
    const casts = this.save.stats.casts;
    return t(isNight(casts, timeParams) ? 'hud.night' : 'hud.day', { n: castsUntilSwitch(casts, timeParams) });
  }

  private refresh(bump = false): void {
    const here = speciesIn(this.save.sea.current);
    const known = here.filter((s) => this.save.fishbook[s.id]).length;
    this.ui.update(this.save, known, here.length, bump);
    this.ui.setTime(this.timeLabel(), isNight(this.save.stats.casts, timeParams));
    const bait = baitById(this.save.bait);
    this.ui.setCastLabel(bait ? t('bait.cast', { name: t(bait.nameKey) }) : t('deck.cast'), bait !== null);
    this.harbor.refresh();
  }

  private applySync(r: SyncResult): void {
    if (r.decision === 'pull' && this.sys.isActive() && this.mode === 'deck') this.scene.restart();
  }

  private onResize(): void {
    // Breite der Welt hängt am Bildschirm: an Deck neu aufbauen, im Wurf erst danach.
    if (this.mode === 'deck' && !this.overlayOpen()) this.scene.restart();
  }

  // ---------------------------------------------------------------- Takt

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const cam = this.cameras.main;

    if (this.mode === 'round' && this.round) {
      this.keySteer(dt);
      const frozen = this.hitstop > 0;
      this.hitstop = Math.max(0, this.hitstop - dt);
      if (this.fight && !frozen) this.updateFight(dt);
      const steps = frozen || this.fight ? 0 : this.stepper.advance(dt);
      for (let i = 0; i < steps && this.round && this.mode === 'round'; i++) {
        this.handle(stepRound(this.round, this.steerX, speciesById, this.depth, params, this.stepper.step));
        if (this.mode === 'round') this.checkZone();
      }
    }

    const r = this.round;
    const alpha = this.stepper.alpha;
    if (r && this.mode === 'round') {
      const hx = Phaser.Math.Linear(r.prevHookX, r.hookX, alpha) + this.offsetX;
      const hy = Phaser.Math.Linear(r.prevHookY, r.hookY, alpha);
      this.hook.setPosition(hx, hy);
      const target = hy - cam.height * (r.phase === 'descent' ? HOOK_SCREEN_DESCENT : HOOK_SCREEN_ASCENT);
      this.camY += (target - this.camY) * Math.min(1, dt * 8);
      const meters = yToMeters(hy, this.depth);
      this.ui.setDepth(meters, t(this.depth.zones[zoneIndexAt(meters, this.depth)]!.nameKey), this.save.stats.deepestMeters, true);
      this.bubbles.update(dt, hx, hy, 0, r.phase === 'descent' ? 300 : -300, 0.6);
    } else if (this.mode === 'deck') {
      this.camY += (this.deckCamY() - this.camY) * Math.min(1, dt * 4);
      this.ui.setDepth(0, '', this.save.stats.deepestMeters, false);
      this.bubbles.update(dt, 0, 0, 0, 0, 0);
    } else {
      this.ui.setDepth(0, '', this.save.stats.deepestMeters, false);
      this.camY += (this.deckCamY() - this.camY) * Math.min(1, dt * 5);
      this.bubbles.update(dt, 0, 0, 0, 0, 0);
    }
    cam.scrollY = Phaser.Math.Clamp(this.camY, 0, this.worldHeight - cam.height);
    const pan = this.mode === 'deck' && !this.overlayOpen() && this.worldW > this.scale.width;
    this.ui.setPan(pan && cam.scrollX > 4, pan && cam.scrollX < this.worldW - this.scale.width - 4);

    // Fische zeichnen (interpoliert), Leuchtfische mit Schein
    this.glow.clear();
    if (r) {
      for (const f of r.fish) {
        const s = this.fishSprites.get(f.uid);
        if (!s) continue;
        const visible = f.y > cam.scrollY - 80 && f.y < cam.scrollY + cam.height + 80;
        s.setVisible(visible);
        if (!visible) continue;
        if (f.uid === this.legendUid && !this.legendSeen && f.y < cam.scrollY + cam.height * 0.9) {
          this.legendSeen = true;
          this.ui.banner(t('legend.near'));
          this.cameras.main.shake(500, 0.006);
          play('bite', 0.5);
        }
        s.setPosition(Phaser.Math.Linear(f.px, f.x, alpha) + this.offsetX, Phaser.Math.Linear(f.py, f.y, alpha));
        s.setFlipX(f.caught ? false : f.vx < 0);
        if (f.caught) s.setAngle(Math.sin(r.time * 8 + f.uid) * 25);
        const def = speciesById.get(f.speciesId)!;
        if (def.glow) {
          // Weicher Schein in Ringen, pulsiert leicht
          const pulse = 0.8 + 0.2 * Math.sin(r.time * 3 + f.uid);
          for (const [k, a] of [[1.5, 0.05], [1.1, 0.07], [0.7, 0.09]] as const) {
            this.glow.fillStyle(0x5cf2ff, a * pulse);
            this.glow.fillCircle(s.x, s.y, f.radius * k);
          }
        }
      }
    }

    // Angelschnur von der Rutenspitze zum Haken
    this.line.clear();
    if (this.hook.visible) {
      const tip = this.rodTip();
      this.line.lineStyle(2, 0xf2fbff, 0.8);
      this.line.lineBetween(tip.x, tip.y, this.hook.x, this.hook.y - 14);
    }
    this.snow.update(cam, dt);
    this.sparks.update(dt);
    this.animateWorld(dt);

    // Crew angelt auch während des Spielens
    this.idleTimer += dt;
    if (this.idleTimer >= 1) {
      this.idleTimer = 0;
      const idle = collectIdle(this.save, Date.now(), upgradeById('crew'), params, setBonus(this.save, sets, 'crew'));
      if (idle.coins > 0) {
        this.save = idle.save;
        writeSave(this.save);
        this.refresh();
      } else this.save = idle.save;
    }
  }
}
