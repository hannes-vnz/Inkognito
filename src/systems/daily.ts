import type { Save } from './save';

export interface DailyParams {
  /** Feste Münzen je Serientag (Tag 1 … 7, danach bleibt es beim letzten). */
  base: number[];
  /** Zusätzlich so viele Minuten Crew-Einnahmen, damit der Bonus mitwächst. */
  crewMinutes: number[];
}

/** Kalendertag in Ortszeit als JJJJ-MM-TT; `offsetMinutes` wie Date#getTimezoneOffset. */
export function dayKey(now: number, offsetMinutes: number): string {
  return new Date(now - offsetMinutes * 60000).toISOString().slice(0, 10);
}

const dayNumber = (key: string): number => Math.round(Date.parse(`${key}T00:00:00Z`) / 86400000);

/** Serientag, den der Bonus heute hätte, oder null, wenn heute schon abgeholt. */
export function dailyStreak(save: Save, today: string): number | null {
  const last = save.daily.lastDay;
  if (last === today) return null;
  if (!last) return 1;
  return dayNumber(today) - dayNumber(last) === 1 ? save.daily.streak + 1 : 1;
}

export function dailyReward(streak: number, crewPerMinute: number, p: DailyParams): number {
  const i = Math.min(streak, p.base.length) - 1;
  return Math.round(p.base[i]! + crewPerMinute * p.crewMinutes[i]!);
}

/** Bonus abholen; null, wenn heute schon geschehen. */
export function claimDaily(save: Save, today: string, crewPerMinute: number, p: DailyParams): { save: Save; coins: number; streak: number } | null {
  const streak = dailyStreak(save, today);
  if (streak === null) return null;
  const coins = dailyReward(streak, crewPerMinute, p);
  return { coins, streak, save: { ...save, coins: save.coins + coins, daily: { lastDay: today, streak } } };
}
