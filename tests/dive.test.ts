import { describe, expect, it } from 'vitest';
import { createDive, stepDive, type DiveConfig, type DiveEvent } from '../src/systems/dive';
import type { FishDef, FishTuning } from '../src/systems/fish';
import playerJson from '../data/player.json';
import gameJson from '../data/game.json';
import armsJson from '../data/arms.json';
import fishJson from '../data/fish.json';
import zonesJson from '../data/zones.json';
import predatorsJson from '../data/predators.json';
import type { PredatorDef } from '../src/systems/predator';

const zone = zonesJson[0]!;
const dt = 1 / 60;

function config(overrides: Partial<DiveConfig> = {}): DiveConfig {
  return {
    movement: playerJson.movement,
    bounds: { minX: 50, minY: 150, maxX: 3790, maxY: 4000 },
    fishBounds: { minX: 40, minY: 160, maxX: 3800, maxY: 3990 },
    spawn: zone.spawn,
    surfaceY: zone.world.surfaceY,
    surfaceMeters: 0,
    pixelsPerMeter: zone.pixelsPerMeter,
    fishDefs: fishJson as unknown as FishDef[],
    spawns: zone.fishSpawns as unknown as DiveConfig['spawns'],
    fishTuning: gameJson.fish as unknown as FishTuning,
    cannon: armsJson[0]!,
    carry: playerJson.carry,
    spriteScale: gameJson.spriteScale,
    respawnSeconds: gameJson.catching.respawnSeconds,
    respawnMinDistance: gameJson.catching.respawnMinDistance,
    oxygen: playerJson.oxygen,
    exit: zone.exit,
    current: { ...zone.current, strength: 0 },
    predatorDefs: predatorsJson as PredatorDef[],
    predatorSpawns: [],
    ...overrides,
  };
}

const idle = { move: { x: 0, y: 0 }, fireAt: null };

describe('Tauchgang', () => {
  it('setzt alle Fische laut Zone ein', () => {
    const s = createDive(config(), 'a');
    const expected = zone.fishSpawns.reduce((n, sp) => n + sp.groups * sp.perGroup, 0);
    expect(s.fish).toHaveLength(expected);
  });

  it('ist bei gleichem Seed und gleichen Eingaben identisch', () => {
    const run = () => {
      const cfg = config();
      const s = createDive(cfg, 'duell-42');
      const log: DiveEvent[] = [];
      for (let i = 0; i < 900; i++) {
        const fireAt = i % 50 === 0 ? { x: s.player.x + 200, y: s.player.y + 50 } : null;
        log.push(...stepDive(s, { move: { x: Math.sin(i / 40), y: 0.3 }, fireAt }, cfg, dt));
      }
      return { log, fish: s.fish.map((f) => [f.x, f.y]), player: s.player };
    };
    expect(run()).toEqual(run());
  });

  it('fängt einen Fisch vom Zielen bis zur Blase in unter 3 Sekunden', () => {
    const cfg = config();
    const s = createDive(cfg, 'b');
    // Einen neugierigen Fisch 250 px vor den Spieler setzen, die anderen weit weg.
    const target = s.fish.find((f) => f.behavior === 'curious')!;
    for (const f of s.fish) if (f !== target) f.x = f.y = 3500;
    target.x = s.player.x + 250;
    target.y = s.player.y + 20;

    let caughtAt = -1;
    for (let i = 0; i < 180 && caughtAt < 0; i++) {
      // Spieler tippt grob auf den Fisch (absichtlich etwas daneben, die Zielhilfe soll helfen).
      const fireAt = i === 0 ? { x: target.x, y: target.y - 30 } : null;
      for (const e of stepDive(s, { move: { x: 0, y: 0 }, fireAt }, cfg, dt)) if (e.type === 'caught') caughtAt = s.time;
    }
    expect(caughtAt).toBeGreaterThan(0);
    expect(caughtAt).toBeLessThan(3);
    expect(s.carried).toHaveLength(1);
  });

  it('respektiert den Cooldown der Blasenkanone', () => {
    const cfg = config();
    const s = createDive(cfg, 'c');
    let fired = 0;
    const steps = Math.round(1 / dt);
    for (let i = 0; i < steps; i++) {
      for (const e of stepDive(s, { move: { x: 0, y: 0 }, fireAt: { x: 0, y: 0 } }, cfg, dt)) if (e.type === 'fired') fired++;
    }
    expect(fired).toBe(Math.ceil(1000 / cfg.cannon.cooldownMs));
  });

  it('meldet Fehlschüsse', () => {
    const cfg = config();
    const s = createDive(cfg, 'd');
    for (const f of s.fish) f.x = f.y = 3500;
    const events: DiveEvent[] = [];
    events.push(...stepDive(s, { move: { x: 0, y: 0 }, fireAt: { x: s.player.x - 100, y: s.player.y } }, cfg, dt));
    for (let i = 0; i < 120; i++) events.push(...stepDive(s, idle, cfg, dt));
    expect(events.some((e) => e.type === 'missed')).toBe(true);
  });

  it('fängt nicht mehr als die Kapazität und lässt Fische nachwachsen', () => {
    const cfg = config({ carry: { ...playerJson.carry, capacity: 1 }, respawnSeconds: 2 });
    const s = createDive(cfg, 'e');
    const total = s.fish.length;
    const [a, b] = s.fish;
    for (const f of s.fish) f.x = f.y = 3500;
    const events: DiveEvent[] = [];
    for (const f of [a!, b!]) {
      f.x = s.player.x + 150;
      f.y = s.player.y;
      events.push(...stepDive(s, { move: { x: 0, y: 0 }, fireAt: { x: f.x, y: f.y } }, cfg, dt));
      for (let i = 0; i < 60; i++) events.push(...stepDive(s, idle, cfg, dt));
    }
    expect(events.filter((e) => e.type === 'caught')).toHaveLength(1);
    expect(events.some((e) => e.type === 'full')).toBe(true);
    for (let i = 0; i < 180; i++) events.push(...stepDive(s, idle, cfg, dt));
    expect(events.some((e) => e.type === 'spawned')).toBe(true);
    expect(s.fish).toHaveLength(total);
  });
});
