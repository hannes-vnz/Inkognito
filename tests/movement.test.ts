import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/systems/movement';

describe('FixedStepper', () => {
  it('führt bei 60 Hz pro 1/60 s genau einen Schritt aus', () => {
    const f = new FixedStepper(60);
    let total = 0;
    for (let i = 0; i < 60; i++) total += f.advance(1 / 60);
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
  });

  it('läuft bei 120 Hz Bildrate gleich schnell wie bei 60 Hz', () => {
    const a = new FixedStepper(60);
    const b = new FixedStepper(60);
    let sa = 0;
    let sb = 0;
    for (let i = 0; i < 60; i++) sa += a.advance(1 / 60);
    for (let i = 0; i < 120; i++) sb += b.advance(1 / 120);
    expect(Math.abs(sa - sb)).toBeLessThanOrEqual(1);
  });

  it('liefert alpha zwischen 0 und 1', () => {
    const f = new FixedStepper(60);
    f.advance(1 / 120);
    expect(f.alpha).toBeCloseTo(0.5, 5);
  });

  it('holt nach einem langen Hänger nicht alles nach', () => {
    const f = new FixedStepper(60, 5);
    expect(f.advance(3)).toBe(5);
    expect(f.alpha).toBe(0);
  });
});
