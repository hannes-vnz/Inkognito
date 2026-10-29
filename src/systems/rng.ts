/**
 * Seed-basierter Zufallsgenerator (mulberry32). Einzige erlaubte Zufallsquelle im Spiel,
 * damit Tauchgänge mit gleichem Seed identisch ablaufen (Fang-Duelle).
 */
export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Gleichverteilt in [min, max). */
  range(min: number, max: number): number;
  /** Ganzzahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number;
  /** Zufälliges Element eines nicht-leeren Arrays. */
  pick<T>(items: readonly T[]): T;
  /** Interner Zustand, um den Generator später exakt fortsetzen zu können. */
  readonly state: number;
}

export function seedFromString(text: string): number {
  // FNV-1a, 32 Bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRng(seed: number | string): Rng {
  let state = (typeof seed === 'string' ? seedFromString(seed) : seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('rng.pick: leeres Array');
      return items[Math.floor(next() * items.length)] as T;
    },
    get state() {
      return state;
    },
  };
}
