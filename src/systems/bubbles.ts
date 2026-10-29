import type { Vec2 } from './vector';

export interface ProjectileParams {
  speed: number;
  /** Wasserwiderstand der Blase (pro Sekunde, exponentiell). */
  drag: number;
  lifeSeconds: number;
  radius: number;
  /** Anteil der Spielergeschwindigkeit, den die Blase mitnimmt. */
  inheritVelocity: number;
}

export interface AimAssistParams {
  maxAngleDegrees: number;
  range: number;
}

/** Eintrag aus data/arms.json für die Blasenkanone. */
export interface CannonDef {
  id: string;
  cooldownMs: number;
  projectile: ProjectileParams;
  aimAssist: AimAssistParams;
}

export interface Shot {
  uid: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
}

export interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Ungefähre Reichweite einer Blase mit Widerstand. */
export function shotRange(p: ProjectileParams): number {
  if (p.drag <= 0) return p.speed * p.lifeSeconds;
  return (p.speed * (1 - Math.exp(-p.drag * p.lifeSeconds))) / p.drag;
}

/**
 * Schussrichtung mit Zielhilfe: Liegt ein Fisch in einem schmalen Kegel um die gewünschte Richtung,
 * wird auf seine vorausberechnete Position gezielt. Gibt einen Einheitsvektor zurück.
 */
export function aimDirection(
  from: Vec2,
  target: Vec2,
  candidates: readonly Target[],
  speed: number,
  assist: AimAssistParams,
): Vec2 {
  let bx = target.x - from.x;
  let by = target.y - from.y;
  const len = Math.hypot(bx, by);
  if (len < 0.001) return { x: 1, y: 0 };
  bx /= len;
  by /= len;

  const maxAngle = (assist.maxAngleDegrees * Math.PI) / 180;
  let best: Vec2 | null = null;
  let bestAngle = maxAngle;
  for (const c of candidates) {
    const dist = Math.hypot(c.x - from.x, c.y - from.y);
    if (dist > assist.range || dist < 0.001) continue;
    const t = dist / speed;
    const lx = c.x + c.vx * t - from.x;
    const ly = c.y + c.vy * t - from.y;
    const ll = Math.hypot(lx, ly);
    if (ll < 0.001) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, (lx * bx + ly * by) / ll)));
    if (angle <= bestAngle) {
      bestAngle = angle;
      best = { x: lx / ll, y: ly / ll };
    }
  }
  return best ?? { x: bx, y: by };
}

export function fireShot(uid: number, from: Vec2, dir: Vec2, shooter: Vec2, p: ProjectileParams): Shot {
  return {
    uid,
    x: from.x,
    y: from.y,
    px: from.x,
    py: from.y,
    vx: dir.x * p.speed + shooter.x * p.inheritVelocity,
    vy: dir.y * p.speed + shooter.y * p.inheritVelocity,
    age: 0,
  };
}

/** Bewegt die Blase. Gibt `false` zurück, wenn sie zerplatzt ist. */
export function stepShot(s: Shot, p: ProjectileParams, dt: number): boolean {
  s.px = s.x;
  s.py = s.y;
  const damping = Math.exp(-p.drag * dt);
  s.vx *= damping;
  s.vy *= damping;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.age += dt;
  return s.age < p.lifeSeconds;
}

/** Index des ersten getroffenen Ziels (Strecke seit dem letzten Schritt gegen Kreise) oder -1. */
export function findHit(s: Shot, targets: readonly { x: number; y: number; radius: number }[], shotRadius: number): number {
  const sx = s.x - s.px;
  const sy = s.y - s.py;
  const segLen2 = sx * sx + sy * sy;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    let u = segLen2 > 0 ? ((t.x - s.px) * sx + (t.y - s.py) * sy) / segLen2 : 1;
    u = Math.max(0, Math.min(1, u));
    const cx = s.px + sx * u - t.x;
    const cy = s.py + sy * u - t.y;
    const r = t.radius + shotRadius;
    if (cx * cx + cy * cy <= r * r) return i;
  }
  return -1;
}
