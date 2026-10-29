import { describe, expect, it } from 'vitest';
import gameJson from '../data/game.json';
import bottles from '../data/bottles.json';
import texts from '../data/texts.de.json';
import { claimDaily, dailyReward, dailyStreak, dayKey, type DailyParams } from '../src/systems/daily';
import { flotsam, takeFlotsam, type MapParams } from '../src/systems/seaMap';
import { newSave } from '../src/systems/save';

const p = gameJson.daily as DailyParams;
const mp = gameJson.map as MapParams;

describe('Tagesbonus', () => {
  it('Kalendertag in Ortszeit', () => {
    const t = Date.parse('2026-10-29T23:30:00Z');
    expect(dayKey(t, 0)).toBe('2026-10-29');
    expect(dayKey(t, -60)).toBe('2026-10-30');
  });

  it('einmal pro Tag, Serie wächst an Folgetagen und reißt bei Lücke', () => {
    let s = newSave(1);
    const a = claimDaily(s, '2026-10-29', 0, p)!;
    expect(a.streak).toBe(1);
    expect(a.coins).toBe(p.base[0]);
    s = a.save;
    expect(claimDaily(s, '2026-10-29', 0, p)).toBeNull();
    s = claimDaily(s, '2026-10-30', 0, p)!.save;
    expect(s.daily.streak).toBe(2);
    expect(dailyStreak(s, '2026-11-02')).toBe(1);
    expect(dailyStreak(s, '2026-10-31')).toBe(3);
    expect(dailyStreak(s, '2026-10-01')).toBeNull();
  });

  it('wächst mit der Crew und bleibt nach Tag 7 beim Höchstwert', () => {
    expect(dailyReward(1, 10, p)).toBe(p.base[0]! + 10 * p.crewMinutes[0]!);
    expect(dailyReward(30, 0, p)).toBe(p.base[p.base.length - 1]);
    expect(p.base).toHaveLength(p.crewMinutes.length);
  });
});

describe('Flaschenpost', () => {
  it('alle Briefe haben Text', () => {
    for (const key of bottles) expect(texts).toHaveProperty([key]);
  });

  it('kommt manchmal, höchstens eine pro Wurf, zählt gelesene Briefe', () => {
    let withBottle = 0;
    for (let i = 0; i < 40; i++) {
      const pieces = flotsam(`b${i}`, { x: 200, y: 1000 }, 500, mp);
      const b = pieces.filter((f) => f.bottle);
      expect(b.length).toBeLessThanOrEqual(1);
      if (b.length) {
        withBottle++;
        expect(b[0]!.coins).toBe(mp.bottleCoins);
        expect(takeFlotsam(newSave(1), b[0]!).map.bottlesRead).toBe(1);
      }
    }
    expect(withBottle).toBeGreaterThan(5);
    expect(withBottle).toBeLessThan(35);
  });
});
