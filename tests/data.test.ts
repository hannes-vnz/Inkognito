import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import player from '../data/player.json';
import fish from '../data/fish.json';
import seasJson from '../data/seas.json';

import upgrades from '../data/upgrades.json';
import texts from '../data/texts.de.json';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const sprite = (name: string) => join(root, 'assets', 'sprites', `${name}.png`);

/** Liest Breite und Höhe aus dem PNG-Header. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('Daten und Assets', () => {
  it('Oktopus-Spritesheet hat 32×32-Frames und alle Animationsreihen', () => {
    const sheet = pngSize(sprite(player.sprite));
    expect(player.frameWidth).toBe(32);
    const rows = sheet.height / player.frameHeight;
    for (const a of player.animations) {
      expect(a.row).toBeLessThan(rows);
      expect(a.frames).toBeGreaterThanOrEqual(4);
      expect(a.frames).toBeLessThanOrEqual(8);
    }
  });

  it('jede Art hat Name, Fakt, Kommentar, Quelle und ein Spritesheet in erlaubter Größe', () => {
    for (const f of fish) {
      for (const key of [f.nameKey, f.factKey, f.commentKey]) expect(texts, key).toHaveProperty([key]);
      expect(f.source).toMatch(/^https:\/\//);
      expect(f.factChecked, `${f.id}: Fakt nicht geprüft`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(texts).toHaveProperty([`group.${f.group}`]);
      expect(f.sprite).toBe(`fish_${f.id}`);
      expect(f.frame.width).toBeGreaterThanOrEqual(16);
      expect(f.frame.width).toBeLessThanOrEqual(64);
      expect(existsSync(sprite(f.sprite)), f.sprite).toBe(true);
      expect(pngSize(sprite(f.sprite)).width % f.frame.width).toBe(0);
    }
  });

  it('Fakten sind kurz genug für eine Karte', () => {
    for (const f of fish) expect((texts as Record<string, string>)[f.factKey]!.length, f.id).toBeLessThanOrEqual(170);
  });

  it('Meere: Texte da, Zonen schließen lückenlos an, jede Art lebt in einem Meer', () => {
    for (const sea of seasJson) {
      for (const key of [sea.nameKey, sea.descKey]) expect(texts).toHaveProperty([key]);
      const zones = sea.zones;
      expect(zones[0]!.depthMeters[0]).toBe(0);
      for (let i = 0; i < zones.length; i++) {
        expect(texts).toHaveProperty([zones[i]!.nameKey]);
        expect(texts).toHaveProperty([zones[i]!.enterKey]);
        if (i > 0) expect(zones[i]!.depthMeters[0]).toBe(zones[i - 1]!.depthMeters[1]);
      }
    }
    for (const f of fish) expect(seasJson.map((s) => s.id), f.id).toContain(f.sea);
  });

  it('Upgrades haben Texte, die Leine reicht bis in den Tiefseegraben', () => {
    for (const u of upgrades) {
      expect(texts).toHaveProperty([u.nameKey]);
      expect(texts).toHaveProperty([u.effectKey]);
    }
    const line = upgrades.find((u) => u.id === 'line')!;
    expect(line.values[line.values.length - 1]!).toBeGreaterThanOrEqual(seasJson[0]!.zones[seasJson[0]!.zones.length - 1]!.depthMeters[0]!);
  });

  it('kein Math.random in Spiellogik und Darstellung', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.ts$/.test(entry.name) && readFileSync(path, 'utf8').includes('Math.random')) offenders.push(path);
      }
    };
    walk(join(root, 'src'));
    expect(offenders).toEqual([]);
  });

  it('src/systems importiert kein Phaser', () => {
    const dir = join(root, 'src', 'systems');
    for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/from ['"]phaser['"]/);
  });
});
