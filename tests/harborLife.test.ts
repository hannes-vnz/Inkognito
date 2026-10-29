import { describe, expect, it } from 'vitest';
import lifeJson from '../data/harbor_life.json';
import chatterJson from '../data/chatter.json';
import npcsJson from '../data/npcs.json';
import texts from '../data/texts.de.json';
import { advanceChatter, announceLife, lifeToAnnounce, lifeUnlocked, nextStep, pickChatter, type ChatterGag, type LifeDef } from '../src/systems/harborLife';
import { newSave, type Save } from '../src/systems/save';

const life = lifeJson as LifeDef[];
const gags = chatterJson as ChatterGag[];
const speakers = new Set([...npcsJson.map((n) => n.id), ...life.map((l) => l.id)]);

describe('Hafenleben', () => {
  it('Daten: Namen vorhanden, Sprecher existieren, alle Zeilen haben Text', () => {
    for (const l of life) expect(texts).toHaveProperty([l.nameKey]);
    for (const g of gags)
      for (const step of g.steps) {
        expect(step.length).toBeGreaterThanOrEqual(2);
        for (const line of step) {
          expect(speakers.has(line.speaker), `${g.id}: ${line.speaker}`).toBe(true);
          expect(texts).toHaveProperty([line.textKey]);
        }
      }
  });

  it('füllt sich mit dem Fortschritt und kündigt jeden Bewohner nur einmal an', () => {
    let s = newSave(1);
    expect(lifeUnlocked(s, life)).toHaveLength(0);
    s = { ...s, stats: { casts: 50, deepestMeters: 0 }, fishbook: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, { count: 1, firstAt: 1 }])) };
    const fresh = lifeToAnnounce(s, life);
    expect(fresh).toHaveLength(life.length);
    s = announceLife(s, fresh.map((l) => l.id));
    expect(lifeToAnnounce(s, life)).toHaveLength(0);
  });
});

describe('Running Gags', () => {
  const all = new Set(speakers);

  it('läuft nur, wenn alle Sprecher zu sehen sind', () => {
    expect(pickChatter(newSave(1), gags, new Set(), 'x')).toBeNull();
    expect(pickChatter(newSave(1), gags, all, 'x')).not.toBeNull();
  });

  it('entwickelt sich weiter und bevorzugt seltener gespielte Gags', () => {
    let s: Save = newSave(1);
    const first = pickChatter(s, gags, all, 'a')!;
    const step0 = nextStep(s, first);
    s = advanceChatter(s, first.id);
    expect(nextStep(s, first)).not.toBe(step0);
    for (let i = 0; i < gags.length - 1; i++) {
      const g = pickChatter(s, gags, all, `b${i}`)!;
      expect(g.id).not.toBe(first.id);
      s = advanceChatter(s, g.id);
    }
  });
});
