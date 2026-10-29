import { t } from '../i18n';
import { Toast } from './Toast';

/** Flache DOM-Oberfläche über dem Canvas: scharf auf jedem Display, Safe Areas per CSS. */
export class Hud {
  private readonly depthValue: HTMLDivElement;
  private readonly depthLabel: HTMLDivElement;
  private readonly fps: HTMLDivElement | null;
  private readonly hint: HTMLDivElement;
  private readonly carry: HTMLDivElement;
  private readonly oxygen: HTMLDivElement;
  private lastOxygen = -1;
  private readonly toast: Toast;
  private lastDepth = -1;
  private lastCarry = '';

  constructor(
    private readonly root: HTMLElement,
    zoneNameKey: string,
    debug: boolean,
  ) {
    const depth = el('div', 'card hud-depth');
    this.oxygen = el('div', 'o2-ring');
    this.oxygen.setAttribute('aria-label', t('hud.oxygen'));
    this.depthLabel = el('div', 'label');
    this.depthLabel.textContent = t(zoneNameKey);
    this.depthValue = el('div', 'value');
    this.carry = el('div', 'carry');
    this.carry.setAttribute('aria-label', t('hud.carry'));
    depth.append(this.oxygen, this.depthLabel, this.depthValue, this.carry);
    root.append(depth);

    this.toast = new Toast(root);

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

  /** Luft-Ring wie bei Dave the Diver: Anteil als Ring, Restsekunden in der Mitte, pulsiert rot, wenn es knapp wird. */
  setOxygen(ratio: number, low: boolean, seconds: number): void {
    const r = Math.round(ratio * 200) / 200;
    const secs = Math.ceil(seconds);
    if (r === this.lastOxygen && this.oxygen.dataset.value === String(secs)) return;
    this.lastOxygen = r;
    this.oxygen.style.setProperty('--o2', String(r));
    this.oxygen.dataset.value = String(secs);
    this.oxygen.classList.toggle('low', low);
  }

  /** Blasen-Leiste unter der Tiefe: ein Punkt pro Platz, gefüllt in der Farbe des Fangs. */
  setCarry(colors: readonly string[], capacity: number): void {
    const key = `${colors.join(',')}/${capacity}`;
    if (key === this.lastCarry) return;
    this.lastCarry = key;
    this.carry.replaceChildren(
      ...Array.from({ length: capacity }, (_, i) => {
        const dot = el('span', colors[i] ? 'dot full' : 'dot');
        if (colors[i]) dot.style.setProperty('--fish', colors[i]!);
        return dot;
      }),
    );
  }

  /** Kurzer Einzeiler oben (z. B. Kommentare der Arme). */
  say(text: string, seconds = 2.2): void {
    this.toast.say(text, seconds);
  }

  setFps(fps: number): void {
    if (this.fps) this.fps.textContent = t('hud.fps', { fps: Math.round(fps) });
  }

  /** Zeigt den Steuerungshinweis über einer Bildschirmposition (CSS-Pixel). */
  showHint(textKey: string, bottomY: number): void {
    const text = t(textKey);
    if (this.hint.textContent === text && !this.hint.classList.contains('hidden')) return;
    this.hint.textContent = text;
    this.hint.style.top = `${bottomY}px`;
    this.hint.classList.remove('hidden');
  }

  hideHint(): void {
    this.hint.classList.add('hidden');
  }

  destroy(): void {
    this.toast.destroy();
    this.root.replaceChildren();
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
