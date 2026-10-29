import type { Save } from './save';

/** Sammel-Set aus data/sets.json: alle Arten gefunden = dauerhafter Bonus. */
export interface SetDef {
  id: string;
  nameKey: string;
  species: string[];
  bonus: { type: 'coins' | 'crew'; value: number };
}

export interface SetProgress {
  def: SetDef;
  known: number;
  total: number;
  complete: boolean;
}

export function setProgress(save: Save, sets: readonly SetDef[]): SetProgress[] {
  return sets.map((def) => {
    const known = def.species.filter((id) => save.fishbook[id]).length;
    return { def, known, total: def.species.length, complete: known === def.species.length };
  });
}

/** Summe der Boni aller vollständigen Sets eines Typs (0.25 = +25 %). */
export function setBonus(save: Save, sets: readonly SetDef[], type: 'coins' | 'crew'): number {
  return setProgress(save, sets)
    .filter((p) => p.complete && p.def.bonus.type === type)
    .reduce((n, p) => n + p.def.bonus.value, 0);
}

/** Welche Sets durch den neuen Stand gerade fertig geworden sind. */
export function newlyCompleted(before: Save, after: Save, sets: readonly SetDef[]): SetDef[] {
  const was = new Set(setProgress(before, sets).filter((p) => p.complete).map((p) => p.def.id));
  return setProgress(after, sets)
    .filter((p) => p.complete && !was.has(p.def.id))
    .map((p) => p.def);
}
