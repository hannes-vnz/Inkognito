export interface DialogOption {
  textKey: string;
  next: string | null;
}

export interface DialogAction {
  type: 'startQuest';
  quest: string;
}

export interface DialogNode {
  textKey: string;
  options?: DialogOption[];
  action?: DialogAction;
  /** Springt zu einem anderen Knoten, wenn ein Auftrag schon erledigt ist. */
  redirect?: { questDone: string; to: string };
}

export type Dialog = Record<string, DialogNode>;

export interface NpcDef {
  id: string;
  nameKey: string;
  sprite: string;
  frame: { width: number; height: number };
  placeholderColor: string;
  unlock: { residentsAtLeast: number };
  dialog: Dialog;
}

const BYE: DialogOption = { textKey: 'riff.close', next: null };

/**
 * Knoten mit mindestens einer Antwort; ohne Antworten gibt es „Schließen“.
 * Folgt Weiterleitungen für bereits erledigte Aufträge.
 */
export function dialogNode(dialog: Dialog, id: string, doneQuests: readonly string[] = []): DialogNode & { id: string; options: DialogOption[] } {
  let node = dialog[id];
  for (let hops = 0; node?.redirect && doneQuests.includes(node.redirect.questDone) && hops < 8; hops++) {
    id = node.redirect.to;
    node = dialog[id];
  }
  if (!node) throw new Error(`Dialog-Knoten "${id}" fehlt`);
  return { ...node, id, options: node.options && node.options.length > 0 ? node.options : [BYE] };
}

/** Prüft, dass alle Verweise im Dialog auf existierende Knoten zeigen. */
export function validateDialog(dialog: Dialog): string[] {
  const errors: string[] = [];
  if (!dialog.start) errors.push('start fehlt');
  for (const [id, node] of Object.entries(dialog)) {
    for (const o of node.options ?? []) if (o.next !== null && !dialog[o.next]) errors.push(`${id} → ${o.next}`);
    if (node.redirect && !dialog[node.redirect.to]) errors.push(`${id} ⇒ ${node.redirect.to}`);
  }
  return errors;
}
