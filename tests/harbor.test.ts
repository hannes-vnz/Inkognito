import { describe, expect, it } from 'vitest';
import npcs from '../data/npcs.json';
import story from '../data/story.json';
import quiz from '../data/quiz.json';
import fish from '../data/fish.json';
import game from '../data/game.json';
import texts from '../data/texts.de.json';
import { dialogNode, dialogTextKeys, validateDialog, type NpcDef } from '../src/systems/dialog';
import { markSeen, nextBeat, npcMet, type StoryBeat } from '../src/systems/story';
import { fulfillRequest, newRequest } from '../src/systems/requests';
import { answerQuiz, pickQuiz, quizReady, type QuizParams, type QuizQuestion } from '../src/systems/quiz';
import { newSave, type Save } from '../src/systems/save';
import gagsJson from '../data/gags.json';

const T = 1_700_000_000_000;
const beats = story as StoryBeat[];
const questions = quiz as QuizQuestion[];
const qp = game.harbor as QuizParams;
const people = npcs as unknown as NpcDef[];

const withFish = (s: Save, ...ids: string[]): Save => ({
  ...s,
  fishbook: { ...s.fishbook, ...Object.fromEntries(ids.map((id) => [id, { count: 1, firstAt: T }])) },
});

describe('Hafen-Daten', () => {
  it('Dialoge sind gültig und alle Texte existieren', () => {
    for (const n of people) {
      expect(validateDialog(n.dialog), n.id).toEqual([]);
      for (const key of [n.nameKey, ...dialogTextKeys(n.dialog)]) expect(texts, key).toHaveProperty([key]);
      expect(n.sprite).toBe(`npc_${n.id}`);
      for (const [id, node] of Object.entries(n.dialog)) if (node.reaction) expect(texts).toHaveProperty([`reaction.${n.id}.${id}`]);
    }
  });

  it('Story-Momente zeigen auf existierende Figuren und Knoten', () => {
    const ids = beats.map((b) => b.id);
    for (const b of beats) {
      const npc = people.find((n) => n.id === b.npc);
      expect(npc?.dialog[b.node], b.id).toBeDefined();
      if (b.requires) expect(ids).toContain(b.requires);
      if (b.trigger.type === 'caught') expect(fish.map((f) => f.id)).toContain(b.trigger.value);
    }
    expect(ids).toContain(qp.quizRequires);
    expect(ids).toContain(game.harbor.requestRequires);
  });

  it('jede Quizfrage gehört zu einer Art und hat drei Antworten mit Text', () => {
    for (const q of questions) {
      expect(fish.map((f) => f.id)).toContain(q.species);
      expect(q.answerKeys).toHaveLength(3);
      for (const key of [q.questionKey, ...q.answerKeys]) expect(texts, key).toHaveProperty([key]);
    }
  });
});

describe('Dialog', () => {
  it('Aktions-Knoten haben keine Pflicht-Antwort, andere bekommen Tschüss', () => {
    const bruno = people.find((n) => n.id === 'bruno')!;
    expect(dialogNode(bruno.dialog, 'request').options).toEqual([]);
    expect(dialogNode({ start: { textKey: 'x' } }, 'start').options[0]!.next).toBeNull();
  });

  it('Weiterleitung nach gesehenen Story-Momenten', () => {
    const d = { start: { textKey: 'a', redirect: [{ seen: 'x', to: 'b' }] }, b: { textKey: 'b' } };
    expect(dialogNode(d, 'start', []).id).toBe('start');
    expect(dialogNode(d, 'start', ['x']).id).toBe('b');
  });
});

describe('Story', () => {
  it('Hilde begrüßt zuerst, danach kommt die nächste fällige Szene', () => {
    let s = newSave(T);
    expect(nextBeat(s, beats)?.id).toBe('hilde_intro');
    s = markSeen(s, 'hilde_intro');
    expect(nextBeat(s, beats)).toBeNull();
    s = { ...s, stats: { casts: 1, deepestMeters: 50 } };
    expect(nextBeat(s, beats)?.id).toBe('hilde_upgrades');
  });

  it('requires hält Szenen zurück', () => {
    let s = withFish(newSave(T), 'dumbo');
    for (const id of ['hilde_intro', 'hilde_upgrades']) s = markSeen(s, id);
    expect(nextBeat(s, beats)?.id).not.toBe('bruno_dumbo');
    s = markSeen(withFish(s, 'herring', 'mackerel'), 'bruno_intro');
    s = markSeen(s, 'qualle_intro');
    expect(nextBeat(s, beats)?.id).toBe('bruno_dumbo');
  });

  it('Figuren erscheinen erst nach ihrem ersten Auftritt', () => {
    const s = markSeen(newSave(T), 'hilde_intro');
    expect(npcMet(s, beats, 'hilde')).toBe(true);
    expect(npcMet(s, beats, 'bruno')).toBe(false);
  });

  it('markSeen doppelt ändert nichts', () => {
    const s = markSeen(newSave(T), 'a');
    expect(markSeen(s, 'a')).toBe(s);
  });
});

describe('Brunos Wunschfisch', () => {
  const species = fish as unknown as { id: string; value: number; depthMeters: [number, number] }[];
  const reward = game.harbor.requestReward;

  it('nur erreichbare Arten, deterministisch, Belohnung nach Wert', () => {
    for (let i = 0; i < 30; i++) {
      const r = newRequest(`s${i}`, species, 150, reward)!;
      const def = species.find((f) => f.id === r.speciesId)!;
      expect(def.depthMeters[0]).toBeLessThanOrEqual(150);
      expect(r.reward).toBe(Math.round(reward.base + reward.perValue * def.value));
    }
    expect(newRequest('x', species, 150, reward)).toEqual(newRequest('x', species, 150, reward));
  });

  it('wiederholt die letzte Art nicht, wenn es Alternativen gibt', () => {
    const two = species.slice(0, 2).map((s) => ({ ...s, depthMeters: [0, 10] as [number, number] }));
    for (let i = 0; i < 20; i++) expect(newRequest(`r${i}`, two, 100, reward, two[0]!.id)!.speciesId).toBe(two[1]!.id);
  });

  it('zahlt beim Landen der Art aus und schließt den Auftrag', () => {
    const s: Save = { ...newSave(T), request: { speciesId: 'tuna', reward: 99 } };
    expect(fulfillRequest(s, ['herring']).reward).toBe(0);
    const done = fulfillRequest(s, ['herring', 'tuna']);
    expect(done.reward).toBe(99);
    expect(done.save.coins).toBe(99);
    expect(done.save.request).toBeNull();
  });
});

describe('Quiz', () => {
  const ready = (s: Save) => quizReady(s, questions, qp);

  it('erst nach Qualles Vorstellung und mit genug bekannten Arten', () => {
    let s = withFish(newSave(T), 'herring', 'mackerel');
    expect(ready(s)).toBe(false);
    s = markSeen(s, qp.quizRequires);
    expect(ready(s)).toBe(true);
    expect(ready(markSeen(withFish(newSave(T), 'herring'), qp.quizRequires))).toBe(false);
  });

  it('fragt nur bekannte Arten, richtige Antwort bleibt nach dem Mischen richtig', () => {
    const s = withFish(newSave(T), 'herring', 'tuna');
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const r = pickQuiz(`q${i}`, s, questions)!;
      expect(['herring', 'tuna']).toContain(r.species);
      expect(r.answerKeys[r.correct]).toBe(`quiz.${r.species}.a0`);
      expect(new Set(r.answerKeys).size).toBe(3);
      positions.add(r.correct);
    }
    expect(positions.size).toBe(3);
  });

  it('Antwort zahlt aus und pausiert das Quiz für ein paar Würfe', () => {
    const s = markSeen(withFish({ ...newSave(T), stats: { casts: 4, deepestMeters: 0 } }, 'herring', 'tuna'), qp.quizRequires);
    const r = pickQuiz('x', s, questions)!;
    const right = answerQuiz(s, r, r.correct, 10, qp);
    expect(right.right).toBe(true);
    expect(right.reward).toBe(qp.quizReward.base + qp.quizReward.perValue * 10);
    expect(right.save.quiz).toEqual({ nextAtCast: 4 + qp.quizEveryCasts, correct: 1, asked: 1 });
    expect(ready(right.save)).toBe(false);
    const wrong = answerQuiz(s, r, (r.correct + 1) % 3, 10, qp);
    expect(wrong.reward).toBe(0);
    expect(wrong.save.coins).toBe(0);
  });
});

describe('Möwe Gisela', () => {
  it('alle Sprüche haben Texte', () => {
    for (const key of gagsJson) expect(texts).toHaveProperty([key]);
  });
});

describe('Porträts', () => {
  it('jede Figur und Bert haben alle Gesichtsausdrücke als Datei, Knoten nutzen nur bekannte Ausdrücke', async () => {
    const { existsSync } = await import('node:fs');
    for (const id of [...people.map((n) => n.id), 'bert'])
      for (const face of ['', '_happy', '_annoyed', '_shock']) expect(existsSync(`assets/sprites/portrait_${id}${face}.png`), `${id}${face}`).toBe(true);
    for (const n of people) for (const node of Object.values(n.dialog)) if (node.face) expect(['normal', 'happy', 'annoyed', 'shock']).toContain(node.face);
  });
});
