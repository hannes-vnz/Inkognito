import Phaser from 'phaser';
import { dailyParams, depthMap, fixedStepHz, mapParams, params, player, sets, species, speciesById, spotById, upgradeById, upgrades, zones } from '../data';
import { spotSpecies, type SpotDef } from '../systems/seaMap';
import { play } from '../audio/sfx';
import { claimDaily, dailyReward, dailyStreak, dayKey } from '../systems/daily';
import { showDailyCard } from '../ui/DailyCard';
import { newlyCompleted, setBonus, type SetDef } from '../systems/sets';
import { playReaction } from '../ui/ReactionShot';
import { animKey } from '../entities/Octopus';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
import { FixedStepper } from '../systems/movement';
import { createRng } from '../systems/rng';
import { metersToY, yToMeters, zoneIndexAt } from '../systems/depthMap';
import { createRound, stepRound, type RoundEvent, type RoundFish, type RoundState, type SpeciesDef } from '../systems/fishing';
import { buyUpgrade, collectIdle, upgradeCost, upgradeValue, landCatch, type UpgradeDef } from '../systems/economy';
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
  private limitSaid = false;

  constructor() {
    super('Fishing');
  }

  create(): void {
    const now = Date.now();
    this.mode = 'deck';
    this.round = null;
    this.keys = [];
    this.fishSprites = new Map();
    this.save = loadSave(now);
    this.spot = spotById(this.save.map.spot);
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
      canTalk: () => this.mode === 'deck' && !this.overlayOpen(),
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
      if (this.spot.harbor) this.harbor.playNext(intro);
      else this.ui.say(t('spot.arrive', { name: t(this.spot.nameKey), max: this.spot.maxMeters.toLocaleString('de-DE') }), 2.5);
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
    const width = this.scale.width;
    const surface = depthMap.surfaceY;
    const maxLine = upgradeValue(upgradeById('line'), upgradeById('line').values.length - 1);
    this.worldHeight = metersToY(maxLine, depthMap) + 900;

    // Himmel und Inseln oberhalb der Wasserlinie
    const sky = this.add.image(width / 2, surface + 30, 'bg_sea_0').setOrigin(0.5, 1).setDepth(-20);
    sky.setScale(Math.max(width / sky.width, 1) * 0.6);
    const islands = this.add.image(width / 2, surface + 6, 'bg_sea_1').setOrigin(0.5, 1).setDepth(-19);
    islands.setScale(Math.max(width / islands.width, 0.5) * 0.45);

    // Wasser: jede Zone als Verlauf in ihren echten Farben
    const water = this.add.graphics().setDepth(-10);
    zones.forEach((z) => {
      const top = metersToY(z.depthMeters[0], depthMap);
      const bottom = metersToY(z.depthMeters[1], depthMap);
      const a = color(z.water[0]);
      const b = color(z.water[1]);
      water.fillGradientStyle(a, a, b, b, 1);
      water.fillRect(0, top, width, bottom - top + 1);
    });
    const last = zones[zones.length - 1]!;
    water.fillStyle(color(last.water[1]), 1);
    water.fillRect(0, metersToY(last.depthMeters[1], depthMap), width, 2000);

    // Lichtstrahlen in der Sonnenlichtzone, Leuchtpunkte in der Tiefe
    const fx = this.add.graphics().setDepth(-9);
    const rng = createRng('sea-fx');
    for (let i = 0; i < 6; i++) {
      const x = rng.range(-50, width);
      const w = rng.range(30, 80);
      fx.fillStyle(0xfff6d0, rng.range(0.05, 0.1));
      fx.fillTriangle(x, surface, x + w, surface, x + w * 3 + 120, metersToY(180, depthMap));
    }
    for (let i = 0; i < 260; i++) {
      const y = rng.range(metersToY(250, depthMap), this.worldHeight);
      fx.fillStyle(rng.pick([0x5cf2ff, 0xb07cff, 0x7dff8a]), rng.range(0.2, 0.7));
      fx.fillRect(rng.range(0, width), y, 2, 2);
    }
    // Zonengrenzen als feine Linien
    for (const z of zones.slice(1)) {
      const y = metersToY(z.depthMeters[0], depthMap);
      fx.fillStyle(0xffffff, 0.12);
      for (let x = 0; x < width; x += 16) fx.fillRect(x, y, 8, 2);
    }
    // Wasseroberfläche
    const wave = this.add.graphics().setDepth(5);
    wave.fillStyle(0xe8fffb, 0.9);
    for (let x = 0; x < width; x += 12) wave.fillRect(x, surface - 3 + Math.round(Math.sin(x * 0.05) * 2), 12, 3);

    this.boat = this.add.image(width / 2, surface + 18, 'boat_1').setOrigin(0.5, 1).setScale(3).setDepth(4);
    this.bert = this.add.sprite(width / 2 - 54, surface - 36, player.sprite, 0).setOrigin(0.5, 1).setScale(2).setDepth(3);
    this.bert.play(animKey(player.id, 'idle'));
    if (this.spot.harbor) this.harbor.build(width, this.scale.height, surface);
    else islands.setVisible(false);
    this.tweens.add({ targets: [this.boat, this.bert], y: '-=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.glow = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.line = this.add.graphics().setDepth(7);
    this.hook = this.add.image(this.rodTip().x, surface, 'hook').setScale(3).setDepth(9).setVisible(false);

    const fxRng = createRng('sea-snow');
    this.snow = new MarineSnow(this, fxRng, 60, 0.85, 8);
    this.bubbles = new BubbleTrail(this, fxRng, { maxCount: 40, perSecondAtMaxSpeed: 14, riseSpeed: 70, lifeSeconds: 1.4 }, 'fx_bubble');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, width, this.worldHeight);
    cam.setBackgroundColor('#2fb6b8');
    this.camY = this.deckCamY();
    cam.scrollY = this.camY;
  }

  /** Kamera an Deck: Wasserlinie bei etwa 45 % der Bildschirmhöhe. */
  private deckCamY(): number {
    return Math.max(0, depthMap.surfaceY - this.scale.height * 0.45);
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
    });
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
    const pool = spotSpecies(species, this.spot, mapParams.boostWeight);
    this.round = createRound(`${this.save.createdAt}-${this.save.stats.casts}`, this.scale.width, line, hooks, pool, depthMap, params);
    play('splash');
    this.round.hookX = this.rodTip().x;
    this.steerX = null;
    this.zoneShown = -1;
    this.mode = 'round';
    this.ui.setMode('round');
    this.bert.play(animKey(player.id, 'cast'));
    this.bert.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.bert.play(animKey(player.id, 'idle')));
    this.hook.setVisible(true);
    this.stepper.reset();
    if (this.save.stats.casts === 0) this.ui.showHint(t('ui.hint.steer'));
    for (const f of this.round.fish) this.spawnFishSprite(f);
  }

  private spawnFishSprite(f: RoundFish): void {
    const def = speciesById.get(f.speciesId)!;
    const s = this.add.sprite(f.x, f.y, def.sprite, 0).setScale(params.spriteScale).setDepth(8);
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
          this.celebrateRare(e.uid);
          this.ui.floater(t('round.bite'), r.hookX, screen(r.hookY) - 30, '#ffd23f');
          navigator.vibrate?.(25);
          this.ui.hideHint();
          break;
        case 'lineEnd':
          this.ui.floater(t('round.lineEnd'), r.hookX, screen(r.hookY) - 30, '#ff6b6b');
          break;
        case 'catch': {
          const s = this.fishSprites.get(e.uid);
          if (s) this.tweens.add({ targets: s, scale: params.spriteScale * 1.4, duration: 90, yoyo: true });
          this.celebrateRare(e.uid);
          play('catch', 1 + r.caught.length * 0.08);
          this.ui.floater(`${r.caught.length}`, r.hookX + 26, screen(r.hookY) - 10, '#ffffff');
          this.bubbles.burst(r.hookX, r.hookY, 5);
          navigator.vibrate?.(12);
          break;
        }
        case 'full':
          this.ui.floater(t('round.full'), r.hookX, screen(r.hookY) - 40, '#7bd88f');
          play('full');
          break;
        case 'landed':
          this.finale(e.species, e.deepestMeters);
          break;
      }
    }
  }

  /** Neue Zone erreicht: beim ersten Mal ein echter Fakt zur Zone (Lernen nebenbei). */
  private checkZone(): void {
    const r = this.round!;
    const m = yToMeters(r.hookY, depthMap);
    const i = zoneIndexAt(m, depthMap);
    if (i <= this.zoneShown) return;
    this.zoneShown = i;
    const z = zones[i]!;
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
        this.ui.floater(t('round.combo'), s.x, s.y - this.cameras.main.scrollY - 20, '#ffd23f');
        this.bubbles.burst(s.x, s.y, 6);
      });
      this.tweens.add({
        targets: s,
        x: { from: s.x, to: targetX },
        y: { from: depthMap.surfaceY, to: depthMap.surfaceY - 40 },
        angle: { from: 0, to: (i % 2 ? 1 : -1) * 360 },
        duration: params.flightSeconds * 1000,
        delay: i * 120,
        ease: 'Linear',
        onUpdate: (tw) => {
          // Bogen: zuerst hoch hinaus, dann runter aufs Deck
          const p = tw.progress;
          s.y = depthMap.surfaceY - 40 - Math.sin(p * Math.PI) * (this.scale.height * 0.35);
        },
      });
      return s;
    });
    this.bert.play(animKey(player.id, caught.length > 0 ? 'cheer' : 'sweat'));
    if (caught.length === 0) this.ui.say(t('round.empty'), 2.5);

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
        setBonus(this.save, sets, 'coins'),
      );
      const completed = newlyCompleted(this.save, landed.save, sets);
      const record = landed.save.stats.deepestMeters > this.save.stats.deepestMeters && this.save.stats.casts > 0;
      this.save = landed.save;
      writeSave(this.save);
      this.harbor.landed(caught);
      const boatScreenY = depthMap.surfaceY - this.cameras.main.scrollY;
      if (landed.coins > 0) {
        this.ui.floater(t('round.summary', { coins: landed.coins }), this.boat.x, boatScreenY - 90, '#ffd23f');
        this.ui.coinBurst(this.boat.x, boatScreenY - 40, Math.ceil(landed.coins / 10));
      }
      if (record) {
        this.ui.shout(t('round.record', { depth: Math.round(landed.save.stats.deepestMeters).toLocaleString('de-DE') }));
        this.ui.confetti(this.boat.x, boatScreenY - 60, 28);
        play('fanfare');
      }
      this.refresh(true);
      this.endRound(landed.firstCatches, completed);
    });
  }

  private endRound(firstCatches: string[], completedSets: SetDef[] = []): void {
    for (const s of this.fishSprites.values()) s.destroy();
    this.fishSprites.clear();
    this.round = null;
    const next = () => {
      const id = firstCatches.shift();
      if (!id && completedSets.length > 0) {
        this.showSetComplete(completedSets.shift()!, next);
        return;
      }
      if (!id) {
        this.mode = 'deck';
        this.ui.setMode('deck');
        this.bert.play(animKey(player.id, 'idle'));
        this.refresh();
        this.harbor.playNext(() => undefined);
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
      portrait = this.textures.getBase64(player.sprite, 2 * 6);
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
    return t(zones[zoneIndexAt(def.depthMeters[0], depthMap)]!.nameKey);
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
    showFishbook(this.uiRoot, species, sets, this.save, (s) => this.imageOf(s), (s) => this.zoneName(s), (s) => this.showFact(s, false, () => this.openFishbook()));
  }

  private buy(u: UpgradeDef): void {
    if (this.mode !== 'deck') return;
    const level = this.save.upgrades[u.id];
    if (this.save.coins < upgradeCost(u, level)) return;
    this.save = buyUpgrade(this.save, u, Date.now());
    writeSave(this.save);
    this.bert.play(animKey(player.id, 'cheer'));
    play('upgrade');
    this.ui.confetti(this.boat.x, depthMap.surfaceY - this.cameras.main.scrollY - 40);
    this.time.delayedCall(700, () => this.mode === 'deck' && this.bert.play(animKey(player.id, 'idle')));
    this.bubbles.burst(this.boat.x, depthMap.surfaceY, 10);
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
    play('newSpecies');
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
      portrait = this.textures.getBase64(player.sprite, 0);
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

  private refresh(bump = false): void {
    const known = species.filter((s) => this.save.fishbook[s.id]).length;
    this.ui.update(this.save, known, species.length, bump);
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
      const steps = this.stepper.advance(dt);
      for (let i = 0; i < steps && this.round && this.mode === 'round'; i++) {
        this.handle(stepRound(this.round, this.steerX, speciesById, depthMap, params, this.stepper.step));
        if (this.mode === 'round') this.checkZone();
      }
    }

    const r = this.round;
    const alpha = this.stepper.alpha;
    if (r && this.mode === 'round') {
      const hx = Phaser.Math.Linear(r.prevHookX, r.hookX, alpha);
      const hy = Phaser.Math.Linear(r.prevHookY, r.hookY, alpha);
      this.hook.setPosition(hx, hy);
      const target = hy - cam.height * (r.phase === 'descent' ? HOOK_SCREEN_DESCENT : HOOK_SCREEN_ASCENT);
      this.camY += (target - this.camY) * Math.min(1, dt * 8);
      const meters = yToMeters(hy, depthMap);
      this.ui.setDepth(meters, t(zones[zoneIndexAt(meters, depthMap)]!.nameKey), this.save.stats.deepestMeters, true);
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

    // Fische zeichnen (interpoliert), Leuchtfische mit Schein
    this.glow.clear();
    if (r) {
      for (const f of r.fish) {
        const s = this.fishSprites.get(f.uid);
        if (!s) continue;
        const visible = f.y > cam.scrollY - 80 && f.y < cam.scrollY + cam.height + 80;
        s.setVisible(visible);
        if (!visible) continue;
        s.setPosition(Phaser.Math.Linear(f.px, f.x, alpha), Phaser.Math.Linear(f.py, f.y, alpha));
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
