import Phaser from 'phaser';
import { createRng } from '../systems/rng';
import type { ZoneDef } from '../data';

const color = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

/**
 * Platzhalter für die Zonen-Geometrie in Weltkoordinaten: Wasseroberfläche oben,
 * Sandgrund mit Felsen unten. Layout kommt aus dem Zonen-Seed und ist damit fest.
 */
export function drawWorldDecor(scene: Phaser.Scene, zone: ZoneDef): void {
  const { width, height, surfaceY, floorHeight } = zone.world;
  const rng = createRng(zone.seed);

  // Oberfläche: helles Band mit Wellenkante.
  const surface = scene.add.graphics().setDepth(-10);
  surface.fillStyle(0xe8fffb, 0.55);
  surface.fillRect(0, 0, width, surfaceY - 6);
  surface.fillStyle(0xffffff, 0.8);
  for (let x = 0; x < width; x += 24) {
    const y = surfaceY - 6 + Math.round(Math.sin(x * 0.02) * 3);
    surface.fillRect(x, y, 24, 3);
  }

  // Sandgrund mit welliger Oberkante.
  const floorTop = height - floorHeight;
  const g = scene.add.graphics().setDepth(-5);
  const points: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: height }];
  for (let x = 0; x <= width; x += 64) {
    points.push({ x, y: floorTop + Math.sin(x * 0.004) * 22 + rng.range(-10, 10) });
  }
  points.push({ x: width, y: height });
  g.fillStyle(color(zone.floor.sandShadow), 1);
  g.fillPoints(points, true);
  g.fillStyle(color(zone.floor.sand), 1);
  g.fillPoints(
    points.map((p) => ({ x: p.x, y: p.y === height ? height : p.y + 10 })),
    true,
  );

  // Felsen als einfache Vielecke mit Lichtkante.
  const rockCount = Math.round(width / 260);
  for (let i = 0; i < rockCount; i++) {
    const cx = rng.range(0, width);
    const r = rng.range(40, 120);
    const cy = floorTop + rng.range(10, 40);
    const corners = rng.int(6, 9);
    const shape: Phaser.Types.Math.Vector2Like[] = [];
    for (let c = 0; c < corners; c++) {
      const a = Math.PI + (c / (corners - 1)) * Math.PI;
      const rr = r * rng.range(0.7, 1.05);
      shape.push({ x: cx + Math.cos(a) * rr * 1.3, y: cy + Math.sin(a) * rr });
    }
    g.fillStyle(color(zone.floor.rock), 1);
    g.fillPoints(shape, true);
    g.fillStyle(color(zone.floor.rockLight), 1);
    g.fillPoints(
      shape.slice(0, Math.ceil(corners / 2)).map((p) => ({ x: p.x + 6, y: p.y + 6 })).concat([{ x: cx, y: cy }]),
      true,
    );
  }
}
