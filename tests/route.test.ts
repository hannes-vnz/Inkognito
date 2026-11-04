import { describe, expect, it } from 'vitest';
import { routeBetween, routeCurve, routeLayout } from '../src/systems/route';

describe('Route der Seekarte', () => {
  it('Heimathafen unten in der Mitte, jede weitere Station weiter nördlich im Zickzack', () => {
    const { nodes, height } = routeLayout(5, 400, 150);
    expect(nodes[0]!.x).toBe(200);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i]!.y).toBeLessThan(nodes[i - 1]!.y);
      expect(nodes[i]!.y).toBeGreaterThan(0);
    }
    expect(nodes[1]!.x).not.toBe(nodes[2]!.x);
    expect(height).toBeGreaterThan(nodes[0]!.y);
  });

  it('Kurve beginnt und endet an den Stationen, Weg geht vor und zurück', () => {
    const a = { x: 100, y: 500 };
    const b = { x: 300, y: 350 };
    const c = routeCurve(a, b);
    expect(c[0]).toEqual(a);
    expect(c[c.length - 1]).toEqual(b);
    const { nodes } = routeLayout(4, 400, 150);
    const up = routeBetween(nodes, 0, 3);
    expect(up[0]).toEqual(nodes[0]);
    expect(up[up.length - 1]).toEqual(nodes[3]);
    const down = routeBetween(nodes, 3, 1);
    expect(down[0]).toEqual(nodes[3]);
    expect(down[down.length - 1]).toEqual(nodes[1]);
    expect(routeBetween(nodes, 2, 2)).toEqual([nodes[2]]);
  });
});
