import type { FishDef } from './fish';
import type { Save } from './save';

/**
 * Zahlt Muscheln für alle Bewohner aus, deren Produktionszeit seit der letzten Auszahlung vergangen ist.
 * Offline-Zeit wird auf `maxOfflineMs` begrenzt.
 */
export function collectProduction(
  save: Save,
  now: number,
  fishDefs: ReadonlyMap<string, FishDef>,
  maxOfflineMs: number,
): { save: Save; gained: number } {
  let gained = 0;
  const residents = save.residents.map((r) => {
    const def = fishDefs.get(r.fishId);
    if (!def) return r;
    const every = def.produces.everySeconds * 1000;
    const from = Math.max(r.producedUntil, now - maxOfflineMs);
    const periods = Math.floor((now - from) / every);
    if (periods <= 0) return r.producedUntil < from ? { ...r, producedUntil: from } : r;
    gained += periods * def.produces.shells;
    return { ...r, producedUntil: from + periods * every };
  });
  if (gained === 0 && residents.every((r, i) => r === save.residents[i])) return { save, gained };
  return { save: { ...save, residents, shells: save.shells + gained, updatedAt: now }, gained };
}

/** Sekunden bis zur nächsten Muschel eines Bewohners (für Anzeigen). */
export function secondsUntilNext(producedUntil: number, everySeconds: number, now: number): number {
  const every = everySeconds * 1000;
  const elapsed = (now - producedUntil) % every;
  return Math.ceil((every - elapsed) / 1000);
}
