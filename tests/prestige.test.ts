import { describe, expect, it } from 'vitest';
import seasJson from '../data/seas.json';
import fishJson from '../data/fish.json';
import spotsJson from '../data/spots.json';
import storyJson from '../data/story.json';
import gameJson from '../data/game.json';
import { canMoveOn, knownInSea, moveOn, nextSea, prestigeBonus, type PrestigeParams, type SeaDef } from '../src/systems/prestige';
import { nextBeat, markSeen, type StoryBeat } from '../src/systems/story';
import { newSave, type Save } from '../src/systems/save';
import { createRound, stepRound, type FishingParams, type SpeciesDef } from '../src/systems/fishing';
import type { DepthMap } from '../src/systems/depthMap';

const seas = seasJson as unknown as SeaDef[];
const species = fishJson as unknown as SpeciesDef[];
const pp = gameJson.prestige as PrestigeParams;
const T = 1_800_000_000_000;

const knowing = (n: number, sea = 'northsea', legend = true): Save => {
  const s = newSave(T);
  const ids = species.filter((f) => f.sea === sea && !(f as { legend?: unknown }).legend).slice(0, n).map((f) => f.id);
  if (legend) ids.push(...species.filter((f) => f.sea === sea && (f as { legend?: unknown }).legend).map((f) => f.id));
  return { ...s, fishbook: Object.fromEntries(ids.map((id) => [id, { count: 1, firstAt: T }])) };
};

describe('Prestige: neue Meere', () => {
  it('jedes Meer hat genug Arten zum Weiterziehen, einen Hafen und Plätze', () => {
    for (const sea of seas) {
      const here = species.filter((f) => f.sea === sea.id);
      if (sea.nextKnown !== null) expect(here.length).toBeGreaterThanOrEqual(sea.nextKnown);
      expect(spotsJson.filter((s) => s.sea === sea.id && s.harbor)).toHaveLength(1);
    }
    expect(seas[0]!.id).toBe('northsea');
    expect(nextSea(seas, 'northsea')?.id).toBe('pacific');
    expect(nextSea(seas, seas[seas.length - 1]!.id)).toBeNull();
  });

  it('Weiterziehen erst mit genug bekannten Arten und der Legende (Kartenstück) des aktuellen Meeres', () => {
    const need = seas[0]!.nextKnown!;
    expect(canMoveOn(knowing(need - 1, 'northsea', false), seas, species)).toBe(false);
    expect(canMoveOn(knowing(need, 'northsea', false), seas, species)).toBe(false);
    expect(canMoveOn(knowing(need), seas, species)).toBe(true);
    expect(knownInSea(knowing(need), species, 'pacific')).toBe(0);
  });

  it('setzt Münzen und Upgrades zurück, behält Wissen, gibt dauerhaften Bonus', () => {
    const before: Save = { ...knowing(15), coins: 999, upgrades: { line: 5, hook: 4, crate: 3, steer: 0, lure: 0, engine: 2 }, story: { seen: ['hilde_intro'] } };
    const after = moveOn(before, 'pacific', 'harbor', T + 1);
    expect(after.coins).toBe(0);
    expect(after.upgrades).toEqual({ line: 0, hook: 0, crate: 0, steer: 0, lure: 0, engine: 0 });
    expect(after.fishbook).toEqual(before.fishbook);
    expect(after.story).toEqual(before.story);
    expect(after.map.spot).toBe('harbor');
    expect(after.sea).toEqual({ current: 'pacific', left: ['northsea'] });
    expect(prestigeBonus(before, pp)).toBe(0);
    expect(prestigeBonus(after, pp)).toBe(pp.coinBonusPerSea);
  });

  it('Hilde begrüßt Bert in der Südsee', () => {
    const beats = storyJson as StoryBeat[];
    let s = moveOn(knowing(15), 'pacific', 'harbor', T);
    for (const b of beats) if (b.id !== 'hilde_pacific') s = markSeen(s, b.id);
    expect(nextBeat(s, beats)?.id).toBe('hilde_pacific');
  });

  it('Spielstand v15: Atlantik wird Südsee, wer noch im ersten Meer war, startet in der Nordsee', async () => {
    const { migrate } = await import('../src/systems/save');
    const v14 = (sea: { current: string; left: string[] }) => ({ ...newSave(T), version: 14, sea, map: { ...newSave(T).map, spot: 'open' }, legend: { hints: { atlantic: 2 }, hintAtCast: 0, snapped: ['atlantic'] } });
    const a = migrate(v14({ current: 'atlantic', left: [] }), T);
    expect(a.sea).toEqual({ current: 'northsea', left: [] });
    expect(a.map.spot).toBe('watt');
    expect(a.legend.hints).toEqual({ pacific: 2 });
    expect(a.legend.snapped).toEqual(['pacific']);
    const b = migrate(v14({ current: 'northsea', left: ['atlantic'] }), T);
    expect(b.sea).toEqual({ current: 'northsea', left: ['pacific'] });
    expect(b.map.spot).toBe('open');
  });
});

describe('Strömung', () => {
  const p = gameJson.fishing as unknown as FishingParams;
  const map: DepthMap = { zones: seasJson[1]!.zones as unknown as DepthMap['zones'], unitsPerZone: 2600, surfaceY: 260 };
  const ns = species.filter((f) => f.sea === 'northsea');

  it('treibt den Haken ohne Daumen zur Seite, ohne Strömung bleibt er stehen', () => {
    const still = createRound('c', 390, 50, 3, ns, map, p, 0);
    const drift = createRound('c', 390, 50, 3, ns, map, p, 140);
    for (const r of [still, drift]) r.fish.length = 0;
    for (let i = 0; i < 60; i++) {
      stepRound(still, null, new Map(), map, p, 1 / 60);
      stepRound(drift, null, new Map(), map, p, 1 / 60);
    }
    expect(still.hookX).toBe(195);
    expect(drift.hookX).not.toBe(195);
    expect(drift.hookX).toBeGreaterThanOrEqual(16);
  });
});
