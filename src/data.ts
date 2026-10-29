import playerJson from '../data/player.json';
import fishJson from '../data/fish.json';
import zonesJson from '../data/zones.json';
import upgradesJson from '../data/upgrades.json';
import setsJson from '../data/sets.json';
import npcsJson from '../data/npcs.json';
import storyJson from '../data/story.json';
import quizJson from '../data/quiz.json';
import gameJson from '../data/game.json';
import textsJson from '../data/texts.de.json';
import type { TextTable } from './systems/texts';
import type { FishingParams, SpeciesDef } from './systems/fishing';
import type { EconomyParams, UpgradeDef } from './systems/economy';
import type { DepthMap } from './systems/depthMap';
import type { SetDef } from './systems/sets';
import type { NpcDef } from './systems/dialog';
import type { StoryBeat } from './systems/story';
import type { QuizParams, QuizQuestion } from './systems/quiz';
import type { RewardParams } from './systems/requests';

export interface AnimationDef {
  key: string;
  row: number;
  frames: number;
  fps: number;
  repeat: number;
}

export interface PlayerDef {
  id: string;
  nameKey: string;
  sprite: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  animations: AnimationDef[];
}

export interface ZoneDef {
  id: string;
  nameKey: string;
  enterKey: string;
  depthMeters: [number, number];
  /** Wasserfarbe oben und unten in der Zone. */
  water: [string, string];
}

export type GameParams = FishingParams &
  EconomyParams & {
    unitsPerZone: number;
    surfaceY: number;
    flightSeconds: number;
  };

export const player = playerJson as PlayerDef;
export const species = fishJson as unknown as SpeciesDef[];
export const speciesById = new Map(species.map((s) => [s.id, s]));
export const zones = zonesJson as unknown as ZoneDef[];
export const upgrades = upgradesJson as UpgradeDef[];
export const sets = setsJson as SetDef[];
export const params = gameJson.fishing as GameParams;
export const fixedStepHz = gameJson.fixedStepHz;
export const npcs = npcsJson as unknown as NpcDef[];
export const npcById = new Map(npcs.map((n) => [n.id, n]));
export const story = storyJson as unknown as StoryBeat[];
export const quiz = quizJson as QuizQuestion[];
export const harbor = gameJson.harbor as QuizParams & { requestReward: RewardParams; requestRequires: string };
export const texts = textsJson as TextTable;

export const depthMap: DepthMap = { zones, unitsPerZone: params.unitsPerZone, surfaceY: params.surfaceY };

export function upgradeById(id: string): UpgradeDef {
  const u = upgrades.find((x) => x.id === id);
  if (!u) throw new Error(`Upgrade "${id}" fehlt in data/upgrades.json`);
  return u;
}
