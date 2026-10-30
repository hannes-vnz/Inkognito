import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import finalArt from '../scripts/final-art.json';
import sheetsJson from '../data/sheets.json';

const size = (file: string) => {
  const buf = readFileSync(`assets/${file}`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};
const sheets = sheetsJson as unknown as Record<string, { file: string; frame: [number, number]; anims: Record<string, { from?: number; to?: number; fps: number }> }>;

describe('Spritesheets aus data/sheets.json', () => {
  it('Bild passt ins Raster, Animationen liegen in den vorhandenen Frames', () => {
    for (const [key, d] of Object.entries(sheets)) {
      const { w, h } = size(d.file);
      expect(w % d.frame[0], key).toBe(0);
      expect(h % d.frame[1], key).toBe(0);
      const total = (w / d.frame[0]) * (h / d.frame[1]);
      for (const [name, a] of Object.entries(d.anims)) {
        expect(a.fps, name).toBeGreaterThan(0);
        expect(a.to ?? total - 1, name).toBeLessThan(total);
        expect(a.from ?? 0, name).toBeLessThanOrEqual(a.to ?? total - 1);
      }
    }
  });
});

describe('Fertige Grafik', () => {
  it('jede eingetragene Datei existiert', () => {
    for (const f of finalArt as string[]) expect(() => size(f), f).not.toThrow();
  });
});
