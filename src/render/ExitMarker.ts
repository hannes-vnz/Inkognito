import Phaser from 'phaser';

/** Ausgang zum Riff: pulsierender Ring in der Welt, Pfeil am Bildschirmrand, wenn er nicht zu sehen ist. */
export class ExitMarker {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly radius: number,
  ) {
    this.ring = scene.add.graphics().setDepth(7);
    this.arrow = scene.add.graphics().setScrollFactor(0).setDepth(55);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, dt: number, urgent: boolean): void {
    this.time += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    const g = this.ring;
    g.clear();
    g.lineStyle(4, 0xfff3b0, 0.5 + pulse * 0.4);
    g.strokeCircle(this.x, this.y, this.radius * (0.9 + pulse * 0.08));
    g.fillStyle(0xfff3b0, 0.12 + pulse * 0.08);
    g.fillCircle(this.x, this.y, this.radius * 0.9);
    // Pfeil nach oben in der Mitte: „hier geht's raus“.
    g.fillStyle(0xfff3b0, 0.9);
    g.fillTriangle(this.x - 18, this.y + 4, this.x + 18, this.y + 4, this.x, this.y - 24);
    g.fillRect(this.x - 6, this.y + 4, 12, 22);

    const a = this.arrow;
    a.clear();
    const sx = this.x - camera.scrollX;
    const sy = this.y - camera.scrollY;
    const w = camera.width;
    const h = camera.height;
    if (sx > -this.radius && sx < w + this.radius && sy > -this.radius && sy < h + this.radius) return;
    const cx = w / 2;
    const cy = h / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const margin = 34;
    // Schnittpunkt der Richtung mit dem Bildschirmrand.
    const tx = Math.cos(ang) !== 0 ? (Math.sign(Math.cos(ang)) * (cx - margin)) / Math.cos(ang) : Infinity;
    const ty = Math.sin(ang) !== 0 ? (Math.sign(Math.sin(ang)) * (cy - margin)) / Math.sin(ang) : Infinity;
    const t = Math.min(Math.abs(tx), Math.abs(ty));
    const px = cx + Math.cos(ang) * t;
    const py = cy + Math.sin(ang) * t;
    const size = urgent ? 18 + pulse * 6 : 16;
    a.fillStyle(urgent ? 0xffb35c : 0xfff3b0, 0.95);
    a.fillTriangle(
      px + Math.cos(ang) * size,
      py + Math.sin(ang) * size,
      px + Math.cos(ang + 2.5) * size,
      py + Math.sin(ang + 2.5) * size,
      px + Math.cos(ang - 2.5) * size,
      py + Math.sin(ang - 2.5) * size,
    );
  }
}
