import { el, iconImg } from './dom';
import { Toast } from './Toast';
import { setRichText } from './rich';
import { t } from '../i18n';
import { isMaxed, upgradeCost, type UpgradeDef } from '../systems/economy';
import type { SpotDef } from '../systems/seaMap';
import type { Save } from '../systems/save';

/**
 * Oberfläche der Seekarte: Münzen, Zurück, unten der Platz unter dem Boot mit „Hier angeln“
 * und die Motor-Karte (Reichweite = neue Plätze).
 */
export class MapUi {
  private readonly coins: HTMLDivElement;
  private readonly spotCard: HTMLDivElement;
  private readonly spotName: HTMLDivElement;
  private readonly spotDesc: HTMLParagraphElement;
  private readonly fishButton: HTMLButtonElement;
  private readonly engine: HTMLButtonElement;
  private readonly engineLevel: HTMLSpanElement;
  private readonly engineEffect: HTMLSpanElement;
  private readonly engineCost: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly toast: Toast;
  private lastCoins = -1;
  private shownSpot: string | null | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly engineDef: UpgradeDef,
    handlers: { back: () => void; fish: () => void; buyEngine: () => void },
  ) {
    const coinCard = el('div', 'card hud-coins');
    this.coins = el('div', 'value');
    coinCard.append(iconImg('icon_coin'), this.coins);

    const back = el('button', 'button map-back');
    back.type = 'button';
    back.textContent = t('map.back');
    back.addEventListener('click', handlers.back);

    const panel = el('div', 'map-panel');
    this.spotCard = el('div', 'card map-spot');
    this.spotName = el('div', 'map-spot-name');
    this.spotDesc = el('p', 'map-spot-desc');
    this.fishButton = el('button', 'button primary');
    this.fishButton.type = 'button';
    this.fishButton.textContent = t('map.fish');
    this.fishButton.addEventListener('click', handlers.fish);
    this.spotCard.append(this.spotName, this.spotDesc, this.fishButton);

    this.engine = el('button', 'upgrade map-engine');
    this.engine.type = 'button';
    const name = el('span', 'upgrade-name');
    name.textContent = t(engineDef.nameKey);
    this.engineLevel = el('span', 'upgrade-level');
    this.engineEffect = el('span', 'upgrade-effect');
    this.engineCost = el('span', 'upgrade-cost');
    this.engine.append(name, this.engineLevel, this.engineEffect, this.engineCost);
    this.engine.addEventListener('click', handlers.buyEngine);
    panel.append(this.spotCard, this.engine);

    this.hint = el('div', 'card hint');
    setRichText(this.hint, t('map.hint'));
    root.append(coinCard, back, panel, this.hint);
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

  /** Platz unter dem Boot zeigen (oder ausblenden). */
  showSpot(spot: SpotDef | null): void {
    const id = spot?.id ?? null;
    if (id === this.shownSpot) return;
    this.shownSpot = id;
    this.spotCard.classList.toggle('hidden', !spot);
    if (!spot) return;
    this.hint.classList.add('hidden');
    this.spotName.textContent = t(spot.nameKey);
    setRichText(this.spotDesc, t(spot.descKey, { max: spot.maxMeters.toLocaleString('de-DE') }));
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
