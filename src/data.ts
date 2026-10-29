import playerJson from '../data/player.json';
import zonesJson from '../data/zones.json';
import gameJson from '../data/game.json';
import textsJson from '../data/texts.de.json';
import type { MovementParams } from './systems/movement';
import type { CameraParams } from './systems/camera';
import type { JoystickParams } from './systems/joystick';
import type { TextTable } from './systems/texts';

export interface AnimationDef {
  key: string;
  row: number;
  frames: number;
  fps: number;
  repeat: number;
}

export interface PlayerDef {
  id: string;
  sprite: string;
  normalMap: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  animations: AnimationDef[];
  swimAnimationMinSpeed: number;
  movement: MovementParams;
  tilt: { maxDegrees: number; perSpeed: number };
  squash: { amount: number; perAcceleration: number; rate: number };
}

export interface BackgroundLayerDef {
  key: string;
  factorX: number;
  factorY: number;
  fixed?: boolean;
}

export interface ZoneDef {
  id: string;
  nameKey: string;
  depthMeters: { min: number; max: number };
  world: { width: number; height: number; surfaceY: number; floorHeight: number };
  pixelsPerMeter: number;
  spawn: { x: number; y: number };
  water: { shallow: string; deep: string; hazeColor: string; hazeMaxAlpha: number };
  floor: { sand: string; sandShadow: string; rock: string; rockLight: string };
  background: BackgroundLayerDef[];
  seed: string;
}

export interface GameConfig {
  fixedStepHz: number;
  camera: CameraParams;
  joystick: JoystickParams & { restMargin: number };
  juice: {
    bubbles: { maxCount: number; perSecondAtMaxSpeed: number; riseSpeed: number; lifeSeconds: number };
    marineSnow: { count: number; parallax: number; driftSpeed: number };
  };
  ui: { margin: number; fontFamily: string };
}

export const player = playerJson as PlayerDef;
export const zones = zonesJson as ZoneDef[];
export const game = gameJson as GameConfig;
export const texts = textsJson as TextTable;

export function zoneById(id: string): ZoneDef {
  const zone = zones.find((z) => z.id === id);
  if (!zone) throw new Error(`Zone "${id}" fehlt in data/zones.json`);
  return zone;
}
