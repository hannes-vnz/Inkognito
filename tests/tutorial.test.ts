import { describe, expect, it } from 'vitest';
import texts from '../data/texts.de.json';
import { advanceTutorial, mapAllowed } from '../src/systems/tutorial';
import { migrate, newSave } from '../src/systems/save';

describe('Tutorial im Heimathafen', () => {
  it('auswerfen → verkaufen → Upgrade → Karte → fertig, jeweils nur mit der passenden Handlung', () => {
    let s = newSave(1);
    expect(s.tutorial).toBe('cast');
    expect(mapAllowed(s)).toBe(false);
    expect(advanceTutorial(s, 'sold')).toBe(s);
    // Leerer Fang zählt nicht: es gibt nichts zu verkaufen
    expect(advanceTutorial(s, 'landed').tutorial).toBe('cast');
    s = advanceTutorial({ ...s, crate: { herring: { n: 1, premium: 0 } } }, 'landed');
    expect(s.tutorial).toBe('sell');
    s = advanceTutorial(s, 'sold');
    expect(s.tutorial).toBe('upgrade');
    s = advanceTutorial(s, 'upgraded');
    expect(s.tutorial).toBe('map');
    expect(mapAllowed(s)).toBe(true);
    s = advanceTutorial(s, 'mapOpened');
    expect(s.tutorial).toBe('done');
    expect(advanceTutorial(s, 'landed')).toBe(s);
  });

  it('jeder Schritt hat einen Hinweistext', () => {
    for (const step of ['cast', 'sell', 'upgrade', 'map']) expect(texts).toHaveProperty([`tut.${step}`]);
  });

  it('Spielstand v16: wer schon geangelt hat, ist durch', () => {
    const old = (casts: number) => {
      const s = { ...newSave(1), version: 15, stats: { casts, deepestMeters: 0 } } as Record<string, unknown>;
      delete s.tutorial;
      return s;
    };
    expect(migrate(old(0), 1).tutorial).toBe('cast');
    expect(migrate(old(5), 1).tutorial).toBe('done');
  });
});
