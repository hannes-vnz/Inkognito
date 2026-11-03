import type { Save } from './save';

export interface SeaDef {
  id: string;
  nameKey: string;
  descKey: string;
  /** So viele Arten dieses Meeres muss man kennen, um weiterzuziehen; null = letztes Meer. */
  nextKnown: number | null;
}

export interface PrestigeParams {
  coinBonusPerSea: number;
}

interface SeaSpecies {
  id: string;
  sea: string;
  legend?: unknown;
}

/** Die Legende eines Meeres ist noch nicht gefangen (null, wenn es keine gibt oder sie schon im Fischbuch steht). */
export const missingLegend = <T extends SeaSpecies>(save: Save, species: readonly T[], sea: string): T | null =>
  species.find((s) => s.sea === sea && s.legend && !save.fishbook[s.id]) ?? null;

export const knownInSea = (save: Save, species: readonly SeaSpecies[], sea: string): number =>
  species.filter((s) => s.sea === sea && save.fishbook[s.id]).length;

/** Das nächste Meer nach dem aktuellen, oder null. */
export function nextSea<T extends SeaDef>(seas: readonly T[], current: string): T | null {
  const i = seas.findIndex((s) => s.id === current);
  return i >= 0 && i < seas.length - 1 ? seas[i + 1]! : null;
}

export function canMoveOn(save: Save, seas: readonly SeaDef[], species: readonly SeaSpecies[]): boolean {
  const here = seas.find((s) => s.id === save.sea.current);
  if (!here || here.nextKnown === null || !nextSea(seas, here.id)) return false;
  // Weiter geht es erst mit genug Arten UND der Legende: In ihrem Bauch steckt das Kartenstück zum nächsten Meer
  return knownInSea(save, species, here.id) >= here.nextKnown && !missingLegend(save, species, here.id);
}

/** Dauerhafter Münzbonus aus verlassenen Meeren (0.25 = +25 %). */
export const prestigeBonus = (save: Save, p: PrestigeParams): number => save.sea.left.length * p.coinBonusPerSea;

/**
 * Weiterziehen: Münzen und Upgrades auf null, Bert startet im Hafen des neuen Meeres.
 * Fischbuch, Story, Sets, Rekorde, Tagesbonus und Quiz-Statistik bleiben.
 */
export function moveOn(save: Save, to: string, home: string, now: number): Save {
  return {
    ...save,
    updatedAt: now,
    coins: 0,
    idleCarry: 0,
    lastTick: now,
    upgrades: { line: 0, hook: 0, crate: 0, steer: 0, lure: 0, engine: 0 },
    request: null,
    quiz: { ...save.quiz, nextAtCast: save.stats.casts },
    map: { ...save.map, spot: home, flotsamCast: -1, flotsamTaken: [] },
    sea: { current: to, left: [...save.sea.left, save.sea.current] },
  };
}
