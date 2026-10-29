import { t } from '../i18n';

/** Flache DOM-Oberfläche über dem Canvas: scharf auf jedem Display, Safe Areas per CSS. */
export class Hud {
  private readonly depthValue: HTMLDivElement;
  private readonly depthLabel: HTMLDivElement;
  private readonly fps: HTMLDivElement | null;
  private readonly hint: HTMLDivElement;
  private lastDepth = -1;

  constructor(
    private readonly root: HTMLElement,
    zoneNameKey: string,
    debug: boolean,
  ) {
    const depth = el('div', 'card hud-depth');
    this.depthLabel = el('div', 'label');
    this.depthLabel.textContent = `${t(zoneNameKey)} · ${t('hud.depthLabel')}`;
    this.depthValue = el('div', 'value');
    depth.append(this.depthLabel, this.depthValue);
    root.append(depth);

    this.fps = debug ? el('div', 'card hud-fps') : null;
    if (this.fps) root.append(this.fps);

    this.hint = el('div', 'card hint');
    root.append(this.hint);
  }

  setDepth(meters: number): void {
    const rounded = Math.round(meters);
    if (rounded === this.lastDepth) return;
    this.lastDepth = rounded;
    this.depthValue.textContent = t('hud.depth', { depth: rounded });
  }

  setFps(fps: number): void {
    if (this.fps) this.fps.textContent = t('hud.fps', { fps: Math.round(fps) });
  }

  /** Zeigt den Steuerungshinweis über einer Bildschirmposition (CSS-Pixel). */
  showHint(textKey: string, bottomY: number): void {
    this.hint.textContent = t(textKey);
    this.hint.style.top = `${bottomY}px`;
    this.hint.classList.remove('hidden');
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }

  destroy(): void {
    this.root.replaceChildren();
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
