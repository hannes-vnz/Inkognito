import { describe, expect, it } from 'vitest';
import spotsJson from '../data/spots.json';
import fishJson from '../data/fish.json';
import upgradesJson from '../data/upgrades.json';
import gameJson from '../data/game.json';
import texts from '../data/texts.de.json';
import { clampToRange, distance, flotsam, flotsamTaken, reachableMeters, spotAt, spotSpecies, spotUnlocked, stepBoat, takeFlotsam, type MapParams, type SpotDef } from '../src/systems/seaMap';
import type { SpeciesDef } from '../src/systems/fishing';
import { newSave } from '../src/systems/save';

const spots = spotsJson as SpotDef[];
const home = spots.find((s) => s.harbor)!;
const mp = gameJson.map as MapParams;
const engine = upgradesJson.find((u) => u.id === 'engine')!.values;
const species = fishJson as unknown as SpeciesDef[];

describe('Seekarte', () => {
  it('Daten: genau ein Hafen, Texte da, Boost-Arten existieren, alles in der Welt', () => {
    expect(spots.filter((s) => s.harbor)).toHaveLength(1);
    for (const s of spots) {
      for (const key of [s.nameKey, s.descKey]) expect(texts).toHaveProperty([key]);
      for (const b of s.boost) expect(species.map((f) => f.id)).toContain(b);
      expect(s.x).toBeLessThanOrEqual(mp.worldSize);
      expect(s.y).toBeLessThanOrEqual(mp.worldSize);
    }
  });

  it('jede Motorstufe schaltet genau einen neuen Platz frei, der letzte erreicht den Graben', () => {
    const counts = engine.map((r) => spots.filter((s) => spotUnlocked(s, home, r)).length);
    expect(counts).toEqual(engine.map((_, i) => i + 1));
    expect(reachableMeters(99999, spots, home, engine[engine.length - 1]!)).toBe(11000);
    expect(reachableMeters(500, spots, home, engine[0]!)).toBe(200);
  });

  it('Boot fährt zum Ziel und bleibt in Reichweite', () => {
    let b = { x: home.x, y: home.y, heading: 0 };
    for (let i = 0; i < 100; i++) b = stepBoat(b, { x: home.x + 100, y: home.y }, mp.boatSpeed, 1 / 30);
    expect(distance(b, { x: home.x + 100, y: home.y })).toBeLessThan(5);
    const c = clampToRange({ x: home.x + 1000, y: home.y }, home, 300, mp.worldSize);
    expect(c.limited).toBe(true);
    expect(distance(c, home)).toBeCloseTo(300);
    expect(spotAt(home, spots, mp.spotRadius)?.id).toBe(home.id);
    expect(spotAt({ x: 0, y: 0 }, spots, mp.spotRadius)).toBeNull();
  });

  it('Lieblingsarten zählen mehrfach', () => {
    const boosted = spotSpecies(species, home, 3).find((s) => s.id === home.boost[0])!;
    expect(boosted.weight).toBe(species.find((s) => s.id === home.boost[0])!.weight * 3);
  });

  it('Treibgut: deterministisch, in Reichweite, einmal pro Wurf', () => {
    const a = flotsam('x', home, 300, mp);
    expect(a).toEqual(flotsam('x', home, 300, mp));
    for (const f of a) expect(distance(f, home)).toBeLessThanOrEqual(300.001);
    let s = takeFlotsam(newSave(1), a[0]!);
    expect(s.coins).toBe(a[0]!.coins);
    expect(flotsamTaken(s, a[0]!.id)).toBe(true);
    expect(takeFlotsam(s, a[0]!)).toBe(s);
    s = { ...s, stats: { ...s.stats, casts: 1 } };
    expect(flotsamTaken(s, a[0]!.id)).toBe(false);
  });
});
