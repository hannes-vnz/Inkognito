import { describe, expect, it } from 'vitest';
import { metersToY, yToMeters, zoneIndexAt, type DepthMap } from '../src/systems/depthMap';
import { createRound, pickSpecies, stepRound, type FishingParams, type RoundEvent, type SpeciesDef } from '../src/systems/fishing';
import { buyUpgrade, collectIdle, fishValue, isMaxed, landCatch, upgradeCost, upgradeValue, type EconomyParams, type UpgradeDef } from '../src/systems/economy';
import { deserialize, migrate, newSave, SAVE_VERSION, serialize, type Save } from '../src/systems/save';
import { createRng } from '../src/systems/rng';
import fishJson from '../data/fish.json';
import seasJson from '../data/seas.json';
const zonesJson = seasJson[0]!.zones;
import upgradesJson from '../data/upgrades.json';
import gameJson from '../data/game.json';
import spotsJson from '../data/spots.json';
import { reachableMeters, spotSpecies, unlockedSpots, type MapParams, type SpotDef } from '../src/systems/seaMap';

const species = fishJson as unknown as SpeciesDef[];
const byId = new Map(species.map((s) => [s.id, s]));
const p = gameJson.fishing as FishingParams & EconomyParams & { unitsPerZone: number; surfaceY: number };
const map: DepthMap = { zones: zonesJson as unknown as DepthMap['zones'], unitsPerZone: p.unitsPerZone, surfaceY: p.surfaceY };
const upgrades = upgradesJson as UpgradeDef[];
const up = (id: string) => upgrades.find((u) => u.id === id)!;
const dt = 1 / 60;
const spots = spotsJson as SpotDef[];
const home = spots.find((s) => s.harbor)!;
const T = 1_800_000_000_000;

describe('Tiefenskala', () => {
  it('Meter und Spielhöhe lassen sich hin und her rechnen', () => {
    for (const m of [0, 50, 200, 999, 2500, 5000, 8000]) expect(yToMeters(metersToY(m, map), map)).toBeCloseTo(m, 6);
  });
  it('jede Zone ist im Spiel gleich lang', () => {
    expect(metersToY(200, map) - metersToY(0, map)).toBeCloseTo(metersToY(1000, map) - metersToY(200, map));
  });
  it('findet die Zone zur Tiefe', () => {
    expect(zoneIndexAt(10, map)).toBe(0);
    expect(zoneIndexAt(500, map)).toBe(1);
    expect(zoneIndexAt(10000, map)).toBe(4);
  });
});

describe('Arten', () => {
  it('jede Zone hat Arten, jede Art lebt in einer Zone', () => {
    for (const z of map.zones) {
      const mid = (z.depthMeters[0] + z.depthMeters[1]) / 2;
      expect(species.some((s) => mid >= s.depthMeters[0] && mid <= s.depthMeters[1]), z.id).toBe(true);
    }
  });
  it('tiefer ist wertvoller: erwarteter Wert eines Fangs in der Mitte jeder Zone steigt', () => {
    const expected = map.zones.map((z) => {
      const m = (z.depthMeters[0] + z.depthMeters[1]) / 2;
      const here = species.filter((s) => m >= s.depthMeters[0] && m <= s.depthMeters[1]);
      const w = here.reduce((n, s) => n + s.weight, 0);
      return here.reduce((n, s) => n + s.value * s.weight, 0) / w;
    });
    for (let i = 1; i < expected.length; i++) expect(expected[i], map.zones[i]!.id).toBeGreaterThan(expected[i - 1]!);
  });
  it('würfelt nur Arten, die in der Tiefe leben', () => {
    const rng = createRng(1);
    const shallow = species.filter((s) => s.depthMeters[0] <= 10).map((s) => s.id);
    for (let i = 0; i < 200; i++) expect(shallow).toContain(pickSpecies(10, species, rng)!.id);
  });
});

describe('Angel-Runde', () => {
  const round = (seed: string, line = 100, hook = 3) => createRound(seed, 390, line, hook, species, map, p);
  const play = (s: ReturnType<typeof round>, steer: (s: ReturnType<typeof round>) => number | null) => {
    const events: RoundEvent[] = [];
    for (let i = 0; i < 60 * 60 && s.phase !== 'surface'; i++) events.push(...stepRound(s, steer(s), byId, map, p, dt));
    return events;
  };

  it('ist bei gleichem Seed identisch', () => {
    const a = play(round('x'), () => 200);
    const b = play(round('x'), () => 200);
    expect(a).toEqual(b);
  });

  it('Biss im Abstieg dreht sofort um', () => {
    const s = round('bite');
    const f = s.fish[0]!;
    const fishY = f.y;
    s.hookX = f.x;
    f.vx = 0;
    const x = f.x;
    const events = play(s, () => x);
    expect(events[0]).toEqual({ type: 'bite', uid: f.uid });
    expect(s.deepestY).toBeLessThan(fishY);
  });

  it('ohne Berührung geht es bis zum Leinenende, dann wird eingesammelt bis der Haken voll ist', () => {
    const s = round('end', 150, 2);
    s.fish = s.fish.slice(3, 6);
    for (const f of s.fish) {
      f.x = 195;
      f.vx = 0;
    }
    const events = play(s, (r) => (r.phase === 'descent' ? 40 : 195));
    expect(events.map((e) => e.type)).toEqual(['lineEnd', 'catch', 'catch', 'full', 'landed']);
    expect(s.caught).toHaveLength(2);
    expect(yToMeters(s.deepestY, map)).toBeCloseTo(150, 0);
  });

  it('der Haken bleibt im Bild', () => {
    const s = round('edge');
    play(s, () => 5000);
    expect(s.hookX).toBeLessThanOrEqual(390 - 16);
  });
});

describe('Wirtschaft', () => {
  it('Kosten steigen exponentiell, Werte wachsen', () => {
    for (const u of upgrades) {
      for (let l = 1; l < u.values.length - 1; l++) {
        expect(upgradeCost(u, l)).toBeGreaterThan(upgradeCost(u, l - 1));
        expect(upgradeValue(u, l)).toBeGreaterThan(upgradeValue(u, l - 1));
      }
    }
  });

  it('Upgrade kaufen kostet Münzen und scheitert ohne', () => {
    const s = { ...newSave(T), coins: 100 };
    const after = buyUpgrade(s, up('line'), T);
    expect(after.upgrades.line).toBe(1);
    expect(after.coins).toBe(100 - upgradeCost(up('line'), 0));
    expect(() => buyUpgrade(newSave(T), up('line'), T)).toThrow();
    expect(isMaxed(up('hook'), up('hook').values.length - 1)).toBe(true);
  });

  it('Wissen und Combo erhöhen den Wert', () => {
    const h = byId.get('sunfish')!;
    expect(fishValue(h, true, false, p)).toBeGreaterThan(fishValue(h, false, false, p));
    expect(fishValue(h, false, true, p)).toBe(h.value * p.comboMultiplier);
  });

  it('Fang verbuchen: Erstfänge für die Fakt-Karten, Rekord, Fischbuch', () => {
    const r = landCatch(newSave(T), [{ speciesId: 'herring', combo: false }, { speciesId: 'herring', combo: true }], 80, byId, p, T);
    expect(r.firstCatches).toEqual(['herring']);
    expect(r.save.fishbook.herring!.count).toBe(2);
    expect(r.save.stats).toEqual({ casts: 1, deepestMeters: 80 });
    expect(r.coins).toBe(fishValue(byId.get('herring')!, false, false, p) + fishValue(byId.get('herring')!, true, true, p));
  });

  it('Crew verdient offline, gedeckelt, ohne Münzen zu verlieren', () => {
    const s: Save = { ...newSave(T), upgrades: { line: 0, hook: 0, crew: 3, engine: 0 } };
    const rate = upgradeValue(up('crew'), 3);
    const r = collectIdle(s, T + 10 * 60000 + 30000, up('crew'), p);
    expect(r.coins).toBe(Math.floor(rate * 10.5));
    const again = collectIdle(r.save, T + 11 * 60000, up('crew'), p);
    expect(r.coins + again.coins).toBe(Math.floor(rate * 11));
    expect(collectIdle(s, T + 1000 * 3600e3, up('crew'), p).coins).toBe(Math.floor(rate * 60 * p.maxOfflineHours));
  });
});

describe('Balance: die ersten Minuten', () => {
  /**
   * Simulierter Spieler: weicht im Abstieg aus (lenkt weg vom nächsten Fisch darunter),
   * sammelt im Aufstieg (lenkt zum nächsten Fisch darüber), kauft immer das günstigste Upgrade.
   */
  function simulate(rounds: number) {
    let save = newSave(T);
    const log: { round: number; bought: string[] }[] = [];
    let waitedRounds = 0;
    let maxWait = 0;
    for (let r = 0; r < rounds; r++) {
      // Fährt immer zum tiefsten freigeschalteten Platz.
      const range = upgradeValue(up('engine'), save.upgrades.engine);
      const spot = unlockedSpots(spots, home, range).sort((a, b) => b.maxMeters - a.maxMeters)[0]!;
      const line = reachableMeters(upgradeValue(up('line'), save.upgrades.line), spots, home, range);
      const pool = spotSpecies(species, spot, (gameJson.map as MapParams).boostWeight);
      const s = createRound(`sim-${r}`, 390, line, upgradeValue(up('hook'), save.upgrades.hook), pool, map, p);
      for (let i = 0; i < 60 * 120 && s.phase !== 'surface'; i++) {
        const near = s.fish
          .filter((f) => !f.caught && (s.phase === 'descent' ? f.y > s.hookY && f.y < s.hookY + 220 : f.y < s.hookY && f.y > s.hookY - 260))
          .sort((a, b) => Math.abs(a.y - s.hookY) - Math.abs(b.y - s.hookY))[0];
        const steer = !near ? null : s.phase === 'descent' ? (near.x > 195 ? near.x - 160 : near.x + 160) : near.x;
        stepRound(s, steer, byId, map, p, dt);
      }
      save = landCatch(save, s.caught.map((f) => ({ speciesId: f.speciesId, combo: false })), Math.round(yToMeters(s.deepestY, map)), byId, p, T).save;
      const bought: string[] = [];
      for (;;) {
        const affordable = upgrades
          .filter((u) => !isMaxed(u, save.upgrades[u.id]) && upgradeCost(u, save.upgrades[u.id]) <= save.coins)
          .sort((a, b) => upgradeCost(a, save.upgrades[a.id]) - upgradeCost(b, save.upgrades[b.id]))[0];
        if (!affordable) break;
        save = buyUpgrade(save, affordable, T);
        bought.push(affordable.id);
      }
      waitedRounds = bought.length > 0 ? 0 : waitedRounds + 1;
      maxWait = Math.max(maxWait, waitedRounds);
      log.push({ round: r + 1, bought });
    }
    return { save, log, maxWait };
  }

  it('in den ersten 20 Würfen (etwa 10 Minuten) gibt es spätestens jeden 3. Wurf ein Upgrade', () => {
    const { save, maxWait } = simulate(20);
    expect(maxWait).toBeLessThanOrEqual(3);
    expect(save.upgrades.line).toBeGreaterThanOrEqual(3);
    expect(save.upgrades.engine).toBeGreaterThanOrEqual(1);
    expect(Object.keys(save.fishbook).length).toBeGreaterThanOrEqual(4);
  });
});

describe('Spielstand v3', () => {
  it('neuer Stand übersteht Speichern/Laden', () => {
    const s = newSave(T);
    expect(s.version).toBe(SAVE_VERSION);
    expect(deserialize(serialize(s), T)).toEqual(s);
  });
  it('migriert v0, v1 und v2 (Muscheln werden Münzen)', () => {
    expect(migrate({ shells: 42 }, T).coins).toBe(42);
    expect(migrate({ version: 1, shells: 7, createdAt: 5 }, T)).toMatchObject({ coins: 7, createdAt: 5 });
    expect(migrate({ version: 2, shells: 12.7, fish: [], buildings: {} }, T)).toMatchObject({ version: 7, coins: 12, upgrades: { line: 0, engine: 0 }, story: { seen: [] }, request: null, map: { spot: "harbor", bottlesRead: 0 }, daily: { streak: 0 }, sea: { current: "atlantic", left: [] } });
  });
  it('kaputte Daten ergeben einen neuen Stand, zu neue Versionen werfen', () => {
    expect(deserialize('{nicht json', T)).toEqual(newSave(T));
    expect(() => migrate({ version: SAVE_VERSION + 1 }, T)).toThrow();
  });
});
