import { describe, expect, it } from 'vitest';
import cutscenesJson from '../data/cutscenes.json';
import npcsJson from '../data/npcs.json';
import soundsJson from '../data/sounds.json';
import texts from '../data/texts.de.json';
import type { Shot } from '../src/ui/Cutscene';

const scenes = cutscenesJson as unknown as Record<string, Shot[]>;
const who = new Set([...npcsJson.map((n) => n.id), 'bert']);
const faces = ['normal', 'happy', 'annoyed', 'shock'];
const bgs = ['spotlight', 'marquee', 'speedlines', 'burst', 'split', 'crayon', 'waves', 'sparkle', 'night'];

describe('Zwischensequenzen', () => {
  it('jede Einstellung nutzt bekannte Hintergründe, Figuren, Ausdrücke, Texte und Sounds', () => {
    for (const [id, shots] of Object.entries(scenes)) {
      expect(shots.length, id).toBeGreaterThanOrEqual(1);
      for (const s of shots) {
        expect(bgs, id).toContain(s.bg);
        expect(s.ms).toBeGreaterThan(300);
        for (const f of [...(s.figures ?? []), ...(s.panels ?? [])]) {
          expect(who.has(f.who), `${id}: ${f.who}`).toBe(true);
          expect(faces).toContain(f.face ?? 'normal');
        }
        if (s.captionKey) expect(texts, s.captionKey).toHaveProperty([s.captionKey]);
        if (s.sfx) expect(soundsJson).toHaveProperty([s.sfx]);
      }
    }
  });

  it('Dialoge verweisen nur auf vorhandene Szenen', () => {
    for (const n of npcsJson) for (const node of Object.values(n.dialog) as { cutscene?: string }[]) if (node.cutscene) expect(scenes).toHaveProperty([node.cutscene]);
  });
});

describe('Acting-Animationen', () => {
  it('jede Animation hat einen Bildstreifen mit passender Bildanzahl, Szenen nutzen nur vorhandene', async () => {
    const { readFileSync } = await import('node:fs');
    const anims = (await import('../data/anims.json')).default as Record<string, { file: string; frames: number; fps: number }>;
    for (const [key, a] of Object.entries(anims)) {
      const buf = readFileSync(`assets/${a.file}`);
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(w, key).toBe(h * a.frames);
      expect(a.fps).toBeGreaterThan(0);
    }
    for (const shots of Object.values(scenes))
      for (const s of shots) for (const f of s.figures ?? []) if (f.anim) expect(anims).toHaveProperty([`${f.who}_${f.anim}`]);
  });
});

describe('Requisiten', () => {
  it('Requisiten in Szenen gibt es als Grafik', async () => {
    const { existsSync } = await import('node:fs');
    for (const shots of Object.values(scenes))
      for (const s of shots as (Shot & { prop?: string })[])
        if (s.prop) expect(existsSync(`assets/sprites/${s.prop}.png`), s.prop).toBe(true);
  });
});
