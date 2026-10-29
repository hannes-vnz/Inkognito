import { describe, expect, it } from 'vitest';
import { createSwimmer, FixedStepper, stepSwimmer, type Bounds, type MovementParams, type SwimmerState } from '../src/systems/movement';
import playerJson from '../data/player.json';

const params: MovementParams = playerJson.movement;
const bounds: Bounds = { minX: 0, minY: 0, maxX: 10000, maxY: 10000 };
const dt = 1 / 60;

function run(steps: number, input = { x: 0, y: 0 }, start = createSwimmer(5000, 5000)) {
  let s = start;
  for (let i = 0; i < steps; i++) s = stepSwimmer(s, input, params, bounds, dt);
  return s;
}

describe('stepSwimmer', () => {
  it('beschleunigt mit Trägheit statt sofort auf Höchstgeschwindigkeit', () => {
    const one = run(1, { x: 1, y: 0 });
    expect(one.vx).toBeGreaterThan(0);
    expect(one.vx).toBeLessThan(params.maxSpeed * 0.2);
  });

  it('überschreitet die Höchstgeschwindigkeit nie, auch diagonal nicht', () => {
    const s = run(600, { x: 1, y: 1 });
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(params.maxSpeed + 1e-9);
  });

  it('erreicht die Höchstgeschwindigkeit in unter einer Sekunde', () => {
    const s = run(60, { x: 1, y: 0 });
    expect(s.vx).toBeGreaterThan(params.maxSpeed * 0.95);
  });

  it('gleitet nach dem Loslassen aus und kommt zur Ruhe', () => {
    const fast = run(120, { x: 1, y: 0 });
    const glide = run(10, { x: 0, y: 0 }, fast);
    expect(glide.vx).toBeGreaterThan(0);
    expect(glide.x).toBeGreaterThan(fast.x);
    const rest = run(300, { x: 0, y: 0 }, fast);
    expect(Math.abs(rest.vx)).toBeLessThan(1);
  });

  it('sinkt ohne Eingabe langsam ab', () => {
    const s = run(600);
    expect(s.vy).toBeGreaterThan(0);
    expect(s.vy).toBeLessThanOrEqual(params.sinkSpeed + 1e-9);
  });

  it('begrenzt Eingaben länger als 1', () => {
    const a = run(30, { x: 5, y: 0 });
    const b = run(30, { x: 1, y: 0 });
    expect(a.vx).toBeCloseTo(b.vx, 9);
  });

  it('hält an den Weltgrenzen an und verliert dort die Geschwindigkeit', () => {
    const small: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let s = createSwimmer(90, 50);
    for (let i = 0; i < 60; i++) s = stepSwimmer(s, { x: 1, y: 0 }, params, small, dt);
    expect(s.x).toBe(100);
    expect(s.vx).toBe(0);
  });

  it('dreht sich erst über der Schwelle um', () => {
    const start = createSwimmer(5000, 5000);
    expect(start.facing).toBe(1);
    const left = run(30, { x: -1, y: 0 }, start);
    expect(left.facing).toBe(-1);
    const slow = stepSwimmer({ ...left, vx: params.turnThreshold / 2 }, { x: 0, y: 0 }, params, bounds, dt);
    expect(slow.facing).toBe(-1);
  });

  it('ist deterministisch', () => {
    const inputs = Array.from({ length: 200 }, (_, i) => ({ x: Math.sin(i * 0.1), y: Math.cos(i * 0.07) }));
    const play = () => inputs.reduce<SwimmerState>((s, inp) => stepSwimmer(s, inp, params, bounds, dt), createSwimmer(10, 10));
    expect(play()).toEqual(play());
  });
});

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
