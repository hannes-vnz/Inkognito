import type { Save, UpgradeId } from './save';
import type { SpeciesDef } from './fishing';
import { addToCrate, crateCount } from './market';

/** Eintrag aus data/upgrades.json: Wert je Stufe und exponentielle Kosten. */
export interface UpgradeDef {
  id: UpgradeId;
  nameKey: string;
  effectKey: string;
  costBase: number;
  costGrowth: number;
  values: number[];
  /** Symbol im Shop (Emoji, wie auf der Seekarte). */
  icon: string;
}

export interface EconomyParams {
  knowledgeBonus: number;
  comboMultiplier: number;
}

export const upgradeValue = (def: UpgradeDef, level: number): number => def.values[Math.min(level, def.values.length - 1)]!;

export const isMaxed = (def: UpgradeDef, level: number): boolean => level >= def.values.length - 1;

/** Kosten für den Schritt von `level` auf `level + 1`. */
export const upgradeCost = (def: UpgradeDef, level: number): number => Math.round(def.costBase * Math.pow(def.costGrowth, level));

export function buyUpgrade(save: Save, def: UpgradeDef, now: number): Save {
  const level = save.upgrades[def.id];
  if (isMaxed(def, level)) throw new Error('Upgrade ist ausgereizt');
  const cost = upgradeCost(def, level);
  if (save.coins < cost) throw new Error('Zu wenig Münzen');
  return { ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [def.id]: level + 1 }, updatedAt: now };
}

/**
 * Stückpreis einer Art: bekannte Arten bringen mehr (Wissen zahlt sich aus, ab dem zweiten Fang),
 * angetippte im Flug doppelt, `bonus` aus Sammel-Sets und Prestige (0.1 = +10 %), `factor` ist der Tageskurs.
 */
export function fishValue(def: SpeciesDef, known: boolean, combo: boolean, p: EconomyParams, bonus = 0, factor = 1): number {
  return Math.round(def.value * (known ? 1 + p.knowledgeBonus : 1) * (combo ? p.comboMultiplier : 1) * (1 + bonus) * factor);
}

/**
 * Fang verbuchen: Fische in die Kiste (verkauft wird bei Bruno), Fischbuch zählen, Rekord merken.
 * Gibt zurück, welche Arten zum ersten Mal gefangen wurden (für die Fakt-Karten).
 */
export function landCatch(
  save: Save,
  catches: readonly { speciesId: string; combo: boolean }[],
  deepestMeters: number,
  species: ReadonlyMap<string, SpeciesDef>,
  now: number,
  /** Platz in der Kiste; was nicht mehr passt, schwimmt zurück ins Meer (zählt trotzdem fürs Fischbuch). */
  capacity = Infinity,
): { save: Save; firstCatches: string[]; overflow: number } {
  const fishbook = { ...save.fishbook };
  const firstCatches: string[] = [];
  const known = catches.filter((c) => species.has(c.speciesId));
  for (const c of known) {
    const entry = fishbook[c.speciesId];
    if (entry) fishbook[c.speciesId] = { ...entry, count: entry.count + 1 };
    else {
      fishbook[c.speciesId] = { count: 1, firstAt: now };
      firstCatches.push(c.speciesId);
    }
  }
  const space = Math.max(0, capacity - crateCount(save.crate));
  const kept = known.slice(0, space);
  return {
    firstCatches,
    overflow: known.length - kept.length,
    save: {
      ...save,
      fishbook,
      crate: addToCrate(save.crate, kept),
      stats: { casts: save.stats.casts + 1, deepestMeters: Math.max(save.stats.deepestMeters, deepestMeters) },
      updatedAt: now,
    },
  };
}
