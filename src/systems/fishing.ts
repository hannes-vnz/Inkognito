import { createRng, type Rng } from './rng';
import { metersToY, yToMeters, type DepthMap } from './depthMap';
import { approachFactor } from './camera';

/** Eintrag aus data/fish.json. */
export interface SpeciesDef {
  id: string;
  nameKey: string;
  factKey: string;
  commentKey: string;
  depthMeters: [number, number];
  value: number;
  /** Häufigkeit innerhalb ihres Tiefenbereichs. */
  weight: number;
  behavior: 'cruise' | 'dart' | 'drift';
  speed: number;
  glow: boolean;
  sprite: string;
  frame: { width: number; height: number };
  placeholderColor: string;
  source: string;
}

export interface FishingParams {
  fallSpeed: number;
  riseSpeed: number;
  steerSpeed: number;
  hookRadius: number;
  fishPerThousandUnits: number;
  spawnStartBelowSurface: number;
  spriteScale: number;
}

export type Phase = 'descent' | 'ascent' | 'surface';

export interface RoundFish {
  uid: number;
  speciesId: string;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  radius: number;
  caught: boolean;
  timer: number;
}

export interface RoundState {
  phase: Phase;
  rng: Rng;
  width: number;
  hookX: number;
  hookY: number;
  prevHookX: number;
  prevHookY: number;
  /** Tiefste erlaubte Position (Leinenende). */
  maxY: number;
  capacity: number;
  fish: RoundFish[];
  /** Gefangene Fische in Fangreihenfolge. */
  caught: RoundFish[];
  deepestY: number;
  time: number;
}

export type RoundEvent =
  | { type: 'bite'; uid: number }
  | { type: 'lineEnd' }
  | { type: 'catch'; uid: number }
  | { type: 'full' }
  | { type: 'landed'; species: string[]; deepestMeters: number };

export const BASE_SPEED = 110;

/** Art für eine Tiefe auswürfeln, gewichtet nach Häufigkeit. */
export function pickSpecies(meters: number, species: readonly SpeciesDef[], rng: Rng): SpeciesDef | null {
  const options = species.filter((s) => meters >= s.depthMeters[0] && meters <= s.depthMeters[1]);
  const total = options.reduce((n, s) => n + s.weight, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const s of options) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return options[options.length - 1]!;
}

/**
 * Neue Runde: Fische werden entlang der ganzen Wassersäule bis knapp unter das Leinenende verteilt.
 * Alles hängt am Seed, damit gleiche Würfe gleich aussehen (Duelle).
 */
export function createRound(
  seed: number | string,
  width: number,
  lineMeters: number,
  capacity: number,
  species: readonly SpeciesDef[],
  map: DepthMap,
  p: FishingParams,
): RoundState {
  const rng = createRng(seed);
  const maxY = metersToY(lineMeters, map);
  const fish: RoundFish[] = [];
  const start = map.surfaceY + p.spawnStartBelowSurface;
  const end = maxY + 400;
  const count = Math.round(((end - start) / 1000) * p.fishPerThousandUnits);
  for (let i = 0; i < count; i++) {
    const y = start + ((i + rng.range(0.1, 0.9)) / count) * (end - start);
    const s = pickSpecies(yToMeters(y, map), species, rng);
    if (!s) continue;
    const dir = rng.next() < 0.5 ? -1 : 1;
    fish.push({
      uid: i + 1,
      speciesId: s.id,
      x: rng.range(20, width - 20),
      y,
      px: 0,
      py: 0,
      vx: dir * BASE_SPEED * s.speed * rng.range(0.7, 1.3),
      radius: (Math.max(s.frame.width, s.frame.height) * p.spriteScale) / 2 * 0.75,
      caught: false,
      timer: rng.range(0.5, 2.5),
    });
  }
  for (const f of fish) {
    f.px = f.x;
    f.py = f.y;
  }
  const x = width / 2;
  return {
    phase: 'descent',
    rng,
    width,
    hookX: x,
    hookY: map.surfaceY,
    prevHookX: x,
    prevHookY: map.surfaceY,
    maxY,
    capacity,
    fish,
    caught: [],
    deepestY: map.surfaceY,
    time: 0,
  };
}

const touches = (s: RoundState, f: RoundFish, p: FishingParams): boolean =>
  !f.caught && Math.hypot(f.x - s.hookX, f.y - s.hookY) <= f.radius + p.hookRadius;

/**
 * Ein Schritt. `steerX`: Zielposition des Hakens (Daumen) oder null.
 * Abstieg: Berührung = Biss, sofort Aufstieg. Aufstieg: alles einsammeln bis der Haken voll ist.
 */
export function stepRound(
  s: RoundState,
  steerX: number | null,
  species: ReadonlyMap<string, SpeciesDef>,
  map: DepthMap,
  p: FishingParams,
  dt: number,
): RoundEvent[] {
  const events: RoundEvent[] = [];
  if (s.phase === 'surface') return events;
  s.time += dt;
  s.prevHookX = s.hookX;
  s.prevHookY = s.hookY;

  if (steerX !== null) {
    const target = Math.min(s.width - 16, Math.max(16, steerX));
    const want = (target - s.hookX) * approachFactor(14, dt);
    const max = p.steerSpeed * dt;
    s.hookX += Math.max(-max, Math.min(max, want));
  }

  for (const f of s.fish) {
    f.px = f.x;
    f.py = f.y;
    if (f.caught) continue;
    const def = species.get(f.speciesId);
    f.timer -= dt;
    if (def?.behavior === 'dart' && f.timer <= 0) {
      f.vx = -f.vx * s.rng.range(0.8, 1.4);
      f.timer = s.rng.range(0.6, 1.8);
    }
    f.x += f.vx * dt;
    if (f.x < 10 || f.x > s.width - 10) {
      f.x = Math.min(s.width - 10, Math.max(10, f.x));
      f.vx = -f.vx;
    }
  }

  if (s.phase === 'descent') {
    s.hookY = Math.min(s.maxY, s.hookY + p.fallSpeed * dt);
    s.deepestY = Math.max(s.deepestY, s.hookY);
    const bitten = s.fish.find((f) => touches(s, f, p));
    if (bitten) {
      bitten.caught = true;
      s.caught.push(bitten);
      s.phase = 'ascent';
      events.push({ type: 'bite', uid: bitten.uid });
    } else if (s.hookY >= s.maxY) {
      s.phase = 'ascent';
      events.push({ type: 'lineEnd' });
    }
  } else {
    const full = s.caught.length >= s.capacity;
    s.hookY = Math.max(map.surfaceY, s.hookY - p.riseSpeed * (full ? 1.6 : 1) * dt);
    if (!full) {
      for (const f of s.fish) {
        if (s.caught.length >= s.capacity || !touches(s, f, p)) continue;
        f.caught = true;
        s.caught.push(f);
        events.push({ type: 'catch', uid: f.uid });
        if (s.caught.length >= s.capacity) events.push({ type: 'full' });
      }
    }
    if (s.hookY <= map.surfaceY) {
      s.phase = 'surface';
      events.push({ type: 'landed', species: s.caught.map((f) => f.speciesId), deepestMeters: Math.round(yToMeters(s.deepestY, map)) });
    }
  }

  // Gefangene hängen am Haken und baumeln mit.
  s.caught.forEach((f, i) => {
    f.x = s.hookX + Math.sin(s.time * 6 + i) * (10 + i * 2);
    f.y = s.hookY + 26 + i * 18;
  });
  return events;
}
