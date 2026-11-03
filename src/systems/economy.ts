import type { Save, UpgradeId } from './save';
import type { SpeciesDef } from './fishing';
import { addToCrate } from './market';

/** Eintrag aus data/upgrades.json: Wert je Stufe und exponentielle Kosten. */
export interface UpgradeDef {
  id: UpgradeId;
  nameKey: string;
  effectKey: string;
  costBase: number;
  costGrowth: number;
  values: number[];
}

export interface EconomyParams {
  knowledgeBonus: number;
  comboMultiplier: number;
  maxOfflineHours: number;
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
): { save: Save; firstCatches: string[] } {
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
  return {
    firstCatches,
    save: {
      ...save,
      fishbook,
      crate: addToCrate(save.crate, known),
      stats: { casts: save.stats.casts + 1, deepestMeters: Math.max(save.stats.deepestMeters, deepestMeters) },
      updatedAt: now,
    },
  };
}

/** Crew-Einnahmen seit dem letzten Abrechnen (auch offline, gedeckelt), `bonus` aus Sammel-Sets. */
export function collectIdle(save: Save, now: number, crew: UpgradeDef, p: EconomyParams, bonus = 0): { save: Save; coins: number } {
  const from = Math.max(save.lastTick, now - p.maxOfflineHours * 3600e3);
  const minutes = Math.max(0, (now - from) / 60000);
  const exact = save.idleCarry + minutes * upgradeValue(crew, save.upgrades.crew) * (1 + bonus);
  const coins = Math.floor(exact);
  return { coins, save: { ...save, coins: save.coins + coins, idleCarry: exact - coins, lastTick: now, updatedAt: coins > 0 ? now : save.updatedAt } };
}
