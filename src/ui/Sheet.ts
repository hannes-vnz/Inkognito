import { el } from './Hud';

export interface SheetInput {
  id: string;
  type: 'email' | 'text';
  placeholder: string;
  inputMode?: 'email' | 'numeric' | 'text';
  autocomplete?: string;
  maxLength?: number;
  value?: string;
}

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
  private input: HTMLInputElement | null = null;

  constructor(root: HTMLElement) {
    this.node = el('div', 'sheet');
    this.node.hidden = true;
    root.append(this.node);
  }

  get open(): boolean {
    return !this.node.hidden;
  }

  /** Inhalt des Eingabefelds der aktuellen Karte. */
  get inputValue(): string {
    return this.input?.value ?? '';
  }

  show(title: string, text: string, options: readonly SheetOption[], input?: SheetInput): void {
    const card = el('div', 'card sheet-card');
    const body = el('div', 'sheet-body');
    const h = el('div', 'sheet-title');
    h.textContent = title;
    const p = el('p', 'sheet-text');
    p.textContent = text;
    body.append(h, p);
    this.input = null;
    if (input) {
      const field = el('input', 'sheet-input');
      field.id = input.id;
      field.type = input.type;
      field.placeholder = input.placeholder;
      field.value = input.value ?? '';
      if (input.inputMode) field.inputMode = input.inputMode;
      if (input.autocomplete) field.autocomplete = input.autocomplete as AutoFill;
      if (input.maxLength) field.maxLength = input.maxLength;
      field.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') options[0]?.onSelect();
      });
      body.append(field);
      this.input = field;
    }
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

  /** Nur den Text der offenen Karte ändern (z. B. „Einen Moment …“ oder Fehler). */
  setText(text: string): void {
    const p = this.node.querySelector('.sheet-text');
    if (p) p.textContent = text;
  }

  close(): void {
    this.input = null;
    this.node.hidden = true;
    this.node.replaceChildren();
  }
}
