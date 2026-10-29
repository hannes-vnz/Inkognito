import { createRng } from './rng';
import type { FishRequest, Save } from './save';

export interface RewardParams {
  base: number;
  perValue: number;
}

interface RequestSpecies {
  id: string;
  value: number;
  depthMeters: [number, number];
}

/** Arten, deren Lebensbereich die Leine erreicht. */
export const reachable = <T extends RequestSpecies>(species: readonly T[], lineMeters: number): T[] =>
  species.filter((s) => s.depthMeters[0] <= lineMeters);

/** Neuer Wunschfisch per Seed, möglichst nicht dieselbe Art wie zuletzt. */
export function newRequest(seed: string, species: readonly RequestSpecies[], lineMeters: number, p: RewardParams, previous?: string): FishRequest | null {
  const pool = reachable(species, lineMeters);
  const fresh = pool.filter((s) => s.id !== previous);
  const from = fresh.length > 0 ? fresh : pool;
  if (from.length === 0) return null;
  const pick = createRng(seed).pick(from);
  return { speciesId: pick.id, reward: Math.round(p.base + p.perValue * pick.value) };
}

/** Prämie, wenn die gewünschte Art unter den gelandeten ist. Der Auftrag ist danach erledigt. */
export function fulfillRequest(save: Save, landed: readonly string[]): { save: Save; reward: number; speciesId: string | null } {
  const r = save.request;
  if (!r || !landed.includes(r.speciesId)) return { save, reward: 0, speciesId: null };
  return { save: { ...save, coins: save.coins + r.reward, request: null }, reward: r.reward, speciesId: r.speciesId };
}
