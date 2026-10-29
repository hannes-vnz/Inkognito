/**
 * Tiefenskala: Jede Meereszone ist im Spiel gleich lang (`unitsPerZone`), zeigt aber ihre echten Meter an.
 * So dauert die Sonnenlichtzone (200 m) genauso lange wie die Mitternachtszone (3000 m).
 */
export interface ZoneSpan {
  id: string;
  depthMeters: [number, number];
}

export interface DepthMap {
  zones: readonly ZoneSpan[];
  unitsPerZone: number;
  surfaceY: number;
}

export function metersToY(m: number, map: DepthMap): number {
  if (m <= 0) return map.surfaceY;
  for (let i = 0; i < map.zones.length; i++) {
    const [a, b] = map.zones[i]!.depthMeters;
    if (m <= b || i === map.zones.length - 1) {
      const t = Math.min(1, (m - a) / (b - a));
      return map.surfaceY + (i + t) * map.unitsPerZone;
    }
  }
  return map.surfaceY;
}

export function yToMeters(y: number, map: DepthMap): number {
  if (y <= map.surfaceY) return 0;
  const units = (y - map.surfaceY) / map.unitsPerZone;
  const i = Math.min(map.zones.length - 1, Math.floor(units));
  const [a, b] = map.zones[i]!.depthMeters;
  return a + Math.min(1, units - i) * (b - a);
}

/** Index der Zone in einer Tiefe. */
export function zoneIndexAt(m: number, map: DepthMap): number {
  const i = map.zones.findIndex((z) => m < z.depthMeters[1]);
  return i < 0 ? map.zones.length - 1 : i;
}
