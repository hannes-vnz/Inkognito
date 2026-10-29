import { describe, expect, it } from 'vitest';
import baitsJson from '../data/baits.json';
import fishJson from '../data/fish.json';
import texts from '../data/texts.de.json';
import { baitCallsLegend, baitCost, baitSpecies, buyBait, consumeBait, type BaitDef } from '../src/systems/bait';
import { legendOf, legendSpawn } from '../src/systems/legend';
import type { SpeciesDef } from '../src/systems/fishing';
import { newSave, type Save } from '../src/systems/save';

const baits = baitsJson as BaitDef[];
const species = fishJson as unknown as SpeciesDef[];
const rich = (): Save => ({ ...newSave(1), coins: 10_000 });

describe('Köder', () => {
  it('Texte vorhanden, Preis wächst mit den Upgrades', () => {
    for (const b of baits) for (const key of [b.nameKey, b.descKey]) expect(texts).toHaveProperty([key]);
    const b = baits[0]!;
    const later: Save = { ...rich(), upgrades: { line: 5, hook: 3, crew: 0, engine: 0 } };
    expect(baitCost(b, later)).toBeGreaterThan(baitCost(b, rich()));
  });

  it('nur einer gleichzeitig, nur mit genug Münzen, wird beim Wurf verbraucht', () => {
    const b = baits[0]!;
    expect(buyBait(newSave(1), b)).toBeNull();
    const s = buyBait(rich(), b)!;
    expect(s.bait).toBe(b.id);
    expect(s.coins).toBe(10_000 - baitCost(b, rich()));
    expect(buyBait(s, baits[1]!)).toBeNull();
    expect(consumeBait(s).bait).toBeNull();
  });

  it('Leuchtköder und Krabbelköder machen passende Arten häufiger', () => {
    const glow = baits.find((b) => b.effect.type === 'glow')!;
    const crawl = baits.find((b) => b.effect.type === 'group')!;
    const lantern = species.find((s) => s.glow)!;
    const crab = species.find((s) => s.group === 'crustacean')!;
    const herring = species.find((s) => s.id === 'herring')!;
    expect(baitSpecies(species, glow).find((s) => s.id === lantern.id)!.weight).toBeGreaterThan(lantern.weight);
    expect(baitSpecies(species, crawl).find((s) => s.id === crab.id)!.weight).toBeGreaterThan(crab.weight);
    expect(baitSpecies(species, crawl).find((s) => s.id === herring.id)!.weight).toBe(herring.weight);
    expect(baitSpecies(species, null)).toEqual(species);
  });

  it('Legendenköder lockt die Legende sicher an, aber nur unter ihren Bedingungen', () => {
    const lb = baits.find((b) => b.effect.type === 'legend')!;
    expect(baitCallsLegend(lb)).toBe(true);
    const l = legendOf(species, 'atlantic')!;
    for (let i = 0; i < 20; i++) {
      expect(legendSpawn(`b${i}`, l, l.legend.spot, l.legend.night, 1000, true)).not.toBeNull();
      expect(legendSpawn(`b${i}`, l, 'harbor', l.legend.night, 1000, true)).toBeNull();
    }
  });
});
