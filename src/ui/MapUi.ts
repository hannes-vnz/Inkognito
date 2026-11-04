import { el, iconImg } from './dom';
import { Toast } from './Toast';
import { t } from '../i18n';
import { isMaxed, upgradeCost, type UpgradeDef } from '../systems/economy';
import type { SpotDef } from '../systems/seaMap';
import type { Save } from '../systems/save';

/**
 * Oberfläche der Seekarte: Münzen, Zurück, Fortschritt zum nächsten Meer und die Motor-Karte
 * (Reichweite = neue Stationen auf der Route).
 */
export class MapUi {
  private readonly coins: HTMLDivElement;
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
    handlers: { back: () => void; buyEngine: () => void; prestige: () => void },
  ) {
    const coinCard = el('div', 'card hud-coins');
    this.coins = el('div', 'value');
    coinCard.append(iconImg('icon_coin'), this.coins);

    const back = el('button', 'button map-back');
    back.type = 'button';
    back.textContent = t('map.back');
    back.addEventListener('click', handlers.back);

    const panel = el('div', 'map-panel');

    this.engine = el('button', 'upgrade map-engine');
    this.engine.type = 'button';
    const name = el('span', 'upgrade-name');
    name.textContent = t(engineDef.nameKey);
    this.engineLevel = el('span', 'upgrade-level');
    this.engineEffect = el('span', 'upgrade-effect');
    this.engineCost = el('span', 'upgrade-cost');
    this.engine.append(name, this.engineLevel, this.engineEffect, this.engineCost);
    this.engine.addEventListener('click', handlers.buyEngine);
    panel.append(this.engine);

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
