import { createRng } from './rng';
import type { Save } from './save';

/**
 * Dienste der Hafenfiguren:
 * Möwe Gisela verrät gegen ein Fischbrötchen einen Schwarm-Platz (dort ein paar Würfe lang mehr Münzen).
 * Herr Schulze chartert einmal am Tag das Boot: Er zahlt kräftig, verscheucht aber mit dem Blitz einen Fisch,
 * und jede Art, die dabei an Bord kommt, klebt er in sein Urlaubsalbum.
 */
export interface PerkParams {
  tip: { priceBase: number; pricePerLevel: number; casts: number; bonus: number };
  charter: { bonus: number; hookPenalty: number };
}

/** Preis für Giselas Tipp: steigt mit den Upgrades, damit er nie geschenkt ist. */
export function tipPrice(save: Save, p: PerkParams): number {
  const levels = Object.values(save.upgrades).reduce((a, b) => a + b, 0);
  return p.tip.priceBase + p.tip.pricePerLevel * levels;
}

/** Tipp kaufen: Gisela nennt einen der erreichbaren Plätze (nicht den Hafen). Null, wenn zu teuer oder kein Platz. */
export function buyTip(save: Save, spotIds: readonly string[], seed: string, p: PerkParams): Save | null {
  const price = tipPrice(save, p);
  if (save.coins < price || spotIds.length === 0) return null;
  const others = spotIds.filter((id) => id !== save.perks.tip?.spot);
  const pool = others.length > 0 ? others : spotIds;
  const spot = createRng(seed).pick(pool);
  return { ...save, coins: save.coins - price, perks: { ...save.perks, tip: { spot, casts: p.tip.casts } } };
}

/** Münz-Bonus aus Giselas Tipp für einen Wurf an `spotId` (1 = +100 %). */
export const tipBonus = (save: Save, spotId: string, p: PerkParams): number =>
  save.perks.tip && save.perks.tip.spot === spotId && save.perks.tip.casts > 0 ? p.tip.bonus : 0;

/** Nach einem Wurf am Tipp-Platz: ein Wurf weniger, danach ist der Schwarm weitergezogen. */
export function useTip(save: Save, spotId: string): Save {
  const tip = save.perks.tip;
  if (!tip || tip.spot !== spotId) return save;
  return { ...save, perks: { ...save.perks, tip: tip.casts > 1 ? { ...tip, casts: tip.casts - 1 } : null } };
}

/** Schulze fährt höchstens einmal am Tag mit. */
export const charterReady = (save: Save, today: string): boolean => !save.perks.charter.aboard && save.perks.charter.day !== today;

export function boardCharter(save: Save, today: string): Save {
  if (!charterReady(save, today)) return save;
  return { ...save, perks: { ...save.perks, charter: { ...save.perks.charter, day: today, aboard: true } } };
}

/** Haken beim Charter: der Blitz verscheucht einen Fisch, mindestens ein Haken bleibt. */
export const charterHooks = (save: Save, hooks: number, p: PerkParams): number => (save.perks.charter.aboard ? Math.max(1, hooks - p.charter.hookPenalty) : hooks);

export const charterBonus = (save: Save, p: PerkParams): number => (save.perks.charter.aboard ? p.charter.bonus : 0);

/** Schulze geht von Bord und klebt neue Arten ins Album. */
export function landCharter(save: Save, caught: readonly string[]): { save: Save; photos: string[] } {
  const charter = save.perks.charter;
  if (!charter.aboard) return { save, photos: [] };
  const photos = [...new Set(caught)].filter((id) => !charter.album.includes(id));
  return { photos, save: { ...save, perks: { ...save.perks, charter: { ...charter, aboard: false, album: [...charter.album, ...photos] } } } };
}
