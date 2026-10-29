/**
 * Spielstand. Jede Formatänderung bekommt eine neue Version und eine Migration,
 * damit alte Stände (lokal oder später aus Supabase) weiter laden.
 */
export const SAVE_VERSION = 1;

export interface Resident {
  uid: number;
  fishId: string;
  buildingId: string;
  /** Bis zu diesem Zeitpunkt (ms) wurden Muscheln schon ausgezahlt. */
  producedUntil: number;
}

export interface HeldFish {
  uid: number;
  fishId: string;
}

export interface SaveV1 {
  version: 1;
  createdAt: number;
  updatedAt: number;
  shells: number;
  diveCount: number;
  nextUid: number;
  /** Gefangene Fische, die noch keine Wohnung haben. */
  holding: HeldFish[];
  residents: Resident[];
  quests: { active: string[]; done: string[] };
}

export type Save = SaveV1;

export function newSave(now: number): Save {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    shells: 0,
    diveCount: 0,
    nextUid: 1,
    holding: [],
    residents: [],
    quests: { active: [], done: [] },
  };
}

type Migration = (old: Record<string, unknown>, now: number) => Record<string, unknown>;

/**
 * Migrationen von Version n auf n+1. Version 0 ist der unversionierte Prototyp-Stand
 * (nur `shells` und eine Fischliste), damit der Mechanismus von Anfang an getestet ist.
 */
const migrations: Record<number, Migration> = {
  0: (old, now) => {
    const fish = Array.isArray(old.fish) ? old.fish.filter((f): f is string => typeof f === 'string') : [];
    return {
      ...newSave(now),
      shells: typeof old.shells === 'number' ? old.shells : 0,
      holding: fish.map((fishId, i) => ({ uid: i + 1, fishId })),
      nextUid: fish.length + 1,
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
