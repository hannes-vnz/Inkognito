export interface OxygenParams {
  maxSeconds: number;
  drainPerSecond: number;
  /** Zusätzlicher Verbrauch je 100 m Tiefe. */
  depthDrainPer100m: number;
  warnRatio: number;
  refillOnSurface: boolean;
}

/** Restluft nach `dt` Sekunden in `meters` Tiefe. */
export function drainOxygen(current: number, meters: number, p: OxygenParams, dt: number): number {
  const rate = p.drainPerSecond + (Math.max(0, meters) / 100) * p.depthDrainPer100m;
  return Math.max(0, current - rate * dt);
}

export const oxygenRatio = (current: number, p: OxygenParams): number => (p.maxSeconds > 0 ? current / p.maxSeconds : 0);
