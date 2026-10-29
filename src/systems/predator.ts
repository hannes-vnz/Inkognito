import { approachFactor } from './camera';
import { clamp } from './vector';
import type { Rng } from './rng';

/** Eintrag aus data/predators.json. */
export interface PredatorDef {
  id: string;
  nameKey: string;
  sprite: string;
  frame: { width: number; height: number };
  placeholderColor: string;
  speed: number;
  chaseSpeed: number;
  senseRadius: number;
  giveUpRadius: number;
  /** Jagt nur, wenn der Spieler Fische dabeihat. */
  requiresCarry: boolean;
  hitRadius: number;
  retreatSeconds: number;
  stunSeconds: number;
  knockback: number;
}

export type PredatorMode = 'patrol' | 'chase' | 'retreat' | 'stunned';

export interface PredatorState {
  uid: number;
  predatorId: string;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  mode: PredatorMode;
  timer: number;
  heading: number;
  minY: number;
  maxY: number;
  facing: 1 | -1;
}

export function createPredator(uid: number, def: PredatorDef, x: number, y: number, minY: number, maxY: number, rng: Rng): PredatorState {
  const heading = rng.next() < 0.5 ? 0 : Math.PI;
  return { uid, predatorId: def.id, x, y, px: x, py: y, vx: 0, vy: 0, mode: 'patrol', timer: 0, heading, minY, maxY, facing: heading === 0 ? 1 : -1 };
}

/**
 * Räuber-KI: patrouilliert im Tiefenband, jagt den Spieler (wenn er Fische trägt),
 * zieht sich nach einem Diebstahl zurück. Gibt `true` zurück, wenn er den Spieler erwischt.
 */
export function stepPredator(
  r: PredatorState,
  def: PredatorDef,
  player: { x: number; y: number },
  carrying: number,
  world: { minX: number; maxX: number },
  rng: Rng,
  dt: number,
): boolean {
  r.px = r.x;
  r.py = r.y;
  r.timer -= dt;
  const dx = player.x - r.x;
  const dy = player.y - r.y;
  const dist = Math.hypot(dx, dy);
  const wantsChase = (!def.requiresCarry || carrying > 0) && dist < def.senseRadius;

  if ((r.mode === 'stunned' || r.mode === 'retreat') && r.timer <= 0) r.mode = 'patrol';
  if (r.mode === 'patrol' && wantsChase) r.mode = 'chase';
  if (r.mode === 'chase' && (dist > def.giveUpRadius || (def.requiresCarry && carrying === 0))) r.mode = 'patrol';

  let desX = 0;
  let desY = 0;
  switch (r.mode) {
    case 'chase':
      desX = (dx / Math.max(dist, 1)) * def.chaseSpeed;
      desY = (dy / Math.max(dist, 1)) * def.chaseSpeed;
      break;
    case 'retreat':
      desX = Math.cos(r.heading) * def.speed;
      desY = -def.speed * 0.6;
      break;
    case 'stunned':
      desY = 20;
      break;
    default:
      r.heading += (rng.next() * 2 - 1) * dt * 2;
      desX = Math.cos(r.heading) * def.speed * 0.5;
      desY = Math.sin(r.heading) * def.speed * 0.2;
      if (r.y < r.minY) desY += def.speed * 0.4;
      else if (r.y > r.maxY) desY -= def.speed * 0.4;
  }

  const k = approachFactor(r.mode === 'chase' ? 3 : 2, dt);
  r.vx += (desX - r.vx) * k;
  r.vy += (desY - r.vy) * k;
  r.x = clamp(r.x + r.vx * dt, world.minX, world.maxX);
  r.y = r.y + r.vy * dt;
  if (r.x === world.minX || r.x === world.maxX) r.heading = Math.PI - r.heading;
  if (r.vx > 10) r.facing = 1;
  else if (r.vx < -10) r.facing = -1;

  if (r.mode === 'chase' && dist < def.hitRadius) {
    r.mode = 'retreat';
    r.timer = def.retreatSeconds;
    r.heading = dx > 0 ? Math.PI : 0;
    return true;
  }
  return false;
}

export function stunPredator(r: PredatorState, def: PredatorDef): void {
  r.mode = 'stunned';
  r.timer = def.stunSeconds;
  r.vx *= 0.2;
  r.vy *= 0.2;
}
