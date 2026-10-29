import { texts } from './data';
import { translate } from './systems/texts';

/** Kurzform für Texte aus data/texts.de.json. */
export const t = (key: string, params?: Readonly<Record<string, string | number>>): string =>
  translate(texts, key, params);
