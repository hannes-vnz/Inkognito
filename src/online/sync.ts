import { currentUser, fetchRemoteSave, pushSave } from './cloud';
import { decideSync, type SyncDecision } from '../systems/sync';
import type { Save } from '../systems/save';
import { loadSave, writeFreshAndLock, writeSave } from '../storage';
import { newSave } from '../systems/save';

export interface SyncResult {
  decision: SyncDecision | 'offline' | 'loggedOut';
  save: Save;
}

/**
 * Gleicht den lokalen Stand mit Supabase ab (neuerer gewinnt). Fehler (kein Netz) lassen
 * den lokalen Stand unangetastet, gespielt wird dann mit dem lokalen Cache weiter.
 */
export async function syncNow(): Promise<SyncResult> {
  const local = loadSave();
  const user = await currentUser().catch(() => null);
  if (!user) return { decision: 'loggedOut', save: local };
  try {
    const remote = await fetchRemoteSave(user.id);
    const decision = decideSync(local, remote);
    if (decision === 'pull' && remote) {
      writeSave(remote.save);
      return { decision, save: remote.save };
    }
    if (decision === 'push') await pushSave(user.id, local);
    return { decision, save: local };
  } catch {
    return { decision: 'offline', save: local };
  }
}

/**
 * Ganz von vorn: frischer Stand lokal und, falls eingeloggt, auch online (sonst käme der alte
 * Stand beim nächsten Abgleich zurück). Danach lädt die Seite neu.
 */
export async function resetProgress(): Promise<void> {
  const fresh = newSave(Date.now());
  writeFreshAndLock(fresh);
  const user = await currentUser().catch(() => null);
  if (user) await pushSave(user.id, fresh).catch(() => undefined);
  window.location.reload();
}

/** Beim Schließen oder in den Hintergrund: lokalen Stand hochladen (ohne zu warten). */
export function pushOnHide(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    void syncNow();
  });
}
