import { el, iconImg } from './dom';
import { setRichText } from './rich';
import { t } from '../i18n';

/** Ein Reiter im Shop: wer spricht, was er sagt, und wie der Inhalt gezeichnet wird. */
export interface ShopTab {
  id: string;
  label: string;
  portrait?: string;
  quote: string;
  render: (body: HTMLElement) => void;
}

/**
 * Shop als eigener Bildschirm (Vorbild: Werkstätten und Läden in Dave the Diver, Upgrade-Karten in Tiny Fishing):
 * oben die Figur mit Sprechblase und die Münzen, darunter Reiter, darunter Karten mit großem Kaufknopf.
 * Bleibt offen, bis man ihn schließt; nach jedem Kauf wird neu gezeichnet.
 */
export class Shop {
  private readonly node: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly tabsEl: HTMLDivElement;
  private readonly quote: HTMLDivElement;
  private readonly portrait: HTMLImageElement;
  private readonly coinsEl: HTMLSpanElement;
  private active = '';

  constructor(
    root: HTMLElement,
    private readonly tabs: readonly ShopTab[],
    private readonly coins: () => number,
    private readonly onClose: () => void,
  ) {
    this.node = el('div', 'overlay shop');
    const panel = el('div', 'shop-panel');
    const head = el('div', 'shop-head');
    this.portrait = el('img', 'shop-portrait');
    this.portrait.alt = '';
    this.quote = el('div', 'shop-quote');
    const coinChip = el('div', 'shop-coins');
    this.coinsEl = el('span', '');
    coinChip.append(iconImg('icon_coin'), this.coinsEl);
    const close = el('button', 'shop-close');
    close.type = 'button';
    close.textContent = '✕';
    close.setAttribute('aria-label', t('shop.close'));
    close.addEventListener('click', () => this.close());
    const side = el('div', 'shop-side');
    side.append(close, coinChip);
    head.append(this.portrait, this.quote, side);
    this.tabsEl = el('div', 'shop-tabs');
    this.body = el('div', 'shop-body');
    panel.append(head, this.tabsEl, this.body);
    this.node.append(panel);
    this.node.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.append(this.node);
  }

  show(id: string): void {
    const tab = this.tabs.find((x) => x.id === id) ?? this.tabs[0]!;
    this.active = tab.id;
    this.tabsEl.replaceChildren(
      ...this.tabs.map((x) => {
        const b = el('button', `shop-tab${x.id === tab.id ? ' active' : ''}`);
        b.type = 'button';
        b.textContent = x.label;
        b.addEventListener('click', () => this.show(x.id));
        return b;
      }),
    );
    this.tabsEl.hidden = this.tabs.length < 2;
    this.portrait.hidden = !tab.portrait;
    if (tab.portrait) this.portrait.src = tab.portrait;
    setRichText(this.quote, tab.quote);
    this.body.scrollTop = 0;
    this.refresh();
  }

  /** Inhalt und Münzen neu zeichnen (nach Kauf oder Verkauf). */
  refresh(): void {
    this.coinsEl.textContent = Math.floor(this.coins()).toLocaleString('de-DE');
    const tab = this.tabs.find((x) => x.id === this.active);
    if (!tab) return;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    tab.render(this.body);
    this.body.scrollTop = scroll;
  }

  /** Sprechblase kurz austauschen (z. B. „Zu teuer!“). */
  say(text: string): void {
    setRichText(this.quote, text);
    this.quote.classList.remove('pop');
    void this.quote.offsetWidth;
    this.quote.classList.add('pop');
  }

  close(): void {
    this.node.remove();
    this.onClose();
  }
}

export interface ShopCardOptions {
  /** Name einer Grafik in sprites/ oder eine fertige Bild-URL (data:…). */
  icon: string;
  title: string;
  /** Stufe als Balken (aktuelle Stufe ab 1, Höchststufe). */
  level?: { now: number; max: number };
  /** Text unter dem Titel (Hervorhebungen mit *Sternchen*). */
  lines: string[];
  /** Knopf: buy = kaufen (Preis), poor = zu teuer, done = fertig/eingebaut, plain = Text ohne Preis. */
  action: { state: 'buy' | 'poor' | 'done' | 'plain'; label?: string; cost?: number };
  big?: boolean;
  onClick?: () => void;
}

/** Karte mit Symbol, Titel, Stufen-Balken, Wirkung und großem Knopf. */
export function shopCard(o: ShopCardOptions): HTMLElement {
  const card = el('div', `shop-card${o.big ? ' big' : ''}`);
  const icon = el('div', 'shop-icon');
  if (o.icon.startsWith('data:')) {
    const img = el('img', 'icon');
    img.src = o.icon;
    img.alt = '';
    icon.append(img);
  } else icon.append(iconImg(o.icon));
  const main = el('div', 'shop-main');
  const title = el('div', 'shop-title');
  title.textContent = o.title;
  main.append(title);
  if (o.level) {
    const pips = el('div', 'shop-pips');
    const shown = Math.min(o.level.max, 10);
    const filled = Math.round((o.level.now / o.level.max) * shown);
    for (let i = 0; i < shown; i++) pips.append(el('span', i < filled ? 'on' : ''));
    const lv = el('span', 'shop-lv');
    lv.textContent = t('shop.level', { now: o.level.now, max: o.level.max });
    pips.append(lv);
    main.append(pips);
  }
  for (const line of o.lines) {
    const p = el('div', 'shop-line');
    setRichText(p, line);
    main.append(p);
  }
  const btn = el('button', `shop-buy ${o.action.state}`);
  btn.type = 'button';
  if (o.action.cost !== undefined && (o.action.state === 'buy' || o.action.state === 'poor')) {
    btn.append(iconImg('icon_coin'));
    const c = el('span', '');
    c.textContent = o.action.cost.toLocaleString('de-DE');
    btn.append(c);
  } else btn.textContent = o.action.label ?? '';
  btn.disabled = o.action.state === 'done';
  if (o.onClick) btn.addEventListener('click', o.onClick);
  card.append(icon, main, btn);
  return card;
}

/** Zwischenüberschrift im Shop. */
export function shopHeading(text: string): HTMLElement {
  const h = el('div', 'shop-heading');
  h.textContent = text;
  return h;
}
