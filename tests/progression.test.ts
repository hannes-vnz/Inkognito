import { describe, expect, it } from 'vitest';
import { yToMeters, type DepthMap } from '../src/systems/depthMap';
import { createRound, stepRound, type FishingParams, type SpeciesDef } from '../src/systems/fishing';
import { marketTick, priceFactor, sellFish, type MarketParams } from '../src/systems/market';
import { buyUpgrade, fishValue, isMaxed, landCatch, upgradeCost, upgradeValue, type EconomyParams, type UpgradeDef } from '../src/systems/economy';
import { canMoveOn, knownInSea, type SeaDef } from '../src/systems/prestige';
import { isNight, legendSpawn, type LegendDef, type TimeParams } from '../src/systems/legend';
import { newSave, type Save } from '../src/systems/save';
import { createRng } from '../src/systems/rng';
import { spotSpecies, spotUnlocked, type MapParams, type SpotDef } from '../src/systems/seaMap';
import fishJson from '../data/fish.json';
import seasJson from '../data/seas.json';
import spotsJson from '../data/spots.json';
import upgradesJson from '../data/upgrades.json';
import gameJson from '../data/game.json';

const species = fishJson as unknown as SpeciesDef[];
const byId = new Map(species.map((s) => [s.id, s]));
const seas = seasJson as unknown as (SeaDef & { zones: DepthMap['zones'] })[];
const upgrades = upgradesJson as UpgradeDef[];
const up = (id: string) => upgrades.find((u) => u.id === id)!;
const p = gameJson.fishing as FishingParams & EconomyParams & { unitsPerZone: number; surfaceY: number; flightSeconds: number };
const market = gameJson.market as MarketParams;
const time = gameJson.time as TimeParams;
const mapP = gameJson.map as MapParams;
const T = 1_800_000_000_000;

/** Sekunden außerhalb der eigentlichen Runde je Wurf: Finale, Fakt-Karten, Verkaufen, Kaufen, kurze Dialoge. */
const OVERHEAD_SECONDS = 14;
/** Wahrscheinlichkeit, eine erschienene Legende im Kampf auch zu landen (Spielerkönnen). */
const FIGHT_WIN = 0.5;

/**
 * Simulierter Spieler für ein Meer: fährt zum tiefsten erreichbaren Platz (für die Legende zu ihrem Platz, sobald der Haken hält),
 * weicht beim Absinken aus, sammelt beim Hochziehen, verkauft alles, kauft den Motor zuerst, sonst das günstigste Upgrade.
 */
function playSea(seaId: string) {
  const sea = seas.find((s) => s.id === seaId)!;
  const map: DepthMap = { zones: sea.zones, unitsPerZone: p.unitsPerZone, surfaceY: p.surfaceY };
  const own = species.filter((s) => s.sea === seaId);
  const spots = (spotsJson as SpotDef[]).filter((s) => s.sea === seaId);
  const home = spots.find((s) => s.harbor)!;
  const legend = own.find((s) => (s as { legend?: unknown }).legend) as LegendDef | undefined;
  const rng = createRng(`prog-${seaId}`);
  let save: Save = { ...newSave(T), sea: { current: seaId, left: [] } };
  let seconds = 0;
  let casts = 0;
  while (casts < 400 && !canMoveOn(save, seas, species)) {
    const range = upgradeValue(up('engine'), save.upgrades.engine);
    const hooks = upgradeValue(up('hook'), save.upgrades.hook);
    const night = isNight(save.stats.casts, time);
    const reachable = spots.filter((s) => spotUnlocked(s, home, range));
    const wantLegend = legend && !save.fishbook[legend.id] && hooks >= legend.legend.minHook && reachable.some((s) => s.id === legend.legend.spot);
    const spot = wantLegend ? reachable.find((s) => s.id === legend!.legend.spot)! : [...reachable].sort((a, b) => b.maxMeters - a.maxMeters)[0]!;
    const line = Math.min(upgradeValue(up('line'), save.upgrades.line), spot.maxMeters);
    const pool = spotSpecies(own.filter((s) => !(s as { legend?: unknown }).legend), spot, mapP.boostWeight);
    const params = { ...p, steerSpeed: p.steerSpeed * (upgradeValue(up('steer'), save.upgrades.steer) / 100), fishPerThousandUnits: p.fishPerThousandUnits * (upgradeValue(up('lure'), save.upgrades.lure) / 100) };
    const r = createRound(`p-${casts}`, 390, line, hooks, pool, map, params);
    for (let i = 0; i < 60 * 180 && r.phase !== 'surface'; i++) {
      const near = r.fish
        .filter((f) => !f.caught && (r.phase === 'descent' ? f.y > r.hookY && f.y < r.hookY + 220 : f.y < r.hookY && f.y > r.hookY - 260))
        .sort((a, b) => Math.abs(a.y - r.hookY) - Math.abs(b.y - r.hookY))[0];
      const steer = !near ? null : r.phase === 'descent' ? (near.x > 195 ? near.x - 160 : near.x + 160) : near.x;
      stepRound(r, steer, byId, map, params, 1 / 60);
    }
    const caught = r.caught.map((f) => ({ speciesId: f.speciesId, combo: false }));
    // Legende: erscheint am richtigen Platz zur richtigen Zeit, wird mit etwas Können gelandet
    if (wantLegend && legendSpawn(`p-${casts}`, legend!, spot.id, night, line) !== null && rng.next() < FIGHT_WIN) caught.push({ speciesId: legend!.id, combo: false });
    save = landCatch(save, caught, Math.round(yToMeters(r.deepestY, map)), byId, T, upgradeValue(up('crate'), save.upgrades.crate)).save;
    const tick = marketTick(save.stats.casts, market);
    const priced = save;
    save = sellFish(save, Object.keys(save.crate), (id) => fishValue(byId.get(id)!, (priced.fishbook[id]?.count ?? 0) >= 2, false, p, 0, priceFactor(String(priced.createdAt), id, tick, market)), p.comboMultiplier).save;
    for (;;) {
      const next = upgrades
        .filter((u) => !isMaxed(u, save.upgrades[u.id]) && upgradeCost(u, save.upgrades[u.id]) <= save.coins)
        .sort((a, b) => Number(b.id === 'engine') - Number(a.id === 'engine') || upgradeCost(a, save.upgrades[a.id]) - upgradeCost(b, save.upgrades[b.id]))[0];
      if (!next) break;
      save = buyUpgrade(save, next, T);
    }
    seconds += r.time + p.flightSeconds + OVERHEAD_SECONDS;
    casts++;
  }
  return { casts, minutes: seconds / 60, known: knownInSea(save, species, seaId), save };
}

describe('Fortschritt: etwa 30 Minuten pro Meer', () => {
  it('Nordsee (Meer 1) dauert 25 bis 35 Minuten bis zum nächsten Meer', () => {
    const r = playSea('northsea');
    process.stderr.write(`Nordsee: ${r.casts} Würfe, ${r.minutes.toFixed(1)} min, ${r.known} Arten, Upgrades ${JSON.stringify(r.save.upgrades)}\n`);
    expect(r.minutes).toBeGreaterThanOrEqual(25);
    expect(r.minutes).toBeLessThanOrEqual(35);
  });
});
