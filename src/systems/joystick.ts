import type { Vec2 } from './vector';

export interface JoystickParams {
  /** Maximale Auslenkung des Knaufs in CSS-Pixeln. */
  radius: number;
  /** Anteil des Radius ohne Wirkung, gegen Zittern des Daumens. */
  deadzone: number;
  /** Zieht die Basis mit, wenn der Daumen über den Radius hinausgeht. */
  followFactor: number;
}

export interface StickReading {
  /** Steuervektor, Länge in [0, 1]. */
  value: Vec2;
  /** Position des Knaufs relativ zur Basis, für die Anzeige. */
  knob: Vec2;
  /** Neue Basis (verschoben, falls der Daumen weit wegzieht). */
  origin: Vec2;
}

/** Rechnet Daumenposition relativ zur Joystick-Basis in einen Steuervektor um. */
export function readStick(origin: Vec2, pointer: Vec2, p: JoystickParams): StickReading {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const dist = Math.hypot(dx, dy);

  let base = origin;
  if (dist > p.radius && p.followFactor > 0) {
    const excess = (dist - p.radius) * p.followFactor;
    base = { x: origin.x + (dx / dist) * excess, y: origin.y + (dy / dist) * excess };
  }

  const kx = pointer.x - base.x;
  const ky = pointer.y - base.y;
  const kDist = Math.hypot(kx, ky);
  const clamped = Math.min(kDist, p.radius);
  const knob = kDist === 0 ? { x: 0, y: 0 } : { x: (kx / kDist) * clamped, y: (ky / kDist) * clamped };

  const dead = p.radius * p.deadzone;
  if (kDist <= dead) return { value: { x: 0, y: 0 }, knob, origin: base };

  // Totzone herausrechnen, damit die Stärke direkt danach bei 0 beginnt.
  const strength = Math.min(1, (clamped - dead) / (p.radius - dead));
  return { value: { x: (kx / kDist) * strength, y: (ky / kDist) * strength }, knob, origin: base };
}

/** Tastatur (WASD/Pfeile) als Steuervektor, diagonal normiert. */
export function keysToVector(left: boolean, right: boolean, up: boolean, down: boolean): Vec2 {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  if (x !== 0 && y !== 0) return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 };
  return { x, y };
}

export type Orientation = 'portrait' | 'landscape';

export const orientationOf = (width: number, height: number): Orientation =>
  width >= height ? 'landscape' : 'portrait';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bereich, in dem ein Daumen den Joystick startet.
 * Hochkant: untere Hälfte (obere bleibt fürs Schießen). Quer: linke Hälfte.
 */
export function joystickZone(width: number, height: number): Rect {
  return orientationOf(width, height) === 'portrait'
    ? { x: 0, y: height / 2, width, height: height / 2 }
    : { x: 0, y: 0, width: width / 2, height };
}

export const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

export interface TapParams {
  /** Längste Berührung, die noch als Tipp zählt. */
  maxMs: number;
  /** Weiteste Daumenbewegung, die noch als Tipp zählt. */
  maxMove: number;
}

/** Kurz und ohne Ziehen = Tipp (schießt), sonst war es Steuern. */
export const isTap = (durationMs: number, moved: number, p: TapParams): boolean =>
  durationMs <= p.maxMs && moved <= p.maxMove;
