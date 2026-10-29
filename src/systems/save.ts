/**
 * Spielstand. Jede Formatänderung bekommt eine neue Version und eine Migration,
 * damit alte Stände (lokal oder aus Supabase) weiter laden.
 */
export const SAVE_VERSION = 10;

export type UpgradeId = 'line' | 'hook' | 'crew' | 'engine';

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

export interface SaveV5 extends Omit<SaveV4, 'version'> {
  version: 5;
  /** Seekarte: aktueller Angelplatz und eingesammeltes Treibgut (gilt bis zum nächsten Wurf). */
  map: { spot: string; flotsamCast: number; flotsamTaken: number[] };
}

export interface SaveV6 extends Omit<SaveV5, 'version' | 'map'> {
  version: 6;
  map: SaveV5['map'] & { bottlesRead: number };
  /** Tagesbonus: zuletzt abgeholter Tag (JJJJ-MM-TT, Ortszeit) und Serie. */
  daily: { lastDay: string; streak: number };
}

export interface SaveV7 extends Omit<SaveV6, 'version'> {
  version: 7;
  /** Aktuelles Meer und alle Meere, die Bert schon hinter sich gelassen hat (Prestige). */
  sea: { current: string; left: string[] };
}

export interface SaveV8 extends Omit<SaveV7, 'version'> {
  version: 8;
  /** Opa Knuts Seemannsgarn (wahr oder erfunden?). */
  yarn: { nextAtCast: number; asked: number; correct: number };
}

export interface SaveV9 extends Omit<SaveV8, 'version' | 'yarn'> {
  version: 9;
  /** Legenden: wie viele Hinweise Knut je Meer verraten hat, wann der nächste kommt, wo die Leine schon riss. */
  legend: { hints: Record<string, number>; hintAtCast: number; snapped: string[] };
}

export interface SaveV10 extends Omit<SaveV9, 'version'> {
  version: 10;
  /** Gekaufter Köder für den nächsten Wurf (id aus data/baits.json). */
  bait: string | null;
}

export type Save = SaveV10;

export function newSave(now: number): Save {
  return {
    version: 10,
    createdAt: now,
    updatedAt: now,
    coins: 0,
    upgrades: { line: 0, hook: 0, crew: 0, engine: 0 },
    fishbook: {},
    stats: { casts: 0, deepestMeters: 0 },
    lastTick: now,
    idleCarry: 0,
    story: { seen: [] },
    request: null,
    quiz: { nextAtCast: 0, correct: 0, asked: 0 },
    map: { spot: 'harbor', flotsamCast: -1, flotsamTaken: [], bottlesRead: 0 },
    daily: { lastDay: '', streak: 0 },
    sea: { current: 'atlantic', left: [] },
    legend: { hints: {}, hintAtCast: 0, snapped: [] },
    bait: null,
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
  // v4 → v5: Seekarte. Alle starten in der Hafenbucht mit kleinem Motor.
  4: (old) => ({
    ...old,
    upgrades: { ...(old.upgrades as Record<string, number>), engine: 0 },
    map: { spot: 'harbor', flotsamCast: -1, flotsamTaken: [] },
  }),
  // v5 → v6: Tagesbonus und Flaschenpost.
  5: (old) => ({
    ...old,
    map: { ...(old.map as Record<string, unknown>), bottlesRead: 0 },
    daily: { lastDay: '', streak: 0 },
  }),
  // v6 → v7: mehrere Meere. Bisher gab es nur den Atlantik.
  6: (old) => ({ ...old, sea: { current: 'atlantic', left: [] } }),
  // v7 → v8: Opa Knut und sein Seemannsgarn.
  7: (old) => ({ ...old, yarn: { nextAtCast: 0, asked: 0, correct: 0 } }),
  // v8 → v9: Knut erzählt jetzt von Legenden statt Seemannsgarn.
  8: (old) => {
    const { yarn: _yarn, ...rest } = old;
    return { ...rest, legend: { hints: {}, hintAtCast: 0, snapped: [] } };
  },
  // v9 → v10: Köder.
  9: (old) => ({ ...old, bait: null }),
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
