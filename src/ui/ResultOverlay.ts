import { el } from './Hud';
import { t } from '../i18n';

export interface ResultEntry {
  name: string;
  count: number;
  color: string;
}

/** Ergebnis nach dem Tauchgang (bis Meilenstein 4 das begehbare Riff bringt). */
export class ResultOverlay {
  private readonly node: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.node = el('div', 'overlay result');
    this.node.hidden = true;
    root.append(this.node);
  }

  show(titleKey: string, subKey: string | null, entries: readonly ResultEntry[], onAgain: () => void): void {
    const card = el('div', 'card');
    const title = el('div', 'title');
    title.textContent = t(titleKey);
    card.append(title);
    if (subKey) {
      const sub = el('div', 'sub');
      sub.textContent = t(subKey);
      card.append(sub);
    }
    const total = entries.reduce((n, e) => n + e.count, 0);
    const summary = el('div', 'sub');
    summary.textContent = total === 0 ? t('result.none') : total === 1 ? t('result.caughtOne') : t('result.caught', { count: total });
    card.append(summary);
    if (entries.length > 0) {
      const list = el('ul', 'result-list');
      for (const e of entries) {
        const li = el('li', '');
        const dot = el('span', 'dot full');
        dot.style.setProperty('--fish', e.color);
        const label = el('span', '');
        label.textContent = `${e.count}× ${e.name}`;
        li.append(dot, label);
        list.append(li);
      }
      card.append(list);
    }
    const button = el('button', 'button');
    button.type = 'button';
    button.textContent = t('result.again');
    button.addEventListener('click', () => {
      this.node.hidden = true;
      onAgain();
    });
    card.append(button);
    this.node.replaceChildren(card);
    this.node.hidden = false;
  }

  destroy(): void {
    this.node.remove();
  }
}
