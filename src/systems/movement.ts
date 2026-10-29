/**
 * Fester Zeitschritt mit Akkumulator. Entkoppelt Spiellogik von der Bildrate
 * (60 Hz, 90 Hz, 120 Hz) und liefert `alpha` für die Interpolation beim Zeichnen.
 */
export class FixedStepper {
  private accumulator = 0;
  readonly step: number;

  constructor(
    hz: number,
    private readonly maxStepsPerFrame = 5,
  ) {
    this.step = 1 / hz;
  }

  /** Gibt zurück, wie viele Schritte jetzt ausgeführt werden sollen. */
  advance(frameSeconds: number): number {
    this.accumulator += Math.max(0, frameSeconds);
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxStepsPerFrame) {
      // Nach langem Hänger (Tab im Hintergrund) nicht hinterherrennen.
      steps = this.maxStepsPerFrame;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.step;
    }
    return steps;
  }

  /** Anteil des angefangenen Schritts in [0, 1). */
  get alpha(): number {
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
