import { createRng } from './rng';
import type { Save } from './save';

/**
 * Fischkiste und Markt: Gefangenes kommt erst in die Kiste und wird bei Bruno verkauft.
 * Jede Art hat einen eigenen Kurs, der in langsamen Wellen steigt und fällt (alle paar Würfe ein neuer Stand).
 * Wer wartet, bis der Hering teuer ist, verdient mehr.
 */
export interface MarketParams {
  /** Nach so vielen Würfen gibt es neue Kurse. */
  castsPerTick: number;
  /** Ausschlag der Kurswelle (0.45 = ±45 %). */
  swing: number;
  /** Zufälliger Zuschlag je Takt. */
  noise: number;
}

/** Inhalt der Kiste je Art; `premium` sind im Flug angetippte Fische (mehr wert). */
export type Crate = Record<string, { n: number; premium: number }>;

export const marketTick = (casts: number, p: MarketParams): number => Math.floor(casts / p.castsPerTick);

/** Würfe bis zu den nächsten Kursen. */
export const castsUntilTick = (casts: number, p: MarketParams): number => p.castsPerTick - (casts % p.castsPerTick);

/** Kursfaktor einer Art: eigene Welle (Phase und Tempo aus dem Seed) plus etwas Rauschen, zwischen 0,4 und 2. */
export function priceFactor(seed: string, speciesId: string, tick: number, p: MarketParams): number {
  const wave = createRng(`${seed}-${speciesId}`);
  const phase = wave.range(0, Math.PI * 2);
  const speed = wave.range(0.35, 0.9);
  const noise = createRng(`${seed}-${speciesId}-${tick}`).range(-p.noise, p.noise);
  const f = 1 + p.swing * Math.sin(phase + tick * speed) + noise;
  return Math.round(Math.min(2, Math.max(0.4, f)) * 100) / 100;
}

/** Richtung seit dem letzten Takt: 1 steigt, -1 fällt, 0 etwa gleich. */
export function priceTrend(seed: string, speciesId: string, tick: number, p: MarketParams): -1 | 0 | 1 {
  const d = priceFactor(seed, speciesId, tick, p) - priceFactor(seed, speciesId, tick - 1, p);
  return d > 0.05 ? 1 : d < -0.05 ? -1 : 0;
}

export const crateCount = (crate: Crate): number => Object.values(crate).reduce((a, c) => a + c.n, 0);

/** Fang in die Kiste legen. */
export function addToCrate(crate: Crate, catches: readonly { speciesId: string; combo: boolean }[]): Crate {
  const out: Crate = { ...crate };
  for (const c of catches) {
    const prev = out[c.speciesId] ?? { n: 0, premium: 0 };
    out[c.speciesId] = { n: prev.n + 1, premium: prev.premium + (c.combo ? 1 : 0) };
  }
  return out;
}

export interface SaleLine {
  speciesId: string;
  n: number;
  coins: number;
}

/**
 * Arten aus der Kiste verkaufen. `priceOf` liefert den heutigen Stückpreis, angetippte Fische zählen ×`comboMultiplier`.
 * Ist Brunos Wunschfisch dabei, gibt es die Prämie obendrauf und der Wunsch ist erfüllt.
 */
export function sellFish(
  save: Save,
  ids: readonly string[],
  priceOf: (speciesId: string) => number,
  comboMultiplier: number,
): { save: Save; coins: number; lines: SaleLine[]; request: { speciesId: string; reward: number } | null } {
  const crate: Crate = { ...save.crate };
  const lines: SaleLine[] = [];
  for (const id of ids) {
    const c = crate[id];
    if (!c || c.n === 0) continue;
    const price = priceOf(id);
    lines.push({ speciesId: id, n: c.n, coins: price * (c.n - c.premium) + Math.round(price * comboMultiplier) * c.premium });
    delete crate[id];
  }
  const r = save.request;
  const request = r && lines.some((l) => l.speciesId === r.speciesId) ? r : null;
  const coins = lines.reduce((a, l) => a + l.coins, 0) + (request?.reward ?? 0);
  return { coins, lines, request, save: { ...save, crate, coins: save.coins + coins, request: request ? null : save.request } };
}
