import { armById, fish, game, player, type ZoneDef } from './data';
import type { DiveConfig } from './systems/dive';

/** Baut aus den JSON-Daten die Konfiguration für einen Tauchgang in einer Zone. */
export function diveConfigFor(zone: ZoneDef): DiveConfig {
  const { world } = zone;
  const half = (player.frameWidth * player.scale) / 2;
  const floorY = world.height - world.floorHeight;
  return {
    movement: player.movement,
    bounds: { minX: half, minY: world.surfaceY + half * 0.5, maxX: world.width - half, maxY: floorY },
    fishBounds: { minX: 40, minY: world.surfaceY + 40, maxX: world.width - 40, maxY: floorY - 30 },
    spawn: zone.spawn,
    surfaceY: world.surfaceY,
    surfaceMeters: zone.depthMeters.min,
    pixelsPerMeter: zone.pixelsPerMeter,
    fishDefs: fish.filter((f) => f.zone === zone.id),
    spawns: zone.fishSpawns,
    fishTuning: game.fish,
    cannon: armById('bubble_cannon'),
    carry: player.carry,
    spriteScale: game.spriteScale,
    respawnSeconds: game.catching.respawnSeconds,
    respawnMinDistance: game.catching.respawnMinDistance,
  };
}
