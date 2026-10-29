import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from '../src/systems/rng';

describe('rng', () => {
  it('liefert bei gleichem Seed die gleiche Folge', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('unterscheidet verschiedene Seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
    expect(createRng('kelp').next()).not.toBe(createRng('reef').next());
  });

  it('akzeptiert Text-Seeds stabil', () => {
    expect(seedFromString('kelp-layout-1')).toBe(seedFromString('kelp-layout-1'));
    expect(createRng('abc').next()).toBe(createRng(seedFromString('abc')).next());
  });

  it('bleibt in den Grenzen', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const v = r.range(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
      const k = r.int(1, 3);
      expect([1, 2, 3]).toContain(k);
    }
  });

  it('trifft bei int alle Werte inklusive der Grenzen', () => {
    const r = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(0, 4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('pick wählt aus dem Array und wirft bei leerem Array', () => {
    const r = createRng(3);
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    expect(() => r.pick([])).toThrow();
  });

  it('kann über den Zustand exakt fortgesetzt werden', () => {
    const a = createRng(5);
    a.next();
    a.next();
    const b = createRng(a.state);
    expect(b.next()).toBe(a.next());
  });
});
