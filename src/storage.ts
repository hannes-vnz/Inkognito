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

/** Nach dem Zurücksetzen darf bis zum Neuladen nichts den alten Stand zurückschreiben. */
let locked = false;

export function writeSave(save: Save): void {
  if (locked) return;
  try {
    window.localStorage.setItem(KEY, serialize(save));
  } catch {
    // Kein Speicher (privater Modus): Spiel läuft weiter, nur ohne Fortschritt.
  }
}

/** Frischen Stand schreiben und weitere Schreibzugriffe sperren (danach wird neu geladen). */
export function writeFreshAndLock(save: Save): void {
  writeSave(save);
  locked = true;
}
