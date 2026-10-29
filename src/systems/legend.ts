import { createRng } from './rng';
import type { SpeciesDef } from './fishing';
import type { Save } from './save';

/** Tag und Nacht wechseln mit den Würfen (wie die Uhr bei Dredge nur beim Angeln läuft). */
export interface TimeParams {
  dayCasts: number;
  nightCasts: number;
  /** Leuchtende Arten beißen nachts so viel öfter an. */
  nightGlowBoost: number;
}

export interface LegendRule {
  /** Angelplatz, an dem die Legende auftaucht. */
  spot: string;
  /** true: nur nachts, false: nur tagsüber. */
  night: boolean;
  /** So viele Fische muss der Haken tragen, sonst reißt die Leine. */
  minHook: number;
  /** Chance pro passendem Wurf. */
  chance: number;
  nameKey: string;
  /** Knuts Hinweise, vom vagen zum genauen. */
  hintKeys: string[];
}

export type LegendDef = SpeciesDef & { legend: LegendRule };

export const isNight = (casts: number, p: TimeParams): boolean => casts % (p.dayCasts + p.nightCasts) >= p.dayCasts;

/** Würfe, bis Tag oder Nacht wechselt (mindestens 1). */
export function castsUntilSwitch(casts: number, p: TimeParams): number {
  const k = casts % (p.dayCasts + p.nightCasts);
  return k < p.dayCasts ? p.dayCasts - k : p.dayCasts + p.nightCasts - k;
}

/** Nachts beißen leuchtende Arten öfter. */
export const nightSpecies = (species: readonly SpeciesDef[], night: boolean, p: TimeParams): SpeciesDef[] =>
  night ? species.map((s) => (s.glow ? { ...s, weight: s.weight * p.nightGlowBoost } : s)) : [...species];

export const isLegend = (s: SpeciesDef): s is LegendDef => (s as Partial<LegendDef>).legend !== undefined;

export const legendOf = (species: readonly SpeciesDef[], sea: string): LegendDef | null =>
  (species.filter(isLegend).find((s) => s.sea === sea) as LegendDef | undefined) ?? null;

/**
 * Taucht die Legende in diesem Wurf auf? Nur am richtigen Platz, zur richtigen Tageszeit,
 * wenn die Leine tief genug reicht, und dann mit ihrer Chance (Seed).
 * Gibt die Tiefe zurück, in der sie schwimmt, oder null.
 */
export function legendSpawn(seed: string, legend: LegendDef, spot: string, night: boolean, lineMeters: number): number | null {
  const r = legend.legend;
  if (spot !== r.spot || night !== r.night || lineMeters < legend.depthMeters[0]) return null;
  const rng = createRng(`${seed}-legend`);
  if (rng.next() >= r.chance) return null;
  const top = legend.depthMeters[0];
  const bottom = Math.min(legend.depthMeters[1], lineMeters);
  return top + rng.next() * (bottom - top);
}

/** Hält der Haken die Legende? */
export const hookHolds = (legend: LegendDef, capacity: number): boolean => capacity >= legend.legend.minHook;

export interface HintParams {
  legendHintEveryCasts: number;
  legendRequires: string;
}

export const hintsGiven = (save: Save, sea: string): number => save.legend.hints[sea] ?? 0;

/** Neuer Hinweis von Knut verfügbar? */
export const hintReady = (save: Save, sea: string, total: number, p: HintParams): boolean =>
  save.story.seen.includes(p.legendRequires) && hintsGiven(save, sea) < total && save.stats.casts >= save.legend.hintAtCast;

/** Nächsten Hinweis freigeben; der übernächste kommt erst nach ein paar Würfen. */
export function takeHint(save: Save, sea: string, p: HintParams): Save {
  return {
    ...save,
    legend: {
      ...save.legend,
      hints: { ...save.legend.hints, [sea]: hintsGiven(save, sea) + 1 },
      hintAtCast: save.stats.casts + p.legendHintEveryCasts,
    },
  };
}

export const markSnapped = (save: Save, sea: string): Save =>
  save.legend.snapped.includes(sea) ? save : { ...save, legend: { ...save.legend, snapped: [...save.legend.snapped, sea] } };
