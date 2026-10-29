import type { Rng } from './rng';
import { approachFactor } from './camera';
import { clamp } from './vector';

export type FishBehavior = 'curious' | 'schooling' | 'skittish';
export type FishMode = 'wander' | 'approach' | 'flee' | 'rest';

/** Eintrag aus data/fish.json. */
export interface FishDef {
  id: string;
  nameKey: string;
  zone: string;
  rarity: string;
  behavior: FishBehavior;
  /** Faktor auf die Grundgeschwindigkeit. */
  speed: number;
  catchWith: string[];
  home: { needs: string; enemies: string[] };
  produces: { shells: number; everySeconds: number };
  sellValue: number;
  factKey: string;
  sprite: string;
  frame: { width: number; height: number };
  placeholderColor: string;
}

/** Verhaltens-Parameter je Typ aus data/game.json (`fish.behaviors`). */
export interface BehaviorParams {
  /** Neugierige Fische bemerken den Spieler ab hier. */
  senseRadius: number;
  /** Ab hier wird geflohen. */
  fleeRadius: number;
  /** Neugierige Fische fliehen nur, wenn der Spieler schneller ist. */
  startleSpeed: number;
  /** Abstand, in dem neugierige Fische vor dem Spieler schweben. */
  approachDistance: number;
  /** Fluchtgeschwindigkeit als Faktor. */
  fleeSpeed: number;
  fleeSeconds: number;
  /** Wie stark die Richtung beim Umherschwimmen zufällig dreht (rad/s). */
  wanderTurn: number;
  /** Ab diesem Abstand zur Heimat zieht es den Fisch zurück. */
  leashRadius: number;
  neighborRadius: number;
  cohesion: number;
  alignment: number;
  /** Mindestabstand im Schwarm. */
  separation: number;
  /** Ruhezeit nach einer Flucht (scheue Fische). */
  restSeconds: number;
}

export interface FishTuning {
  baseSpeed: number;
  acceleration: number;
  turnThreshold: number;
  behaviors: Record<FishBehavior, BehaviorParams>;
}

export interface FishState {
  uid: number;
  fishId: string;
  behavior: FishBehavior;
  speed: number;
  x: number;
  y: number;
  /** Position vor dem letzten Schritt, für die Interpolation beim Zeichnen. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  heading: number;
  mode: FishMode;
  modeTimer: number;
  homeX: number;
  homeY: number;
  /** Tiefenband, in dem der Fisch sich aufhält. */
  minY: number;
  maxY: number;
  schoolId: number;
  facing: 1 | -1;
}

export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface WorldX {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function createFish(
  uid: number,
  def: Pick<FishDef, 'id' | 'behavior' | 'speed'>,
  x: number,
  y: number,
  home: { x: number; y: number; minY: number; maxY: number },
  schoolId: number,
  rng: Rng,
): FishState {
  const heading = rng.next() < 0.5 ? 0 : Math.PI;
  return {
    uid,
    fishId: def.id,
    behavior: def.behavior,
    speed: def.speed,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    heading,
    mode: 'wander',
    modeTimer: 0,
    homeX: home.x,
    homeY: home.y,
    minY: home.minY,
    maxY: home.maxY,
    schoolId,
    facing: heading === 0 ? 1 : -1,
  };
}

const angleLerp = (from: number, to: number, t: number): number => {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * t;
};

/** Erschreckt einen Fisch sofort (z. B. wenn eine Blase ihn verfehlt oder abprallt). */
export function startle(f: FishState, from: { x: number; y: number }, tuning: FishTuning): void {
  f.mode = 'flee';
  f.modeTimer = tuning.behaviors[f.behavior].fleeSeconds;
  f.heading = Math.atan2(f.y - from.y, f.x - from.x);
}

/**
 * Ein Schritt Fisch-KI. Verändert `f` direkt.
 * - neugierig: kommt zu einem ruhigen Spieler und schwebt vor ihm, flieht nur vor schnellen
 * - Schwarm: zieht mit Artgenossen der Gruppe, flieht gemeinsam
 * - scheu: ruht, schießt bei Annäherung weit davon und ruht dann wieder
 */
export function stepFish(
  f: FishState,
  player: Mover,
  school: readonly FishState[],
  tuning: FishTuning,
  world: WorldX,
  rng: Rng,
  dt: number,
): void {
  const p = tuning.behaviors[f.behavior];
  const maxSpeed = tuning.baseSpeed * f.speed;
  f.px = f.x;
  f.py = f.y;

  const dx = f.x - player.x;
  const dy = f.y - player.y;
  const dist = Math.hypot(dx, dy);
  const playerSpeed = Math.hypot(player.vx, player.vy);
  f.modeTimer -= dt;

  const threatened = dist < p.fleeRadius && (f.behavior !== 'curious' || playerSpeed > p.startleSpeed);
  if (threatened) {
    f.mode = 'flee';
    f.modeTimer = p.fleeSeconds;
  } else if (f.mode === 'flee' && f.modeTimer <= 0) {
    f.mode = f.behavior === 'skittish' ? 'rest' : 'wander';
    f.modeTimer = p.restSeconds;
  }
  if (f.behavior === 'curious' && f.mode !== 'flee') {
    f.mode = dist < p.senseRadius && playerSpeed <= p.startleSpeed ? 'approach' : 'wander';
  }
  if (f.mode === 'rest' && f.modeTimer <= 0) f.mode = 'wander';

  let desX = 0;
  let desY = 0;
  let accel = tuning.acceleration;

  switch (f.mode) {
    case 'flee': {
      const away = dist > 0.001 ? Math.atan2(dy, dx) : f.heading;
      f.heading = away;
      desX = Math.cos(away) * maxSpeed * p.fleeSpeed;
      desY = Math.sin(away) * maxSpeed * p.fleeSpeed * 0.7;
      accel *= 2.5;
      break;
    }
    case 'approach': {
      const d = Math.max(dist, 0.001);
      const s = clamp((dist - p.approachDistance) / 120, -1, 1) * maxSpeed;
      desX = (-dx / d) * s;
      desY = (-dy / d) * s;
      if (Math.abs(desX) > 1) f.heading = desX > 0 ? 0 : Math.PI;
      break;
    }
    case 'rest': {
      desX = Math.cos(f.heading) * maxSpeed * 0.08;
      desY = 0;
      break;
    }
    default: {
      f.heading += (rng.next() * 2 - 1) * p.wanderTurn * dt * 4;
      const hx = f.homeX - f.x;
      const hy = f.homeY - f.y;
      if (Math.hypot(hx, hy) > p.leashRadius) f.heading = angleLerp(f.heading, Math.atan2(hy, hx), 2 * dt);
      desX = Math.cos(f.heading) * maxSpeed * 0.55;
      desY = Math.sin(f.heading) * maxSpeed * 0.25;

      if (f.behavior === 'schooling' && school.length > 1) {
        let cx = 0;
        let cy = 0;
        let avx = 0;
        let avy = 0;
        let n = 0;
        let sepX = 0;
        let sepY = 0;
        for (const o of school) {
          if (o.uid === f.uid) continue;
          const ox = o.x - f.x;
          const oy = o.y - f.y;
          const od = Math.hypot(ox, oy);
          if (od > p.neighborRadius) continue;
          cx += o.x;
          cy += o.y;
          avx += o.vx;
          avy += o.vy;
          n++;
          if (od < p.separation && od > 0.001) {
            sepX -= (ox / od) * (p.separation - od);
            sepY -= (oy / od) * (p.separation - od);
          }
        }
        if (n > 0) {
          desX += ((cx / n - f.x) * p.cohesion) + (avx / n - desX) * p.alignment + sepX * 2;
          desY += ((cy / n - f.y) * p.cohesion) + (avy / n - desY) * p.alignment + sepY * 2;
        }
      }
    }
  }

  // Sanft im eigenen Tiefenband halten.
  if (f.y < f.minY) desY += maxSpeed * 0.6;
  else if (f.y > f.maxY) desY -= maxSpeed * 0.6;

  const k = approachFactor(accel, dt);
  f.vx += (desX - f.vx) * k;
  f.vy += (desY - f.vy) * k;

  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.x < world.minX || f.x > world.maxX) {
    f.x = clamp(f.x, world.minX, world.maxX);
    f.vx = -f.vx * 0.3;
    f.heading = Math.PI - f.heading;
  }
  if (f.y < world.minY || f.y > world.maxY) {
    f.y = clamp(f.y, world.minY, world.maxY);
    f.vy = 0;
  }

  if (f.vx > tuning.turnThreshold) f.facing = 1;
  else if (f.vx < -tuning.turnThreshold) f.facing = -1;
}
