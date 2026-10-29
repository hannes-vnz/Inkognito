import playerJson from '../data/player.json';
import fishJson from '../data/fish.json';
import seasJson from '../data/seas.json';
import upgradesJson from '../data/upgrades.json';
import setsJson from '../data/sets.json';
import npcsJson from '../data/npcs.json';
import storyJson from '../data/story.json';
import quizJson from '../data/quiz.json';
import spotsJson from '../data/spots.json';
import gameJson from '../data/game.json';
import textsJson from '../data/texts.de.json';
import type { TextTable } from './systems/texts';
import type { FishingParams, SpeciesDef } from './systems/fishing';
import type { EconomyParams, UpgradeDef } from './systems/economy';
import type { DepthMap } from './systems/depthMap';
import type { PrestigeParams, SeaDef } from './systems/prestige';
import type { SetDef } from './systems/sets';
import type { NpcDef } from './systems/dialog';
import type { StoryBeat } from './systems/story';
import type { QuizParams, QuizQuestion } from './systems/quiz';
import type { RewardParams } from './systems/requests';
import type { MapParams, SpotDef } from './systems/seaMap';
import type { DailyParams } from './systems/daily';
import type { SparkStyle } from './render/Sparks';
import bottlesJson from '../data/bottles.json';
import gagsJson from '../data/gags.json';
import baitsJson from '../data/baits.json';
import type { BaitDef } from './systems/bait';
import type { HintParams, TimeParams } from './systems/legend';

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
  /** Leuchtpunkte (Biolumineszenz) im Hintergrund. */
  sparkle: boolean;
}

export type GameParams = FishingParams &
  EconomyParams & {
    unitsPerZone: number;
    surfaceY: number;
    flightSeconds: number;
    /** Arten mit Häufigkeit bis hier gelten als selten (Extra-Jubel beim Fang). */
    rareWeight: number;
  };

export const player = playerJson as PlayerDef;
export const species = fishJson as unknown as SpeciesDef[];
export const speciesById = new Map(species.map((s) => [s.id, s]));
export const upgrades = upgradesJson as UpgradeDef[];
export const sets = setsJson as SetDef[];
export const params = gameJson.fishing as GameParams;
export const fixedStepHz = gameJson.fixedStepHz;
export const npcs = npcsJson as unknown as NpcDef[];
export const npcById = new Map(npcs.map((n) => [n.id, n]));
export const story = storyJson as unknown as StoryBeat[];
export const quiz = quizJson as QuizQuestion[];
export const harbor = gameJson.harbor as QuizParams & HintParams & { requestReward: RewardParams; requestRequires: string };
export const seas = seasJson as unknown as (SeaDef & { zones: ZoneDef[] })[];
export const seaById = (id: string) => seas.find((s) => s.id === id) ?? seas[0]!;
export const prestigeParams = gameJson.prestige as PrestigeParams;
export const spots = spotsJson as SpotDef[];
export const spotsIn = (sea: string): SpotDef[] => spots.filter((s) => s.sea === sea);
/** Hafen eines Meeres (Startplatz, Figuren, Mittelpunkt der Motor-Reichweite). */
export const homeOf = (sea: string): SpotDef => spots.find((s) => s.sea === sea && s.harbor) ?? spots.find((s) => s.harbor)!;
export const spotById = (id: string): SpotDef => spots.find((s) => s.id === id) ?? homeOf(seas[0]!.id);
export const speciesIn = (sea: string): SpeciesDef[] => species.filter((s) => s.sea === sea);
export const mapParams = gameJson.map as MapParams;
type JuiceStyle = Omit<SparkStyle, 'tint'> & { tint: string };
export const juice = gameJson.juice as unknown as { hitstopSeconds: number; splash: JuiceStyle; spark: JuiceStyle; coinSpark: JuiceStyle };
export const dailyParams = gameJson.daily as DailyParams;
export const bottles = bottlesJson as string[];
export const timeParams = gameJson.time as TimeParams;
export const gags = gagsJson as string[];
export const baits = baitsJson as BaitDef[];
export const baitById = (id: string | null): BaitDef | null => baits.find((b) => b.id === id) ?? null;
export const texts = textsJson as TextTable;

/** Tiefenskala eines Meeres: jede seiner Zonen ist im Spiel gleich lang. */
export type SeaDepthMap = Omit<DepthMap, 'zones'> & { zones: ZoneDef[] };
export const depthMapFor = (sea: string): SeaDepthMap => ({ zones: seaById(sea).zones, unitsPerZone: params.unitsPerZone, surfaceY: params.surfaceY });

export function upgradeById(id: string): UpgradeDef {
  const u = upgrades.find((x) => x.id === id);
  if (!u) throw new Error(`Upgrade "${id}" fehlt in data/upgrades.json`);
  return u;
}
