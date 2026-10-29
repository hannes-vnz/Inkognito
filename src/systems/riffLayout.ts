import type { Orientation } from './joystick';

/** Grotte im Riff-Querschnitt (data/reef.json). */
export interface GrottoDef {
  id: string;
  kind: 'home' | 'building' | 'npc' | 'locked';
  building?: string;
  npc?: string;
  /** Spalte, Zeile je Ausrichtung. */
  portrait: [number, number];
  landscape: [number, number];
}

export interface GrottoParams {
  width: number;
  height: number;
  gap: number;
  /** Rand links/rechts/unten. */
  margin: number;
  /** Offenes Wasser über der Felswand. */
  top: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RiffLayout {
  width: number;
  height: number;
  /** Oberkante der Felswand. */
  wallTop: number;
  grottos: Map<string, Rect>;
}

/**
 * Ordnet die Grotten an: hochkant als Etagen untereinander, quer als Panorama.
 * Die Welt ist mindestens so groß wie der Bildschirm, damit nichts am Rand klebt.
 */
export function layoutGrottos(defs: readonly GrottoDef[], orientation: Orientation, viewWidth: number, viewHeight: number, p: GrottoParams): RiffLayout {
  let cols = 0;
  let rows = 0;
  for (const g of defs) {
    const [c, r] = g[orientation];
    cols = Math.max(cols, c + 1);
    rows = Math.max(rows, r + 1);
  }
  const contentW = cols * p.width + (cols - 1) * p.gap;
  const contentH = rows * p.height + (rows - 1) * p.gap;
  const width = Math.max(viewWidth, contentW + 2 * p.margin);
  const height = Math.max(viewHeight, p.top + contentH + p.margin);
  const offsetX = (width - contentW) / 2;
  const grottos = new Map<string, Rect>();
  for (const g of defs) {
    const [c, r] = g[orientation];
    grottos.set(g.id, { x: offsetX + c * (p.width + p.gap), y: p.top + r * (p.height + p.gap), width: p.width, height: p.height });
  }
  return { width, height, wallTop: p.top - p.gap, grottos };
}

export const contains = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** Welche Grotte liegt an einem Punkt (oder null). */
export function grottoAt(layout: RiffLayout, x: number, y: number): string | null {
  for (const [id, r] of layout.grottos) if (contains(r, x, y)) return id;
  return null;
}

/** Kamera nach dem Ziehen: Schwung klingt ab, Position bleibt in der Welt. */
export function clampScroll(scroll: number, viewSize: number, worldSize: number): number {
  return Math.min(Math.max(0, worldSize - viewSize), Math.max(0, scroll));
}
