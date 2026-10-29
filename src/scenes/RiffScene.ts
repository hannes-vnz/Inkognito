import Phaser from 'phaser';
import { buildings, colonyDefs, fishById, game, jobs, npcs, player, quests, reef } from '../data';
import { animKey, Octopus } from '../entities/Octopus';
import { Parallax } from '../render/Parallax';
import { drawFloor } from '../render/WorldDecor';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
import { ExitMarker } from '../render/ExitMarker';
import { TouchJoystick } from '../input/TouchJoystick';
import { KeyboardControls } from '../input/Keyboard';
import { createSwimmer, FixedStepper, stepSwimmer, type Bounds, type SwimmerState } from '../systems/movement';
import { approachFactor, targetLookAhead } from '../systems/camera';
import { orientationOf, type Orientation } from '../systems/joystick';
import { createRng } from '../systems/rng';
import {
  addCatch,
  assignJob,
  buildingLevel,
  canAssign,
  checkUpgrade,
  houseCapacity,
  jobRate,
  jobSlots,
  letIn,
  sellFish,
  sellPrice,
  tick,
  upgrade,
  workersOn,
  type BuildingDef,
} from '../systems/colony';
import { completeQuests, startQuest } from '../systems/quests';
import { dialogNode, npcUnlocked, type NpcDef } from '../systems/dialog';
import type { OwnedFish, Save } from '../systems/save';
import type { Vec2 } from '../systems/vector';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { JoystickView } from '../ui/JoystickView';
import { PauseOverlay } from '../ui/PauseOverlay';
import { RiffHud } from '../ui/RiffHud';
import { Sheet, type SheetOption } from '../ui/Sheet';
import { AccountMenu } from '../ui/AccountMenu';
import { syncNow, type SyncResult } from '../online/sync';
import { onAuthChange } from '../online/cloud';
import { readSafeArea } from '../ui/safeArea';

interface RiffData {
  /** Fische, die gerade vom Tauchgang mitgebracht wurden. */
  returned?: string[];
}

type Interactable =
  | { kind: 'npc'; npc: NpcDef; x: number; y: number }
  | { kind: 'building'; building: BuildingDef; x: number; y: number }
  | { kind: 'dive'; x: number; y: number };

/** 2,5D: Ebene 0 vorn, höhere Ebenen weiter hinten (kleiner, dunstiger, langsamer). */
const LAYER = [
  { scroll: 1, scale: 1, tint: 0xffffff, depth: 6 },
  { scroll: 0.82, scale: 0.8, tint: 0xb8d8e8, depth: 3 },
  { scroll: 0.65, scale: 0.62, tint: 0x8fb8d0, depth: 1 },
] as const;

const TICK_SECONDS = 1;

/** Riff-Basis in 2,5D: altes Haus, Jobs, Story-Figuren auf Podesten, Einstieg zum Tauchen. */
export class RiffScene extends Phaser.Scene {
  private save!: Save;
  private octopus!: Octopus;
  private swimmer!: SwimmerState;
  private prevSwimmer!: SwimmerState;
  private bounds!: Bounds;
  private stepper!: FixedStepper;
  private parallax!: Parallax;
  private snow!: MarineSnow;
  private bubbles!: BubbleTrail;
  private entrance!: ExitMarker;
  private joystick!: TouchJoystick;
  private keyboard!: KeyboardControls;
  private hud!: RiffHud;
  private sheet!: Sheet;
  private pause!: PauseOverlay;
  private account!: AccountMenu;
  private interactables: Interactable[] = [];
  private npcLayer = new Map<string, number>();
  private fishSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private camCenter: Vec2 = { x: 0, y: 0 };
  private lookAhead: Vec2 = { x: 0, y: 0 };
  private orientation: Orientation = 'portrait';
  private tickTimer = 0;
  private clock = 0;
  private paused = false;
  private moved = false;
  private hungryWarned = false;
  /** Welt fertig aufgebaut (vorher keine Figuren nachsetzen). */
  private ready = false;

  constructor() {
    super('Riff');
  }

  create(data: RiffData): void {
    const now = Date.now();
    this.ready = false;
    this.paused = false;
    this.moved = false;
    this.hungryWarned = false;
    this.lookAhead = { x: 0, y: 0 };
    this.fishSprites = new Map();
    this.interactables = [];
    this.npcLayer = new Map();
    this.save = loadSave(now);

    const uiRoot = document.getElementById('ui') as HTMLElement;
    uiRoot.replaceChildren();
    this.hud = new RiffHud(uiRoot, reef.nameKey);
    this.sheet = new Sheet(uiRoot);
    this.pause = new PauseOverlay(uiRoot);
    this.account = new AccountMenu(uiRoot, this.sheet, (r) => this.applySync(r, true), (text) => this.hud.say(text, 3));

    // Erst die Zeit seit dem letzten Besuch verrechnen, dann den neuen Fang aufnehmen.
    const messages: string[] = [];
    const offline = tick(this.save, now, colonyDefs);
    this.save = offline.save;
    if (offline.shells >= 1 || offline.food >= 1) {
      messages.push(t('riff.offline', { shells: Math.floor(offline.shells), food: Math.round(Math.max(0, offline.food)) }));
    }
    if (data.returned && data.returned.length > 0) {
      const r = addCatch(this.save, data.returned, colonyDefs, now);
      this.save = r.save;
      if (r.housed > 0) messages.push(r.housed === 1 ? t('riff.arrivedOne') : t('riff.arrived', { count: r.housed }));
      if (r.waiting > 0) messages.push(t('riff.waitingAdded', { count: r.waiting }));
      if (r.released > 0) messages.push(t('riff.released', { count: r.released }));
    }
    this.commit(this.save);
    if (messages.length > 0) this.hud.say(messages.join(' · '), 4);

    this.buildWorld();

    this.stepper = new FixedStepper(game.fixedStepHz);
    const half = (player.frameWidth * player.scale) / 2;
    const { world } = reef;
    this.bounds = { minX: half, minY: half, maxX: world.width - half, maxY: world.floorY - half * 0.6 };
    this.swimmer = createSwimmer(reef.spawn.x, reef.spawn.y);
    this.prevSwimmer = this.swimmer;
    this.octopus = new Octopus(this, reef.spawn.x, reef.spawn.y, player, this.stepper.step);
    this.octopus.sprite.setDepth(10);
    const fxRng = createRng(`${reef.seed}-fx`);
    this.bubbles = new BubbleTrail(this, fxRng, game.juice.bubbles, 'fx_bubble');
    this.snow = new MarineSnow(this, fxRng, game.juice.marineSnow.count, game.juice.marineSnow.parallax, game.juice.marineSnow.driftSpeed);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width, world.height);
    cam.setBackgroundColor(reef.water.deep);
    this.camCenter = { ...reef.spawn };
    cam.centerOn(reef.spawn.x, reef.spawn.y);

    this.joystick = new TouchJoystick(this, new JoystickView(uiRoot, game.joystick.radius), game.joystick);
    this.joystick.onTap = (p) => this.tapInteract(p);
    this.keyboard = new KeyboardControls(this);

    this.orientation = orientationOf(this.scale.width, this.scale.height);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.hud.destroy();
    });
    this.hud.showHint(t('ui.hint.riff'), this.scale.height * 0.62);
    this.ready = true;

    void syncNow().then((r) => this.applySync(r, false));
    const stopAuth = onAuthChange((user) => {
      if (user && window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        void this.account.afterLogin();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAuth);

    if (new URLSearchParams(window.location.search).has('debug') || window.location.hash === '#debug') {
      (window as unknown as { inkognito: unknown }).inkognito = { riff: this };
    }
  }

  /** Hintergrund, Boden, Ruinen-Kulisse, Gebäude, Podeste mit Figuren, Vordergrund-Korallen. */
  private buildWorld(): void {
    const { world } = reef;
    this.parallax = new Parallax(this, reef.background, world.height);
    drawFloor(this, world.width, world.height, world.floorY, reef.floor, createRng(reef.seed));

    for (const b of buildings) {
      this.add.image(b.position.x, b.position.y, b.sprite).setOrigin(0.5, 1).setScale(game.spriteScale).setDepth(4);
      this.interactables.push({ kind: 'building', building: b, x: b.position.x, y: b.position.y + b.interactOffsetY });
    }

    this.spawnUnlockedNpcs(false);

    const d = reef.diveEntrance;
    this.entrance = new ExitMarker(this, d.x, d.y, d.radius);
    this.interactables.push({ kind: 'dive', x: d.x, y: d.y });

    // Vordergrund: Korallen, die vor dem Oktopus vorbeiziehen (schneller als die Welt, daher 2,5D).
    const fg = this.add.graphics().setScrollFactor(1.18, 1.05).setDepth(30);
    const rng = createRng(`${reef.seed}-fg`);
    const colors = [0xe86a8a, 0xf2a65a, 0xb48be0, 0x6cc4a1];
    for (let i = 0; i < 9; i++) {
      const cx = rng.range(0, world.width * 1.2);
      const color = rng.pick(colors);
      for (let b = 0; b < 5; b++) {
        fg.fillStyle(color, 0.85);
        fg.fillCircle(cx + rng.range(-50, 50), world.height + 40 - rng.range(0, 110), rng.range(22, 46));
      }
    }
  }

  /** Setzt alle freigeschalteten Figuren, die noch fehlen, auf ihr Podest. */
  private spawnUnlockedNpcs(announce: boolean): void {
    for (const npc of npcs) {
      if (this.npcLayer.has(npc.id) || !npcUnlocked(npc, this.save.quests)) continue;
      const L = LAYER[Math.min(npc.podest.layer, LAYER.length - 1)]!;
      const scale = game.spriteScale * L.scale;
      this.add.image(npc.podest.x, npc.podest.y, reef.podestSprite).setOrigin(0.5, 0).setScale(scale).setScrollFactor(L.scroll).setDepth(L.depth).setTint(L.tint);
      const sprite = this.add
        .sprite(npc.podest.x, npc.podest.y + 2, npc.sprite, 0)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setScrollFactor(L.scroll)
        .setDepth(L.depth + 0.5)
        .setTint(L.tint)
        .play(animKey(npc.sprite, 'idle'));
      this.npcLayer.set(npc.id, L.scroll);
      this.interactables.push({ kind: 'npc', npc, x: npc.podest.x, y: npc.podest.y - 50 });
      if (announce) {
        // Neue Figur zieht ein: kurz von oben einschweben.
        sprite.setAlpha(0).y -= 80;
        this.tweens.add({ targets: sprite, alpha: 1, y: npc.podest.y + 2, duration: 700, ease: 'Back.Out' });
        this.bubbles.burst(npc.podest.x, npc.podest.y - 40, 12);
      }
    }
  }

  /** Für Tests und Debug: aktueller Stand. */
  get state(): Save {
    return this.save;
  }

  /** Neuen Stand übernehmen: Aufträge prüfen, speichern, Anzeige aktualisieren. */
  private commit(next: Save, bump = false): void {
    const q = completeQuests(next, quests, Date.now());
    this.save = q.save;
    for (const done of q.completed) this.hud.say(t(done.doneTextKey), 3.5);
    writeSave(this.save);
    this.refreshHud(bump || q.completed.length > 0);
    // Neue Figuren kommen mit erledigten Aufträgen dazu (erst wenn die Welt steht).
    if (q.completed.length > 0 && this.ready) this.spawnUnlockedNpcs(true);
  }

  private refreshHud(bump: boolean): void {
    this.hud.setShells(Math.floor(this.save.shells), bump);
    const cap = houseCapacity(this.save, colonyDefs);
    const food = Math.floor(this.save.food);
    this.hud.setStatus(`${t('hud.fishCount', { count: this.save.fish.length, capacity: cap })} · ${t('hud.food', { food })}`, food <= 0 && this.save.fish.length > 0);
    this.hud.setHolding(
      this.save.fish.map((f) => fishById.get(f.fishId)!.placeholderColor),
      cap,
    );
  }

  private applySync(r: SyncResult, announce: boolean): void {
    if (!this.sys.isActive()) return;
    if (r.decision === 'pull') {
      this.hud.say(t('sync.pulled'), 2.5);
      this.time.delayedCall(400, () => this.scene.restart({}));
      return;
    }
    if (!announce) return;
    if (r.decision === 'push') this.hud.say(t('sync.pushed'));
    else if (r.decision === 'none') this.hud.say(t('sync.none'));
    else if (r.decision === 'offline') this.hud.say(t('sync.offline'));
  }

  private onResize(): void {
    this.layout();
    const next = orientationOf(this.scale.width, this.scale.height);
    if (next !== this.orientation) {
      this.orientation = next;
      if (this.sys.game.device.input.touch && !this.sheet.open) {
        this.paused = true;
        this.joystick.release();
        this.pause.show('ui.pausedOrientation', () => {
          this.paused = false;
          this.stepper.reset();
        });
      }
    }
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.joystick.layout(width, height, readSafeArea());
  }

  /** Position eines Ziels so, wie es auf dem Bildschirm erscheint (hintere Ebenen scrollen langsamer). */
  private apparent(it: Interactable): Vec2 {
    const f = it.kind === 'npc' ? (this.npcLayer.get(it.npc.id) ?? 1) : 1;
    const cam = this.cameras.main;
    return { x: it.x + cam.scrollX * (1 - f), y: it.y + cam.scrollY * (1 - f) };
  }

  private nearest(): Interactable | null {
    let best: Interactable | null = null;
    let bd = reef.interactRadius;
    for (const it of this.interactables) {
      const p = this.apparent(it);
      const d = Math.hypot(p.x - this.swimmer.x, p.y - this.swimmer.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  private labelFor(it: Interactable): string {
    switch (it.kind) {
      case 'npc':
        return t('riff.talk');
      case 'building':
        return t('riff.open');
      case 'dive':
        return t('riff.dive');
    }
  }

  private interact(it: Interactable): void {
    this.joystick.release();
    this.moved = true;
    switch (it.kind) {
      case 'npc':
        this.openDialog(it.npc, 'start');
        break;
      case 'building':
        if (it.building.id === 'house') this.openHouse();
        else this.openStation(it.building);
        break;
      case 'dive':
        writeSave(this.save);
        this.scene.start('Dive', { zoneId: 'kelp', diveNumber: this.save.diveCount + 1 });
        break;
    }
  }

  private tapInteract(screen: Vec2): void {
    const it = this.nearest();
    if (!it) return;
    const cam = this.cameras.main;
    const p = this.apparent(it);
    if (Math.hypot(screen.x + cam.scrollX - p.x, screen.y + cam.scrollY - p.y) < 160) this.interact(it);
  }

  // ---------------------------------------------------------------- Karten

  private close(): SheetOption {
    return { label: t('riff.close'), onSelect: () => this.sheet.close() };
  }

  private fishName(f: OwnedFish): string {
    const name = t(fishById.get(f.fishId)!.nameKey);
    return f.variant === 'normal' ? name : `${t(`variant.${f.variant}`)}-${name}`;
  }

  private statsText(f: OwnedFish): string {
    return t('stat.short', f.stats);
  }

  private jobName(id: string | null): string {
    const job = jobs.find((j) => j.id === id);
    return job ? t(job.nameKey) : t('job.none');
  }

  /** Porträt der Figur für den Dialog (erstes Frame ihres Spritesheets). */
  private portrait(npc: NpcDef): string | undefined {
    try {
      return this.textures.getBase64(npc.sprite, 0);
    } catch {
      return undefined;
    }
  }

  private openDialog(npc: NpcDef, nodeId: string): void {
    const node = dialogNode(npc.dialog, nodeId, this.save.quests);
    if (node.action?.type === 'startQuest') this.commit(startQuest(this.save, node.action.quest, Date.now()));
    if (node.action?.type === 'openShop') {
      this.openShop(npc);
      return;
    }
    this.sheet.show(
      t(npc.nameKey),
      t(node.textKey),
      node.options.map((o) => ({
        label: t(o.textKey),
        onSelect: () => (o.next === null ? this.sheet.close() : this.openDialog(npc, o.next)),
      })),
      undefined,
      this.portrait(npc),
    );
  }

  private upgradeOption(b: BuildingDef, reopen: () => void): SheetOption | null {
    const check = checkUpgrade(this.save, b.id, colonyDefs);
    if (!check.ok && check.reason === 'max') return null;
    const cost = b.levels[buildingLevel(this.save, b.id)]?.cost ?? 0;
    return {
      label: t('riff.upgrade', { cost }),
      onSelect: () => {
        const now = checkUpgrade(this.save, b.id, colonyDefs);
        if (!now.ok) {
          this.sheet.setText(now.reason === 'max' ? t('riff.upgradeMax') : t('riff.upgradeNoShells', { missing: now.missing }));
          return;
        }
        let next = upgrade(this.save, b.id, colonyDefs, Date.now());
        if (b.id === 'house') next = letIn(next, colonyDefs, Date.now());
        this.commit(next, true);
        this.bubbles.burst(b.position.x, b.position.y - 120, 14);
        this.hud.say(t('riff.upgraded', { building: t(b.nameKey), level: buildingLevel(this.save, b.id) }));
        reopen();
      },
    };
  }

  private openHouse(): void {
    const house = buildings.find((b) => b.id === 'house')!;
    const cap = houseCapacity(this.save, colonyDefs);
    const room = cap - this.save.fish.length;
    const options: SheetOption[] = [{ label: t('riff.house.fish'), onSelect: () => this.openFishList() }];
    if (this.save.waiting.length > 0 && room > 0) {
      options.push({
        label: t('riff.house.letIn', { count: Math.min(room, this.save.waiting.length) }),
        onSelect: () => {
          this.commit(letIn(this.save, colonyDefs, Date.now()));
          this.openHouse();
        },
      });
    }
    const up = this.upgradeOption(house, () => this.openHouse());
    if (up) options.push(up);
    options.push(this.close());
    this.sheet.show(
      t('riff.house.title', { level: buildingLevel(this.save, 'house') }),
      t('riff.house.info', { count: this.save.fish.length, capacity: cap, food: Math.floor(this.save.food), waiting: this.save.waiting.length }),
      options,
    );
  }

  private openFishList(): void {
    if (this.save.fish.length === 0) {
      this.sheet.show(t('riff.house.fish'), t('riff.noFish'), [{ label: t('riff.back'), onSelect: () => this.openHouse() }]);
      return;
    }
    this.sheet.show(t('riff.house.fish'), t('riff.fishList'), [
      ...this.save.fish.map((f) => ({
        label: t('riff.fishEntry', { name: this.fishName(f), stats: this.statsText(f), job: this.jobName(f.job) }),
        color: fishById.get(f.fishId)!.placeholderColor,
        onSelect: () => this.openJobPicker(f.uid),
      })),
      { label: t('riff.back'), onSelect: () => this.openHouse() },
    ]);
  }

  private openJobPicker(uid: number): void {
    const f = this.save.fish.find((x) => x.uid === uid);
    if (!f) return this.openFishList();
    const options: SheetOption[] = jobs.map((job) => {
      const full = canAssign(this.save, uid, job.id, colonyDefs) === 'full';
      return {
        label: full ? t('riff.jobFull', { job: t(job.nameKey) }) : t('riff.jobOption', { job: t(job.nameKey), stat: t(`stat.${job.stat}`), value: f.stats[job.stat] }),
        onSelect: () => {
          if (full) return;
          this.commit(assignJob(this.save, uid, job.id, colonyDefs, Date.now()));
          this.hud.say(t('riff.jobSet', { name: this.fishName(f), job: t(job.nameKey) }));
          this.openFishList();
        },
      };
    });
    options.push({
      label: t('job.none'),
      onSelect: () => {
        this.commit(assignJob(this.save, uid, null, colonyDefs, Date.now()));
        this.openFishList();
      },
    });
    options.push({ label: t('riff.back'), onSelect: () => this.openFishList() });
    this.sheet.show(t('riff.jobTitle', { name: this.fishName(f) }), t('riff.jobInfo', { stats: this.statsText(f) }), options);
  }

  private openStation(b: BuildingDef): void {
    const job = jobs.find((j) => j.building === b.id);
    const workers = job ? workersOn(this.save, job.id).length : 0;
    const slots = job ? jobSlots(this.save, colonyDefs, job.id) : 0;
    const rate = job ? jobRate(this.save, job.id, colonyDefs) : { food: 0, shells: 0 };
    const rateText = rate.food > 0 ? t('riff.rate.food', { value: rate.food.toFixed(1) }) : t('riff.rate.shells', { value: rate.shells.toFixed(1) });
    const options: SheetOption[] = [{ label: t('riff.house.fish'), onSelect: () => this.openFishList() }];
    const up = this.upgradeOption(b, () => this.openStation(b));
    if (up) options.push(up);
    options.push(this.close());
    this.sheet.show(`${t(b.nameKey)} · ${buildingLevel(this.save, b.id)}`, t('riff.station.info', { workers, slots, rate: rateText }), options);
  }

  private openShop(npc: NpcDef): void {
    const all = [...this.save.fish, ...this.save.waiting];
    if (all.length === 0) {
      this.sheet.show(t(npc.nameKey), t('riff.shop.empty'), [this.close()]);
      return;
    }
    this.sheet.show(t(npc.nameKey), t('npc.bruno.shop'), [
      ...all.map((f) => ({
        label: t('riff.shop.entry', { name: this.fishName(f), stats: this.statsText(f), price: sellPrice(f, colonyDefs) }),
        color: fishById.get(f.fishId)!.placeholderColor,
        onSelect: () => {
          const r = sellFish(this.save, f.uid, colonyDefs, Date.now());
          this.commit(r.save, true);
          this.hud.say(t('riff.sold', { name: this.fishName(f), price: r.price }));
          this.openShop(npc);
        },
      })),
      this.close(),
    ]);
  }

  // ---------------------------------------------------------------- Fische im Riff

  /** Arbeiter schwimmen bei ihrem Arbeitsplatz, alle anderen ums Haus, Wartende vor der Tür. */
  private renderFish(): void {
    const seen = new Set<number>();
    const counters = new Map<string, number>();
    const place = (f: OwnedFish, anchor: string, waiting: boolean) => {
      seen.add(f.uid);
      const def = fishById.get(f.fishId);
      const b = buildings.find((x) => x.id === anchor);
      if (!def || !b) return;
      const i = counters.get(anchor + waiting) ?? 0;
      counters.set(anchor + waiting, i + 1);
      let s = this.fishSprites.get(f.uid);
      if (!s) {
        s = this.add.sprite(b.position.x, b.position.y, def.sprite, 0).setScale(game.spriteScale).setDepth(5);
        s.play(animKey(def.sprite, 'swim'));
        if (f.variant === 'zombie') s.setTint(0x9fe0a0);
        this.fishSprites.set(f.uid, s);
      }
      const phase = this.clock * (0.5 + (i % 5) * 0.11) + i * 2.1;
      const spread = waiting ? 40 : 90 + (i % 4) * 22;
      const baseX = waiting ? b.position.x - 220 - i * 26 : b.position.x;
      const x = baseX + Math.sin(phase) * spread;
      const y = b.position.y - (waiting ? 40 : 160 + (i % 4) * 34) + Math.sin(phase * 2) * 10;
      s.setPosition(x, y).setFlipX(Math.cos(phase) < 0).setAlpha(waiting ? 0.75 : 1);
    };
    for (const f of this.save.fish) place(f, jobs.find((j) => j.id === f.job)?.building ?? 'house', false);
    for (const f of this.save.waiting) place(f, 'house', true);
    for (const [uid, s] of this.fishSprites) {
      if (seen.has(uid)) continue;
      s.destroy();
      this.fishSprites.delete(uid);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.clock += dt;
    const busy = this.paused || this.sheet.open;

    const keys = this.keyboard.read();
    const move = busy ? { x: 0, y: 0 } : keys.x !== 0 || keys.y !== 0 ? keys : this.joystick.value;
    if (busy) this.joystick.release();
    if (move.x !== 0 || move.y !== 0) this.moved = true;
    if (this.moved) this.hud.hideHint();

    if (!this.paused) {
      const steps = this.stepper.advance(dt);
      for (let i = 0; i < steps; i++) {
        this.prevSwimmer = this.swimmer;
        this.swimmer = stepSwimmer(this.swimmer, move, player.movement, this.bounds, this.stepper.step);
      }
    }

    const it = busy ? null : this.nearest();
    this.hud.setAction(it ? this.labelFor(it) : null, it ? () => this.interact(it) : null);
    if (it && !busy && this.keyboard.actionPressed()) this.interact(it);

    this.tickTimer += dt;
    if (this.tickTimer >= TICK_SECONDS) {
      this.tickTimer = 0;
      const before = Math.floor(this.save.shells);
      const r = tick(this.save, Date.now(), colonyDefs);
      if (r.ranOut && !this.hungryWarned) {
        this.hungryWarned = true;
        this.hud.say(t('riff.hungry'), 3);
      }
      if (r.save.food > 0) this.hungryWarned = false;
      this.save = r.save;
      writeSave(this.save);
      this.refreshHud(Math.floor(this.save.shells) > before);
    }

    const pos = this.octopus.render(this.prevSwimmer, this.swimmer, this.stepper.alpha, this.paused ? 0 : dt);
    this.renderFish();
    this.updateCamera(pos, dt);
    this.entrance.update(this.cameras.main, dt, false);
    const speedRatio = Math.hypot(this.swimmer.vx, this.swimmer.vy) / player.movement.maxSpeed;
    this.bubbles.update(dt, pos.x, pos.y, this.swimmer.vx, this.swimmer.vy, speedRatio);
    this.snow.update(this.cameras.main, dt);
  }

  private updateCamera(pos: Vec2, dt: number): void {
    const cam = this.cameras.main;
    const target = targetLookAhead({ x: this.swimmer.vx, y: this.swimmer.vy }, this.orientation, cam.width, cam.height, game.camera);
    const la = approachFactor(game.camera.lookAheadRate, dt);
    this.lookAhead.x += (target.x * 0.5 - this.lookAhead.x) * la;
    this.lookAhead.y += (target.y * 0.5 - this.lookAhead.y) * la;
    const f = approachFactor(game.camera.followRate, dt);
    this.camCenter.x += (pos.x + this.lookAhead.x - this.camCenter.x) * f;
    this.camCenter.y += (pos.y + this.lookAhead.y - this.camCenter.y) * f;
    cam.centerOn(this.camCenter.x, this.camCenter.y);
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, reef.world.width - cam.width));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, reef.world.height - cam.height));
    this.parallax.update(cam);
  }
}
