import { describe, expect, it } from 'vitest';
import { deserialize, migrate, newSave, SAVE_VERSION, serialize, type Save } from '../src/systems/save';
import {
  addCatch,
  assignJob,
  canAssign,
  checkUpgrade,
  houseCapacity,
  jobRate,
  letIn,
  rollFish,
  sellFish,
  sellPrice,
  tick,
  upgrade,
  type BuildingDef,
  type ColonyDefs,
  type EconomyParams,
  type JobDef,
} from '../src/systems/colony';
import { completeQuests, startQuest, type QuestDef } from '../src/systems/quests';
import { dialogNode, npcUnlocked, validateDialog, type NpcDef } from '../src/systems/dialog';
import fishJson from '../data/fish.json';
import buildingsJson from '../data/buildings.json';
import jobsJson from '../data/jobs.json';
import questsJson from '../data/quests.json';
import npcsJson from '../data/npcs.json';
import reefJson from '../data/reef.json';
import texts from '../data/texts.de.json';

const defs: ColonyDefs = {
  buildings: buildingsJson as BuildingDef[],
  jobs: jobsJson as JobDef[],
  fish: new Map(fishJson.map((f) => [f.id, { id: f.id, sellValue: f.sellValue, stats: f.stats as never }])),
  economy: reefJson.economy as EconomyParams,
  waitingCapacity: reefJson.waitingCapacity,
};
const quests = questsJson as unknown as QuestDef[];
const npcs = npcsJson as unknown as NpcDef[];
const T0 = 1_800_000_000_000;
const MIN = 60_000;

const withFish = (ids: string[]): Save => addCatch(newSave(T0), ids, defs, T0).save;

describe('Spielstand v2', () => {
  it('neuer Stand: aktuelle Version, übersteht Speichern/Laden', () => {
    const s = newSave(T0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(deserialize(serialize(s), T0)).toEqual(s);
  });

  it('migriert v0 über v1 bis v2', () => {
    const s = migrate({ shells: 42, fish: ['garibaldi', 'senorita', 7] }, T0);
    expect(s.version).toBe(2);
    expect(s.shells).toBe(42);
    expect(s.fish.map((f) => f.fishId)).toEqual(['garibaldi', 'senorita']);
    expect(s.fish[0]!.stats).toEqual({ strength: 2, speed: 2, diligence: 2 });
  });

  it('migriert v1: Höhlenbewohner und Wartebecken ziehen ins Haus, Rest vor die Tür', () => {
    const v1 = {
      version: 1,
      createdAt: T0 - 1000,
      updatedAt: T0 - 500,
      shells: 25,
      diveCount: 3,
      nextUid: 7,
      holding: [{ uid: 4, fishId: 'senorita' }, { uid: 5, fishId: 'garibaldi' }, { uid: 6, fishId: 'garibaldi' }],
      residents: [{ uid: 1, fishId: 'garibaldi', buildingId: 'cave_algae', producedUntil: T0 }, { uid: 2, fishId: 'kelp_perch', buildingId: 'cave_kelp', producedUntil: T0 }],
      quests: { active: [], done: ['move_in_1'] },
    };
    const s = migrate(v1, T0);
    expect(s.fish.map((f) => f.uid)).toEqual([1, 2, 4, 5]);
    expect(s.waiting.map((f) => f.uid)).toEqual([6]);
    expect(s.quests.done).toEqual(['first_fish']);
    expect(s).toMatchObject({ shells: 25, diveCount: 3, nextUid: 7, updatedAt: T0 - 500 });
  });

  it('kaputte Daten ergeben einen neuen Stand, zu neue Versionen werfen', () => {
    expect(deserialize('{nicht json', T0)).toEqual(newSave(T0));
    expect(() => migrate({ version: SAVE_VERSION + 1 }, T0)).toThrow();
  });
});

describe('Haus und Fang', () => {
  it('Werte werden im Bereich der Art gewürfelt und sind reproduzierbar', () => {
    const s = newSave(T0);
    for (let uid = 1; uid < 50; uid++) {
      const f = rollFish(s, 'senorita', uid, defs);
      expect(f.stats.speed).toBeGreaterThanOrEqual(3);
      expect(f.stats.speed).toBeLessThanOrEqual(5);
    }
    expect(rollFish(s, 'garibaldi', 3, defs)).toEqual(rollFish(s, 'garibaldi', 3, defs));
    expect(rollFish(s, 'garibaldi', 3, defs, 'zombie').stats.strength).toBe(rollFish(s, 'garibaldi', 3, defs).stats.strength + 1);
  });

  it('erst ins Haus, dann vor die Tür, dann freilassen', () => {
    const cap = houseCapacity(newSave(T0), defs);
    const many = Array.from({ length: cap + defs.waitingCapacity + 2 }, () => 'kelp_perch');
    const r = addCatch(newSave(T0), many, defs, T0);
    expect(r).toMatchObject({ housed: cap, waiting: defs.waitingCapacity, released: 2 });
    expect(r.save.diveCount).toBe(1);
  });

  it('nach dem Ausbau dürfen Wartende rein', () => {
    let s = addCatch({ ...newSave(T0), shells: 100 }, Array(6).fill('garibaldi'), defs, T0).save;
    expect(s.waiting).toHaveLength(2);
    expect(checkUpgrade(s, 'house', defs)).toEqual({ ok: true, cost: 60 });
    s = letIn(upgrade(s, 'house', defs, T0), defs, T0);
    expect(s.fish).toHaveLength(6);
    expect(s.waiting).toHaveLength(0);
    expect(Math.floor(s.shells)).toBe(40);
  });

  it('Ausbau scheitert ohne Muscheln und auf Maximalstufe', () => {
    expect(checkUpgrade(newSave(T0), 'house', defs)).toEqual({ ok: false, reason: 'shells', missing: 60 });
    const max = { ...newSave(T0), buildings: { house: 4 } };
    expect(checkUpgrade(max, 'house', defs)).toEqual({ ok: false, reason: 'max' });
  });
});

describe('Jobs und Produktion', () => {
  it('Jobs haben begrenzte Plätze', () => {
    let s = withFish(['garibaldi', 'garibaldi', 'garibaldi']);
    s = assignJob(s, 1, 'seaweed_farm', defs, T0);
    s = assignJob(s, 2, 'seaweed_farm', defs, T0);
    expect(canAssign(s, 3, 'seaweed_farm', defs)).toBe('full');
    expect(canAssign(s, 3, 'nope', defs)).toBe('unknownJob');
    expect(canAssign(s, 99, null, defs)).toBe('notFound');
    s = assignJob(s, 1, null, defs, T0);
    expect(canAssign(s, 3, 'seaweed_farm', defs)).toBe('ok');
  });

  it('ein Fang zieht ein, übernimmt einen Job und erarbeitet Futter und Muscheln', () => {
    let s = withFish(['garibaldi', 'senorita']);
    s = assignJob(s, 1, 'seaweed_farm', defs, T0);
    s = assignJob(s, 2, 'shell_gathering', defs, T0);
    const farm = jobRate(s, 'seaweed_farm', defs).food;
    const gather = jobRate(s, 'shell_gathering', defs).shells;
    expect(farm).toBeGreaterThan(0);
    expect(gather).toBeGreaterThan(0);
    const r = tick(s, T0 + 10 * MIN, defs);
    const eat = 2 * defs.economy.foodPerFishPerMinute;
    expect(r.food).toBeCloseTo((farm - eat) * 10, 6);
    expect(r.shells).toBeCloseTo(gather * 10, 6);
    expect(r.save.lastTick).toBe(T0 + 10 * MIN);
    expect(tick(r.save, T0 + 10 * MIN, defs).shells).toBe(0);
  });

  it('ohne Futter wird nur halb so viel gearbeitet', () => {
    let s = { ...withFish(['senorita', 'senorita', 'senorita', 'senorita']), food: 0 };
    s = assignJob(s, 1, 'shell_gathering', defs, T0);
    const full = jobRate(s, 'shell_gathering', defs).shells * 10;
    const r = tick(s, T0 + 10 * MIN, defs);
    expect(r.shells).toBeCloseTo(full * defs.economy.hungryFactor, 6);
    expect(r.save.food).toBe(0);
  });

  it('meldet, wenn das Futter ausgeht, und deckelt Offline-Zeit', () => {
    const s = { ...withFish(['kelp_perch', 'kelp_perch']), food: 1 };
    expect(tick(s, T0 + 60 * MIN, defs).ranOut).toBe(true);
    const long = tick({ ...s, food: 1e6 }, T0 + 1000 * 3600e3, defs);
    expect(long.food).toBeCloseTo(-2 * defs.economy.foodPerFishPerMinute * 60 * defs.economy.maxOfflineHours, 3);
  });
});

describe('Bruno', () => {
  it('zahlt mehr für bessere Werte und Zombies', () => {
    const base = { uid: 1, fishId: 'garibaldi', variant: 'normal' as const, job: null };
    const weak = sellPrice({ ...base, stats: { strength: 1, speed: 1, diligence: 1 } }, defs);
    const strong = sellPrice({ ...base, stats: { strength: 4, speed: 4, diligence: 4 } }, defs);
    const zombie = sellPrice({ ...base, variant: 'zombie', stats: { strength: 4, speed: 4, diligence: 4 } }, defs);
    expect(strong).toBeGreaterThan(weak);
    expect(zombie).toBeGreaterThan(strong);
  });

  it('Verkauf entfernt den Fisch, zahlt aus und zählt mit', () => {
    const s = withFish(['garibaldi']);
    const r = sellFish(s, 1, defs, T0);
    expect(r.save.fish).toHaveLength(0);
    expect(r.save.shells).toBe(r.price);
    expect(r.save.counters.sold).toBe(1);
    expect(() => sellFish(r.save, 1, defs, T0)).toThrow();
  });
});

describe('Story', () => {
  it('Auftragskette: erster Fisch → erste Schicht → Verkauf → Anbau', () => {
    let s = startQuest(newSave(T0), 'first_fish', T0);
    s = addCatch(s, ['garibaldi', 'senorita'], defs, T0).save;
    let r = completeQuests(s, quests, T0);
    expect(r.completed.map((q) => q.id)).toEqual(['first_fish']);
    s = startQuest(r.save, 'first_job', T0);
    s = assignJob(s, 1, 'seaweed_farm', defs, T0);
    s = startQuest(completeQuests(s, quests, T0).save, 'first_sale', T0);
    s = sellFish(s, 2, defs, T0).save;
    r = completeQuests(s, quests, T0);
    expect(r.save.quests.done).toEqual(['first_fish', 'first_job', 'first_sale']);
    expect(r.save.food).toBeGreaterThan(newSave(T0).food);
  });

  it('Figuren werden nach der Story freigeschaltet', () => {
    const by = (id: string) => npcs.find((n) => n.id === id)!;
    const q = { active: [], done: [] as string[] };
    expect(npcUnlocked(by('kalle'), q)).toBe(true);
    expect(npcUnlocked(by('gisela'), q)).toBe(false);
    expect(npcUnlocked(by('gisela'), { active: [], done: ['first_fish'] })).toBe(true);
  });

  it('Kalle reagiert auf den Auftragsstand', () => {
    const d = npcs.find((n) => n.id === 'kalle')!.dialog;
    expect(dialogNode(d, 'start').id).toBe('start');
    expect(dialogNode(d, 'start', { active: ['first_fish'], done: [] }).id).toBe('first_fish_wait');
    expect(dialogNode(d, 'start', { active: [], done: ['first_fish', 'first_job', 'first_sale'] }).id).toBe('house_2_offer');
    expect(dialogNode(d, 'start', { active: [], done: ['first_fish', 'first_sale', 'house_2'] }).id).toBe('idle');
  });

  it('alle Dialoge sind gültig, alle Texte vorhanden, jede Figur und jeder Auftrag existiert', () => {
    for (const npc of npcs) {
      expect(validateDialog(npc.dialog), npc.id).toEqual([]);
      expect(texts).toHaveProperty([npc.nameKey]);
      for (const node of Object.values(npc.dialog)) {
        expect(texts).toHaveProperty([node.textKey]);
        for (const o of node.options ?? []) expect(texts).toHaveProperty([o.textKey]);
        if (node.action?.type === 'startQuest') expect(quests.map((q) => q.id)).toContain(node.action.quest);
      }
      if (npc.unlock.questDone) expect(quests.map((q) => q.id)).toContain(npc.unlock.questDone);
    }
    for (const q of quests) {
      expect(texts).toHaveProperty([q.nameKey]);
      expect(texts).toHaveProperty([q.doneTextKey]);
      expect(npcs.map((n) => n.id)).toContain(q.giver);
    }
    for (const b of buildingsJson) expect(texts).toHaveProperty([b.nameKey]);
    for (const j of jobsJson) expect(texts).toHaveProperty([j.nameKey]);
  });
});
