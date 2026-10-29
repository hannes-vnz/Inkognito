import { el } from './Hud';
import { Toast } from './Toast';
import { t } from '../i18n';

/** Oberfläche im Riff: Riffname und wartende Fische oben links, Muscheln oben rechts, Aktionsknopf unten rechts. */
export class RiffHud {
  private readonly shells: HTMLDivElement;
  private readonly holding: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private readonly toast: Toast;
  private readonly hint: HTMLDivElement;
  private onAction: (() => void) | null = null;
  private lastShells = -1;
  private lastHolding = '';
  private lastAction = '';

  constructor(
    private readonly root: HTMLElement,
    titleKey: string,
  ) {
    const left = el('div', 'card hud-depth');
    const label = el('div', 'label');
    label.textContent = t(titleKey);
    const sub = el('div', 'sub-label');
    sub.textContent = t('riff.holding');
    this.holding = el('div', 'carry');
    left.append(label, sub, this.holding);

    const right = el('div', 'card hud-shells');
    const sl = el('div', 'label');
    sl.textContent = t('hud.shells');
    this.shells = el('div', 'value');
    right.append(sl, this.shells);

    this.action = el('button', 'action-button');
    this.action.type = 'button';
    this.action.hidden = true;
    this.action.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onAction?.();
    });
    this.hint = el('div', 'card hint');
    root.append(left, right, this.action, this.hint);
    this.toast = new Toast(root);
  }

  setShells(n: number, bump = false): void {
    if (n === this.lastShells) return;
    this.lastShells = n;
    this.shells.textContent = String(n);
    if (bump) {
      this.shells.classList.remove('bump');
      void this.shells.offsetWidth;
      this.shells.classList.add('bump');
    }
  }

  setHolding(colors: readonly string[], capacity: number): void {
    const key = `${colors.join(',')}/${capacity}`;
    if (key === this.lastHolding) return;
    this.lastHolding = key;
    this.holding.replaceChildren(
      ...Array.from({ length: capacity }, (_, i) => {
        const dot = el('span', colors[i] ? 'dot full' : 'dot');
        if (colors[i]) dot.style.setProperty('--fish', colors[i]!);
        return dot;
      }),
    );
  }

  /** Zeigt den Aktionsknopf (z. B. „Reden“) oder blendet ihn mit `null` aus. */
  setAction(label: string | null, onAction: (() => void) | null): void {
    this.onAction = onAction;
    if (label === this.lastAction) return;
    this.lastAction = label ?? '';
    this.action.hidden = label === null;
    this.action.textContent = label ?? '';
  }

  showHint(text: string, top: number): void {
    this.hint.textContent = text;
    this.hint.style.top = `${top}px`;
    this.hint.classList.remove('hidden');
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }

  say(text: string, seconds?: number): void {
    this.toast.say(text, seconds);
  }

  destroy(): void {
    this.toast.destroy();
    this.root.replaceChildren();
  }
}
