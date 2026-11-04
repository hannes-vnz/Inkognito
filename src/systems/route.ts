import type { Point } from './seaMap';

/**
 * Route der Seekarte (wie Level-Karten in Mobile-Spielen): Stationen liegen im Zickzack untereinander,
 * der Heimathafen unten, nach Norden (oben) geht es weiter. Dazwischen eine geschwungene Linie.
 */
export interface RouteLayout {
  nodes: Point[];
  height: number;
}

/** Positionen für `count` Stationen auf einer Karte der Breite `width`, Abstand `spacing`. */
export function routeLayout(count: number, width: number, spacing: number, top = 200, bottom = 230): RouteLayout {
  const height = top + bottom + Math.max(0, count - 1) * spacing;
  const nodes = Array.from({ length: count }, (_, i) => ({
    x: width * (i === 0 ? 0.5 : i % 2 ? 0.7 : 0.3),
    y: height - bottom - i * spacing,
  }));
  return { nodes, height };
}

/** Punkte auf der geschwungenen Verbindung von `a` nach `b` (Bezier mit seitlich versetztem Mittelpunkt). */
export function routeCurve(a: Point, b: Point, steps = 16): Point[] {
  const side = b.x >= a.x ? -1 : 1;
  const c = { x: (a.x + b.x) / 2 + side * Math.abs(b.x - a.x) * 0.6, y: (a.y + b.y) / 2 };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}

/** Weg entlang der Route von Station `from` zu Station `to` (auch rückwärts). */
export function routeBetween(nodes: readonly Point[], from: number, to: number): Point[] {
  if (from === to) return [nodes[from]!];
  const dir = to > from ? 1 : -1;
  const pts: Point[] = [];
  for (let i = from; i !== to; i += dir) {
    const lo = Math.min(i, i + dir);
    const seg = routeCurve(nodes[lo]!, nodes[lo + 1]!);
    const part = dir > 0 ? seg : [...seg].reverse();
    pts.push(...(pts.length ? part.slice(1) : part));
  }
  return pts;
}
