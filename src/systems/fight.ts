import type { Rng } from './rng';

/** Kampf an der Leine mit einer Legende: dem Monster folgen holt es ein, sonst steigt die Spannung. */
export interface FightParams {
  /** Fortschritt pro Sekunde, solange der Haken dicht am Monster bleibt (1 = eingeholt). */
  reelPerSecond: number;
  /** So nah (Einheiten) muss der Haken waagerecht am Monster sein. */
  followRadius: number;
  tensionUp: number;
  tensionDown: number;
  fishSpeed: [number, number];
  turnSeconds: [number, number];
  steerSpeed: number;
}

export interface FightState {
  hookX: number;
  fishX: number;
  fishVx: number;
  turnIn: number;
  progress: number;
  tension: number;
  result: 'running' | 'won' | 'snapped';
}

export function createFight(x: number, rng: Rng, p: FightParams): FightState {
  return { hookX: x, fishX: x, fishVx: (rng.next() < 0.5 ? -1 : 1) * rng.range(p.fishSpeed[0], p.fishSpeed[1]), turnIn: rng.range(p.turnSeconds[0], p.turnSeconds[1]), progress: 0, tension: 0.2, result: 'running' };
}

export const following = (f: FightState, p: FightParams): boolean => Math.abs(f.hookX - f.fishX) <= p.followRadius;

/** Ein Schritt: Monster zieht hin und her, der Daumen (steerX) lenkt den Haken. */
export function stepFight(f: FightState, steerX: number | null, width: number, rng: Rng, p: FightParams, dt: number): FightState {
  if (f.result !== 'running') return f;
  f.turnIn -= dt;
  if (f.turnIn <= 0) {
    f.fishVx = (f.fishVx > 0 ? -1 : 1) * rng.range(p.fishSpeed[0], p.fishSpeed[1]);
    f.turnIn = rng.range(p.turnSeconds[0], p.turnSeconds[1]);
  }
  f.fishX += f.fishVx * dt;
  if (f.fishX < 30 || f.fishX > width - 30) {
    f.fishX = Math.min(width - 30, Math.max(30, f.fishX));
    f.fishVx = -f.fishVx;
  }
  if (steerX !== null) {
    const d = steerX - f.hookX;
    f.hookX += Math.sign(d) * Math.min(Math.abs(d), p.steerSpeed * dt);
  }
  if (following(f, p)) {
    f.progress = Math.min(1, f.progress + p.reelPerSecond * dt);
    f.tension = Math.max(0, f.tension - p.tensionDown * dt);
  } else {
    // Monster zieht Leine ab: Fortschritt schwindet, Spannung steigt
    f.progress = Math.max(0, f.progress - p.reelPerSecond * 0.5 * dt);
    f.tension = Math.min(1, f.tension + p.tensionUp * dt);
  }
  if (f.progress >= 1) f.result = 'won';
  else if (f.tension >= 1) f.result = 'snapped';
  return f;
}
