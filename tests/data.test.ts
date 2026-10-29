import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import player from '../data/player.json';
import zones from '../data/zones.json';
import texts from '../data/texts.de.json';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Liest Breite und Höhe aus dem PNG-Header. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('Daten und Assets', () => {
  it('jede Zone hat einen Text und Hintergründe in 1920×1080', () => {
    for (const zone of zones) {
      expect(texts).toHaveProperty([zone.nameKey]);
      for (const layer of zone.background) {
        const file = join(root, 'assets', 'backgrounds', `${layer.key}.png`);
        expect(existsSync(file), file).toBe(true);
        expect(pngSize(file)).toEqual({ width: 1920, height: 1080 });
        expect(layer.key).toMatch(new RegExp(`^bg_${zone.id}_\\d+$`));
      }
    }
  });

  it('Oktopus-Spritesheet hat 32×32-Frames und alle Animationsreihen', () => {
    const sheet = pngSize(join(root, 'assets', 'sprites', `${player.sprite}.png`));
    const normal = pngSize(join(root, 'assets', 'sprites', `${player.normalMap}.png`));
    expect(normal).toEqual(sheet);
    expect(player.frameWidth).toBe(32);
    expect(player.frameHeight).toBe(32);
    const cols = sheet.width / player.frameWidth;
    const rows = sheet.height / player.frameHeight;
    for (const a of player.animations) {
      expect(a.row).toBeLessThan(rows);
      expect(a.frames).toBeLessThanOrEqual(cols);
      expect(a.frames).toBeGreaterThanOrEqual(4);
      expect(a.frames).toBeLessThanOrEqual(8);
    }
    expect(player.animations.map((a) => a.key)).toEqual(['idle', 'swim', 'turn', 'catch']);
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
    for (const f of readdirSync(dir)) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/from ['"]phaser['"]/);
    }
  });
});

import fish from '../data/fish.json';
import arms from '../data/arms.json';
import game from '../data/game.json';

describe('Fische und Arme', () => {
  it('jeder Fisch hat Texte und ein Spritesheet in erlaubter Größe', () => {
    for (const f of fish) {
      expect(texts).toHaveProperty([f.nameKey]);
      expect(texts).toHaveProperty([f.factKey]);
      expect(f.sprite).toBe(`fish_${f.id}`);
      expect(f.frame.width).toBeGreaterThanOrEqual(16);
      expect(f.frame.width).toBeLessThanOrEqual(24);
      const sheet = pngSize(join(root, 'assets', 'sprites', `${f.sprite}.png`));
      expect(sheet.width % f.frame.width).toBe(0);
      expect(sheet.height / f.frame.height).toBe(game.fish.animations.length);
      expect(Object.keys(game.fish.behaviors)).toContain(f.behavior);
    }
  });

  it('jede Zone setzt nur bekannte Fische ein', () => {
    for (const zone of zones) for (const sp of zone.fishSpawns) expect(fish.map((f) => f.id)).toContain(sp.fish);
  });

  it('Gerd-Sprüche passen in eine Zeile', () => {
    for (const [key, value] of Object.entries(texts)) if (key.startsWith('arm.gerd.')) expect(value.length, key).toBeLessThanOrEqual(36);
  });

  it('Blasenkanone ist definiert', () => {
    expect(arms.find((a) => a.id === 'bubble_cannon')?.cooldownMs).toBeGreaterThan(0);
  });
});
