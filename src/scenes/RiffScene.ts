import Phaser from 'phaser';
import { buildings, colonyDefs, fishById, game, jobs, npcs, player, quests, reef } from '../data';
import { animKey } from '../entities/Octopus';
import { Parallax } from '../render/Parallax';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
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
import { clampScroll, grottoAt, layoutGrottos, type GrottoDef, type Rect, type RiffLayout } from '../systems/riffLayout';
import type { OwnedFish, Save } from '../systems/save';
import type { Vec2 } from '../systems/vector';
import { loadSave, writeSave } from '../storage';
import { t } from '../i18n';
import { RiffHud } from '../ui/RiffHud';
import { Sheet, type SheetOption } from '../ui/Sheet';
import { playReaction } from '../ui/ReactionShot';
import { AccountMenu } from '../ui/AccountMenu';
import { syncNow, type SyncResult } from '../online/sync';
import { onAuthChange } from '../online/cloud';

interface RiffData {
  /** Fische, die gerade vom Tauchgang mitgebracht wurden. */
  returned?: string[];
}

const color = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;
const TICK_SECONDS = 1;
const FLOOR = 28;

/**
 * Riff-Basis als 2,5D-Querschnitt (Vorbild Tiny Tower / Fallout Shelter, Tiefe wie Dave the Diver):
 * Felswand mit Grotten, durch die man die Riff-Kulisse sieht. Wischen bewegt die Kamera, Antippen wählt aus.
 */
export class RiffScene extends Phaser.Scene {
  private save!: Save;
  private layout!: RiffLayout;
  private orientation: Orientation = 'portrait';
  private parallax!: Parallax;
  private snow!: MarineSnow;
  private bubbles!: BubbleTrail;
  private hud!: RiffHud;
  private sheet!: Sheet;
  private account!: AccountMenu;
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private fishSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private octopus!: Phaser.GameObjects.Sprite;
  private scale_ = 2;
  private clock = 0;
  private tickTimer = 0;
  private hungryWarned = false;
  private shellCarry = 0;
  private ready = false;
  private interacted = false;

  // Wischen mit Schwung
  private drag: { id: number; start: Vec2; last: Vec2; moved: number; time: number } | null = null;
  private velocity: Vec2 = { x: 0, y: 0 };

  constructor() {
    super('Riff');
  }

  create(data: RiffData): void {
    const now = Date.now();
    this.ready = false;
    this.interacted = false;
    this.hungryWarned = false;
    this.shellCarry = 0;
    this.drag = null;
    this.velocity = { x: 0, y: 0 };
    this.npcSprites = new Map();
    this.fishSprites = new Map();
    this.scale_ = reef.spriteScale;
    this.save = loadSave(now);

    const uiRoot = document.getElementById('ui') as HTMLElement;
    uiRoot.replaceChildren();
    uiRoot.className = 'riff';
    this.hud = new RiffHud(uiRoot);
    this.sheet = new Sheet(uiRoot);
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

    const { width, height } = this.scale;
    this.orientation = orientationOf(width, height);
    this.layout = layoutGrottos(reef.grottos, this.orientation, width, height, reef.grotto);
    this.buildWorld();

    const fxRng = createRng(`${reef.seed}-fx`);
    this.bubbles = new BubbleTrail(this, fxRng, game.juice.bubbles, 'fx_bubble');
    this.snow = new MarineSnow(this, fxRng, game.juice.marineSnow.count, game.juice.marineSnow.parallax, game.juice.marineSnow.driftSpeed);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.layout.width, this.layout.height);
    cam.setBackgroundColor(reef.water.deep);
    cam.setScroll(0, 0);

    this.hud.setAction(t('riff.dive'), () => this.startDive());
    this.hud.showHint(t('ui.hint.riff'), height * 0.58);
    this.setupInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.hud.destroy();
    });
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

  // ---------------------------------------------------------------- Welt

  private grottoDef(id: string): GrottoDef {
    return reef.grottos.find((g) => g.id === id)!;
  }

  private rect(id: string): Rect {
    return this.layout.grottos.get(id)!;
  }

  /** Kulisse, Felswand mit ausgeschnittenen Grotten, Grotten-Inhalt, Vordergrund-Korallen. */
  private buildWorld(): void {
    const { width, height, wallTop } = this.layout;
    const w = reef.wall;
    this.parallax = new Parallax(this, reef.background, height);

    // Felswand als Textur, Grotten werden herausgeschnitten: dahinter sieht man die Riff-Kulisse (2,5D).
    const wall = this.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(0);
    const g = this.make.graphics({}, false);
    const rng = createRng(reef.seed);
    g.fillStyle(color(w.rock), 1);
    const top: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: height }];
    for (let x = 0; x <= width + 40; x += 40) top.push({ x, y: wallTop + Math.sin(x * 0.02) * 14 + rng.range(-10, 10) });
    top.push({ x: width, y: height });
    g.fillPoints(top, true);
    for (let i = 0; i < (width * height) / 9000; i++) {
      g.fillStyle(color(rng.next() < 0.5 ? w.rockLight : w.rockDark), rng.range(0.25, 0.6));
      g.fillCircle(rng.range(0, width), rng.range(wallTop + 20, height), rng.range(6, 26));
    }
    wall.draw(g);
    g.clear();
    g.fillStyle(0xffffff, 1);
    for (const r of this.layout.grottos.values()) g.fillRoundedRect(r.x, r.y, r.width, r.height, 28);
    wall.erase(g);
    g.destroy();

    const deco = this.add.graphics().setDepth(1);
    for (const def of reef.grottos) this.decorateGrotto(deco, def, this.rect(def.id), rng);

    for (const def of reef.grottos) this.fillGrotto(def, this.rect(def.id));

    // Vordergrund: Korallen am unteren Rand, schneller als die Welt (Tiefe).
    const fg = this.add.graphics().setScrollFactor(1.15, 1.08).setDepth(30);
    const colors = [0xe86a8a, 0xf2a65a, 0xb48be0, 0x6cc4a1];
    for (let i = 0; i < Math.ceil(width / 140); i++) {
      const cx = rng.range(0, width * 1.2);
      const c = rng.pick(colors);
      for (let b = 0; b < 4; b++) {
        fg.fillStyle(c, 0.9);
        fg.fillCircle(cx + rng.range(-40, 40), height * 1.08 + 30 - rng.range(0, 90), rng.range(18, 40));
      }
    }
  }

  /** Innenschatten, Sandboden und Korallenbüschel einer Grotte; verschüttete Grotten mit Felsbrocken. */
  private decorateGrotto(g: Phaser.GameObjects.Graphics, def: GrottoDef, r: Rect, rng: ReturnType<typeof createRng>): void {
    const w = reef.wall;
    const locked = this.isLocked(def);
    g.fillStyle(color(w.sandShadow), 1);
    g.fillRoundedRect(r.x + 6, r.y + r.height - FLOOR - 4, r.width - 12, FLOOR + 4, { tl: 0, tr: 0, bl: 24, br: 24 });
    g.fillStyle(color(w.sand), 1);
    g.fillRoundedRect(r.x + 6, r.y + r.height - FLOOR, r.width - 12, FLOOR - 6, { tl: 0, tr: 0, bl: 20, br: 20 });
    for (const side of [0, 1]) {
      const x = side === 0 ? r.x + 18 : r.x + r.width - 18;
      const c = rng.pick([0xe86a8a, 0xf2a65a, 0x6cc4a1, 0xb48be0]);
      for (let k = 0; k < 3; k++) {
        g.fillStyle(c, 1);
        g.fillCircle(x + rng.range(-8, 8), r.y + r.height - FLOOR - rng.range(2, 18), rng.range(6, 11));
      }
    }
    if (locked) {
      for (let k = 0; k < 14; k++) {
        g.fillStyle(color(k % 3 === 0 ? w.rockLight : w.rock), 1);
        g.fillCircle(r.x + rng.range(30, r.width - 30), r.y + r.height - rng.range(30, r.height * 0.75), rng.range(24, 46));
      }
    }
    g.lineStyle(10, color(w.grottoShadow), 0.45);
    g.strokeRoundedRect(r.x + 4, r.y + 4, r.width - 8, r.height - 8, 24);
    g.lineStyle(3, color(w.rockDark), 1);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 28);
  }

  private isLocked(def: GrottoDef): boolean {
    if (def.kind === 'locked') return true;
    if (def.kind === 'npc' && def.npc) return !npcUnlocked(npcs.find((n) => n.id === def.npc)!, this.save.quests);
    return false;
  }

  private floorY(r: Rect): number {
    return r.y + r.height - FLOOR + 6;
  }

  /** Gebäude, Figur und Oktopus in ihre Grotten setzen. */
  private fillGrotto(def: GrottoDef, r: Rect): void {
    const s = this.scale_;
    if (def.kind === 'home') {
      // Ausrüstungsständer und Oktopus, der auf den nächsten Tauchgang wartet.
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x6b5638, 1);
      g.fillRect(r.x + r.width - 90, this.floorY(r) - 70, 8, 70);
      g.fillRect(r.x + r.width - 110, this.floorY(r) - 70, 48, 6);
      this.add.image(r.x + r.width - 86, this.floorY(r) - 86, 'fx_catch_bubble').setScale(s).setDepth(2);
      this.octopus = this.add.sprite(r.x + r.width * 0.38, this.floorY(r), player.sprite, 0).setOrigin(0.5, 1).setScale(s + 1).setDepth(5);
      this.octopus.play(animKey(player.id, 'idle'));
      return;
    }
    if (def.building) {
      const b = buildings.find((x) => x.id === def.building)!;
      const x = def.npc ? r.x + r.width * 0.4 : r.x + r.width / 2;
      this.add.image(x, this.floorY(r), b.sprite).setOrigin(0.5, 1).setScale(s).setDepth(3);
    }
    if (def.npc) this.placeNpc(def, r, false);
  }

  private placeNpc(def: GrottoDef, r: Rect, announce: boolean): void {
    const npc = npcs.find((n) => n.id === def.npc)!;
    if (this.npcSprites.has(npc.id) || !npcUnlocked(npc, this.save.quests)) return;
    const s = this.scale_;
    const x = def.building ? r.x + r.width - 52 : r.x + r.width / 2;
    const y = this.floorY(r) - 8;
    this.add.image(x, y, reef.podestSprite).setOrigin(0.5, 0).setScale(s * 0.8).setDepth(4);
    const sprite = this.add.sprite(x, y + 2, npc.sprite, 0).setOrigin(0.5, 1).setScale(s).setDepth(4.5).play(animKey(npc.sprite, 'idle'));
    this.npcSprites.set(npc.id, sprite);
    if (announce) {
      sprite.setAlpha(0).y -= 60;
      this.tweens.add({ targets: sprite, alpha: 1, y: y + 2, duration: 700, ease: 'Back.Out' });
      this.bubbles.burst(x, y - 30, 12);
    }
  }

  /** Neue Figuren nach erledigten Aufträgen: verschüttete Grotte wird frei, Figur zieht ein. */
  private spawnUnlocked(): void {
    let reopened = false;
    for (const def of reef.grottos) {
      if (!def.npc || this.npcSprites.has(def.npc)) continue;
      const npc = npcs.find((n) => n.id === def.npc)!;
      if (!npcUnlocked(npc, this.save.quests)) continue;
      if (def.kind === 'npc') reopened = true;
      else this.placeNpc(def, this.rect(def.id), true);
    }
    // Verschüttete Grotten brauchen eine neu gezeichnete Wand: kurz neu aufbauen.
    if (reopened) this.time.delayedCall(900, () => !this.sheet.open && this.scene.restart({}));
  }

  // ---------------------------------------------------------------- Eingabe: wischen und tippen

  private setupInput(): void {
    const input = this.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.drag || this.sheet.open) return;
      this.velocity = { x: 0, y: 0 };
      this.drag = { id: p.id, start: { x: p.x, y: p.y }, last: { x: p.x, y: p.y }, moved: 0, time: this.time.now };
    });
    input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || d.id !== p.id) return;
      const dx = p.x - d.last.x;
      const dy = p.y - d.last.y;
      d.moved = Math.max(d.moved, Math.hypot(p.x - d.start.x, p.y - d.start.y));
      const dt = Math.max(1, this.time.now - d.time) / 1000;
      if (d.moved > reef.drag.tapMaxMove) {
        this.scrollBy(-dx, -dy);
        this.velocity = { x: -dx / dt, y: -dy / dt };
        this.markInteracted();
      }
      d.last = { x: p.x, y: p.y };
      d.time = this.time.now;
    });
    const end = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || d.id !== p.id) return;
      this.drag = null;
      if (d.moved <= reef.drag.tapMaxMove) {
        this.velocity = { x: 0, y: 0 };
        this.tapWorld(p.worldX, p.worldY);
      }
    };
    input.on(Phaser.Input.Events.POINTER_UP, end);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, end);
    input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: unknown, _o: unknown, dx: number, dy: number) => {
      if (!this.sheet.open) this.scrollBy(dx, dy);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN);
      input.off(Phaser.Input.Events.POINTER_MOVE);
      input.off(Phaser.Input.Events.POINTER_UP);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE);
      input.off(Phaser.Input.Events.POINTER_WHEEL);
    });
    const kb = this.input.keyboard;
    kb?.on('keydown', (e: KeyboardEvent) => {
      if (this.sheet.open) return;
      const step = 120;
      const map: Record<string, Vec2> = {
        ArrowUp: { x: 0, y: -step },
        KeyW: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
        KeyS: { x: 0, y: step },
        ArrowLeft: { x: -step, y: 0 },
        KeyA: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        KeyD: { x: step, y: 0 },
      };
      const v = map[e.code];
      if (v) this.scrollBy(v.x, v.y);
    });
  }

  private scrollBy(dx: number, dy: number): void {
    const cam = this.cameras.main;
    cam.scrollX = clampScroll(cam.scrollX + dx, cam.width, this.layout.width);
    cam.scrollY = clampScroll(cam.scrollY + dy, cam.height, this.layout.height);
  }

  private markInteracted(): void {
    if (this.interacted) return;
    this.interacted = true;
    this.hud.hideHint();
  }

  /** Antippen an einer Weltposition: Figur vor Gebäude, sonst die Grotte. Auch für Tests. */
  tapWorld(x: number, y: number): void {
    this.markInteracted();
    const id = grottoAt(this.layout, x, y);
    if (!id) return;
    const def = this.grottoDef(id);
    if (this.isLocked(def)) {
      this.hud.say(t('riff.locked'));
      return;
    }
    const npcSprite = def.npc ? this.npcSprites.get(def.npc) : undefined;
    const onNpc = npcSprite?.getBounds().contains(x, y);
    if (def.npc && npcSprite && (onNpc || !def.building)) {
      npcSprite.setScale(this.scale_ * 1.1);
      this.tweens.add({ targets: npcSprite, scale: this.scale_, duration: 200 });
      this.openDialog(npcs.find((n) => n.id === def.npc)!, 'start');
      return;
    }
    if (def.kind === 'home') {
      this.tweens.add({ targets: this.octopus, y: this.octopus.y - 16, yoyo: true, duration: 140 });
      this.sheet.show(t(reef.nameKey), t('riff.home'), [
        { label: t('riff.dive'), onSelect: () => this.startDive() },
        this.close(),
      ]);
      return;
    }
    if (def.building === 'house') this.openHouse();
    else if (def.building) this.openStation(buildings.find((b) => b.id === def.building)!);
  }

  /** Mitte einer Grotte in Weltkoordinaten (für Tests). */
  grottoCenter(id: string): Vec2 {
    const r = this.rect(id);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  /** Weltposition der Figur (für Tests). */
  npcPosition(id: string): Vec2 | null {
    const s = this.npcSprites.get(id);
    return s ? { x: s.x, y: s.y - s.displayHeight / 2 } : null;
  }

  private startDive(): void {
    writeSave(this.save);
    this.scene.start('Dive', { zoneId: 'kelp', diveNumber: this.save.diveCount + 1 });
  }

  // ---------------------------------------------------------------- Stand

  get state(): Save {
    return this.save;
  }

  private commit(next: Save, bump = false): void {
    const q = completeQuests(next, quests, Date.now());
    this.save = q.save;
    for (const done of q.completed) this.hud.say(t(done.doneTextKey), 3.5);
    writeSave(this.save);
    this.refreshHud(bump || q.completed.length > 0);
    if (q.completed.length > 0 && this.ready) this.spawnUnlocked();
  }

  private refreshHud(bump: boolean): void {
    const cap = houseCapacity(this.save, colonyDefs);
    this.hud.setShells(Math.floor(this.save.shells), bump);
    this.hud.setColony(this.save.fish.length, cap, Math.floor(this.save.food));
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
    const next = orientationOf(this.scale.width, this.scale.height);
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    // Andere Ausrichtung = andere Anordnung der Grotten.
    if (next !== this.orientation && !this.sheet.open) this.scene.restart({});
    else this.scrollBy(0, 0);
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

  private portrait(npc: NpcDef): string | undefined {
    try {
      return this.textures.getBase64(npc.sprite, 0);
    } catch {
      return undefined;
    }
  }

  private openDialog(npc: NpcDef, nodeId: string, skipReaction = false): void {
    const node = dialogNode(npc.dialog, nodeId, this.save.quests);
    const portrait = this.portrait(npc);
    if (node.reaction && portrait && !skipReaction) {
      // Erst die Reaktions-Szene, dann derselbe Knoten ohne Szene.
      this.sheet.close();
      playReaction(document.getElementById('ui')!, portrait, node.reaction, t(`reaction.${npc.id}.${node.id}`), () => this.openDialog(npc, nodeId, true));
      return;
    }
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
        const grotto = reef.grottos.find((g) => g.building === b.id);
        if (grotto) {
          const c = this.grottoCenter(grotto.id);
          this.bubbles.burst(c.x, c.y, 16);
          this.cameras.main.shake(120, 0.004);
        }
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
        label: `${this.fishName(f)} · ${this.jobName(f.job)}`,
        meta: this.statsText(f),
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
        label: full ? t('riff.jobFull', { job: t(job.nameKey) }) : t(job.nameKey),
        meta: `${t(`stat.${job.stat}`)} ${f.stats[job.stat]}`,
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
      this.sheet.show(t(npc.nameKey), t('riff.shop.empty'), [this.close()], undefined, this.portrait(npc));
      return;
    }
    this.sheet.show(
      t(npc.nameKey),
      t('npc.bruno.shop'),
      [
        ...all.map((f) => ({
          label: this.fishName(f),
          meta: `${sellPrice(f, colonyDefs)} 🐚`,
          color: fishById.get(f.fishId)!.placeholderColor,
          onSelect: () => {
            const r = sellFish(this.save, f.uid, colonyDefs, Date.now());
            this.commit(r.save, true);
            this.hud.say(t('riff.sold', { name: this.fishName(f), price: r.price }));
            this.openShop(npc);
          },
        })),
        this.close(),
      ],
      undefined,
      this.portrait(npc),
    );
  }

  // ---------------------------------------------------------------- Leben im Riff

  /** Arbeiter wuseln in ihrer Grotte, alle anderen im Haus, Wartende vor der Tür (halb durchsichtig). */
  private renderFish(): void {
    const seen = new Set<number>();
    const counters = new Map<string, number>();
    const place = (f: OwnedFish, grottoId: string, waiting: boolean) => {
      seen.add(f.uid);
      const def = fishById.get(f.fishId);
      const r = this.layout.grottos.get(grottoId);
      if (!def || !r) return;
      const key = grottoId + waiting;
      const i = counters.get(key) ?? 0;
      counters.set(key, i + 1);
      let s = this.fishSprites.get(f.uid);
      if (!s) {
        s = this.add.sprite(r.x + r.width / 2, r.y + r.height / 2, def.sprite, 0).setScale(this.scale_).setDepth(waiting ? 2.5 : 3.5);
        s.play(animKey(def.sprite, 'swim'));
        if (f.variant === 'zombie') s.setTint(0x9fe0a0);
        this.fishSprites.set(f.uid, s);
      }
      const phase = this.clock * (0.45 + (i % 5) * 0.09) + i * 2.3;
      const half = r.width / 2 - 40;
      const x = r.x + r.width / 2 + Math.sin(phase) * half * (waiting ? 0.3 : 0.9);
      const lanes = r.height - FLOOR - 70;
      const y = r.y + 40 + ((i * 37) % Math.max(1, lanes)) + Math.sin(phase * 2) * 6;
      s.setPosition(x, y).setFlipX(Math.cos(phase) < 0).setAlpha(waiting ? 0.55 : 1);
    };
    for (const f of this.save.fish) {
      const building = jobs.find((j) => j.id === f.job)?.building ?? 'house';
      place(f, reef.grottos.find((g) => g.building === building)?.id ?? 'house', false);
    }
    for (const f of this.save.waiting) place(f, 'house', true);
    for (const [uid, s] of this.fishSprites) {
      if (seen.has(uid)) continue;
      s.destroy();
      this.fishSprites.delete(uid);
    }
  }

  /** Erträge als aufsteigende Zahl über der Grotte. */
  private showGain(grottoId: string, text: string, colorHex: string): void {
    const r = this.layout.grottos.get(grottoId);
    if (!r) return;
    const cam = this.cameras.main;
    this.hud.floater(text, r.x + r.width / 2 - cam.scrollX, r.y + 40 - cam.scrollY, colorHex);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.clock += dt;

    // Schwung nach dem Wischen
    if (!this.drag && (this.velocity.x !== 0 || this.velocity.y !== 0)) {
      this.scrollBy(this.velocity.x * dt, this.velocity.y * dt);
      const k = Math.exp(-reef.drag.friction * dt);
      this.velocity = { x: this.velocity.x * k, y: this.velocity.y * k };
      if (Math.hypot(this.velocity.x, this.velocity.y) < 8) this.velocity = { x: 0, y: 0 };
    }
    this.hud.setAction(this.sheet.open ? null : t('riff.dive'), () => this.startDive());

    this.tickTimer += dt;
    if (this.tickTimer >= TICK_SECONDS) {
      this.tickTimer = 0;
      const r = tick(this.save, Date.now(), colonyDefs);
      if (r.ranOut && !this.hungryWarned) {
        this.hungryWarned = true;
        this.hud.say(t('riff.hungry'), 3);
      }
      if (r.save.food > 0) this.hungryWarned = false;
      this.shellCarry += r.shells;
      const before = Math.floor(this.save.shells);
      this.save = r.save;
      writeSave(this.save);
      const gained = Math.floor(this.save.shells) - before;
      if (gained > 0) this.showGain('shells', `+${gained}`, '#ffd1dc');
      this.refreshHud(gained > 0);
    }

    this.renderFish();
    this.parallax.update(this.cameras.main);
    this.snow.update(this.cameras.main, dt);
    this.bubbles.update(dt, 0, 0, 0, 0, 0);
  }
}
