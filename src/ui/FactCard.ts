import { el } from './dom';
import { setRichText } from './rich';
import { t } from '../i18n';
import type { SpeciesDef } from '../systems/fishing';

/**
 * Fakt-Karte beim Erstfang (Vorbild: Museum in Animal Crossing): Bild der Art, Tiefe und Zone,
 * ein echter Fakt mit Quelle und ein Kommentar von Bert.
 */
export function showFactCard(root: HTMLElement, def: SpeciesDef, image: string | undefined, zoneName: string, isNew: boolean, done: () => void): void {
  const overlay = el('div', 'overlay fact');
  const card = el('div', 'card fact-card');
  if (isNew) {
    const badge = el('div', 'fact-badge');
    badge.textContent = t('fact.new');
    card.append(badge);
  }
  const pic = el('div', 'fact-pic');
  if (image) {
    const img = el('img', '');
    img.src = image;
    img.alt = '';
    pic.append(img);
  }
  const name = el('div', 'fact-name');
  name.textContent = t(def.nameKey);
  const depth = el('div', 'fact-depth');
  depth.textContent = t('fact.depth', { min: def.depthMeters[0].toLocaleString('de-DE'), max: def.depthMeters[1].toLocaleString('de-DE'), zone: zoneName });
  const group = el('div', def.group === 'fish' ? 'fact-group' : 'fact-group not-fish');
  group.textContent = t(`group.${def.group}`);
  const fact = el('p', 'fact-text');
  setRichText(fact, t(def.factKey));
  const comment = el('p', 'fact-comment');
  comment.textContent = t('fact.comment', { text: t(def.commentKey) });
  const source = el('a', 'fact-source');
  source.href = def.source;
  source.target = '_blank';
  source.rel = 'noopener';
  source.textContent = `${t('fact.source')} · ${t('fact.checked', { date: new Date(def.factChecked).toLocaleDateString('de-DE') })}`;
  const next = el('button', 'button primary');
  next.type = 'button';
  next.textContent = t('fact.next');
  next.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    done();
  });
  card.append(pic, name, group, depth, fact, comment, source, next);
  overlay.append(card);
  overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.append(overlay);
  next.focus();
}
