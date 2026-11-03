import { describe, expect, it } from 'vitest';
import game from '../data/game.json';
import { addToCrate, castsUntilTick, crateCount, marketTick, priceFactor, priceTrend, sellFish, type MarketParams } from '../src/systems/market';
import { newSave, type Save } from '../src/systems/save';

const p = game.market as MarketParams;

describe('Markt', () => {
  it('Kurse wechseln alle paar Würfe, sind reproduzierbar und bleiben im Rahmen', () => {
    expect(marketTick(p.castsPerTick - 1, p)).toBe(0);
    expect(marketTick(p.castsPerTick, p)).toBe(1);
    expect(castsUntilTick(0, p)).toBe(p.castsPerTick);
    expect(castsUntilTick(p.castsPerTick - 1, p)).toBe(1);
    expect(priceFactor('7', 'herring', 3, p)).toBe(priceFactor('7', 'herring', 3, p));
    const fs = Array.from({ length: 40 }, (_, t) => priceFactor('7', 'herring', t, p));
    for (const f of fs) {
      expect(f).toBeGreaterThanOrEqual(0.4);
      expect(f).toBeLessThanOrEqual(2);
    }
    // Es gibt gute und schlechte Zeiten zum Verkaufen
    expect(Math.max(...fs) - Math.min(...fs)).toBeGreaterThan(0.4);
    expect([-1, 0, 1]).toContain(priceTrend('7', 'herring', 5, p));
  });

  it('Arten schwanken unabhängig voneinander', () => {
    const a = Array.from({ length: 12 }, (_, t) => priceFactor('7', 'herring', t, p));
    const b = Array.from({ length: 12 }, (_, t) => priceFactor('7', 'cod', t, p));
    expect(a).not.toEqual(b);
  });
});

describe('Fischkiste', () => {
  const full = (): Save => ({
    ...newSave(1),
    crate: addToCrate({}, [
      { speciesId: 'herring', combo: false },
      { speciesId: 'herring', combo: true },
      { speciesId: 'cod', combo: false },
    ]),
  });

  it('zählt Fische und angetippte', () => {
    expect(full().crate).toEqual({ herring: { n: 2, premium: 1 }, cod: { n: 1, premium: 0 } });
    expect(crateCount(full().crate)).toBe(3);
  });

  it('verkauft einzeln oder alles, angetippte doppelt', () => {
    const price = (id: string) => (id === 'herring' ? 10 : 30);
    const one = sellFish(full(), ['herring'], price, 2);
    expect(one.coins).toBe(10 + 20);
    expect(one.save.coins).toBe(30);
    expect(one.save.crate).toEqual({ cod: { n: 1, premium: 0 } });
    const all = sellFish(full(), ['herring', 'cod', 'leer'], price, 2);
    expect(all.coins).toBe(60);
    expect(crateCount(all.save.crate)).toBe(0);
    expect(all.lines.map((l) => l.speciesId)).toEqual(['herring', 'cod']);
  });

  it('Brunos Wunschfisch bringt beim Verkauf die Prämie', () => {
    const s = { ...full(), request: { speciesId: 'cod', reward: 50 } };
    expect(sellFish(s, ['herring'], () => 10, 2).request).toBeNull();
    const r = sellFish(s, ['cod'], () => 10, 2);
    expect(r.request).toEqual({ speciesId: 'cod', reward: 50 });
    expect(r.coins).toBe(60);
    expect(r.save.request).toBeNull();
  });
});
