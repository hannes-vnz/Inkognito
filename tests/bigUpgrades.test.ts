import { describe, expect, it } from 'vitest';
import bigJson from '../data/big_upgrades.json';
import texts from '../data/texts.de.json';
import { bigEffect, buyBig, type BigUpgradeDef } from '../src/systems/bigUpgrades';
import { migrate, newSave } from '../src/systems/save';

const defs = bigJson as BigUpgradeDef[];

describe('Großausbauten', () => {
  it('haben Texte, Preise und steigen im Preis', () => {
    for (const d of defs) {
      expect(texts).toHaveProperty([d.nameKey]);
      expect(texts).toHaveProperty([d.descKey]);
    }
    for (let i = 1; i < defs.length; i++) expect(defs[i]!.price).toBeGreaterThan(defs[i - 1]!.price);
  });

  it('wirken erst eingebaut und nur einmal kaufbar', () => {
    const rich = { ...newSave(1), coins: 99_999 };
    expect(bigEffect(rich, defs)).toEqual({ crateMul: 1, priceBonus: 0, sonar: false, catchRadius: 1 });
    let s = rich;
    for (const d of defs) s = buyBig(s, d)!;
    const e = bigEffect(s, defs);
    expect(e.crateMul).toBe(2);
    expect(e.priceBonus).toBeCloseTo(0.2);
    expect(e.sonar).toBe(true);
    expect(e.catchRadius).toBeCloseTo(1.4);
    expect(buyBig(s, defs[0]!)).toBeNull();
    expect(buyBig(newSave(1), defs[0]!)).toBeNull();
  });

  it('Spielstand v18: neue Upgrades auf Stufe 0, keine Ausbauten', () => {
    const old = { ...newSave(1), version: 17, upgrades: { line: 2, hook: 1, crate: 3, engine: 1 } } as Record<string, unknown>;
    delete old.big;
    const s = migrate(old, 1);
    expect(s.upgrades).toEqual({ line: 2, hook: 1, crate: 3, steer: 0, lure: 0, engine: 1 });
    expect(s.big).toEqual([]);
  });
});
