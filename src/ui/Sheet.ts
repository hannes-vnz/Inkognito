import { el } from './Hud';

export interface SheetOption {
  label: string;
  /** Farbpunkt vor der Antwort (z. B. Fischfarbe). */
  color?: string;
  onSelect: () => void;
}

/**
 * Untere Karte für Dialoge und Auswahl: hochkant untere Hälfte mit großen Antworten,
 * quer unteres Drittel mit Antworten rechts.
 */
export class Sheet {
  private readonly node: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.node = el('div', 'sheet');
    this.node.hidden = true;
    root.append(this.node);
  }

  get open(): boolean {
    return !this.node.hidden;
  }

  show(title: string, text: string, options: readonly SheetOption[]): void {
    const card = el('div', 'card sheet-card');
    const body = el('div', 'sheet-body');
    const h = el('div', 'sheet-title');
    h.textContent = title;
    const p = el('p', 'sheet-text');
    p.textContent = text;
    body.append(h, p);
    const list = el('div', 'sheet-options');
    for (const o of options) {
      const b = el('button', 'sheet-option');
      b.type = 'button';
      if (o.color) {
        const dot = el('span', 'dot');
        dot.style.setProperty('--fish', o.color);
        b.append(dot);
      }
      const label = el('span', '');
      label.textContent = o.label;
      b.append(label);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        o.onSelect();
      });
      list.append(b);
    }
    card.append(body, list);
    this.node.replaceChildren(card);
    this.node.hidden = false;
  }

  close(): void {
    this.node.hidden = true;
    this.node.replaceChildren();
  }
}
