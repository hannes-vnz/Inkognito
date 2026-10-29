import { createRng } from './rng';
import type { OwnedFish, Save, StatName, Stats, Variant } from './save';

/** Ausbaustufe eines Gebäudes (data/buildings.json). */
export interface BuildingLevel {
  capacity?: number;
  slots?: number;
  cost?: number;
}

export interface BuildingDef {
  id: string;
  nameKey: string;
  sprite: string;
  frame: { width: number; height: number };
  position: { x: number; y: number };
  interactOffsetY: number;
  levels: BuildingLevel[];
  placeholderColor: string;
}

export interface JobDef {
  id: string;
  nameKey: string;
  building: string;
  stat: StatName;
  /** Ertrag pro Minute und Wertpunkt. */
  produces: { food?: number; shells?: number };
}

export interface FishStatsDef {
  id: string;
  sellValue: number;
  stats: Record<StatName, [number, number]>;
}

export interface EconomyParams {
  foodPerFishPerMinute: number;
  /** Arbeitsleistung ohne Futter. */
  hungryFactor: number;
  startFood: number;
  maxOfflineHours: number;
  statMultiplier: { base: number; perPoint: number };
  variantMultiplier: Record<Variant, number>;
}

export interface ColonyDefs {
  buildings: readonly BuildingDef[];
  jobs: readonly JobDef[];
  fish: ReadonlyMap<string, FishStatsDef>;
  economy: EconomyParams;
  waitingCapacity: number;
}

const STATS: StatName[] = ['strength', 'speed', 'diligence'];

export function buildingLevel(save: Save, id: string): number {
  return save.buildings[id] ?? 1;
}

function levelDef(defs: ColonyDefs, id: string, level: number): BuildingLevel {
  const b = defs.buildings.find((x) => x.id === id);
  if (!b) throw new Error(`Gebäude "${id}" fehlt in data/buildings.json`);
  return b.levels[Math.min(level, b.levels.length) - 1] ?? {};
}

export const houseCapacity = (save: Save, defs: ColonyDefs): number =>
  levelDef(defs, 'house', buildingLevel(save, 'house')).capacity ?? 0;

export function jobSlots(save: Save, defs: ColonyDefs, jobId: string): number {
  const job = defs.jobs.find((j) => j.id === jobId);
  if (!job) return 0;
  return levelDef(defs, job.building, buildingLevel(save, job.building)).slots ?? 0;
}

export const workersOn = (save: Save, jobId: string): OwnedFish[] => save.fish.filter((f) => f.job === jobId);

/** Würfelt die Werte eines frisch gefangenen Fisches (Seed aus Spielstand und Fang-Nummer). */
export function rollFish(save: Save, fishId: string, uid: number, defs: ColonyDefs, variant: Variant = 'normal'): OwnedFish {
  const def = defs.fish.get(fishId);
  const rng = createRng(`${save.createdAt}-${uid}-${fishId}`);
  const bonus = variant === 'normal' ? 0 : 1;
  const stats = Object.fromEntries(
    STATS.map((s) => {
      const [min, max] = def?.stats[s] ?? [1, 3];
      return [s, rng.int(min, max) + bonus];
    }),
  ) as Stats;
  return { uid, fishId, stats, variant, job: null };
}

/**
 * Fang aus dem Tauchgang ins Riff: zuerst ins Haus, dann vor die Tür, der Rest wird freigelassen.
 */
export function addCatch(
  save: Save,
  fishIds: readonly string[],
  defs: ColonyDefs,
  now: number,
): { save: Save; housed: number; waiting: number; released: number } {
  let nextUid = save.nextUid;
  const fish = [...save.fish];
  const waiting = [...save.waiting];
  const cap = houseCapacity(save, defs);
  let housed = 0;
  let waited = 0;
  let released = 0;
  for (const id of fishIds) {
    const f = rollFish(save, id, nextUid++, defs);
    if (fish.length < cap) {
      fish.push(f);
      housed++;
    } else if (waiting.length < defs.waitingCapacity) {
      waiting.push(f);
      waited++;
    } else released++;
  }
  return {
    save: { ...save, fish, waiting, nextUid, diveCount: save.diveCount + 1, updatedAt: now },
    housed,
    waiting: waited,
    released,
  };
}

/** Holt wartende Fische ins Haus, so viele wie Platz ist. */
export function letIn(save: Save, defs: ColonyDefs, now: number): Save {
  const room = houseCapacity(save, defs) - save.fish.length;
  if (room <= 0 || save.waiting.length === 0) return save;
  return { ...save, fish: [...save.fish, ...save.waiting.slice(0, room)], waiting: save.waiting.slice(room), updatedAt: now };
}

export type AssignResult = 'ok' | 'full' | 'unknownJob' | 'notFound';

export function canAssign(save: Save, uid: number, jobId: string | null, defs: ColonyDefs): AssignResult {
  const f = save.fish.find((x) => x.uid === uid);
  if (!f) return 'notFound';
  if (jobId === null || f.job === jobId) return 'ok';
  if (!defs.jobs.some((j) => j.id === jobId)) return 'unknownJob';
  return workersOn(save, jobId).length >= jobSlots(save, defs, jobId) ? 'full' : 'ok';
}

export function assignJob(save: Save, uid: number, jobId: string | null, defs: ColonyDefs, now: number): Save {
  const check = canAssign(save, uid, jobId, defs);
  if (check !== 'ok') throw new Error(`Job nicht möglich: ${check}`);
  return { ...save, updatedAt: now, fish: save.fish.map((f) => (f.uid === uid ? { ...f, job: jobId } : f)) };
}

/** Ertrag pro Minute aller Fische auf einem Job (satt). */
export function jobRate(save: Save, jobId: string, defs: ColonyDefs): { food: number; shells: number } {
  const job = defs.jobs.find((j) => j.id === jobId);
  if (!job) return { food: 0, shells: 0 };
  const points = workersOn(save, jobId).reduce((n, f) => n + f.stats[job.stat], 0);
  return { food: points * (job.produces.food ?? 0), shells: points * (job.produces.shells ?? 0) };
}

/**
 * Lässt die Zeit im Riff laufen: Jobs erarbeiten Futter und Muscheln, alle Fische essen.
 * Ohne Futter arbeiten die Fische nur mit `hungryFactor`. Offline-Zeit ist gedeckelt.
 */
export function tick(save: Save, now: number, defs: ColonyDefs): { save: Save; food: number; shells: number; ranOut: boolean } {
  const from = Math.max(save.lastTick, now - defs.economy.maxOfflineHours * 3600e3);
  const minutes = Math.max(0, (now - from) / 60000);
  if (minutes === 0) return { save: save.lastTick === now ? save : { ...save, lastTick: now }, food: 0, shells: 0, ranOut: false };

  let foodRate = 0;
  let shellRate = 0;
  for (const job of defs.jobs) {
    const r = jobRate(save, job.id, defs);
    foodRate += r.food;
    shellRate += r.shells;
  }
  const eat = save.fish.length * defs.economy.foodPerFishPerMinute;
  const net = foodRate - eat;

  // Anteil der Zeit, in der noch Futter da ist.
  let fedMinutes = minutes;
  if (net < 0) fedMinutes = Math.min(minutes, save.food / -net);
  const hungryMinutes = minutes - fedMinutes;
  const h = defs.economy.hungryFactor;
  const foodGain = foodRate * (fedMinutes + hungryMinutes * h) - eat * fedMinutes - Math.min(eat, foodRate * h) * hungryMinutes;
  const food = Math.max(0, save.food + foodGain);
  const shells = shellRate * (fedMinutes + hungryMinutes * h);
  const ranOut = save.food > 0 && food <= 0.0001 && eat > 0;

  return {
    save: { ...save, food, shells: save.shells + shells, lastTick: now, updatedAt: shells > 0 || foodGain !== 0 ? now : save.updatedAt },
    food: food - save.food,
    shells,
    ranOut,
  };
}

/** Was Bruno für einen Fisch zahlt. */
export function sellPrice(f: OwnedFish, defs: ColonyDefs): number {
  const def = defs.fish.get(f.fishId);
  if (!def) return 0;
  const avg = (f.stats.strength + f.stats.speed + f.stats.diligence) / 3;
  const m = defs.economy.statMultiplier;
  return Math.max(1, Math.round(def.sellValue * (m.base + m.perPoint * avg) * defs.economy.variantMultiplier[f.variant]));
}

export function sellFish(save: Save, uid: number, defs: ColonyDefs, now: number): { save: Save; price: number } {
  const f = save.fish.find((x) => x.uid === uid) ?? save.waiting.find((x) => x.uid === uid);
  if (!f) throw new Error('Fisch nicht gefunden');
  const price = sellPrice(f, defs);
  return {
    price,
    save: {
      ...save,
      updatedAt: now,
      shells: save.shells + price,
      fish: save.fish.filter((x) => x.uid !== uid),
      waiting: save.waiting.filter((x) => x.uid !== uid),
      counters: { ...save.counters, sold: save.counters.sold + 1 },
    },
  };
}

export type UpgradeCheck = { ok: true; cost: number } | { ok: false; reason: 'max' } | { ok: false; reason: 'shells'; missing: number };

export function checkUpgrade(save: Save, buildingId: string, defs: ColonyDefs): UpgradeCheck {
  const b = defs.buildings.find((x) => x.id === buildingId);
  const level = buildingLevel(save, buildingId);
  const next = b?.levels[level];
  if (!next) return { ok: false, reason: 'max' };
  const cost = next.cost ?? 0;
  const have = Math.floor(save.shells);
  return have >= cost ? { ok: true, cost } : { ok: false, reason: 'shells', missing: cost - have };
}

export function upgrade(save: Save, buildingId: string, defs: ColonyDefs, now: number): Save {
  const check = checkUpgrade(save, buildingId, defs);
  if (!check.ok) throw new Error(`Ausbau nicht möglich: ${check.reason}`);
  return {
    ...save,
    updatedAt: now,
    shells: save.shells - check.cost,
    buildings: { ...save.buildings, [buildingId]: buildingLevel(save, buildingId) + 1 },
  };
}
