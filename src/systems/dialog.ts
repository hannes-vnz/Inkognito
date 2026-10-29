export interface DialogOption {
  textKey: string;
  next: string | null;
}

export type DialogAction = { type: 'startQuest'; quest: string } | { type: 'openShop' };

/** Weiterleitung abhängig vom Auftragsstand; die erste passende gewinnt. */
export interface DialogRedirect {
  questDone?: string;
  questActive?: string;
  to: string;
}

export interface DialogNode {
  textKey: string;
  options?: DialogOption[];
  action?: DialogAction;
  redirect?: DialogRedirect[];
}

export type Dialog = Record<string, DialogNode>;

export interface NpcDef {
  id: string;
  nameKey: string;
  sprite: string;
  frame: { width: number; height: number };
  placeholderColor: string;
  /** Platz auf einem Podest im Riff; `layer` 0 = vorn. */
  podest: { x: number; y: number; layer: number };
  /** Leer = von Anfang an da, sonst nach erledigtem Auftrag. */
  unlock: { questDone?: string };
  dialog: Dialog;
}

export interface QuestState {
  active: readonly string[];
  done: readonly string[];
}

const BYE: DialogOption = { textKey: 'riff.close', next: null };

function matches(r: DialogRedirect, q: QuestState): boolean {
  if (r.questDone !== undefined && !q.done.includes(r.questDone)) return false;
  if (r.questActive !== undefined && !q.active.includes(r.questActive)) return false;
  return true;
}

/**
 * Knoten mit mindestens einer Antwort (sonst „Schließen“), Weiterleitungen nach Auftragsstand aufgelöst.
 * Knoten mit `openShop` brauchen keine Antworten.
 */
export function dialogNode(dialog: Dialog, id: string, quests: QuestState = { active: [], done: [] }): DialogNode & { id: string; options: DialogOption[] } {
  let node = dialog[id];
  for (let hops = 0; node?.redirect && hops < 8; hops++) {
    const hit = node.redirect.find((r) => matches(r, quests));
    if (!hit) break;
    id = hit.to;
    node = dialog[id];
  }
  if (!node) throw new Error(`Dialog-Knoten "${id}" fehlt`);
  return { ...node, id, options: node.options && node.options.length > 0 ? node.options : [BYE] };
}

export const npcUnlocked = (npc: NpcDef, quests: QuestState): boolean =>
  npc.unlock.questDone === undefined || quests.done.includes(npc.unlock.questDone);

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
