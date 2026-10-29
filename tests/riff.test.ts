import { describe, expect, it } from 'vitest';
import { deserialize, migrate, newSave, SAVE_VERSION, serialize, type Save } from '../src/systems/save';
import { addCatch, candidatesFor, checkMoveIn, moveIn, type BuildingDef } from '../src/systems/residents';
import { collectProduction, secondsUntilNext } from '../src/systems/economy';
import { completeQuests, startQuest, type QuestDef } from '../src/systems/quests';
import { dialogNode, validateDialog, type NpcDef } from '../src/systems/dialog';
import type { FishDef } from '../src/systems/fish';
import fishJson from '../data/fish.json';
import buildingsJson from '../data/buildings.json';
import questsJson from '../data/quests.json';
import npcsJson from '../data/npcs.json';
import texts from '../data/texts.de.json';

const fishDefs = new Map((fishJson as FishDef[]).map((f) => [f.id, f]));
const buildings = buildingsJson as BuildingDef[];
const quests = questsJson as QuestDef[];
const T0 = 1_800_000_000_000;
const caveFor = (fishId: string) => buildings.find((b) => b.provides === fishDefs.get(fishId)!.home.needs)!;

describe('Spielstand', () => {
  it('neuer Stand hat die aktuelle Version und übersteht Speichern/Laden', () => {
    const s = newSave(T0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(deserialize(serialize(s), T0)).toEqual(s);
  });

  it('migriert den unversionierten Stand', () => {
    const s = migrate({ shells: 42, fish: ['garibaldi', 'senorita', 7] }, T0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.shells).toBe(42);
    expect(s.holding.map((h) => h.fishId)).toEqual(['garibaldi', 'senorita']);
    expect(s.nextUid).toBe(3);
  });

  it('kaputte Daten ergeben einen neuen Stand, zu neue Versionen werfen', () => {
    expect(deserialize('{nicht json', T0)).toEqual(newSave(T0));
    expect(deserialize(null, T0)).toEqual(newSave(T0));
    expect(() => migrate({ version: SAVE_VERSION + 1 }, T0)).toThrow();
  });
});

describe('Bewohner', () => {
  const withCatch = (ids: string[]): Save => addCatch(newSave(T0), ids, 12, T0).save;

  it('Fang landet im Wartebecken, begrenzt auf die Kapazität', () => {
    const r = addCatch(newSave(T0), ['garibaldi', 'kelp_perch', 'senorita'], 2, T0);
    expect(r.added).toBe(2);
    expect(r.save.holding).toHaveLength(2);
    expect(r.save.diveCount).toBe(1);
  });

  it('jeder Fisch passt in genau eine Höhle', () => {
    for (const f of fishDefs.values()) expect(buildings.filter((b) => b.provides === f.home.needs)).toHaveLength(1);
  });

  it('Einzug nur in die passende Höhle und bis sie voll ist', () => {
    let s = withCatch(['garibaldi', 'garibaldi', 'garibaldi', 'garibaldi', 'senorita']);
    const algae = caveFor('garibaldi');
    expect(checkMoveIn(s, 5, algae, fishDefs)).toBe('wrongHome');
    expect(candidatesFor(s, algae, fishDefs)).toEqual([1, 2, 3, 4]);
    for (const uid of [1, 2, 3]) s = moveIn(s, uid, algae, fishDefs, T0);
    expect(checkMoveIn(s, 4, algae, fishDefs)).toBe('full');
    expect(checkMoveIn(s, 99, algae, fishDefs)).toBe('notHeld');
    expect(s.residents).toHaveLength(3);
    expect(s.holding.map((h) => h.uid)).toEqual([4, 5]);
    expect(() => moveIn(s, 4, algae, fishDefs, T0)).toThrow();
  });
});

describe('Muscheln', () => {
  const settled = (): Save => {
    const s = addCatch(newSave(T0), ['garibaldi'], 12, T0).save;
    return moveIn(s, 1, caveFor('garibaldi'), fishDefs, T0);
  };
  const g = fishJson.find((f) => f.id === 'garibaldi')!;

  it('ein eingezogener Fang produziert Muscheln', () => {
    const s = settled();
    expect(collectProduction(s, T0 + 1000, fishDefs, 8 * 3600e3).gained).toBe(0);
    const r = collectProduction(s, T0 + g.produces.everySeconds * 1000 * 3 + 500, fishDefs, 8 * 3600e3);
    expect(r.gained).toBe(3 * g.produces.shells);
    expect(r.save.shells).toBe(3 * g.produces.shells);
    // Rest der angefangenen Periode bleibt erhalten, nichts wird doppelt gezahlt.
    expect(collectProduction(r.save, T0 + g.produces.everySeconds * 1000 * 3 + 900, fishDefs, 8 * 3600e3).gained).toBe(0);
    expect(collectProduction(r.save, T0 + g.produces.everySeconds * 1000 * 4, fishDefs, 8 * 3600e3).gained).toBe(g.produces.shells);
  });

  it('Offline-Zeit ist gedeckelt', () => {
    const max = 3600e3;
    const r = collectProduction(settled(), T0 + 100 * max, fishDefs, max);
    expect(r.gained).toBe(Math.floor(max / (g.produces.everySeconds * 1000)) * g.produces.shells);
  });

  it('zeigt die Zeit bis zur nächsten Muschel', () => {
    expect(secondsUntilNext(T0, 60, T0 + 15_000)).toBe(45);
  });
});

describe('Aufträge und Dialog', () => {
  it('erster Mieter: Auftrag starten, Einzug schließt ihn ab und zahlt aus', () => {
    let s = startQuest(newSave(T0), 'move_in_1', T0);
    expect(startQuest(s, 'move_in_1', T0)).toBe(s);
    expect(completeQuests(s, quests, T0).completed).toEqual([]);
    s = addCatch(s, ['senorita'], 12, T0).save;
    s = moveIn(s, 1, caveFor('senorita'), fishDefs, T0);
    const r = completeQuests(s, quests, T0);
    expect(r.completed.map((q) => q.id)).toEqual(['move_in_1']);
    expect(r.save.shells).toBe(quests[0]!.reward.shells);
    expect(r.save.quests).toEqual({ active: [], done: ['move_in_1'] });
  });

  it('alle NPC-Dialoge sind gültig und haben Texte', () => {
    for (const npc of npcsJson as unknown as NpcDef[]) {
      expect(validateDialog(npc.dialog)).toEqual([]);
      expect(texts).toHaveProperty([npc.nameKey]);
      for (const node of Object.values(npc.dialog)) {
        expect(texts).toHaveProperty([node.textKey]);
        for (const o of node.options ?? []) expect(texts).toHaveProperty([o.textKey]);
      }
    }
  });

  it('der Makler leitet nach erledigtem Auftrag um', () => {
    const d = (npcsJson[0] as unknown as NpcDef).dialog;
    expect(dialogNode(d, 'flat').id).toBe('flat');
    expect(dialogNode(d, 'flat', ['move_in_1']).id).toBe('flat_done');
    expect(dialogNode(d, 'flat').action).toEqual({ type: 'startQuest', quest: 'move_in_1' });
  });
});
