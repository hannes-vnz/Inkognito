import Phaser from 'phaser';
import { fish as fishDefs, game, player, predators as predatorDefs, zoneById, type ZoneDef } from '../data';
import { diveConfigFor } from '../diveConfig';
import { Octopus } from '../entities/Octopus';
import { FishLayer } from '../entities/Fish';
import { CarryLayer, ShotLayer } from '../entities/Bubble';
import { Parallax } from '../render/Parallax';
import { drawWorldDecor } from '../render/WorldDecor';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
import { TouchJoystick } from '../input/TouchJoystick';
import { KeyboardControls } from '../input/Keyboard';
import { AimInput } from '../input/AimInput';
import { FixedStepper } from '../systems/movement';
import { approachFactor, targetLookAhead } from '../systems/camera';
import { orientationOf, type Orientation } from '../systems/joystick';
import { depthRatio, metersAt } from '../systems/depth';
import { createRng, type Rng } from '../systems/rng';
import { createDive, metersAtY, stepDive, type DiveConfig, type DiveEvent, type DiveState } from '../systems/dive';
import { currentAt } from '../systems/current';
import { oxygenRatio } from '../systems/oxygen';
import type { FishState } from '../systems/fish';
import type { PredatorState } from '../systems/predator';
import { ExitMarker } from '../render/ExitMarker';
import { ResultOverlay } from '../ui/ResultOverlay';
import type { FishDef } from '../systems/fish';
import type { Vec2 } from '../systems/vector';
import { t } from '../i18n';
import { Hud } from '../ui/Hud';
import { JoystickView } from '../ui/JoystickView';
import { PauseOverlay } from '../ui/PauseOverlay';
import { readSafeArea } from '../ui/safeArea';

interface DiveData {
  zoneId: string;
  /** Laufende Nummer des Tauchgangs, ergibt den Seed. */
  diveNumber?: number;
}

const hexColor = (hex: string): Phaser.Display.Color => Phaser.Display.Color.HexStringToColor(hex);

/** Tauchgang: Schwimmen, Fangen mit der Blasenkanone, Fische folgen in Blasen. */
export class DiveScene extends Phaser.Scene {
  private zone!: ZoneDef;
  private cfg!: DiveConfig;
  private dive!: DiveState;
  private defs!: Map<string, FishDef>;
  private octopus!: Octopus;
  private fishLayer!: FishLayer<FishState>;
  private predatorLayer!: FishLayer<PredatorState>;
  private exitMarker!: ExitMarker;
  private result!: ResultOverlay;
  private diveNumber = 1;
  private shotLayer!: ShotLayer;
  private carryLayer!: CarryLayer;
  private parallax!: Parallax;
  private haze!: Phaser.GameObjects.Rectangle;
  private aimLine!: Phaser.GameObjects.Graphics;
  private snow!: MarineSnow;
  private bubbles!: BubbleTrail;
  private joystick!: TouchJoystick;
  private aim!: AimInput;
  private keyboard!: KeyboardControls;
  private hud!: Hud;
  private pause!: PauseOverlay;
  private stepper!: FixedStepper;
  private fxRng!: Rng;

  private camCenter: Vec2 = { x: 0, y: 0 };
  private lookAhead: Vec2 = { x: 0, y: 0 };
  private orientation: Orientation = 'portrait';
  private fpsTimer = 0;
  private paused = false;
  private hitStop = 0;
  private catches = 0;

  constructor() {
    super('Dive');
  }

  create(data: DiveData): void {
    this.zone = zoneById(data.zoneId);
    this.cfg = diveConfigFor(this.zone);
    this.diveNumber = data.diveNumber ?? 1;
    this.dive = createDive(this.cfg, `${this.zone.seed}-dive-${this.diveNumber}`);
    this.catches = 0;
    this.hitStop = 0;
    this.paused = false;
    this.lookAhead = { x: 0, y: 0 };
    this.defs = new Map(fishDefs.map((f) => [f.id, f]));
    const { world, spawn } = this.zone;
    const debug = new URLSearchParams(window.location.search).has('debug') || window.location.hash === '#debug';
    this.fxRng = createRng(`${this.zone.seed}-fx`);

    this.parallax = new Parallax(this, this.zone.background);
    this.haze = this.add
      .rectangle(0, 0, 10, 10, hexColor(this.zone.water.hazeColor).color, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Parallax.depthAbove(this.zone.background.length - 1));
    drawWorldDecor(this, this.zone);

    this.stepper = new FixedStepper(game.fixedStepHz);
    this.octopus = new Octopus(this, spawn.x, spawn.y, player, this.stepper.step);
    this.fishLayer = new FishLayer<FishState>(this, (f) => this.defs.get(f.fishId)!.sprite, game.spriteScale);
    const predatorSprites = new Map(predatorDefs.map((p) => [p.id, p.sprite]));
    this.predatorLayer = new FishLayer<PredatorState>(this, (r) => predatorSprites.get(r.predatorId)!, game.spriteScale, 9, (r) =>
      r.mode === 'stunned' ? { tint: 0x9fd8ff, angle: 160 } : r.mode === 'chase' ? { tint: 0xffc0a0 } : {},
    );
    this.exitMarker = new ExitMarker(this, this.zone.exit.x, this.zone.exit.y, this.zone.exit.radius);
    this.shotLayer = new ShotLayer(this, 'fx_bubble');
    this.carryLayer = new CarryLayer(this, this.defs, 'fx_catch_bubble');
    this.bubbles = new BubbleTrail(this, this.fxRng, game.juice.bubbles, 'fx_bubble');
    this.snow = new MarineSnow(this, this.fxRng, game.juice.marineSnow.count, game.juice.marineSnow.parallax, game.juice.marineSnow.driftSpeed);
    this.aimLine = this.add.graphics().setScrollFactor(0).setDepth(60);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width, world.height);
    cam.setBackgroundColor(this.zone.water.deep);
    this.camCenter = { x: spawn.x, y: spawn.y };
    cam.centerOn(spawn.x, spawn.y);

    const uiRoot = document.getElementById('ui') as HTMLElement;
    uiRoot.replaceChildren();
    this.hud = new Hud(uiRoot, this.zone.nameKey, debug);
    this.hud.setCarry([], this.cfg.carry.capacity);
    this.joystick = new TouchJoystick(this, new JoystickView(uiRoot, game.joystick.radius), game.joystick);
    this.aim = new AimInput(this);
    this.joystick.onTap = (point) => this.aim.fireAtScreen(point);
    this.keyboard = new KeyboardControls(this);
    this.pause = new PauseOverlay(uiRoot);
    this.result = new ResultOverlay(uiRoot);

    // Nur zum Testen: Zustand im Debug-Modus von außen lesbar (Konsole, automatische Tests).
    if (debug) (window as unknown as { inkognito: unknown }).inkognito = { dive: this.dive, camera: cam };

    this.orientation = orientationOf(this.scale.width, this.scale.height);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.hud.destroy();
      this.result.destroy();
    });
  }

  private onResize(): void {
    this.layout();
    const next = orientationOf(this.scale.width, this.scale.height);
    if (next !== this.orientation) {
      this.orientation = next;
      // Konzept: Pause beim Wechsel der Ausrichtung (nur auf Touch-Geräten, am Desktop stört es beim Fenster ziehen).
      if (this.sys.game.device.input.touch) this.setPaused(true);
    }
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.joystick.release();
    this.aim.release();
    this.stepper.reset();
    if (paused) this.pause.show('ui.pausedOrientation', () => this.setPaused(false));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.haze.setSize(width, height);
    this.joystick.layout(width, height, readSafeArea());
  }

  /** Einstiegshinweise: erst Bewegen, dann Schießen. */
  private updateHint(): void {
    if (this.aim.used) {
      this.hud.hideHint();
      return;
    }
    const touch = this.sys.game.device.input.touch;
    // Hochkant über dem Joystick, quer unten mittig (dort ist der Oktopus nie).
    const y =
      this.orientation === 'portrait'
        ? this.joystick.restPosition.y - game.joystick.radius - 56
        : this.scale.height - readSafeArea().bottom - 60;
    if (!touch) this.hud.showHint(this.keyboardUsed ? 'ui.hint.aim.keys' : 'ui.hint.keys', this.scale.height - 96);
    else if (!this.joystick.used) this.hud.showHint('ui.hint.touch', y);
    else this.hud.showHint(this.orientation === 'portrait' ? 'ui.hint.aim.portrait' : 'ui.hint.aim.landscape', y);
  }

  private keyboardUsed = false;

  private handleEvents(events: readonly DiveEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'fired':
          this.octopus.playCatch();
          break;
        case 'caught': {
          this.catches++;
          this.hitStop = game.catching.hitStopMs / 1000;
          this.bubbles.burst(e.x, e.y, 8);
          this.cameras.main.shake(90, 0.003);
          if (game.catching.vibration) navigator.vibrate?.(game.catching.vibrateMs);
          if (this.catches === 1 || this.fxRng.next() < 0.3) this.hud.say(t(`arm.gerd.catch.${this.fxRng.int(1, 3)}`));
          break;
        }
        case 'missed':
          this.bubbles.burst(e.x, e.y, 3);
          if (this.fxRng.next() < game.catching.gerdMissChance) this.hud.say(t(`arm.gerd.miss.${this.fxRng.int(1, 4)}`));
          break;
        case 'full':
          this.bubbles.burst(e.x, e.y, 4);
          this.hud.say(t('arm.gerd.full'));
          break;
        case 'spawned':
          break;
        case 'stolen': {
          const name = t(this.defs.get(e.fishId)!.nameKey);
          this.hud.say(t('ui.otterSteal', { fish: name }));
          this.cameras.main.shake(160, 0.006);
          if (game.catching.vibration) navigator.vibrate?.([30, 40, 30]);
          break;
        }
        case 'stunned':
          this.bubbles.burst(e.x, e.y, 6);
          this.hud.say(t('ui.otterStun'), 1.4);
          break;
        case 'lowOxygen':
          this.hud.say(t('ui.lowOxygen'), 3);
          break;
        case 'ended':
          this.showResult(e.status, e.fish);
          break;
      }
    }
  }

  private showResult(status: 'surfaced' | 'outOfAir', fish: readonly string[]): void {
    this.joystick.release();
    this.aim.release();
    this.hud.hideHint();
    const counts = new Map<string, number>();
    for (const id of fish) counts.set(id, (counts.get(id) ?? 0) + 1);
    const entries = [...counts].map(([id, count]) => {
      const def = this.defs.get(id)!;
      return { name: t(def.nameKey), count, color: def.placeholderColor };
    });
    const surfaced = status === 'surfaced';
    this.time.delayedCall(surfaced ? 250 : 600, () =>
      this.result.show(surfaced ? 'result.surfaced.title' : 'result.outOfAir.title', surfaced ? null : 'result.outOfAir.sub', entries, 'result.toReef', () =>
        this.scene.start('Riff', { returned: [...fish] }),
      ),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const s = this.dive;

    const active = s.status === 'diving';
    if (!this.paused && active) {
      const keys = this.keyboard.read();
      if (keys.x !== 0 || keys.y !== 0) this.keyboardUsed = true;
      if (this.keyboard.firePressed()) {
        this.aim.fireAtWorld({ x: s.player.x + s.player.facing * 300, y: s.player.y });
      }
      const move = keys.x !== 0 || keys.y !== 0 ? keys : this.joystick.value;
      this.updateHint();

      if (this.hitStop > 0) {
        // Kurzer Freeze beim Treffer: Logik hält an, Darstellung läuft weiter.
        this.hitStop -= dt;
        this.stepper.reset();
      } else {
        const steps = this.stepper.advance(dt);
        for (let i = 0; i < steps; i++) {
          const fireAt = i === 0 ? this.aim.take() : null;
          this.handleEvents(stepDive(s, { move, fireAt }, this.cfg, this.stepper.step));
        }
      }
    }

    const alpha = this.hitStop > 0 ? 1 : this.stepper.alpha;
    const pos = this.octopus.render(s.prevPlayer, s.player, alpha, this.paused ? 0 : dt);
    this.fishLayer.render(s.fish, alpha, dt);
    this.predatorLayer.render(s.predators, alpha, dt);
    this.shotLayer.render(s.shots, alpha, this.cfg.cannon.projectile.lifeSeconds);
    this.carryLayer.render(s.carried, alpha, dt);
    this.hud.setCarry(
      s.carried.map((c) => this.defs.get(c.fishId)!.placeholderColor),
      this.cfg.carry.capacity,
    );

    this.updateCamera(pos, dt);
    const lowAir = oxygenRatio(s.oxygen, this.cfg.oxygen) <= this.cfg.oxygen.warnRatio;
    this.hud.setOxygen(oxygenRatio(s.oxygen, this.cfg.oxygen), lowAir);
    this.exitMarker.update(this.cameras.main, dt, lowAir || s.carried.length >= this.cfg.carry.capacity);

    // Ziellinie beim Zielen im Querformat.
    this.aimLine.clear();
    if (this.aim.aiming) {
      const cam = this.cameras.main;
      const from = { x: pos.x - cam.scrollX, y: pos.y - cam.scrollY };
      const dx = this.aim.aiming.x - from.x;
      const dy = this.aim.aiming.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      this.aimLine.fillStyle(0xe4fdff, 0.85);
      for (let d = 30; d < Math.min(len, 420); d += 18) this.aimLine.fillCircle(from.x + (dx / len) * d, from.y + (dy / len) * d, 3);
    }

    const speedRatio = Math.hypot(s.player.vx, s.player.vy) / player.movement.maxSpeed;
    if (!this.paused) {
      this.bubbles.update(dt, pos.x, pos.y, s.player.vx, s.player.vy, speedRatio);
      this.snow.update(this.cameras.main, dt, currentAt(metersAtY(pos.y, this.cfg), s.time, this.cfg.current));
    }

    this.fpsTimer += dt;
    if (this.fpsTimer > 0.25) {
      this.fpsTimer = 0;
      this.hud.setFps(this.game.loop.actualFps);
    }
  }

  private updateCamera(pos: Vec2, dt: number): void {
    const s = this.dive.player;
    const cam = this.cameras.main;
    const target = targetLookAhead({ x: s.vx, y: s.vy }, this.orientation, cam.width, cam.height, game.camera);
    const la = approachFactor(game.camera.lookAheadRate, dt);
    this.lookAhead.x += (target.x - this.lookAhead.x) * la;
    this.lookAhead.y += (target.y - this.lookAhead.y) * la;
    const f = approachFactor(game.camera.followRate, dt);
    this.camCenter.x += (pos.x + this.lookAhead.x - this.camCenter.x) * f;
    this.camCenter.y += (pos.y + this.lookAhead.y - this.camCenter.y) * f;
    cam.centerOn(this.camCenter.x, this.camCenter.y);
    // centerOn klemmt erst beim Rendern; für Parallax und Schnee schon jetzt die geklemmten Werte nutzen.
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, this.zone.world.width - cam.width));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, this.zone.world.height - cam.height));

    // Mit der Tiefe blauer und dunstiger.
    const meters = metersAt(pos.y, {
      surfaceMeters: this.zone.depthMeters.min,
      pixelsPerMeter: this.zone.pixelsPerMeter,
      surfaceY: this.zone.world.surfaceY,
    });
    const ratio = depthRatio(meters, this.zone.depthMeters.min, this.zone.depthMeters.max);
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(hexColor('#ffffff'), hexColor(this.zone.water.deep), 100, Math.round(ratio * 100));
    this.parallax.setFixedTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
    this.haze.setFillStyle(this.haze.fillColor, ratio * this.zone.water.hazeMaxAlpha);
    this.parallax.update(cam);
    this.hud.setDepth(meters);
  }
}
