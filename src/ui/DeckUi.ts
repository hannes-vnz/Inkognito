import { el, iconImg } from './dom';
import { Toast } from './Toast';
import { setRichText } from './rich';
import { t } from '../i18n';
import { isMaxed, upgradeCost, upgradeValue, type UpgradeDef } from '../systems/economy';
import type { Save } from '../systems/save';
import { isMuted, play, setMuted } from '../audio/sfx';

/**
 * Oberfläche des Angel-Spiels: Münzen oben rechts, Tiefe oben links, unten das Deck mit
 * Auswerfen, Upgrade-Karten und Fischbuch. Knöpfe erscheinen erst, wenn sie gebraucht werden.
 */
export class DeckUi {
  private readonly coins: HTMLDivElement;
  private readonly depthCard: HTMLDivElement;
  private readonly depthValue: HTMLDivElement;
  private readonly depthLabel: HTMLDivElement;
  private readonly timeLabel: HTMLDivElement;
  private readonly deck: HTMLDivElement;
  private readonly castButton: HTMLButtonElement;
  private readonly upgradeRow: HTMLDivElement;
  private readonly bookButton: HTMLButtonElement;
  private readonly bookCount: HTMLSpanElement;
  private readonly mapButton: HTMLButtonElement;
  private readonly hint: HTMLDivElement;
  private readonly toast: Toast;
  private readonly cards = new Map<string, { root: HTMLButtonElement; level: HTMLSpanElement; effect: HTMLSpanElement; cost: HTMLSpanElement }>();
  private lastCoins = -1;
  private shownCoins = 0;
  private roll = 0;
  private readonly coinCard: HTMLDivElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly upgrades: readonly UpgradeDef[],
    handlers: { cast: () => void; buy: (u: UpgradeDef) => void; book: () => void; map: () => void },
  ) {
    const coinCard = el('div', 'card hud-coins');
    this.coinCard = coinCard;
    coinCard.setAttribute('aria-label', t('hud.coins'));
    this.coins = el('div', 'value');
    coinCard.append(iconImg('icon_coin'), this.coins);

    this.depthCard = el('div', 'card hud-depth-card');
    this.depthLabel = el('div', 'label');
    this.depthValue = el('div', 'value');
    this.timeLabel = el('div', 'time-label');
    this.depthCard.append(this.depthLabel, this.depthValue, this.timeLabel);

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

    this.mapButton = el('button', 'button book map-button');
    this.mapButton.type = 'button';
    const mapLabel = el('span', '');
    mapLabel.textContent = t('map.open');
    this.mapButton.append(iconImg('icon_map'), mapLabel);
    this.mapButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.map();
    });

    this.deck.append(this.upgradeRow, this.mapButton, this.bookButton, this.castButton);
    const sound = el('button', 'button sound-button');
    sound.type = 'button';
    const label = () => (sound.textContent = t(isMuted() ? 'hud.soundOff' : 'hud.soundOn'));
    label();
    sound.addEventListener('click', (e) => {
      e.stopPropagation();
      setMuted(!isMuted());
      label();
      play('tap');
    });

    this.hint = el('div', 'card hint hidden');
    root.append(coinCard, this.depthCard, sound, this.deck, this.hint);
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
      if (bump && this.lastCoins >= 0) this.rollTo(coins);
      else {
        this.shownCoins = coins;
        this.coins.textContent = coins.toLocaleString('de-DE');
      }
      this.lastCoins = coins;
    }
    const started = save.stats.casts > 0;
    this.upgradeRow.hidden = !started;
    this.bookButton.hidden = knownSpecies === 0;
    this.mapButton.hidden = !started;
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

  /** Zähler rollt hoch statt zu springen, mit Plopp am Ende. */
  private rollTo(target: number): void {
    cancelAnimationFrame(this.roll);
    const from = this.shownCoins;
    const start = performance.now();
    const ms = Math.min(900, 250 + Math.abs(target - from) * 8);
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      this.shownCoins = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      this.coins.textContent = this.shownCoins.toLocaleString('de-DE');
      if (k < 1) this.roll = requestAnimationFrame(tick);
      else {
        this.coins.classList.remove('bump');
        void this.coins.offsetWidth;
        this.coins.classList.add('bump');
      }
    };
    this.roll = requestAnimationFrame(tick);
  }

  /** Münzen fliegen vom Bildschirmpunkt zum Zähler, jede mit kleinem Klimpern. */
  coinBurst(x: number, y: number, count: number): void {
    const box = this.coinCard.getBoundingClientRect();
    const tx = box.left + 24;
    const ty = box.top + box.height / 2;
    const n = Math.min(14, Math.max(3, count));
    for (let i = 0; i < n; i++) {
      const c = iconImg('icon_coin');
      c.className = 'flying-coin';
      const angle = (i / n) * Math.PI * 2;
      const sx = x + Math.cos(angle) * 30;
      const sy = y + Math.sin(angle) * 20;
      c.style.left = `${sx}px`;
      c.style.top = `${sy}px`;
      this.root.append(c);
      const anim = c.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4)' },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * 40}px), calc(-50% + ${Math.sin(angle) * 40 - 30}px)) scale(1.4)`, offset: 0.3 },
          { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(0.8)` },
        ],
        { duration: 650 + i * 45, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
      );
      anim.onfinish = () => {
        c.remove();
        play('coin', 1 + i * 0.04);
      };
    }
  }

  /** Konfetti-Regen von einem Bildschirmpunkt aus. */
  confetti(x: number, y: number, count = 18): void {
    const colors = ['#ffd23f', '#ff6b6b', '#5ce1e6', '#7bd88f', '#c78cff'];
    for (let i = 0; i < count; i++) {
      const c = el('div', 'confetti');
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      c.style.background = colors[i % colors.length]!;
      this.root.append(c);
      const a = (i / count) * Math.PI * 2;
      const dist = 60 + (i % 4) * 25;
      const anim = c.animate(
        [
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 40}px)) rotate(${i * 47}deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 1.2}px), calc(-50% + ${Math.sin(a) * dist + 80}px)) rotate(${i * 90}deg)`, opacity: 0 },
        ],
        { duration: 900 + (i % 5) * 80, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' },
      );
      anim.onfinish = () => c.remove();
    }
  }

  /** Auswerfen-Knopf zeigt einen aktiven Köder an. */
  setCastLabel(text: string, baited: boolean): void {
    this.castButton.textContent = text;
    this.castButton.classList.toggle('baited', baited);
  }

  /** Tageszeit unter dem Rekord: Sonne oder Mond und wann es wechselt. */
  setTime(text: string, night: boolean): void {
    this.timeLabel.textContent = text;
    this.timeLabel.classList.toggle('night', night);
  }

  /** Zonen-Banner: gleitet beim Eintauchen in eine neue Zone durchs Bild. */
  banner(text: string): void {
    this.root.querySelector('.zone-banner')?.remove();
    const b = el('div', 'zone-banner');
    b.textContent = text;
    this.root.append(b);
    window.setTimeout(() => b.remove(), 1800);
  }

  /** Großer Schriftzug mitten im Bild (Rekord, Seltenheit). */
  shout(text: string, color = '#ffd23f'): void {
    const s = el('div', 'shout');
    s.textContent = text;
    s.style.color = color;
    this.root.append(s);
    window.setTimeout(() => s.remove(), 1600);
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
    cancelAnimationFrame(this.roll);
    this.toast.destroy();
    this.root.replaceChildren();
  }
}
