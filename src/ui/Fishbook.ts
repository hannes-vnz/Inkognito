import { el } from './dom';
import { t } from '../i18n';
import type { SpeciesDef } from '../systems/fishing';
import type { Save } from '../systems/save';

/** Fischbuch: alle Arten als Karten, unbekannte als Silhouette mit Zonen-Hinweis. */
export function showFishbook(
  root: HTMLElement,
  species: readonly SpeciesDef[],
  save: Save,
  imageOf: (s: SpeciesDef) => string | undefined,
  zoneOf: (s: SpeciesDef) => string,
  open: (s: SpeciesDef) => void,
): void {
  const overlay = el('div', 'overlay book-overlay');
  const panel = el('div', 'card book-panel');
  const head = el('div', 'book-head');
  const title = el('div', 'sheet-title');
  title.textContent = t('fishbook.title');
  const progress = el('div', 'book-progress');
  const known = species.filter((s) => save.fishbook[s.id]).length;
  progress.textContent = t('fishbook.progress', { known, total: species.length });
  const close = el('button', 'button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', t('riff.close'));
  close.addEventListener('click', () => overlay.remove());
  head.append(title, progress, close);
  const grid = el('div', 'book-grid');
  for (const s of species) {
    const entry = save.fishbook[s.id];
    const cell = el('button', entry ? 'book-cell' : 'book-cell unknown');
    cell.type = 'button';
    const img = el('img', '');
    const src = imageOf(s);
    if (src) img.src = src;
    img.alt = '';
    const name = el('span', 'book-name');
    name.textContent = entry ? t(s.nameKey) : t('fishbook.unknown');
    const meta = el('span', 'book-meta');
    meta.textContent = entry ? t('fishbook.count', { count: entry.count }) : t('fishbook.hint', { zone: zoneOf(s) });
    cell.append(img, name, meta);
    if (entry)
      cell.addEventListener('click', () => {
        overlay.remove();
        open(s);
      });
    else cell.disabled = true;
    grid.append(cell);
  }
  panel.append(head, grid);
  overlay.append(panel);
  overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.addEventListener('click', (e) => e.target === overlay && overlay.remove());
  root.append(overlay);
}
