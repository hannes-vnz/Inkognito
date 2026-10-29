import { el } from './Hud';
import { t } from '../i18n';

export class PauseOverlay {
  private readonly node: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private onResume: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.node = el('div', 'overlay');
    this.node.hidden = true;
    const card = el('div', 'card');
    this.title = el('div', 'title');
    const sub = el('div', 'sub');
    sub.textContent = t('ui.tapToContinue');
    card.append(this.title, sub);
    this.node.append(card);
    this.node.addEventListener('pointerup', (e) => {
      e.preventDefault();
      this.hide();
      this.onResume?.();
    });
    root.append(this.node);
  }

  show(titleKey: string, onResume: () => void): void {
    this.title.textContent = t(titleKey);
    this.onResume = onResume;
    this.node.hidden = false;
  }

  hide(): void {
    this.node.hidden = true;
  }

  get visible(): boolean {
    return !this.node.hidden;
  }
}
