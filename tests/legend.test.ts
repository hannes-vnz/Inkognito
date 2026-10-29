import { describe, expect, it } from 'vitest';
import fishJson from '../data/fish.json';
import spotsJson from '../data/spots.json';
import seasJson from '../data/seas.json';
import gameJson from '../data/game.json';
import texts from '../data/texts.de.json';
import { castsUntilSwitch, hintReady, hintsGiven, hookHolds, isLegend, isNight, legendOf, legendSpawn, markSnapped, nightSpecies, takeHint, type HintParams, type TimeParams } from '../src/systems/legend';
import { createRound, releaseFish, stepRound, type FishingParams, type SpeciesDef } from '../src/systems/fishing';
import { markSeen } from '../src/systems/story';
import { newSave } from '../src/systems/save';
import type { DepthMap } from '../src/systems/depthMap';

const species = fishJson as unknown as SpeciesDef[];
const tp = gameJson.time as TimeParams;
const hp = gameJson.harbor as HintParams;

describe('Tag und Nacht', () => {
  it('wechselt nach festen Würfen', () => {
    const cycle = tp.dayCasts + tp.nightCasts;
    const nights = Array.from({ length: cycle }, (_, i) => isNight(i, tp)).filter(Boolean).length;
    expect(nights).toBe(tp.nightCasts);
    expect(isNight(0, tp)).toBe(false);
    expect(castsUntilSwitch(0, tp)).toBe(tp.dayCasts);
    expect(castsUntilSwitch(tp.dayCasts, tp)).toBe(tp.nightCasts);
  });

  it('nachts beißen leuchtende Arten öfter', () => {
    const glow = species.find((s) => s.glow)!;
    expect(nightSpecies(species, true, tp).find((s) => s.id === glow.id)!.weight).toBe(glow.weight * tp.nightGlowBoost);
    expect(nightSpecies(species, false, tp).find((s) => s.id === glow.id)!.weight).toBe(glow.weight);
  });
});

describe('Legenden', () => {
  it('jedes Meer hat genau eine Legende mit Platz im Meer, Texten und Hinweisen', () => {
    for (const sea of seasJson) {
      const l = legendOf(species, sea.id)!;
      expect(l, sea.id).not.toBeNull();
      expect(species.filter((s) => isLegend(s) && s.sea === sea.id)).toHaveLength(1);
      expect(l.weight).toBe(0);
      expect(spotsJson.find((s) => s.id === l.legend.spot)?.sea).toBe(sea.id);
      for (const key of [l.legend.nameKey, ...l.legend.hintKeys, l.factKey]) expect(texts).toHaveProperty([key]);
      expect(l.legend.hintKeys.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('erscheint nur am richtigen Platz, zur richtigen Zeit, mit genug Leine', () => {
    const l = legendOf(species, 'atlantic')!;
    const deep = l.depthMeters[1] + 100;
    let hits = 0;
    for (let i = 0; i < 50; i++) {
      const m = legendSpawn(`s${i}`, l, l.legend.spot, l.legend.night, deep);
      if (m !== null) {
        hits++;
        expect(m).toBeGreaterThanOrEqual(l.depthMeters[0]);
        expect(m).toBeLessThanOrEqual(l.depthMeters[1]);
      }
      expect(legendSpawn(`s${i}`, l, 'harbor', l.legend.night, deep)).toBeNull();
      expect(legendSpawn(`s${i}`, l, l.legend.spot, !l.legend.night, deep)).toBeNull();
      expect(legendSpawn(`s${i}`, l, l.legend.spot, l.legend.night, l.depthMeters[0] - 1)).toBeNull();
    }
    expect(hits).toBeGreaterThan(10);
    expect(hits).toBeLessThan(50);
    expect(hookHolds(l, l.legend.minHook)).toBe(true);
    expect(hookHolds(l, l.legend.minHook - 1)).toBe(false);
  });

  it('Knut verrät Hinweise der Reihe nach, mit Pause dazwischen', () => {
    let s = markSeen(newSave(1), hp.legendRequires);
    expect(hintReady(s, 'atlantic', 3, hp)).toBe(true);
    s = takeHint(s, 'atlantic', hp);
    expect(hintsGiven(s, 'atlantic')).toBe(1);
    expect(hintReady(s, 'atlantic', 3, hp)).toBe(false);
    s = { ...s, stats: { ...s.stats, casts: hp.legendHintEveryCasts } };
    expect(hintReady(s, 'atlantic', 3, hp)).toBe(true);
    expect(hintsGiven(s, 'northsea')).toBe(0);
    expect(markSnapped(markSnapped(s, 'atlantic'), 'atlantic').legend.snapped).toEqual(['atlantic']);
  });

  it('eine losgerissene Legende verschwindet vom Haken und beißt nicht wieder an', () => {
    const l = legendOf(species, 'atlantic')!;
    const map: DepthMap = { zones: seasJson[0]!.zones as unknown as DepthMap['zones'], unitsPerZone: 2600, surfaceY: 260 };
    const p = gameJson.fishing as unknown as FishingParams;
    const r = createRound('x', 390, 600, 3, [], map, p, 0, [{ species: l, meters: 300 }]);
    const f = r.fish.find((x) => x.speciesId === l.id)!;
    expect(f).toBeDefined();
    f.x = r.hookX;
    r.hookY = f.y - 5;
    const events = stepRound(r, null, new Map([[l.id, l]]), map, p, 1 / 60);
    expect(events.some((e) => e.type === 'bite')).toBe(true);
    releaseFish(r, f.uid);
    expect(r.caught).toHaveLength(0);
    expect(f.escaped).toBe(true);
    for (let i = 0; i < 30; i++) stepRound(r, null, new Map([[l.id, l]]), map, p, 1 / 60);
    expect(r.caught).toHaveLength(0);
  });
});
