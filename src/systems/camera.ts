import { clamp, type Vec2 } from './vector';
import type { Orientation } from './joystick';

export interface CameraParams {
  /** Wie schnell die Kamera dem Ziel folgt (pro Sekunde, exponentiell). */
  followRate: number;
  /** Vorausschau in Sekunden Bewegung, getrennt nach Achse und Ausrichtung. */
  lookAhead: Record<Orientation, Vec2>;
  /** Höchste Vorausschau als Anteil der Bildschirmgröße. */
  maxLookAheadFraction: number;
  /** Wie schnell sich die Vorausschau anpasst (pro Sekunde). */
  lookAheadRate: number;
}

/**
 * Berechnet den Vorausschau-Versatz: Die Kamera blickt etwas in Schwimmrichtung,
 * hochkant betont nach unten, damit das Abtauchen im Vordergrund steht.
 */
export function targetLookAhead(
  velocity: Vec2,
  orientation: Orientation,
  viewWidth: number,
  viewHeight: number,
  p: CameraParams,
): Vec2 {
  const la = p.lookAhead[orientation];
  const maxX = viewWidth * p.maxLookAheadFraction;
  const maxY = viewHeight * p.maxLookAheadFraction;
  return {
    x: clamp(velocity.x * la.x, -maxX, maxX),
    y: clamp(velocity.y * la.y, -maxY, maxY),
  };
}

/** Bildraten-unabhängige Annäherung: Anteil, um den man sich in `dt` dem Ziel nähert. */
export const approachFactor = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
