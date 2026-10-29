import type { Save } from './save';

export type SyncDecision = 'push' | 'pull' | 'none';

/** Ein unberührter Stand (neues Gerät) darf nie einen echten Online-Stand überschreiben. */
export function isFresh(s: Save): boolean {
  return (
    s.diveCount === 0 &&
    s.shells === 0 &&
    s.fish.length === 0 &&
    s.waiting.length === 0 &&
    s.quests.active.length === 0 &&
    s.quests.done.length === 0
  );
}

/** Konfliktregel aus dem Konzept: der neuere Stand gewinnt, Zeitstempel = letzte Änderung im Spiel. */
export function decideSync(local: Save, remote: { updatedAt: number } | null): SyncDecision {
  if (!remote) return isFresh(local) ? 'none' : 'push';
  if (isFresh(local)) return 'pull';
  if (remote.updatedAt > local.updatedAt) return 'pull';
  if (local.updatedAt > remote.updatedAt) return 'push';
  return 'none';
}

/** Gleiche Zeichen wie in der Datenbank: ohne 0/O und 1/I/L. */
const FRIEND_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** Macht aus Eingaben wie „ab3 k7q“ einen gültigen Code oder null. */
export function normalizeFriendCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return FRIEND_CODE.test(code) ? code : null;
}

/** Sechsstelliger Login-Code aus der E-Mail. */
export function normalizeLoginCode(input: string): string | null {
  const code = input.replace(/\s/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

export const isEmail = (input: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
