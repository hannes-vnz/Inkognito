import { approachFactor } from './camera';

export interface CarryParams {
  capacity: number;
  /** Abstand zwischen den Blasen in der Kette. */
  spacing: number;
  followRate: number;
  /** Ankerpunkt der Kette relativ zum Oktopus (x wird mit der Blickrichtung gespiegelt). */
  offset: { x: number; y: number };
}

export interface Carried {
  uid: number;
  fishId: string;
  x: number;
  y: number;
  px: number;
  py: number;
}

/**
 * Gefangene Fische schweben als Kette hinter dem Oktopus her: der erste folgt dem Anker,
 * jeder weitere hält Abstand zum Vorgänger wie an einer Schnur.
 */
export function stepCarry(
  list: Carried[],
  leader: { x: number; y: number; facing: number },
  p: CarryParams,
  dt: number,
): void {
  const k = approachFactor(p.followRate, dt);
  let prevX = leader.x + p.offset.x * leader.facing;
  let prevY = leader.y + p.offset.y;
  list.forEach((c, i) => {
    c.px = c.x;
    c.py = c.y;
    let tx = prevX;
    let ty = prevY;
    if (i > 0) {
      const dx = c.x - prevX;
      const dy = c.y - prevY;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        tx = prevX + (dx / d) * p.spacing;
        ty = prevY + (dy / d) * p.spacing;
      } else {
        tx = prevX - p.spacing * leader.facing;
      }
    }
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    prevX = c.x;
    prevY = c.y;
  });
}
