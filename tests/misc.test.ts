import { describe, expect, it } from 'vitest';
import { approachFactor, targetLookAhead, type CameraParams } from '../src/systems/camera';
import { layoutTiles } from '../src/systems/parallax';
import { translate } from '../src/systems/texts';
import { depthRatio, metersAt } from '../src/systems/depth';
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

describe('parallax', () => {
  it('deckt den Bildschirm komplett ab', () => {
    for (const [sx, sy] of [[0, 0], [123, 4567], [-50, 10], [99999, 1]] as const) {
      const l = layoutTiles(sx, sy, 0.35, 0.3, 1920, 1080, 844, 390);
      expect(l.offsetX).toBeLessThanOrEqual(0);
      expect(l.offsetX).toBeGreaterThan(-1920);
      expect(l.offsetX + l.cols * 1920).toBeGreaterThanOrEqual(844);
      expect(l.offsetY + l.rows * 1080).toBeGreaterThanOrEqual(390);
    }
  });

  it('bewegt sich langsamer als die Kamera', () => {
    const a = layoutTiles(0, 0, 0.5, 0.5, 1920, 1080, 390, 844);
    const b = layoutTiles(100, 0, 0.5, 0.5, 1920, 1080, 390, 844);
    expect(a.offsetX - b.offsetX).toBeCloseTo(50);
  });
});

describe('texts', () => {
  const table = { 'hud.depth': '{depth} m', plain: 'Hallo' };
  it('ersetzt Platzhalter', () => expect(translate(table, 'hud.depth', { depth: 12 })).toBe('12 m'));
  it('lässt unbekannte Platzhalter stehen', () => expect(translate(table, 'hud.depth')).toBe('{depth} m'));
  it('markiert fehlende Schlüssel', () => expect(translate(table, 'nope')).toBe('[[nope]]'));
});

describe('depth', () => {
  const scale = { surfaceMeters: 0, pixelsPerMeter: 20, surfaceY: 100 };
  it('rechnet Pixel in Meter um', () => {
    expect(metersAt(100, scale)).toBe(0);
    expect(metersAt(300, scale)).toBe(10);
    expect(metersAt(0, scale)).toBe(0);
  });
  it('depthRatio klemmt auf 0..1', () => {
    expect(depthRatio(100, 0, 200)).toBe(0.5);
    expect(depthRatio(500, 0, 200)).toBe(1);
    expect(depthRatio(-5, 0, 200)).toBe(0);
  });
});

describe('vector', () => {
  it('clampLength behält kurze Vektoren', () => expect(clampLength({ x: 0.3, y: 0.4 }, 1)).toEqual({ x: 0.3, y: 0.4 }));
});
