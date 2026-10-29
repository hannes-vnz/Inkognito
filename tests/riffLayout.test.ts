import { describe, expect, it } from 'vitest';
import { clampScroll, grottoAt, layoutGrottos, type GrottoDef, type GrottoParams } from '../src/systems/riffLayout';
import reef from '../data/reef.json';

const defs = reef.grottos as GrottoDef[];
const p = reef.grotto as GrottoParams;

describe('Riff-Layout', () => {
  it('hochkant: Etagen untereinander, passt in die Breite eines Handys', () => {
    const l = layoutGrottos(defs, 'portrait', 390, 844, p);
    expect(l.width).toBe(390);
    const ys = [...l.grottos.values()].map((r) => r.y);
    expect(new Set(ys).size).toBe(defs.length);
    for (const r of l.grottos.values()) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(l.width);
    }
  });

  it('quer: Panorama, breiter als hoch', () => {
    const l = layoutGrottos(defs, 'landscape', 844, 390, p);
    expect(l.width).toBeGreaterThan(l.height);
  });

  it('Grotten überlappen nicht und haben eindeutige Plätze', () => {
    for (const o of ['portrait', 'landscape'] as const) {
      const keys = defs.map((g) => g[o].join(','));
      expect(new Set(keys).size).toBe(defs.length);
      const l = layoutGrottos(defs, o, 390, 844, p);
      for (const [id, r] of l.grottos) expect(grottoAt(l, r.x + r.width / 2, r.y + r.height / 2)).toBe(id);
    }
  });

  it('Kamera bleibt in der Welt', () => {
    expect(clampScroll(-50, 400, 1000)).toBe(0);
    expect(clampScroll(900, 400, 1000)).toBe(600);
    expect(clampScroll(100, 1200, 1000)).toBe(0);
  });
});
