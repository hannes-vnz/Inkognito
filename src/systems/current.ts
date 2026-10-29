export interface CurrentParams {
  /** Höchste Strömung in Welt-Pixeln pro Sekunde. */
  strength: number;
  /** Höhe eines Strömungsbands in Metern; benachbarte Bänder fließen gegenläufig. */
  bandMeters: number;
  /** Dauer, bis ein Band einmal hin und zurück gewechselt hat. */
  periodSeconds: number;
  /** Fische treibt es schwächer ab als den Oktopus. */
  fishFactor: number;
}

/**
 * Horizontale Strömung im Kelpwald: Bänder nach Tiefe, Stärke schwankt mit der Zeit.
 * Rein aus Tiefe und Zeit berechnet, damit beide Spieler im Duell dieselbe Strömung haben.
 */
export function currentAt(meters: number, time: number, p: CurrentParams): number {
  if (p.strength === 0 || p.bandMeters <= 0) return 0;
  const band = Math.sin((meters / p.bandMeters) * Math.PI);
  const pulse = 0.55 + 0.45 * Math.sin((time / p.periodSeconds) * Math.PI * 2 + meters * 0.05);
  return p.strength * band * pulse;
}
