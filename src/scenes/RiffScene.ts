import Phaser from 'phaser';
import { buildings, fishById, game, npcs, player, quests, reef } from '../data';
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
import { addCatch, candidatesFor, moveIn, type BuildingDef } from '../systems/residents';
import { collectProduction } from '../systems/economy';
import { completeQuests, startQuest } from '../systems/quests';
import { dialogNode, type NpcDef } from '../systems/dialog';
import type { Save } from '../systems/save';
import type { Vec2 } from '../systems/vector';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { JoystickView } from '../ui/JoystickView';
import { PauseOverlay } from '../ui/PauseOverlay';
import { RiffHud } from '../ui/RiffHud';
import { Sheet } from '../ui/Sheet';
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

const PRODUCTION_CHECK_SECONDS = 1;

/** Riff-Basis: begehbar, Höhlen mit Bewohnern, Makler mit Dialog, Einstieg zum Tauchen. */
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
  private interactables: Interactable[] = [];
  private residentSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private camCenter: Vec2 = { x: 0, y: 0 };
  private lookAhead: Vec2 = { x: 0, y: 0 };
  private orientation: Orientation = 'portrait';
  private productionTimer = 0;
  private time_ = 0;
  private paused = false;
  private moved = false;
  private account!: AccountMenu;

  constructor() {
    super('Riff');
  }

  create(data: RiffData): void {
    const now = Date.now();
    this.paused = false;
    this.moved = false;
    this.lookAhead = { x: 0, y: 0 };
    this.residentSprites = new Map();
    this.save = loadSave(now);

    const uiRoot = document.getElementById('ui') as HTMLElement;
    uiRoot.replaceChildren();
    this.hud = new RiffHud(uiRoot, reef.nameKey);
    this.sheet = new Sheet(uiRoot);
    this.pause = new PauseOverlay(uiRoot);
    this.account = new AccountMenu(uiRoot, this.sheet, (r) => this.applySync(r, true), (text) => this.hud.say(text, 3));

    // Ausbeute vom Tauchgang ins Wartebecken, dann Offline-Produktion auszahlen.
    const messages: string[] = [];
    if (data.returned) {
      const r = addCatch(this.save, data.returned, reef.holdingCapacity, now);
      this.save = r.save;
      if (r.added > 0) messages.push(r.added === 1 ? t('riff.returnedOne') : t('riff.returned', { count: r.added }));
    }
    const prod = collectProduction(this.save, now, fishById, reef.maxOfflineHours * 3600e3);
    this.save = prod.save;
    if (prod.gained > 0) messages.push(t('riff.offline', { shells: prod.gained }));
    writeSave(this.save);
    if (messages.length > 0) this.hud.say(messages.join(' · '), 3.5);

    const { world } = reef;
    const rng = createRng(reef.seed);
    this.parallax = new Parallax(this, reef.background);
    drawFloor(this, world.width, world.height, world.floorY, reef.floor, rng);

    for (const b of buildings) {
      this.add.image(b.position.x, b.position.y, b.sprite).setOrigin(0.5, 1).setScale(game.spriteScale).setDepth(2);
      this.interactables.push({ kind: 'building', building: b, x: b.position.x, y: b.position.y - 70 });
    }
    for (const placed of reef.npcs) {
      const npc = npcs.find((n) => n.id === placed.npc)!;
      if (this.save.residents.length < npc.unlock.residentsAtLeast) continue;
      this.add.sprite(placed.x, placed.y, npc.sprite, 0).setOrigin(0.5, 1).setScale(game.spriteScale).setDepth(6).play(animKey(npc.sprite, 'idle'));
      this.interactables.push({ kind: 'npc', npc, x: placed.x, y: placed.y - 50 });
    }
    const d = reef.diveEntrance;
    this.entrance = new ExitMarker(this, d.x, d.y, d.radius);
    this.interactables.push({ kind: 'dive', x: d.x, y: d.y });

    this.stepper = new FixedStepper(game.fixedStepHz);
    const half = (player.frameWidth * player.scale) / 2;
    this.bounds = { minX: half, minY: half, maxX: world.width - half, maxY: world.floorY - half * 0.6 };
    this.swimmer = createSwimmer(reef.spawn.x, reef.spawn.y);
    this.prevSwimmer = this.swimmer;
    this.octopus = new Octopus(this, reef.spawn.x, reef.spawn.y, player, this.stepper.step);
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
      this.interactables = [];
      this.hud.destroy();
    });
    this.refreshHud(false);
    this.hud.showHint(t('ui.hint.riff'), this.scale.height * 0.62);

    // Abgleich bei jeder Rückkehr ins Riff; Login über den Mail-Link meldet sich hier.
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

  /** Ergebnis eines Abgleichs übernehmen; `announce` meldet auch „nichts zu tun“. */
  private applySync(r: SyncResult, announce: boolean): void {
    if (!this.sys.isActive()) return;
    if (r.decision === 'pull') {
      // Neuer Stand aus der Cloud: Riff mit diesem Stand neu aufbauen.
      this.hud.say(t('sync.pulled'), 2.5);
      this.time.delayedCall(400, () => this.scene.restart({}));
      return;
    }
    if (!announce) return;
    if (r.decision === 'push') this.hud.say(t('sync.pushed'));
    else if (r.decision === 'none') this.hud.say(t('sync.none'));
    else if (r.decision === 'offline') this.hud.say(t('sync.offline'));
  }

  /** Für Tests und Debug: aktueller Stand. */
  get state(): Save {
    return this.save;
  }

  private setSave(next: Save, bump = false): void {
    const q = completeQuests(next, quests, Date.now());
    this.save = q.save;
    for (const done of q.completed) this.hud.say(t(done.doneTextKey), 3);
    writeSave(this.save);
    this.refreshHud(bump || q.completed.length > 0);
  }

  private refreshHud(bump: boolean): void {
    this.hud.setShells(this.save.shells, bump);
    this.hud.setHolding(
      this.save.holding.map((h) => fishById.get(h.fishId)!.placeholderColor),
      reef.holdingCapacity,
    );
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

  private nearest(): Interactable | null {
    let best: Interactable | null = null;
    let bd = reef.interactRadius;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - this.swimmer.x, it.y - this.swimmer.y);
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
        return t('riff.settle');
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
        this.openSettle(it.building);
        break;
      case 'dive':
        writeSave(this.save);
        this.scene.start('Dive', { zoneId: 'kelp', diveNumber: this.save.diveCount + 1 });
        break;
    }
  }

  /** Tippen auf eine Figur oder Höhle in der Nähe startet die Aktion direkt. */
  private tapInteract(screen: Vec2): void {
    const it = this.nearest();
    if (!it) return;
    const cam = this.cameras.main;
    if (Math.hypot(screen.x + cam.scrollX - it.x, screen.y + cam.scrollY - it.y) < 140) this.interact(it);
  }

  private openDialog(npc: NpcDef, nodeId: string): void {
    const node = dialogNode(npc.dialog, nodeId, this.save.quests.done);
    if (node.action?.type === 'startQuest') this.setSave(startQuest(this.save, node.action.quest, Date.now()));
    this.sheet.show(
      t(npc.nameKey),
      t(node.textKey),
      node.options.map((o) => ({
        label: t(o.textKey),
        onSelect: () => (o.next === null ? this.sheet.close() : this.openDialog(npc, o.next)),
      })),
    );
  }

  private openSettle(b: BuildingDef): void {
    const name = t(b.nameKey);
    const residents = this.save.residents.filter((r) => r.buildingId === b.id).length;
    const info = `${t(`building.needs.${b.provides}`)} · ${t('building.residents', { count: residents, capacity: b.capacity })}`;
    const close = { label: t('riff.close'), onSelect: () => this.sheet.close() };
    if (residents >= b.capacity) {
      this.sheet.show(name, `${t('riff.full')} ${info}`, [close]);
      return;
    }
    const uids = candidatesFor(this.save, b, fishById);
    if (uids.length === 0) {
      this.sheet.show(name, `${this.save.holding.length === 0 ? t('riff.settleNoFish') : t('riff.settleEmpty')} ${info}`, [close]);
      return;
    }
    this.sheet.show(t('riff.settleTitle', { building: name }), info, [
      ...uids.map((uid) => {
        const def = fishById.get(this.save.holding.find((h) => h.uid === uid)!.fishId)!;
        return {
          label: t(def.nameKey),
          color: def.placeholderColor,
          onSelect: () => {
            this.setSave(moveIn(this.save, uid, b, fishById, Date.now()));
            this.sheet.close();
            this.hud.say(t('riff.movedIn', { fish: t(def.nameKey), building: name }));
            this.bubbles.burst(b.position.x, b.position.y - 60, 10);
          },
        };
      }),
      close,
    ]);
  }

  /** Bewohner schwimmen in kleinen Bahnen vor ihrer Höhle. */
  private renderResidents(): void {
    const seen = new Set<number>();
    const perBuilding = new Map<string, number>();
    for (const r of this.save.residents) {
      seen.add(r.uid);
      const b = buildings.find((x) => x.id === r.buildingId);
      const def = fishById.get(r.fishId);
      if (!b || !def) continue;
      const i = perBuilding.get(b.id) ?? 0;
      perBuilding.set(b.id, i + 1);
      let s = this.residentSprites.get(r.uid);
      if (!s) {
        s = this.add.sprite(b.position.x, b.position.y, def.sprite, 0).setScale(game.spriteScale).setDepth(5);
        s.play(animKey(def.sprite, 'swim'));
        this.residentSprites.set(r.uid, s);
      }
      const phase = this.time_ * (0.5 + i * 0.13) + i * 2.1;
      const x = b.position.x + Math.sin(phase) * (70 + i * 18);
      const y = b.position.y - 150 - i * 34 + Math.sin(phase * 2) * 10;
      s.setPosition(x, y).setFlipX(Math.cos(phase) < 0);
    }
    for (const [uid, s] of this.residentSprites) {
      if (seen.has(uid)) continue;
      s.destroy();
      this.residentSprites.delete(uid);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.time_ += dt;
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

    this.productionTimer += dt;
    if (this.productionTimer >= PRODUCTION_CHECK_SECONDS) {
      this.productionTimer = 0;
      const r = collectProduction(this.save, Date.now(), fishById, reef.maxOfflineHours * 3600e3);
      if (r.gained > 0) {
        this.setSave(r.save, true);
        this.hud.say(t('riff.shellsGained', { shells: r.gained }), 1.6);
      }
    }

    const pos = this.octopus.render(this.prevSwimmer, this.swimmer, this.stepper.alpha, this.paused ? 0 : dt);
    this.renderResidents();
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
