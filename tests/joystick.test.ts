import { describe, expect, it } from 'vitest';
import { inRect, joystickZone, keysToVector, orientationOf, readStick, type JoystickParams } from '../src/systems/joystick';

const p: JoystickParams = { radius: 50, deadzone: 0.1, followFactor: 1 };
const o = { x: 100, y: 100 };

describe('readStick', () => {
  it('gibt in der Totzone nichts aus', () => {
    expect(readStick(o, { x: 103, y: 100 }, p).value).toEqual({ x: 0, y: 0 });
  });

  it('erreicht am Rand volle Stärke', () => {
    const r = readStick(o, { x: 150, y: 100 }, p);
    expect(r.value.x).toBeCloseTo(1);
    expect(r.value.y).toBeCloseTo(0);
  });

  it('beginnt direkt hinter der Totzone bei fast 0', () => {
    const r = readStick(o, { x: 106, y: 100 }, p);
    expect(r.value.x).toBeGreaterThan(0);
    expect(r.value.x).toBeLessThan(0.05);
  });

  it('zieht die Basis mit, wenn der Daumen weit wegzieht', () => {
    const r = readStick(o, { x: 250, y: 100 }, p);
    expect(r.origin.x).toBeCloseTo(200);
    expect(r.knob.x).toBeCloseTo(50);
    expect(r.value.x).toBeCloseTo(1);
  });

  it('lässt die Basis ohne followFactor stehen und begrenzt den Knauf', () => {
    const r = readStick(o, { x: 100, y: 300 }, { ...p, followFactor: 0 });
    expect(r.origin).toEqual(o);
    expect(r.knob.y).toBeCloseTo(50);
    expect(Math.hypot(r.value.x, r.value.y)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('keysToVector', () => {
  it('normiert Diagonalen', () => {
    const v = keysToVector(false, true, false, true);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('hebt gegensätzliche Tasten auf', () => {
    expect(keysToVector(true, true, false, false)).toEqual({ x: 0, y: 0 });
  });
});

describe('joystickZone', () => {
  it('hochkant: untere Hälfte', () => {
    expect(orientationOf(390, 844)).toBe('portrait');
    const z = joystickZone(390, 844);
    expect(inRect(z, 195, 800)).toBe(true);
    expect(inRect(z, 195, 200)).toBe(false);
  });

  it('quer: linke Hälfte', () => {
    expect(orientationOf(844, 390)).toBe('landscape');
    const z = joystickZone(844, 390);
    expect(inRect(z, 100, 300)).toBe(true);
    expect(inRect(z, 700, 300)).toBe(false);
  });
});
