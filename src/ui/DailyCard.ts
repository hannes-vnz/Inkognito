import { el, iconImg } from './dom';
import { setRichText } from './rich';
import { t } from '../i18n';

/**
 * Tagesbonus: sieben Tage nebeneinander, heute leuchtet, abgeholte haben einen Haken.
 * `onClaim` bekommt die Mitte des Knopfs, damit die Münzen von dort losfliegen.
 */
export function showDailyCard(
  root: HTMLElement,
  streak: number,
  rewards: readonly number[],
  reset: boolean,
  onClaim: (x: number, y: number) => void,
): void {
  const overlay = el('div', 'overlay daily');
  const card = el('div', 'card daily-card');
  const title = el('div', 'title');
  title.textContent = t('daily.title');
  const text = el('p', 'daily-text');
  setRichText(text, t('daily.text', { streak }) + (reset ? ` ${t('daily.reset')}` : ''));
  const row = el('div', 'daily-row');
  const today = Math.min(streak, rewards.length);
  rewards.forEach((coins, i) => {
    const day = el('div', i + 1 < today ? 'daily-day done' : i + 1 === today ? 'daily-day today' : 'daily-day');
    const n = el('span', 'daily-n');
    n.textContent = t('daily.day', { n: i + 1 });
    const v = el('span', 'daily-v');
    v.textContent = coins.toLocaleString('de-DE');
    day.append(n, iconImg('icon_coin'), v);
    row.append(day);
  });
  const claim = el('button', 'button primary');
  claim.type = 'button';
  claim.textContent = t('daily.claim');
  claim.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = claim.getBoundingClientRect();
    overlay.remove();
    onClaim(r.left + r.width / 2, r.top);
  });
  card.append(title, text, row, claim);
  overlay.append(card);
  overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.append(overlay);
}
