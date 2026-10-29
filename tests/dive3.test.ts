import { describe, expect, it } from 'vitest';
import { drainOxygen, oxygenRatio } from '../src/systems/oxygen';
import { currentAt } from '../src/systems/current';
import { createPredator, stepPredator, stunPredator, type PredatorDef } from '../src/systems/predator';
import { createDive, stepDive, type DiveConfig, type DiveEvent } from '../src/systems/dive';
import { createRng } from '../src/systems/rng';
import type { FishDef, FishTuning } from '../src/systems/fish';
import playerJson from '../data/player.json';
import gameJson from '../data/game.json';
import armsJson from '../data/arms.json';
import fishJson from '../data/fish.json';
import zonesJson from '../data/zones.json';
import predatorsJson from '../data/predators.json';

const zone = zonesJson[0]!;
const otter = predatorsJson[0] as PredatorDef;
const dt = 1 / 60;
const idle = { move: { x: 0, y: 0 }, fireAt: null };

function config(overrides: Partial<DiveConfig> = {}): DiveConfig {
  return {
    movement: playerJson.movement,
    bounds: { minX: 50, minY: 150, maxX: 3790, maxY: 4000 },
    fishBounds: { minX: 40, minY: 160, maxX: 3800, maxY: 3990 },
    spawn: zone.spawn,
    surfaceY: zone.world.surfaceY,
    surfaceMeters: 0,
    pixelsPerMeter: zone.pixelsPerMeter,
    fishDefs: fishJson as FishDef[],
    spawns: zone.fishSpawns as unknown as DiveConfig['spawns'],
    fishTuning: gameJson.fish as unknown as FishTuning,
    cannon: armsJson[0]!,
    carry: playerJson.carry,
    spriteScale: gameJson.spriteScale,
    respawnSeconds: 999,
    respawnMinDistance: gameJson.catching.respawnMinDistance,
    oxygen: playerJson.oxygen,
    exit: zone.exit,
    current: { ...zone.current, strength: 0 },
    predatorDefs: [otter],
    predatorSpawns: [],
    ...overrides,
  };
}

describe('Sauerstoff', () => {
  const p = playerJson.oxygen;
  it('sinkt mit der Zeit und tiefer schneller', () => {
    expect(drainOxygen(100, 0, p, 1)).toBeCloseTo(100 - p.drainPerSecond);
    expect(drainOxygen(100, 200, p, 1)).toBeLessThan(drainOxygen(100, 0, p, 1));
    expect(drainOxygen(0.1, 0, p, 1)).toBe(0);
    expect(oxygenRatio(p.maxSeconds / 2, p)).toBeCloseTo(0.5);
  });
});

describe('Strömung', () => {
  it('benachbarte Bänder fließen gegenläufig und bleiben unter der Höchststärke', () => {
    const c = zone.current;
    const a = currentAt(c.bandMeters * 0.5, 0, c);
    const b = currentAt(c.bandMeters * 1.5, 0, c);
    expect(Math.sign(a)).toBe(-Math.sign(b));
    for (let m = 0; m < 200; m += 3) for (let t = 0; t < 30; t += 1.7) expect(Math.abs(currentAt(m, t, c))).toBeLessThanOrEqual(c.strength);
  });

  it('treibt den Oktopus ab', () => {
    const cfg = config({ current: zone.current });
    const s = createDive(cfg, 'cur');
    for (const f of s.fish) f.x = f.y = 3500;
    s.player = { ...s.player, y: cfg.surfaceY + zone.current.bandMeters * 0.5 * cfg.pixelsPerMeter };
    const x0 = s.player.x;
    for (let i = 0; i < 120; i++) stepDive(s, idle, cfg, dt);
    expect(Math.abs(s.player.x - x0)).toBeGreaterThan(20);
  });
});

describe('Seeotter', () => {
  it('jagt nur, wenn der Spieler Fische trägt, und zieht sich nach dem Diebstahl zurück', () => {
    const rng = createRng(1);
    const r = createPredator(1, otter, 1000, 500, 0, 2000, rng);
    const player = { x: 1200, y: 500 };
    stepPredator(r, otter, player, 0, { minX: 0, maxX: 4000 }, rng, dt);
    expect(r.mode).toBe('patrol');
    let caught = false;
    for (let i = 0; i < 600 && !caught; i++) caught = stepPredator(r, otter, player, 2, { minX: 0, maxX: 4000 }, rng, dt);
    expect(caught).toBe(true);
    expect(r.mode).toBe('retreat');
  });

  it('ist nach einem Blasentreffer kurz betäubt', () => {
    const r = createPredator(1, otter, 0, 0, 0, 100, createRng(2));
    stunPredator(r, otter);
    expect(r.mode).toBe('stunned');
    expect(r.timer).toBe(otter.stunSeconds);
  });

  it('klaut im Tauchgang den letzten Fisch', () => {
    const cfg = config({ predatorSpawns: [{ predator: 'sea_otter', count: 1, depthMeters: [0, 50] }] });
    const s = createDive(cfg, 'otter');
    s.carried.push({ uid: 999, fishId: 'garibaldi', x: s.player.x, y: s.player.y, px: 0, py: 0 });
    const r = s.predators[0]!;
    r.x = s.player.x + 150;
    r.y = s.player.y;
    const events: DiveEvent[] = [];
    for (let i = 0; i < 180; i++) events.push(...stepDive(s, idle, cfg, dt));
    expect(events.some((e) => e.type === 'stolen' && e.fishId === 'garibaldi')).toBe(true);
    expect(s.carried).toHaveLength(0);
  });
});

describe('Rückkehr und Ende', () => {
  it('endet erfolgreich am Ausgang mit den gefangenen Fischen', () => {
    const cfg = config();
    const s = createDive(cfg, 'exit');
    s.carried.push({ uid: 999, fishId: 'senorita', x: 0, y: 0, px: 0, py: 0 });
    // erst wegschwimmen (Ausgang scharf schalten), dann zurück
    s.player = { ...s.player, x: cfg.exit.x + cfg.exit.radius * 3, y: cfg.exit.y + 50 };
    stepDive(s, idle, cfg, dt);
    expect(s.exitArmed).toBe(true);
    s.player = { ...s.player, x: cfg.exit.x, y: cfg.exit.y };
    const events = stepDive(s, idle, cfg, dt);
    expect(events).toContainEqual({ type: 'ended', status: 'surfaced', fish: ['senorita'] });
    expect(stepDive(s, idle, cfg, dt)).toEqual([]);
  });

  it('endet nicht sofort am Einstieg', () => {
    const cfg = config({ exit: { x: zone.spawn.x, y: zone.spawn.y, radius: 110 } });
    const s = createDive(cfg, 'start');
    const events: DiveEvent[] = [];
    for (let i = 0; i < 60; i++) events.push(...stepDive(s, idle, cfg, dt));
    expect(events.some((e) => e.type === 'ended')).toBe(false);
  });

  it('ohne Luft gehen die Fische verloren', () => {
    const cfg = config({ oxygen: { ...playerJson.oxygen, maxSeconds: 1 } });
    const s = createDive(cfg, 'air');
    s.carried.push({ uid: 999, fishId: 'senorita', x: 0, y: 0, px: 0, py: 0 });
    const events: DiveEvent[] = [];
    for (let i = 0; i < 120; i++) events.push(...stepDive(s, idle, cfg, dt));
    expect(events.some((e) => e.type === 'lowOxygen')).toBe(true);
    expect(events).toContainEqual({ type: 'ended', status: 'outOfAir', fish: [] });
    expect(s.status).toBe('outOfAir');
  });
});
