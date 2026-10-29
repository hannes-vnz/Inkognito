import { el } from './Hud';
import { setRichText, typeRichText } from './rich';

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
  /** Kleiner Zusatz rechts (Preis, Werte). */
  meta?: string;
  onSelect: () => void;
}

/**
 * Untere Karte für Dialoge und Auswahl: hochkant untere Hälfte mit großen Antworten,
 * quer unteres Drittel mit Antworten rechts.
 */
export class Sheet {
  private readonly node: HTMLDivElement;
  private input: HTMLInputElement | null = null;
  private finishTyping: (() => void) | null = null;

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

  /** `portrait`: Bild-URL der sprechenden Figur (Dialog wie bei Dave the Diver). */
  show(title: string, text: string, options: readonly SheetOption[], input?: SheetInput, portrait?: string): void {
    this.finishTyping?.();
    const card = el('div', 'card sheet-card');
    const body = el('div', 'sheet-body');
    if (portrait) {
      const img = el('img', 'sheet-portrait');
      img.src = portrait;
      img.alt = '';
      card.append(img);
    }
    const h = el('div', 'sheet-title');
    h.textContent = title;
    const p = el('p', 'sheet-text');
    body.append(h, p);
    this.node.classList.toggle('dialog', Boolean(portrait));
    if (portrait) {
      // Figur spricht: Text tippt sich, Antippen zeigt alles sofort.
      this.finishTyping = typeRichText(p, text);
      card.addEventListener('pointerdown', () => this.finishTyping?.());
    } else {
      this.finishTyping = null;
      setRichText(p, text);
    }
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
      if (o.meta) {
        const meta = el('span', 'meta');
        meta.textContent = o.meta;
        b.append(meta);
      }
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
    this.finishTyping?.();
    const p = this.node.querySelector<HTMLElement>('.sheet-text');
    if (p) setRichText(p, text);
  }

  close(): void {
    this.finishTyping?.();
    this.finishTyping = null;
    this.input = null;
    this.node.hidden = true;
    this.node.replaceChildren();
  }
}
