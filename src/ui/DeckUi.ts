import { el, iconImg } from './dom';
import { Toast } from './Toast';
import { setRichText } from './rich';
import { t } from '../i18n';
import { isMaxed, upgradeCost, upgradeValue, type UpgradeDef } from '../systems/economy';
import type { Save } from '../systems/save';

/**
 * Oberfläche des Angel-Spiels: Münzen oben rechts, Tiefe oben links, unten das Deck mit
 * Auswerfen, Upgrade-Karten und Fischbuch. Knöpfe erscheinen erst, wenn sie gebraucht werden.
 */
export class DeckUi {
  private readonly coins: HTMLDivElement;
  private readonly depthCard: HTMLDivElement;
  private readonly depthValue: HTMLDivElement;
  private readonly depthLabel: HTMLDivElement;
  private readonly deck: HTMLDivElement;
  private readonly castButton: HTMLButtonElement;
  private readonly upgradeRow: HTMLDivElement;
  private readonly bookButton: HTMLButtonElement;
  private readonly bookCount: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly toast: Toast;
  private readonly cards = new Map<string, { root: HTMLButtonElement; level: HTMLSpanElement; effect: HTMLSpanElement; cost: HTMLSpanElement }>();
  private lastCoins = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly upgrades: readonly UpgradeDef[],
    handlers: { cast: () => void; buy: (u: UpgradeDef) => void; book: () => void },
  ) {
    const coinCard = el('div', 'card hud-coins');
    coinCard.setAttribute('aria-label', t('hud.coins'));
    this.coins = el('div', 'value');
    coinCard.append(iconImg('icon_coin'), this.coins);

    this.depthCard = el('div', 'card hud-depth-card');
    this.depthLabel = el('div', 'label');
    this.depthValue = el('div', 'value');
    this.depthCard.append(this.depthLabel, this.depthValue);

    this.deck = el('div', 'deck');
    this.castButton = el('button', 'button primary cast');
    this.castButton.type = 'button';
    this.castButton.textContent = t('deck.cast');
    this.castButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.cast();
    });

    this.upgradeRow = el('div', 'upgrade-row');
    for (const u of upgrades) {
      const card = el('button', 'upgrade');
      card.type = 'button';
      const name = el('span', 'upgrade-name');
      name.textContent = t(u.nameKey);
      const level = el('span', 'upgrade-level');
      const effect = el('span', 'upgrade-effect');
      const cost = el('span', 'upgrade-cost');
      card.append(name, level, effect, cost);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.buy(u);
      });
      this.upgradeRow.append(card);
      this.cards.set(u.id, { root: card, level, effect, cost });
    }

    this.bookButton = el('button', 'button book');
    this.bookButton.type = 'button';
    this.bookCount = el('span', '');
    this.bookButton.append(iconImg('icon_book'), this.bookCount);
    this.bookButton.setAttribute('aria-label', t('deck.fishbook'));
    this.bookButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.book();
    });

    this.deck.append(this.upgradeRow, this.bookButton, this.castButton);
    this.hint = el('div', 'card hint hidden');
    root.append(coinCard, this.depthCard, this.deck, this.hint);
    this.toast = new Toast(root);
  }

  /** An Deck (Knöpfe sichtbar) oder im Wurf (nur Tiefe). */
  setMode(mode: 'deck' | 'round'): void {
    this.deck.classList.toggle('away', mode === 'round');
  }

  setDepth(meters: number, zone: string, record: number, inRound: boolean): void {
    this.depthLabel.textContent = inRound ? zone : t('hud.record', { depth: record });
    this.depthValue.textContent = t('hud.depth', { depth: Math.round(inRound ? meters : 0) });
    this.depthCard.classList.toggle('deck-mode', !inRound);
  }

  /** Münzen, Upgrade-Karten und Fischbuch-Zähler aktualisieren; Knöpfe erst nach dem ersten Fang. */
  update(save: Save, knownSpecies: number, totalSpecies: number, bump = false): void {
    const coins = Math.floor(save.coins);
    if (coins !== this.lastCoins) {
      this.coins.textContent = coins.toLocaleString('de-DE');
      if (bump && this.lastCoins >= 0) {
        this.coins.classList.remove('bump');
        void this.coins.offsetWidth;
        this.coins.classList.add('bump');
      }
      this.lastCoins = coins;
    }
    const started = save.stats.casts > 0;
    this.upgradeRow.hidden = !started;
    this.bookButton.hidden = knownSpecies === 0;
    this.bookCount.textContent = `${knownSpecies}/${totalSpecies}`;
    for (const u of this.upgrades) {
      const c = this.cards.get(u.id)!;
      const level = save.upgrades[u.id];
      const maxed = isMaxed(u, level);
      const cost = upgradeCost(u, level);
      c.level.textContent = `Lv ${level + 1}`;
      c.effect.textContent = maxed
        ? t(u.effectKey, { value: upgradeValue(u, level) })
        : `${t(u.effectKey, { value: upgradeValue(u, level) })} ${t('deck.next', { value: upgradeValue(u, level + 1) })}`;
      c.cost.textContent = maxed ? t('upgrade.max') : cost.toLocaleString('de-DE');
      c.root.disabled = maxed || coins < cost;
      c.root.classList.toggle('ready', !maxed && coins >= cost);
    }
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

  showHint(text: string): void {
    setRichText(this.hint, text);
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
