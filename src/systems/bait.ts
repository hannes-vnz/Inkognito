import type { SpeciesDef } from './fishing';
import type { Save } from './save';

export type BaitEffect =
  | { type: 'glow'; factor: number }
  | { type: 'group'; groups: string[]; factor: number }
  | { type: 'legend'; factor: number };

export interface BaitDef {
  id: string;
  nameKey: string;
  descKey: string;
  costBase: number;
  /** Aufschlag je Upgrade-Stufe von Leine und Haken, damit der Preis mitwächst. */
  costPerLevel: number;
  effect: BaitEffect;
}

export const baitCost = (bait: BaitDef, save: Save): number =>
  Math.round(bait.costBase + bait.costPerLevel * (save.upgrades.line + save.upgrades.hook));

/** Köder kaufen: nur einer gleichzeitig, gilt für den nächsten Wurf. */
export function buyBait(save: Save, bait: BaitDef): Save | null {
  const cost = baitCost(bait, save);
  if (save.bait !== null || save.coins < cost) return null;
  return { ...save, coins: save.coins - cost, bait: bait.id };
}

/** Wirkung auf die Arten des Wurfs. */
export function baitSpecies(species: readonly SpeciesDef[], bait: BaitDef | null): SpeciesDef[] {
  if (!bait) return [...species];
  const e = bait.effect;
  const hit = (s: SpeciesDef): boolean => (e.type === 'glow' ? s.glow : e.type === 'group' ? e.groups.includes(s.group) : false);
  return species.map((s) => (hit(s) ? { ...s, weight: s.weight * e.factor } : s));
}

/** Lockt der Köder die Legende sicher an? */
export const baitCallsLegend = (bait: BaitDef | null): boolean => bait?.effect.type === 'legend';

export const consumeBait = (save: Save): Save => (save.bait === null ? save : { ...save, bait: null });
