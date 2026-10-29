import { clamp, clampLength, type Vec2 } from './vector';

/** Tuning-Werte aus data/player.json (`movement`). Einheiten: Welt-Pixel und Sekunden. */
export interface MovementParams {
  /** Beschleunigung bei voll ausgelenktem Joystick. */
  acceleration: number;
  /** Höchstgeschwindigkeit. */
  maxSpeed: number;
  /** Wasserwiderstand: Geschwindigkeit fällt pro Sekunde um den Faktor e^-drag. */
  drag: number;
  /** Stärkerer Widerstand, wenn nicht gesteuert wird (Oktopus bremst mit den Armen). */
  idleDrag: number;
  /** Leichtes Absinken ohne Eingabe (positiv = nach unten). */
  sinkSpeed: number;
  /** Ab dieser horizontalen Geschwindigkeit dreht sich der Oktopus um. */
  turnThreshold: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SwimmerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 = schaut nach rechts, -1 = nach links. */
  facing: 1 | -1;
}

export function createSwimmer(x: number, y: number): SwimmerState {
  return { x, y, vx: 0, vy: 0, facing: 1 };
}

/**
 * Ein Physik-Schritt mit fester Zeitspanne. Rein funktional und deterministisch:
 * gleicher Zustand + gleiche Eingabe = gleiches Ergebnis (Voraussetzung für Duelle).
 */
export function stepSwimmer(
  s: SwimmerState,
  rawInput: Vec2,
  p: MovementParams,
  bounds: Bounds,
  dt: number,
): SwimmerState {
  const input = clampLength(rawInput, 1);
  const steering = input.x !== 0 || input.y !== 0;

  let vx = s.vx + input.x * p.acceleration * dt;
  let vy = s.vy + input.y * p.acceleration * dt;

  const damping = Math.exp(-(steering ? p.drag : p.idleDrag) * dt);
  vx *= damping;
  vy *= damping;

  if (!steering) {
    // Langsam auf die Sinkgeschwindigkeit zutreiben statt sie aufzuaddieren.
    vy += (p.sinkSpeed - vy) * (1 - damping);
  }

  const limited = clampLength({ x: vx, y: vy }, p.maxSpeed);
  vx = limited.x;
  vy = limited.y;

  let x = s.x + vx * dt;
  let y = s.y + vy * dt;

  // An Weltgrenzen weich anhalten: Geschwindigkeit in diese Richtung verfällt.
  const cx = clamp(x, bounds.minX, bounds.maxX);
  const cy = clamp(y, bounds.minY, bounds.maxY);
  if (cx !== x) vx = 0;
  if (cy !== y) vy = 0;
  x = cx;
  y = cy;

  let facing = s.facing;
  if (vx > p.turnThreshold) facing = 1;
  else if (vx < -p.turnThreshold) facing = -1;

  return { x, y, vx, vy, facing };
}

/**
 * Fester Zeitschritt mit Akkumulator. Entkoppelt Spiellogik von der Bildrate
 * (60 Hz, 90 Hz, 120 Hz) und liefert `alpha` für die Interpolation beim Zeichnen.
 */
export class FixedStepper {
  private accumulator = 0;
  readonly step: number;

  constructor(
    hz: number,
    private readonly maxStepsPerFrame = 5,
  ) {
    this.step = 1 / hz;
  }

  /** Gibt zurück, wie viele Schritte jetzt ausgeführt werden sollen. */
  advance(frameSeconds: number): number {
    this.accumulator += Math.max(0, frameSeconds);
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxStepsPerFrame) {
      // Nach langem Hänger (Tab im Hintergrund) nicht hinterherrennen.
      steps = this.maxStepsPerFrame;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.step;
    }
    return steps;
  }

  /** Anteil des angefangenen Schritts in [0, 1). */
  get alpha(): number {
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
