import { deserialize, serialize, type Save } from './systems/save';

const KEY = 'inkognito.save';

/** Lokaler Spielstand (später zusätzlich Supabase). Speicher kann fehlen oder blockiert sein. */
export function loadSave(now = Date.now()): Save {
  let text: string | null = null;
  try {
    text = window.localStorage.getItem(KEY);
  } catch {
    text = null;
  }
  return deserialize(text, now);
}

export function writeSave(save: Save): void {
  try {
    window.localStorage.setItem(KEY, serialize(save));
  } catch {
    // Kein Speicher (privater Modus): Spiel läuft weiter, nur ohne Fortschritt.
  }
}
