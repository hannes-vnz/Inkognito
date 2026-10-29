import { clamp } from './vector';

export interface DepthScale {
  /** Tiefe am oberen Weltrand in Metern. */
  surfaceMeters: number;
  /** Welt-Pixel pro Meter. */
  pixelsPerMeter: number;
  /** Y-Koordinate der Wasseroberfläche. */
  surfaceY: number;
}

export const metersAt = (y: number, s: DepthScale): number =>
  Math.max(0, s.surfaceMeters + (y - s.surfaceY) / s.pixelsPerMeter);

/** 0 an der Oberfläche, 1 am Grund der Zone; steuert z. B. den Tiefen-Dunst. */
export const depthRatio = (meters: number, minMeters: number, maxMeters: number): number =>
  maxMeters <= minMeters ? 0 : clamp((meters - minMeters) / (maxMeters - minMeters), 0, 1);
