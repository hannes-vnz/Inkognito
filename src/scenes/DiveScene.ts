import Phaser from 'phaser';
import { game, player, zoneById, type ZoneDef } from '../data';
import { Octopus } from '../entities/Octopus';
import { Parallax } from '../render/Parallax';
import { drawWorldDecor } from '../render/WorldDecor';
import { MarineSnow } from '../render/MarineSnow';
import { BubbleTrail } from '../render/BubbleTrail';
import { TouchJoystick } from '../input/TouchJoystick';
import { KeyboardControls } from '../input/Keyboard';
import { FixedStepper } from '../systems/movement';
import { approachFactor, targetLookAhead } from '../systems/camera';
import { orientationOf, type Orientation } from '../systems/joystick';
import { depthRatio, metersAt } from '../systems/depth';
import { createRng } from '../systems/rng';
import type { Vec2 } from '../systems/vector';
import { Hud } from '../ui/Hud';
import { JoystickView } from '../ui/JoystickView';
import { PauseOverlay } from '../ui/PauseOverlay';
import { readSafeArea } from '../ui/safeArea';

interface DiveData {
  zoneId: string;
}

const hexColor = (hex: string): Phaser.Display.Color => Phaser.Display.Color.HexStringToColor(hex);

/** Tauchgang. Meilenstein 1: Schwimmen, Kamera, Parallax-Hintergrund. */
export class DiveScene extends Phaser.Scene {
  private zone!: ZoneDef;
  private octopus!: Octopus;
  private parallax!: Parallax;
  private haze!: Phaser.GameObjects.Rectangle;
  private snow!: MarineSnow;
  private bubbles!: BubbleTrail;
  private joystick!: TouchJoystick;
  private keyboard!: KeyboardControls;
  private hud!: Hud;
  private pause!: PauseOverlay;
  private stepper!: FixedStepper;

  private camCenter: Vec2 = { x: 0, y: 0 };
  private lookAhead: Vec2 = { x: 0, y: 0 };
  private orientation: Orientation = 'portrait';
  private fpsTimer = 0;
  private paused = false;

  constructor() {
    super('Dive');
  }

  create(data: DiveData): void {
    this.zone = zoneById(data.zoneId);
    const { world, spawn } = this.zone;
    const debug = new URLSearchParams(window.location.search).has('debug');
    const fxRng = createRng(`${this.zone.seed}-fx`);

    this.parallax = new Parallax(this, this.zone.background);
    this.haze = this.add
      .rectangle(0, 0, 10, 10, hexColor(this.zone.water.hazeColor).color, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Parallax.depthAbove(this.zone.background.length - 1));
    drawWorldDecor(this, this.zone);

    this.stepper = new FixedStepper(game.fixedStepHz);
    const half = (player.frameWidth * player.scale) / 2;
    this.octopus = new Octopus(
      this,
      spawn.x,
      spawn.y,
      player,
      { minX: half, minY: world.surfaceY + half * 0.5, maxX: world.width - half, maxY: world.height - world.floorHeight },
      this.stepper.step,
    );
    this.bubbles = new BubbleTrail(this, fxRng, game.juice.bubbles, 'fx_bubble');
    this.snow = new MarineSnow(this, fxRng, game.juice.marineSnow.count, game.juice.marineSnow.parallax, game.juice.marineSnow.driftSpeed);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width, world.height);
    cam.setBackgroundColor(this.zone.water.deep);
    this.camCenter = { x: spawn.x, y: spawn.y };
    cam.centerOn(spawn.x, spawn.y);

    const uiRoot = document.getElementById('ui') as HTMLElement;
    this.hud = new Hud(uiRoot, this.zone.nameKey, debug);
    this.joystick = new TouchJoystick(this, new JoystickView(uiRoot, game.joystick.radius), game.joystick);
    this.keyboard = new KeyboardControls(this);
    this.pause = new PauseOverlay(uiRoot);

    this.orientation = orientationOf(this.scale.width, this.scale.height);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.hud.destroy();
    });

    const touch = this.sys.game.device.input.touch;
    const rest = this.joystick.restPosition;
    if (touch) this.hud.showHint('ui.hint.touch', rest.y - game.joystick.radius - 56);
    else this.hud.showHint('ui.hint.keys', this.scale.height - 96);
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
    this.stepper.reset();
    if (paused) this.pause.show('ui.pausedOrientation', () => this.setPaused(false));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.haze.setSize(width, height);
    this.joystick.layout(width, height, readSafeArea());
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const s = this.octopus.state;

    if (!this.paused) {
      const keys = this.keyboard.read();
      const input = keys.x !== 0 || keys.y !== 0 ? keys : this.joystick.value;
      if (this.joystick.used || keys.x !== 0 || keys.y !== 0) this.hud.hideHint();
      const steps = this.stepper.advance(dt);
      for (let i = 0; i < steps; i++) this.octopus.step(input, this.stepper.step);
    }

    const alpha = this.stepper.alpha;
    this.octopus.render(alpha, this.paused ? 0 : dt);
    const pos = this.octopus.renderPosition(alpha);

    // Kamera: weich folgen, in Schwimmrichtung vorausschauen.
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
    const meters = metersAt(pos.y, { surfaceMeters: this.zone.depthMeters.min, pixelsPerMeter: this.zone.pixelsPerMeter, surfaceY: this.zone.world.surfaceY });
    const ratio = depthRatio(meters, this.zone.depthMeters.min, this.zone.depthMeters.max);
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      hexColor('#ffffff'),
      hexColor(this.zone.water.deep),
      100,
      Math.round(ratio * 100),
    );
    this.parallax.setFixedTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
    this.haze.setFillStyle(this.haze.fillColor, ratio * this.zone.water.hazeMaxAlpha);
    this.parallax.update(cam);

    const speedRatio = Math.hypot(s.vx, s.vy) / player.movement.maxSpeed;
    if (!this.paused) {
      this.bubbles.update(dt, pos.x, pos.y, s.vx, s.vy, speedRatio);
      this.snow.update(cam, dt);
    }

    this.hud.setDepth(meters);
    this.fpsTimer += dt;
    if (this.fpsTimer > 0.25) {
      this.fpsTimer = 0;
      this.hud.setFps(this.game.loop.actualFps);
    }
  }
}
