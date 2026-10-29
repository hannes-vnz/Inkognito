import { el } from './Hud';
import { setRichText } from './rich';

/** Einzeiler oben mittig, blendet sich selbst aus. */
export class Toast {
  private readonly node: HTMLDivElement;
  private timer = 0;

  constructor(root: HTMLElement) {
    this.node = el('div', 'card toast hidden');
    root.append(this.node);
  }

  say(text: string, seconds = 2.2): void {
    setRichText(this.node, text);
    this.node.classList.remove('hidden');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.node.classList.add('hidden'), seconds * 1000);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    this.node.remove();
  }
}
