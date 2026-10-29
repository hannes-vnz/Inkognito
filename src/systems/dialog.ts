export interface DialogOption {
  textKey: string;
  next: string | null;
}

/** Was nach dem Text passiert: Wunschfisch, Quiz, Seemannsgarn oder ein Möwen-Spruch. */
export type DialogAction = { type: 'showRequest' } | { type: 'startQuiz' } | { type: 'legendHint' } | { type: 'gag' } | { type: 'showBaits' };

/** Weiterleitung abhängig von gesehenen Story-Momenten; die erste passende gewinnt. */
export interface DialogRedirect {
  seen?: string;
  notSeen?: string;
  to: string;
}

export interface DialogNode {
  textKey: string;
  options?: DialogOption[];
  action?: DialogAction;
  redirect?: DialogRedirect[];
  /** Gesichtsausdruck im Porträt (sonst aus der Reaktions-Stimmung abgeleitet). */
  face?: Face;
  /** Kurze Reaktions-Szene, bevor der Text erscheint (Hintergrund und Stimmung). */
  reaction?: { background: 'waves' | 'burst' | 'sparkle'; mood: 'shock' | 'joy' | 'smug' };
}

export type Dialog = Record<string, DialogNode>;

export type Face = 'normal' | 'happy' | 'annoyed' | 'shock';

/** Ausdruck eines Knotens: ausdrücklich gesetzt oder passend zur Reaktion. */
export const faceOf = (node: DialogNode): Face =>
  node.face ?? (node.reaction ? ({ shock: 'shock', joy: 'happy', smug: 'annoyed' } as const)[node.reaction.mood] : 'normal');

export type NpcPlace = 'pier' | 'bench' | 'stall' | 'roof' | 'water' | 'promenade';

export interface NpcDef {
  id: string;
  nameKey: string;
  sprite: string;
  frame: { width: number; height: number };
  animations: { key: string; row: number; frames: number; fps: number; repeat: number }[];
  placeholderColor: string;
  place: NpcPlace;
  dialog: Dialog;
}

const BYE: DialogOption = { textKey: 'npc.bye', next: null };

function matches(r: DialogRedirect, seen: readonly string[]): boolean {
  if (r.seen !== undefined && !seen.includes(r.seen)) return false;
  if (r.notSeen !== undefined && seen.includes(r.notSeen)) return false;
  return true;
}

/**
 * Knoten mit mindestens einer Antwort (sonst „Tschüss“), Weiterleitungen aufgelöst.
 * Knoten mit Aktion brauchen keine Antworten, die Aktion übernimmt.
 */
export function dialogNode(dialog: Dialog, id: string, seen: readonly string[] = []): DialogNode & { id: string; options: DialogOption[] } {
  let node = dialog[id];
  for (let hops = 0; node?.redirect && hops < 8; hops++) {
    const hit = node.redirect.find((r) => matches(r, seen));
    if (!hit) break;
    id = hit.to;
    node = dialog[id];
  }
  if (!node) throw new Error(`Dialog-Knoten "${id}" fehlt`);
  const options = node.options && node.options.length > 0 ? node.options : node.action ? [] : [BYE];
  return { ...node, id, options };
}

/** Prüft, dass alle Verweise im Dialog auf existierende Knoten zeigen. */
export function validateDialog(dialog: Dialog): string[] {
  const errors: string[] = [];
  if (!dialog.start) errors.push('start fehlt');
  for (const [id, node] of Object.entries(dialog)) {
    for (const o of node.options ?? []) if (o.next !== null && !dialog[o.next]) errors.push(`${id} → ${o.next}`);
    for (const r of node.redirect ?? []) if (!dialog[r.to]) errors.push(`${id} ⇒ ${r.to}`);
  }
  return errors;
}

/** Alle Textschlüssel eines Dialogs (für die Datenprüfung). */
export function dialogTextKeys(dialog: Dialog): string[] {
  return Object.values(dialog).flatMap((n) => [n.textKey, ...(n.options ?? []).map((o) => o.textKey)]);
}
