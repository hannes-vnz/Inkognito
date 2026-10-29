import { createRng, type Rng } from './rng';
import { createSwimmer, stepSwimmer, type Bounds, type MovementParams, type SwimmerState } from './movement';
import { createFish, startle, stepFish, type FishDef, type FishState, type FishTuning } from './fish';
import { aimDirection, findHit, fireShot, stepShot, type CannonDef, type Shot } from './bubbles';
import { stepCarry, type Carried, type CarryParams } from './carry';
import type { Vec2 } from './vector';

export interface SpawnDef {
  fish: string;
  groups: number;
  perGroup: number;
  depthMeters: [number, number];
  /** Streuung der Gruppenmitglieder um die Gruppenmitte. */
  spread: number;
}

export interface DiveConfig {
  movement: MovementParams;
  /** Bewegungsgrenzen des Spielers. */
  bounds: Bounds;
  /** Bewegungsgrenzen der Fische. */
  fishBounds: Bounds;
  spawn: Vec2;
  surfaceY: number;
  surfaceMeters: number;
  pixelsPerMeter: number;
  fishDefs: readonly FishDef[];
  spawns: readonly SpawnDef[];
  fishTuning: FishTuning;
  cannon: CannonDef;
  carry: CarryParams;
  spriteScale: number;
  respawnSeconds: number;
  respawnMinDistance: number;
}

export interface DiveInput {
  move: Vec2;
  /** Weltposition, auf die geschossen werden soll (oder null). */
  fireAt: Vec2 | null;
}

export type DiveEvent =
  | { type: 'fired'; uid: number }
  | { type: 'caught'; uid: number; fishId: string; x: number; y: number }
  | { type: 'missed'; x: number; y: number }
  | { type: 'full'; x: number; y: number }
  | { type: 'spawned'; uid: number };

interface Respawn {
  spawnIndex: number;
  at: number;
}

export interface DiveState {
  time: number;
  rng: Rng;
  player: SwimmerState;
  prevPlayer: SwimmerState;
  fish: FishState[];
  shots: Shot[];
  carried: Carried[];
  /** Restzeit bis zum nächsten Schuss in Sekunden. */
  cooldown: number;
  nextUid: number;
  respawns: Respawn[];
  /** Für Auswertung und Tests: Zeitpunkt des letzten Schusses. */
  lastFireTime: number;
}

const yForMeters = (m: number, cfg: DiveConfig): number => cfg.surfaceY + (m - cfg.surfaceMeters) * cfg.pixelsPerMeter;

/** Trefferradius eines Fisches in Welt-Pixeln (etwas großzügig für Touch). */
export const fishRadius = (def: FishDef, spriteScale: number): number =>
  (Math.max(def.frame.width, def.frame.height) * spriteScale) / 2 * 0.85;

function defOf(cfg: DiveConfig, id: string): FishDef {
  const def = cfg.fishDefs.find((d) => d.id === id);
  if (!def) throw new Error(`Fisch "${id}" fehlt in data/fish.json`);
  return def;
}

function spawnGroup(s: DiveState, cfg: DiveConfig, spawnIndex: number, count: number, avoid: Vec2 | null): number[] {
  const sp = cfg.spawns[spawnIndex]!;
  const def = defOf(cfg, sp.fish);
  const minY = yForMeters(sp.depthMeters[0], cfg);
  const maxY = yForMeters(sp.depthMeters[1], cfg);
  const fb = cfg.fishBounds;

  let hx = 0;
  let hy = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    hx = s.rng.range(fb.minX + sp.spread, fb.maxX - sp.spread);
    hy = s.rng.range(minY, maxY);
    if (!avoid || Math.hypot(hx - avoid.x, hy - avoid.y) >= cfg.respawnMinDistance) break;
  }

  const schoolId = s.nextUid;
  const uids: number[] = [];
  for (let i = 0; i < count; i++) {
    const uid = s.nextUid++;
    const x = hx + s.rng.range(-sp.spread, sp.spread);
    const y = hy + s.rng.range(-sp.spread, sp.spread) * 0.5;
    s.fish.push(createFish(uid, def, x, y, { x: hx, y: hy, minY, maxY }, schoolId, s.rng));
    uids.push(uid);
  }
  return uids;
}

export function createDive(cfg: DiveConfig, seed: number | string): DiveState {
  const player = createSwimmer(cfg.spawn.x, cfg.spawn.y);
  const s: DiveState = {
    time: 0,
    rng: createRng(seed),
    player,
    prevPlayer: player,
    fish: [],
    shots: [],
    carried: [],
    cooldown: 0,
    nextUid: 1,
    respawns: [],
    lastFireTime: -1,
  };
  cfg.spawns.forEach((sp, i) => {
    for (let g = 0; g < sp.groups; g++) spawnGroup(s, cfg, i, sp.perGroup, null);
  });
  return s;
}

/**
 * Ein fester Schritt des Tauchgangs: Spieler, Fische, Blasen, Fang-Kette, Nachschub.
 * Deterministisch bei gleichem Seed und gleichen Eingaben (Grundlage für Fang-Duelle).
 */
export function stepDive(s: DiveState, input: DiveInput, cfg: DiveConfig, dt: number): DiveEvent[] {
  const events: DiveEvent[] = [];
  s.time += dt;
  s.prevPlayer = s.player;
  s.player = stepSwimmer(s.player, input.move, cfg.movement, cfg.bounds, dt);
  const pl = s.player;

  // Schießen
  s.cooldown = Math.max(0, s.cooldown - dt);
  if (input.fireAt && s.cooldown <= 0) {
    const proj = cfg.cannon.projectile;
    const dir = aimDirection(pl, input.fireAt, s.fish, proj.speed, cfg.cannon.aimAssist);
    const shot = fireShot(s.nextUid++, pl, dir, { x: pl.vx, y: pl.vy }, proj);
    s.shots.push(shot);
    s.cooldown = cfg.cannon.cooldownMs / 1000;
    s.lastFireTime = s.time;
    events.push({ type: 'fired', uid: shot.uid });
  }

  // Fische, Schwärme nach Gruppe
  const schools = new Map<number, FishState[]>();
  for (const f of s.fish) {
    const list = schools.get(f.schoolId);
    if (list) list.push(f);
    else schools.set(f.schoolId, [f]);
  }
  const fb = cfg.fishBounds;
  const world = { minX: fb.minX, maxX: fb.maxX, minY: fb.minY, maxY: fb.maxY };
  for (const f of s.fish) stepFish(f, pl, schools.get(f.schoolId) ?? [], cfg.fishTuning, world, s.rng, dt);

  // Blasen und Treffer
  const proj = cfg.cannon.projectile;
  const targets = s.fish.map((f) => ({ x: f.x, y: f.y, radius: fishRadius(defOf(cfg, f.fishId), cfg.spriteScale) }));
  s.shots = s.shots.filter((shot) => {
    const alive = stepShot(shot, proj, dt);
    const hit = findHit(shot, targets, proj.radius);
    if (hit >= 0) {
      const f = s.fish[hit]!;
      if (s.carried.length >= cfg.carry.capacity) {
        startle(f, shot, cfg.fishTuning);
        events.push({ type: 'full', x: f.x, y: f.y });
        return false;
      }
      s.fish.splice(hit, 1);
      targets.splice(hit, 1);
      s.carried.push({ uid: f.uid, fishId: f.fishId, x: f.x, y: f.y, px: f.x, py: f.y });
      s.respawns.push({ spawnIndex: cfg.spawns.findIndex((sp) => sp.fish === f.fishId), at: s.time + cfg.respawnSeconds });
      events.push({ type: 'caught', uid: f.uid, fishId: f.fishId, x: f.x, y: f.y });
      return false;
    }
    if (!alive) events.push({ type: 'missed', x: shot.x, y: shot.y });
    return alive;
  });

  stepCarry(s.carried, pl, cfg.carry, dt);

  // Nachschub: gefangene Fische tauchen später weit weg vom Spieler wieder auf.
  s.respawns = s.respawns.filter((r) => {
    if (r.at > s.time || r.spawnIndex < 0) return r.spawnIndex >= 0 && r.at > s.time;
    for (const uid of spawnGroup(s, cfg, r.spawnIndex, 1, pl)) events.push({ type: 'spawned', uid });
    return false;
  });

  return events;
}
