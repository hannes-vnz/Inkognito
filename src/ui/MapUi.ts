import { el, iconImg } from './dom';
import { Toast } from './Toast';
import { setRichText } from './rich';
import { t } from '../i18n';
import { isMaxed, upgradeCost, type UpgradeDef } from '../systems/economy';
import type { SpotDef } from '../systems/seaMap';
import type { Save } from '../systems/save';

/** Ein Ziel in der Liste der Seekarte. */
export interface Destination {
  id: string;
  name: string;
  desc: string;
  /** here = Boot liegt hier, open = anfahrbar, locked = Motor zu schwach. */
  state: 'here' | 'open' | 'locked';
  badge?: string;
}

/**
 * Oberfläche der Seekarte: Münzen, Zurück, unten die Zielliste (antippen, der Kutter fährt von allein)
 * und die Motor-Karte (Reichweite = neue Plätze).
 */
export class MapUi {
  private readonly coins: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly engine: HTMLButtonElement;
  private readonly engineLevel: HTMLSpanElement;
  private readonly engineEffect: HTMLSpanElement;
  private readonly engineCost: HTMLSpanElement;
  private readonly prestige: HTMLButtonElement;
  private readonly toast: Toast;
  private lastCoins = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly engineDef: UpgradeDef,
    private readonly handlers: { back: () => void; pick: (id: string) => void; buyEngine: () => void; prestige: () => void },
  ) {
    const coinCard = el('div', 'card hud-coins');
    this.coins = el('div', 'value');
    coinCard.append(iconImg('icon_coin'), this.coins);

    const back = el('button', 'button map-back');
    back.type = 'button';
    back.textContent = t('map.back');
    back.addEventListener('click', handlers.back);

    const panel = el('div', 'map-panel');
    this.list = el('div', 'card map-list');

    this.engine = el('button', 'upgrade map-engine');
    this.engine.type = 'button';
    const name = el('span', 'upgrade-name');
    name.textContent = t(engineDef.nameKey);
    this.engineLevel = el('span', 'upgrade-level');
    this.engineEffect = el('span', 'upgrade-effect');
    this.engineCost = el('span', 'upgrade-cost');
    this.engine.append(name, this.engineLevel, this.engineEffect, this.engineCost);
    this.engine.addEventListener('click', handlers.buyEngine);
    panel.append(this.list, this.engine);

    this.prestige = el('button', 'button map-prestige');
    this.prestige.type = 'button';
    this.prestige.addEventListener('click', handlers.prestige);

    root.append(coinCard, back, this.prestige, panel);
    this.toast = new Toast(root);
  }

  /** `nextSpot`: der Platz, den die nächste Motorstufe freischaltet. */
  update(save: Save, nextSpot: SpotDef | null): void {
    const coins = Math.floor(save.coins);
    if (coins !== this.lastCoins) {
      this.coins.textContent = coins.toLocaleString('de-DE');
      if (this.lastCoins >= 0) {
        this.coins.classList.remove('bump');
        void this.coins.offsetWidth;
        this.coins.classList.add('bump');
      }
      this.lastCoins = coins;
    }
    const level = save.upgrades.engine;
    const maxed = isMaxed(this.engineDef, level);
    const cost = upgradeCost(this.engineDef, level);
    this.engineLevel.textContent = `Lv ${level + 1}`;
    this.engineEffect.textContent = maxed || !nextSpot ? t('upgrade.max') : t('map.engine.next', { name: t(nextSpot.nameKey) });
    this.engineCost.textContent = maxed ? t('upgrade.max') : cost.toLocaleString('de-DE');
    this.engine.disabled = maxed || coins < cost;
    this.engine.classList.toggle('ready', !maxed && coins >= cost);
  }

  /** Fortschritt zum nächsten Meer; leuchtet, sobald man weiterziehen kann. */
  showPrestige(progress: { known: number; need: number; nextName: string; legend: string | null } | null, ready: boolean): void {
    this.prestige.hidden = !progress;
    if (!progress) return;
    this.prestige.textContent = ready
      ? t('prestige.button', { sea: progress.nextName })
      : progress.known >= progress.need && progress.legend
        ? t('prestige.legend', { legend: progress.legend })
        : t('prestige.progress', { known: progress.known, need: progress.need });
    this.prestige.disabled = !ready;
    this.prestige.classList.toggle('primary', ready);
    this.prestige.classList.toggle('ready', ready);
  }

  /** Zielliste in Abschnitten (Heimathafen, Meer, nächstes Meer). `focus`: dieses Ziel leuchtet (Tutorial). */
  showDestinations(sections: readonly { title: string; items: readonly Destination[]; note?: string }[], focus: string | null = null): void {
    this.list.replaceChildren();
    for (const sec of sections) {
      const head = el('div', 'map-list-title');
      head.textContent = sec.title;
      this.list.append(head);
      for (const d of sec.items) {
        const b = el('button', `map-dest ${d.state}${d.id === focus ? ' tut-focus' : ''}`);
        b.type = 'button';
        const name = el('span', 'map-dest-name');
        name.textContent = d.state === 'here' ? `${d.name} ✓` : d.name;
        const desc = el('span', 'map-dest-desc');
        setRichText(desc, d.desc);
        b.append(name, desc);
        if (d.badge) {
          const badge = el('span', 'map-dest-badge');
          badge.textContent = d.badge;
          b.append(badge);
        }
        b.addEventListener('click', () => this.handlers.pick(d.id));
        this.list.append(b);
      }
      if (sec.note) {
        const note = el('p', 'map-list-note');
        setRichText(note, sec.note);
        this.list.append(note);
      }
    }
    if (focus) this.list.querySelector('.tut-focus')?.scrollIntoView({ block: 'nearest' });
  }

  /** Während der Fahrt: Liste gesperrt. */
  setTravelling(on: boolean): void {
    this.list.classList.toggle('travelling', on);
  }

  say(text: string, seconds?: number): void {
    this.toast.say(text, seconds);
  }

  floater(text: string, x: number, y: number, color?: string): void {
    const f = el('div', 'floater');
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    if (color) f.style.color = color;
    this.root.append(f);
    window.setTimeout(() => f.remove(), 1300);
  }

  destroy(): void {
    this.toast.destroy();
    this.root.replaceChildren();
  }
}
