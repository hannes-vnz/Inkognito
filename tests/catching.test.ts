import { describe, expect, it } from 'vitest';
import { aimDirection, findHit, fireShot, shotRange, stepShot, type ProjectileParams } from '../src/systems/bubbles';
import { stepCarry, type Carried, type CarryParams } from '../src/systems/carry';
import { createFish, stepFish, type FishTuning } from '../src/systems/fish';
import { createRng } from '../src/systems/rng';
import gameJson from '../data/game.json';
import armsJson from '../data/arms.json';

const proj: ProjectileParams = armsJson[0]!.projectile;
const assist = armsJson[0]!.aimAssist;
const tuning = gameJson.fish as unknown as FishTuning;
const world = { minX: 0, maxX: 4000, minY: 0, maxY: 4000 };
const dt = 1 / 60;

describe('Blasenkanone', () => {
  it('zielt ohne Fisch im Kegel genau auf die Tippstelle', () => {
    const d = aimDirection({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 0, y: 300, vx: 0, vy: 0 }], proj.speed, assist);
    expect(d.x).toBeCloseTo(1);
    expect(d.y).toBeCloseTo(0);
  });

  it('Zielhilfe korrigiert leicht danebenliegende Schüsse', () => {
    const fish = { x: 300, y: 40, vx: 0, vy: 0 };
    const d = aimDirection({ x: 0, y: 0 }, { x: 300, y: 0 }, [fish], proj.speed, assist);
    expect(Math.atan2(d.y, d.x)).toBeCloseTo(Math.atan2(40, 300), 3);
  });

  it('Zielhilfe hält schnelle Fische vor', () => {
    const fish = { x: 300, y: 0, vx: 0, vy: 100 };
    const d = aimDirection({ x: 0, y: 0 }, { x: 300, y: 0 }, [fish], proj.speed, assist);
    expect(d.y).toBeGreaterThan(0);
  });

  it('greift nicht bei Fischen außerhalb von Kegel oder Reichweite', () => {
    const far = { x: assist.range + 100, y: 0, vx: 0, vy: 0 };
    const side = { x: 100, y: 100, vx: 0, vy: 0 };
    const d = aimDirection({ x: 0, y: 0 }, { x: 100, y: 5 }, [far, side], proj.speed, assist);
    expect(Math.atan2(d.y, d.x)).toBeCloseTo(Math.atan2(5, 100), 5);
  });

  it('Blase fliegt etwa die berechnete Reichweite und platzt dann', () => {
    const s = fireShot(1, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, proj);
    let alive = true;
    let steps = 0;
    while (alive && steps < 1000) {
      alive = stepShot(s, proj, dt);
      steps++;
    }
    expect(alive).toBe(false);
    expect(s.x).toBeGreaterThan(shotRange(proj) * 0.95);
    expect(s.x).toBeLessThan(shotRange(proj) * 1.05);
  });

  it('erkennt Treffer auch, wenn die Blase in einem Schritt durch den Fisch fliegt', () => {
    const s = { uid: 1, px: 0, py: 0, x: 100, y: 0, vx: 0, vy: 0, age: 0 };
    expect(findHit(s, [{ x: 50, y: 3, radius: 5 }], 2)).toBe(0);
    expect(findHit(s, [{ x: 50, y: 30, radius: 5 }], 2)).toBe(-1);
  });
});

describe('Fang-Kette', () => {
  const p: CarryParams = { capacity: 8, spacing: 50, followRate: 9, offset: { x: -40, y: -20 } };
  it('zieht die Blasen in gleichem Abstand hinter dem Oktopus her', () => {
    const list: Carried[] = [0, 1, 2].map((i) => ({ uid: i, fishId: 'x', x: 500 + i * 7, y: 500, px: 0, py: 0 }));
    for (let i = 0; i < 600; i++) stepCarry(list, { x: 0, y: 0, facing: 1 }, p, dt);
    expect(list[0]!.x).toBeCloseTo(-40, 0);
    expect(list[0]!.y).toBeCloseTo(-20, 0);
    for (let i = 1; i < list.length; i++) {
      const d = Math.hypot(list[i]!.x - list[i - 1]!.x, list[i]!.y - list[i - 1]!.y);
      expect(d).toBeCloseTo(50, 0);
    }
  });

  it('spiegelt den Anker mit der Blickrichtung', () => {
    const list: Carried[] = [{ uid: 1, fishId: 'x', x: 0, y: 0, px: 0, py: 0 }];
    for (let i = 0; i < 600; i++) stepCarry(list, { x: 0, y: 0, facing: -1 }, p, dt);
    expect(list[0]!.x).toBeCloseTo(40, 0);
  });
});

describe('Fisch-Verhalten', () => {
  const home = { x: 1000, y: 1000, minY: 0, maxY: 4000 };
  const make = (behavior: 'curious' | 'schooling' | 'skittish', x = 1000, y = 1000) =>
    createFish(1, { id: 'f', behavior, speed: 1 }, x, y, home, 1, createRng(1));

  it('scheue Fische fliehen weg vom Spieler', () => {
    const f = make('skittish');
    const rng = createRng(2);
    const player = { x: 900, y: 1000, vx: 0, vy: 0 };
    for (let i = 0; i < 30; i++) stepFish(f, player, [f], tuning, world, rng, dt);
    expect(f.mode).toBe('flee');
    expect(f.x).toBeGreaterThan(1000);
  });

  it('neugierige Fische kommen zu einem ruhigen Spieler und halten Abstand', () => {
    const f = make('curious', 1300, 1000);
    const rng = createRng(3);
    const player = { x: 1000, y: 1000, vx: 0, vy: 0 };
    for (let i = 0; i < 600; i++) stepFish(f, player, [f], tuning, world, rng, dt);
    const d = Math.hypot(f.x - player.x, f.y - player.y);
    expect(d).toBeLessThan(tuning.behaviors.curious.approachDistance + 40);
    expect(d).toBeGreaterThan(tuning.behaviors.curious.approachDistance - 40);
  });

  it('neugierige Fische fliehen vor einem schnellen Spieler', () => {
    const f = make('curious', 1100, 1000);
    const player = { x: 1000, y: 1000, vx: 300, vy: 0 };
    stepFish(f, player, [f], tuning, world, createRng(4), dt);
    expect(f.mode).toBe('flee');
  });

  it('bleiben in der Welt', () => {
    const f = make('skittish', 5, 5);
    const rng = createRng(5);
    for (let i = 0; i < 300; i++) stepFish(f, { x: 50, y: 50, vx: 0, vy: 0 }, [f], tuning, world, rng, dt);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeGreaterThanOrEqual(0);
  });

  it('Schwarmfische bleiben beieinander', () => {
    const rng = createRng(6);
    const school = Array.from({ length: 6 }, (_, i) =>
      createFish(i + 1, { id: 'p', behavior: 'schooling', speed: 1 }, 1000 + i * 30, 1000 + (i % 2) * 20, home, 99, rng),
    );
    const player = { x: 3000, y: 3000, vx: 0, vy: 0 };
    for (let i = 0; i < 1200; i++) for (const f of school) stepFish(f, player, school, tuning, world, rng, dt);
    const cx = school.reduce((a, f) => a + f.x, 0) / school.length;
    const cy = school.reduce((a, f) => a + f.y, 0) / school.length;
    for (const f of school) expect(Math.hypot(f.x - cx, f.y - cy)).toBeLessThan(250);
  });
});
