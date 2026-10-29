export interface Vec2 {
  x: number;
  y: number;
}

export const length = (v: Vec2): number => Math.hypot(v.x, v.y);

/** Begrenzt die Länge eines Vektors auf `max`, Richtung bleibt erhalten. */
export function clampLength(v: Vec2, max: number): Vec2 {
  const len = length(v);
  if (len <= max || len === 0) return { x: v.x, y: v.y };
  const s = max / len;
  return { x: v.x * s, y: v.y * s };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
