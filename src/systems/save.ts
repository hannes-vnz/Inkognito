/**
 * Spielstand. Jede Formatänderung bekommt eine neue Version und eine Migration,
 * damit alte Stände (lokal oder aus Supabase) weiter laden.
 */
export const SAVE_VERSION = 2;

export type StatName = 'strength' | 'speed' | 'diligence';
export type Stats = Record<StatName, number>;
export type Variant = 'normal' | 'zombie' | 'giant';

export interface OwnedFish {
  uid: number;
  fishId: string;
  stats: Stats;
  variant: Variant;
  /** Job-ID aus data/jobs.json oder null. */
  job: string | null;
}

export interface SaveV2 {
  version: 2;
  createdAt: number;
  updatedAt: number;
  /** Kann Nachkommastellen haben (laufende Produktion), angezeigt wird abgerundet. */
  shells: number;
  food: number;
  diveCount: number;
  nextUid: number;
  /** Fische im alten Haus. */
  fish: OwnedFish[];
  /** Fische vor der Tür, wenn das Haus voll ist. */
  waiting: OwnedFish[];
  /** Ausbaustufe je Gebäude (1 = Start). */
  buildings: Record<string, number>;
  quests: { active: string[]; done: string[] };
  counters: { sold: number };
  /** Bis hierhin (ms) wurde die Produktion schon verrechnet. */
  lastTick: number;
}

export type Save = SaveV2;

export function newSave(now: number, startFood = 10): Save {
  return {
    version: 2,
    createdAt: now,
    updatedAt: now,
    shells: 0,
    food: startFood,
    diveCount: 0,
    nextUid: 1,
    fish: [],
    waiting: [],
    buildings: { house: 1, seaweed_farm: 1, shell_bed: 1 },
    quests: { active: [], done: [] },
    counters: { sold: 0 },
    lastTick: now,
  };
}

type Migration = (old: Record<string, unknown>, now: number) => Record<string, unknown>;

const DEFAULT_STATS: Stats = { strength: 2, speed: 2, diligence: 2 };
/** Hauskapazität auf Stufe 1, für die Migration von v1 (dort gab es kein Haus). */
const V1_HOUSE_CAPACITY = 4;

const migrations: Record<number, Migration> = {
  // v0: unversionierter Prototyp-Stand (nur Muscheln und eine Fischliste)
  0: (old, now) => {
    const fish = Array.isArray(old.fish) ? old.fish.filter((f): f is string => typeof f === 'string') : [];
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      shells: typeof old.shells === 'number' ? old.shells : 0,
      diveCount: 0,
      nextUid: fish.length + 1,
      holding: fish.map((fishId, i) => ({ uid: i + 1, fishId })),
      residents: [],
      quests: { active: [], done: [] },
    };
  },
  // v1 → v2: Wohnhöhlen und Wartebecken werden zum alten Haus mit Werten und Jobs.
  1: (old, now) => {
    type V1Fish = { uid: number; fishId: string };
    const residents = (Array.isArray(old.residents) ? old.residents : []) as V1Fish[];
    const holding = (Array.isArray(old.holding) ? old.holding : []) as V1Fish[];
    const all = [...residents, ...holding].map((f) => ({
      uid: f.uid,
      fishId: f.fishId,
      stats: { ...DEFAULT_STATS },
      variant: 'normal' as Variant,
      job: null,
    }));
    const quests = (old.quests ?? { active: [], done: [] }) as { active: string[]; done: string[] };
    // Der alte Auftrag „Erster Mieter“ heißt jetzt first_fish.
    const rename = (ids: string[]) => ids.map((id) => (id === 'move_in_1' ? 'first_fish' : id));
    return {
      ...newSave(now),
      createdAt: typeof old.createdAt === 'number' ? old.createdAt : now,
      updatedAt: typeof old.updatedAt === 'number' ? old.updatedAt : now,
      shells: typeof old.shells === 'number' ? old.shells : 0,
      diveCount: typeof old.diveCount === 'number' ? old.diveCount : 0,
      nextUid: typeof old.nextUid === 'number' ? old.nextUid : all.length + 1,
      fish: all.slice(0, V1_HOUSE_CAPACITY),
      waiting: all.slice(V1_HOUSE_CAPACITY),
      quests: { active: rename(quests.active ?? []), done: rename(quests.done ?? []) },
    };
  },
};

/** Bringt einen beliebigen gelesenen Stand auf die aktuelle Version. Unbrauchbares ergibt einen neuen Stand. */
export function migrate(raw: unknown, now: number): Save {
  if (!raw || typeof raw !== 'object') return newSave(now);
  let data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  if (version > SAVE_VERSION) throw new Error(`Spielstand-Version ${version} ist neuer als dieses Spiel (${SAVE_VERSION}).`);
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return newSave(now);
    data = step(data, now);
    version++;
    data.version = version;
  }
  return data as unknown as Save;
}

export const serialize = (save: Save): string => JSON.stringify(save);

export function deserialize(text: string | null, now: number): Save {
  if (!text) return newSave(now);
  try {
    return migrate(JSON.parse(text), now);
  } catch (e) {
    if (e instanceof SyntaxError) return newSave(now);
    throw e;
  }
}
