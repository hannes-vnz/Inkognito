import { el } from './Hud';
import { Toast } from './Toast';
import { t } from '../i18n';

const iconImg = (name: string): HTMLImageElement => {
  const img = el('img', 'icon');
  img.src = `sprites/${name}.png`;
  img.alt = '';
  return img;
};

/**
 * Oberfläche im Riff: Fische und Futter oben links, Muscheln oben rechts,
 * großer Tauchen-Knopf unten rechts, aufsteigende Zahlen bei Erträgen.
 */
export class RiffHud {
  private readonly shells: HTMLDivElement;
  private readonly fishCount: HTMLSpanElement;
  private readonly food: HTMLSpanElement;
  private readonly foodRow: HTMLDivElement;
  private readonly holding: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private readonly toast: Toast;
  private readonly hint: HTMLDivElement;
  private onAction: (() => void) | null = null;
  private lastShells = -1;
  private lastHolding = '';

  constructor(private readonly root: HTMLElement) {
    const left = el('div', 'card hud-riff');
    const fishRow = el('div', 'stat-row');
    this.fishCount = el('span', '');
    fishRow.append(iconImg('icon_fish'), this.fishCount);
    this.foodRow = el('div', 'stat-row');
    this.food = el('span', '');
    this.foodRow.append(iconImg('icon_food'), this.food);
    this.holding = el('div', 'carry');
    left.append(fishRow, this.foodRow, this.holding);
    left.setAttribute('aria-label', `${t('hud.fishCount', { count: '', capacity: '' })}`);

    const right = el('div', 'card hud-shells');
    right.setAttribute('aria-label', t('hud.shells'));
    this.shells = el('div', 'value');
    right.append(iconImg('icon_shell'), this.shells);

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

  setColony(fish: number, capacity: number, food: number): void {
    this.fishCount.textContent = `${fish}/${capacity}`;
    this.food.textContent = String(food);
    this.foodRow.classList.toggle('warn', food <= 0 && fish > 0);
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

  setAction(label: string | null, onAction: (() => void) | null): void {
    this.onAction = onAction;
    this.action.hidden = label === null;
    if (label !== null && this.action.textContent !== label) this.action.textContent = label;
  }

  /** Aufsteigende Zahl an einer Bildschirmposition, z. B. „+3“ über der Muschelbank. */
  floater(text: string, x: number, y: number, color?: string): void {
    const f = el('div', 'floater');
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    if (color) f.style.color = color;
    this.root.append(f);
    window.setTimeout(() => f.remove(), 1300);
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
