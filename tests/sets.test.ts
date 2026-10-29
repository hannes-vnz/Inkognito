import { describe, expect, it } from 'vitest';
import { newlyCompleted, setBonus, setProgress, type SetDef } from '../src/systems/sets';
import { collectIdle, fishValue, type EconomyParams, type UpgradeDef } from '../src/systems/economy';
import { newSave, type Save } from '../src/systems/save';
import type { SpeciesDef } from '../src/systems/fishing';
import setsJson from '../data/sets.json';
import fishJson from '../data/fish.json';
import upgradesJson from '../data/upgrades.json';
import gameJson from '../data/game.json';
import texts from '../data/texts.de.json';

const sets = setsJson as SetDef[];
const species = fishJson as unknown as SpeciesDef[];
const p = gameJson.fishing as EconomyParams;
const T = 1_800_000_000_000;
const withBook = (ids: string[]): Save => ({ ...newSave(T), fishbook: Object.fromEntries(ids.map((id) => [id, { count: 1, firstAt: T }])) });

describe('Sammel-Sets', () => {
  it('jedes Set nennt nur bekannte Arten und hat einen Namen', () => {
    const ids = new Set(species.map((s) => s.id));
    for (const set of sets) {
      expect(texts).toHaveProperty([set.nameKey]);
      for (const id of set.species) expect(ids.has(id), `${set.id}: ${id}`).toBe(true);
      expect(set.species.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('„Keine Fische!“ enthält in jedem Meer genau alle Nicht-Fische', () => {
    for (const notFish of sets.filter((s) => s.id.startsWith('not_fish'))) {
      const all = species.filter((s) => s.sea === notFish.sea && s.group !== 'fish').map((s) => s.id).sort();
      expect([...notFish.species].sort(), notFish.id).toEqual(all);
    }
  });

  it('Sets enthalten nur Arten aus ihrem Meer', () => {
    for (const set of sets) for (const id of set.species) expect(species.find((s) => s.id === id)!.sea, `${set.id}: ${id}`).toBe(set.sea);
  });

  it('Fortschritt und Bonus erst bei vollständigem Set', () => {
    const teeth = sets.find((s) => s.id === 'teeth')!;
    const partial = withBook(teeth.species.slice(1));
    expect(setProgress(partial, sets).find((x) => x.def.id === 'teeth')).toMatchObject({ known: teeth.species.length - 1, complete: false });
    expect(setBonus(partial, sets, 'coins')).toBe(0);
    const full = withBook(teeth.species);
    expect(setBonus(full, sets, 'coins')).toBeCloseTo(teeth.bonus.value);
    expect(newlyCompleted(partial, full, sets).map((s) => s.id)).toEqual(['teeth']);
    expect(newlyCompleted(full, full, sets)).toEqual([]);
  });

  it('Bonus wirkt auf Münzen und Crew', () => {
    const tuna = species.find((s) => s.id === 'tuna')!;
    expect(fishValue(tuna, false, false, p, 0.5)).toBe(Math.round(tuna.value * 1.5));
    const crew = (upgradesJson as UpgradeDef[]).find((u) => u.id === 'crew')!;
    const s: Save = { ...newSave(T), upgrades: { line: 0, hook: 0, crew: 4, engine: 0 } };
    const plain = collectIdle(s, T + 60 * 60000, crew, p).coins;
    const boosted = collectIdle(s, T + 60 * 60000, crew, p, 0.15).coins;
    expect(boosted).toBe(Math.floor(plain * 1.15));
  });
});
