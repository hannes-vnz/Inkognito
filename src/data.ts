import playerJson from '../data/player.json';
import zonesJson from '../data/zones.json';
import gameJson from '../data/game.json';
import textsJson from '../data/texts.de.json';
import fishJson from '../data/fish.json';
import armsJson from '../data/arms.json';
import predatorsJson from '../data/predators.json';
import buildingsJson from '../data/buildings.json';
import npcsJson from '../data/npcs.json';
import questsJson from '../data/quests.json';
import jobsJson from '../data/jobs.json';
import reefJson from '../data/reef.json';
import type { MovementParams } from './systems/movement';
import type { CameraParams } from './systems/camera';
import type { JoystickParams, TapParams } from './systems/joystick';
import type { TextTable } from './systems/texts';
import type { FishDef, FishTuning } from './systems/fish';
import type { CannonDef } from './systems/bubbles';
import type { CarryParams } from './systems/carry';
import type { PredatorSpawnDef, SpawnDef } from './systems/dive';
import type { PredatorDef } from './systems/predator';
import type { OxygenParams } from './systems/oxygen';
import type { CurrentParams } from './systems/current';
import type { BuildingDef, ColonyDefs, EconomyParams, JobDef } from './systems/colony';
import type { NpcDef } from './systems/dialog';
import type { QuestDef } from './systems/quests';

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
  carry: CarryParams;
  oxygen: OxygenParams;
}

export interface BackgroundLayerDef {
  key: string;
  factorX: number;
  factorY: number;
  fixed?: boolean;
  /** Nicht senkrecht kacheln, sondern am Weltboden verankern (Korallen, Ruinen). */
  anchorBottom?: boolean;
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
  fishSpawns: SpawnDef[];
  exit: { x: number; y: number; radius: number; labelKey: string };
  current: CurrentParams;
  predators: PredatorSpawnDef[];
  seed: string;
}

export interface GameConfig {
  fixedStepHz: number;
  camera: CameraParams;
  joystick: JoystickParams & { restMargin: number; tap: TapParams };
  juice: {
    bubbles: { maxCount: number; perSecondAtMaxSpeed: number; riseSpeed: number; lifeSeconds: number };
    marineSnow: { count: number; parallax: number; driftSpeed: number };
  };
  ui: { margin: number; fontFamily: string };
  spriteScale: number;
  fish: FishTuning & { animations: AnimationDef[] };
  catching: {
    hitStopMs: number;
    vibrateMs: number;
    vibration: boolean;
    respawnSeconds: number;
    respawnMinDistance: number;
    gerdMissChance: number;
  };
}

export interface ArmDef extends CannonDef {
  nameKey: string;
  slotUnlock: number;
  ammo: string[];
  upgrades: { level: number; cost: number; effect: Record<string, number> }[];
  personalityKey: string;
}

export const player = playerJson as PlayerDef;
export const zones = zonesJson as ZoneDef[];
export const game = gameJson as GameConfig;
export const texts = textsJson as TextTable;
export const fish = fishJson as unknown as FishDef[];
export const arms = armsJson as ArmDef[];
export const predators = predatorsJson as PredatorDef[];

export function armById(id: string): ArmDef {
  const arm = arms.find((a) => a.id === id);
  if (!arm) throw new Error(`Arm "${id}" fehlt in data/arms.json`);
  return arm;
}

export function zoneById(id: string): ZoneDef {
  const zone = zones.find((z) => z.id === id);
  if (!zone) throw new Error(`Zone "${id}" fehlt in data/zones.json`);
  return zone;
}

export interface ReefDef {
  id: string;
  nameKey: string;
  world: { width: number; height: number; floorY: number };
  spawn: { x: number; y: number };
  diveEntrance: { x: number; y: number; radius: number };
  interactRadius: number;
  waitingCapacity: number;
  economy: EconomyParams;
  podestSprite: string;
  water: { deep: string };
  floor: { sand: string; sandShadow: string; rock: string; rockLight: string };
  background: BackgroundLayerDef[];
  seed: string;
}

export const buildings = buildingsJson as BuildingDef[];
export const jobs = jobsJson as JobDef[];
export const npcs = npcsJson as unknown as NpcDef[];
export const quests = questsJson as unknown as QuestDef[];
export const reef = reefJson as unknown as ReefDef;

/** Alles, was die Riff-Logik aus den Daten braucht. */
export const colonyDefs: ColonyDefs = {
  buildings,
  jobs,
  fish: new Map(fish.map((f) => [f.id, { id: f.id, sellValue: f.sellValue, stats: f.stats }])),
  economy: reef.economy,
  waitingCapacity: reef.waitingCapacity,
};
export const fishById = new Map(fish.map((f) => [f.id, f]));
