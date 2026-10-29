/**
 * Spielstand. Jede Formatänderung bekommt eine neue Version und eine Migration,
 * damit alte Stände (lokal oder aus Supabase) weiter laden.
 */
export const SAVE_VERSION = 4;

export type UpgradeId = 'line' | 'hook' | 'crew';

export interface FishbookEntry {
  count: number;
  firstAt: number;
}

export interface SaveV3 {
  version: 3;
  createdAt: number;
  updatedAt: number;
  coins: number;
  upgrades: Record<UpgradeId, number>;
  fishbook: Record<string, FishbookEntry>;
  stats: { casts: number; deepestMeters: number };
  /** Bis hierhin (ms) wurde die Crew schon abgerechnet. */
  lastTick: number;
  /** Angefangene Crew-Münze (Nachkommastellen). */
  idleCarry: number;
}

/** Brunos Wunschfisch: diese Art bringt beim Landen die Prämie extra. */
export interface FishRequest {
  speciesId: string;
  reward: number;
}

export interface SaveV4 extends Omit<SaveV3, 'version'> {
  version: 4;
  /** Gesehene Story-Momente (ids aus data/story.json). */
  story: { seen: string[] };
  request: FishRequest | null;
  quiz: { nextAtCast: number; correct: number; asked: number };
}

export type Save = SaveV4;

export function newSave(now: number): Save {
  return {
    version: 4,
    createdAt: now,
    updatedAt: now,
    coins: 0,
    upgrades: { line: 0, hook: 0, crew: 0 },
    fishbook: {},
    stats: { casts: 0, deepestMeters: 0 },
    lastTick: now,
    idleCarry: 0,
    story: { seen: [] },
    request: null,
    quiz: { nextAtCast: 0, correct: 0, asked: 0 },
  };
}

type Migration = (old: Record<string, unknown>, now: number) => Record<string, unknown>;

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

const migrations: Record<number, Migration> = {
  // v0: unversionierter Prototyp-Stand
  0: (old, now) => ({ version: 1, createdAt: now, updatedAt: now, shells: num(old.shells) }),
  // v1: Riff mit Wohnhöhlen; nur die Muscheln zählen weiter
  1: (old, now) => ({ version: 2, createdAt: num(old.createdAt, now), updatedAt: num(old.updatedAt, now), shells: num(old.shells) }),
  // v2 → v3: Neustart als Angel-Spiel. Muscheln werden zu Münzen, das alte Riff entfällt.
  2: (old, now) => ({
    ...newSave(now),
    createdAt: num(old.createdAt, now),
    updatedAt: num(old.updatedAt, now),
    coins: Math.floor(num(old.shells)),
  }),
  // v3 → v4: Hafen-Figuren; Story, Wunschfisch und Quiz starten frisch.
  3: (old) => ({
    ...old,
    story: { seen: [] },
    request: null,
    quiz: { nextAtCast: 0, correct: 0, asked: 0 },
  }),
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
