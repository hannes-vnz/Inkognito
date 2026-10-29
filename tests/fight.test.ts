import { describe, expect, it } from 'vitest';
import gameJson from '../data/game.json';
import { createFight, stepFight, type FightParams } from '../src/systems/fight';
import { createRng } from '../src/systems/rng';

const p = gameJson.fight as unknown as FightParams;
const run = (follow: boolean, seed: string) => {
  const rng = createRng(seed);
  const f = createFight(195, rng, p);
  for (let i = 0; i < 60 * 30 && f.result === 'running'; i++) stepFight(f, follow ? f.fishX : null, 390, rng, p, 1 / 60);
  return f;
};

describe('Legenden-Kampf', () => {
  it('wer dem Monster folgt, holt es ein', () => {
    for (let i = 0; i < 10; i++) expect(run(true, `f${i}`).result).toBe('won');
  });

  it('wer nichts tut, verliert es irgendwann', () => {
    for (let i = 0; i < 10; i++) expect(run(false, `f${i}`).result).toBe('snapped');
  });

  it('dauert ein paar Sekunden, nicht ewig', () => {
    const rng = createRng('t');
    const f = createFight(195, rng, p);
    let s = 0;
    while (f.result === 'running' && s < 60) {
      stepFight(f, f.fishX, 390, rng, p, 1 / 60);
      s += 1 / 60;
    }
    expect(s).toBeGreaterThan(3);
    expect(s).toBeLessThan(10);
  });
});
