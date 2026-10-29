import { createRng } from './rng';
import { triggerMet, type StoryTrigger } from './story';
import type { Save } from './save';

/** Bewohner oder Deko, die nach und nach im Hafen auftauchen. */
export interface LifeDef {
  id: string;
  nameKey: string;
  unlock: StoryTrigger;
}

export interface ChatterLine {
  speaker: string;
  textKey: string;
}

/** Running Gag: eine Folge kleiner Wortwechsel, die sich mit jedem Mal weiterentwickelt. */
export interface ChatterGag {
  id: string;
  steps: ChatterLine[][];
}

export const lifeUnlocked = (save: Save, life: readonly LifeDef[]): LifeDef[] => life.filter((l) => triggerMet(l.unlock, save));

/** Neu freigeschaltet, aber noch nicht angekündigt. */
export const lifeToAnnounce = (save: Save, life: readonly LifeDef[]): LifeDef[] =>
  lifeUnlocked(save, life).filter((l) => !save.harbor.life.includes(l.id));

export const announceLife = (save: Save, ids: readonly string[]): Save =>
  ids.length === 0 ? save : { ...save, harbor: { ...save.harbor, life: [...save.harbor.life, ...ids.filter((id) => !save.harbor.life.includes(id))] } };

/** Wie oft der Gag schon lief; der nächste Schritt läuft danach im Kreis weiter. */
export const gagPlays = (save: Save, id: string): number => save.harbor.chatter[id] ?? 0;

export const nextStep = (save: Save, gag: ChatterGag): ChatterLine[] => gag.steps[gagPlays(save, gag.id) % gag.steps.length]!;

/**
 * Nächster Running Gag, dessen Sprecher gerade alle zu sehen sind. Bevorzugt Gags,
 * die seltener liefen, damit sich alle weiterentwickeln.
 */
export function pickChatter(save: Save, gags: readonly ChatterGag[], visible: ReadonlySet<string>, seed: string): ChatterGag | null {
  const ready = gags.filter((g) => nextStep(save, g).every((l) => visible.has(l.speaker)));
  if (ready.length === 0) return null;
  const least = Math.min(...ready.map((g) => gagPlays(save, g.id)));
  return createRng(seed).pick(ready.filter((g) => gagPlays(save, g.id) === least));
}

export const advanceChatter = (save: Save, id: string): Save => ({
  ...save,
  harbor: { ...save.harbor, chatter: { ...save.harbor.chatter, [id]: gagPlays(save, id) + 1 } },
});
