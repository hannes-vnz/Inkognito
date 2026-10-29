import { createRng } from './rng';
import type { SpeciesDef } from './fishing';
import type { Save } from './save';

export interface Point {
  x: number;
  y: number;
}

export interface SpotDef extends Point {
  id: string;
  nameKey: string;
  descKey: string;
  /** Tiefer geht es an diesem Platz nicht, egal wie lang die Leine ist. */
  maxMeters: number;
  /** Arten, die hier öfter anbeißen. */
  boost: string[];
  /** Hafen mit Steg, Fischstand und Figuren. */
  harbor: boolean;
  sea: string;
  /** Strömung: so stark (Einheiten pro Sekunde) treibt der Haken seitlich. */
  current: number;
}

export interface MapParams {
  worldSize: number;
  boatSpeed: number;
  spotRadius: number;
  boostWeight: number;
  flotsamCount: number;
  flotsamRadius: number;
  flotsamCoins: { base: number; perUnit: number };
  bottleChance: number;
  bottleCoins: number;
}

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Ein Platz ist erreichbar, wenn er innerhalb der Motor-Reichweite um den Hafen liegt. */
export const spotUnlocked = (spot: Point, home: Point, range: number): boolean => distance(spot, home) <= range;

export const unlockedSpots = <T extends Point>(spots: readonly T[], home: Point, range: number): T[] =>
  spots.filter((s) => spotUnlocked(s, home, range));

/** Platz, an dem das Boot gerade liegt (nächster im Umkreis), oder null. */
export function spotAt<T extends Point>(pos: Point, spots: readonly T[], radius: number): T | null {
  let best: T | null = null;
  for (const s of spots) if (distance(pos, s) <= radius && (!best || distance(pos, s) < distance(pos, best))) best = s;
  return best;
}

/** Hält eine Position innerhalb der Reichweite und der Weltgrenzen. `limited`: Rand erreicht. */
export function clampToRange(pos: Point, home: Point, range: number, worldSize: number): Point & { limited: boolean } {
  let { x, y } = pos;
  let limited = false;
  const d = distance(pos, home);
  if (d > range) {
    x = home.x + ((x - home.x) / d) * range;
    y = home.y + ((y - home.y) / d) * range;
    limited = true;
  }
  return { x: Math.min(worldSize, Math.max(0, x)), y: Math.min(worldSize, Math.max(0, y)), limited };
}

export interface Boat extends Point {
  heading: number;
}

/** Fährt Richtung Ziel (Daumen), dreht sich in Fahrtrichtung. Ohne Ziel bleibt das Boot stehen. */
export function stepBoat(boat: Boat, target: Point | null, speed: number, dt: number): Boat {
  if (!target) return boat;
  const d = distance(boat, target);
  if (d < 4) return boat;
  const step = Math.min(d, speed * dt);
  const heading = Math.atan2(target.y - boat.y, target.x - boat.x);
  return { x: boat.x + Math.cos(heading) * step, y: boat.y + Math.sin(heading) * step, heading };
}

/** Arten für einen Platz: Lieblingsarten des Platzes zählen mehrfach. */
export function spotSpecies(species: readonly SpeciesDef[], spot: SpotDef, boostWeight: number): SpeciesDef[] {
  return species.map((s) => (spot.boost.includes(s.id) ? { ...s, weight: s.weight * boostWeight } : s));
}

/** Größte erreichbare Tiefe: Leine, gedeckelt durch den tiefsten freigeschalteten Platz. */
export function reachableMeters(line: number, spots: readonly SpotDef[], home: Point, range: number): number {
  const deepest = Math.max(0, ...unlockedSpots(spots, home, range).map((s) => s.maxMeters));
  return Math.min(line, deepest);
}

export interface Flotsam extends Point {
  id: number;
  coins: number;
  /** Flaschenpost statt Kiste: zeigt den nächsten Brief. */
  bottle: boolean;
}

/** Treibgut innerhalb der Reichweite auf der Seeseite (oben rechts vom Hafen), neu nach jedem Wurf. Weiter draußen ist mehr wert. */
export function flotsam(seed: string, home: Point, range: number, p: MapParams): Flotsam[] {
  const rng = createRng(seed);
  const withBottle = rng.next() < p.bottleChance;
  return Array.from({ length: p.flotsamCount }, (_, id) => {
    const r = range * Math.sqrt(rng.range(0.08, 0.95));
    const a = rng.range(-1.75, 0.17);
    const pos = clampToRange({ x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r }, home, range, p.worldSize);
    // Gibt es diesmal Flaschenpost, ist es das letzte Stück.
    const bottle = withBottle && id === p.flotsamCount - 1;
    const coins = bottle ? p.bottleCoins : Math.round(p.flotsamCoins.base + p.flotsamCoins.perUnit * distance(pos, home));
    return { id, x: pos.x, y: pos.y, coins, bottle };
  });
}

/** Treibgut einsammeln; pro Wurf zählt jedes Stück nur einmal. */
export function takeFlotsam(save: Save, piece: Flotsam): Save {
  const fresh = save.map.flotsamCast === save.stats.casts ? save.map.flotsamTaken : [];
  if (fresh.includes(piece.id)) return save;
  return {
    ...save,
    coins: save.coins + piece.coins,
    map: {
      ...save.map,
      flotsamCast: save.stats.casts,
      flotsamTaken: [...fresh, piece.id],
      bottlesRead: save.map.bottlesRead + (piece.bottle ? 1 : 0),
    },
  };
}

export const flotsamTaken = (save: Save, id: number): boolean =>
  save.map.flotsamCast === save.stats.casts && save.map.flotsamTaken.includes(id);
