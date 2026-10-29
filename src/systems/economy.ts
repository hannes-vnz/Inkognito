import type { Save, UpgradeId } from './save';
import type { SpeciesDef } from './fishing';

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

/** Wert eines Fangs: bekannte Arten bringen mehr (Wissen zahlt sich aus), angetippte im Flug doppelt. */
export function fishValue(def: SpeciesDef, known: boolean, combo: boolean, p: EconomyParams): number {
  return Math.round(def.value * (known ? 1 + p.knowledgeBonus : 1) * (combo ? p.comboMultiplier : 1));
}

/**
 * Fang verbuchen: Münzen gutschreiben, Fischbuch zählen, Rekord merken.
 * Gibt zurück, welche Arten zum ersten Mal gefangen wurden (für die Fakt-Karten).
 */
export function landCatch(
  save: Save,
  catches: readonly { speciesId: string; combo: boolean }[],
  deepestMeters: number,
  species: ReadonlyMap<string, SpeciesDef>,
  p: EconomyParams,
  now: number,
): { save: Save; coins: number; firstCatches: string[] } {
  const fishbook = { ...save.fishbook };
  const firstCatches: string[] = [];
  let coins = 0;
  for (const c of catches) {
    const def = species.get(c.speciesId);
    if (!def) continue;
    const entry = fishbook[c.speciesId];
    // Wissen gilt erst ab dem zweiten Fang: beim ersten lernt man die Art gerade kennen.
    coins += fishValue(def, entry !== undefined, c.combo, p);
    if (entry) fishbook[c.speciesId] = { ...entry, count: entry.count + 1 };
    else {
      fishbook[c.speciesId] = { count: 1, firstAt: now };
      firstCatches.push(c.speciesId);
    }
  }
  return {
    coins,
    firstCatches,
    save: {
      ...save,
      coins: save.coins + coins,
      fishbook,
      stats: { casts: save.stats.casts + 1, deepestMeters: Math.max(save.stats.deepestMeters, deepestMeters) },
      updatedAt: now,
    },
  };
}

/** Crew-Einnahmen seit dem letzten Abrechnen (auch offline, gedeckelt). */
export function collectIdle(save: Save, now: number, crew: UpgradeDef, p: EconomyParams): { save: Save; coins: number } {
  const from = Math.max(save.lastTick, now - p.maxOfflineHours * 3600e3);
  const minutes = Math.max(0, (now - from) / 60000);
  const exact = save.idleCarry + minutes * upgradeValue(crew, save.upgrades.crew);
  const coins = Math.floor(exact);
  return { coins, save: { ...save, coins: save.coins + coins, idleCarry: exact - coins, lastTick: now, updatedAt: coins > 0 ? now : save.updatedAt } };
}
