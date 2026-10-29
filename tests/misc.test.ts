import { describe, expect, it } from 'vitest';
import { approachFactor, targetLookAhead, type CameraParams } from '../src/systems/camera';
import { translate } from '../src/systems/texts';
import { clampLength } from '../src/systems/vector';

const cam: CameraParams = {
  followRate: 6,
  lookAhead: { portrait: { x: 0.2, y: 0.8 }, landscape: { x: 0.6, y: 0.3 } },
  maxLookAheadFraction: 0.25,
  lookAheadRate: 3,
};

describe('camera', () => {
  it('schaut hochkant stärker nach unten als quer', () => {
    const down = { x: 0, y: 200 };
    expect(targetLookAhead(down, 'portrait', 390, 844, cam).y).toBeGreaterThan(
      targetLookAhead(down, 'landscape', 844, 390, cam).y,
    );
  });

  it('begrenzt die Vorausschau auf einen Bildschirmanteil', () => {
    const la = targetLookAhead({ x: 5000, y: -5000 }, 'landscape', 800, 400, cam);
    expect(la.x).toBe(200);
    expect(la.y).toBe(-100);
  });

  it('approachFactor ist bildraten-unabhängig', () => {
    const one = approachFactor(5, 1 / 30);
    const twoHalf = 1 - (1 - approachFactor(5, 1 / 60)) ** 2;
    expect(one).toBeCloseTo(twoHalf, 10);
  });
});

describe('texts', () => {
  const table = { 'hud.depth': '{depth} m', plain: 'Hallo' };
  it('ersetzt Platzhalter', () => expect(translate(table, 'hud.depth', { depth: 12 })).toBe('12 m'));
  it('lässt unbekannte Platzhalter stehen', () => expect(translate(table, 'hud.depth')).toBe('{depth} m'));
  it('markiert fehlende Schlüssel', () => expect(translate(table, 'nope')).toBe('[[nope]]'));
});

describe('vector', () => {
  it('clampLength behält kurze Vektoren', () => expect(clampLength({ x: 0.3, y: 0.4 }, 1)).toEqual({ x: 0.3, y: 0.4 }));
});
