import type { Save } from './save';

/**
 * Großausbauten bei Hilde: teure Einmalkäufe, die das Spiel spürbar verändern
 * (doppelte Kiste, bessere Preise, Echolot, großer Kescher). Sie bleiben auch beim Weiterziehen.
 */
export interface BigUpgradeDef {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  price: number;
  effect: Partial<BigEffect>;
}

export interface BigEffect {
  /** Faktor auf den Kistenplatz. */
  crateMul: number;
  /** Zuschlag auf Verkaufspreise (0.2 = +20 %). */
  priceBonus: number;
  /** Wertvolle Fische leuchten unter Wasser. */
  sonar: boolean;
  /** Faktor auf den Fangradius im Aufstieg. */
  catchRadius: number;
}

const NONE: BigEffect = { crateMul: 1, priceBonus: 0, sonar: false, catchRadius: 1 };

/** Gesamtwirkung aller eingebauten Großausbauten. */
export function bigEffect(save: Save, defs: readonly BigUpgradeDef[]): BigEffect {
  return defs
    .filter((d) => save.big.includes(d.id))
    .reduce<BigEffect>(
      (e, d) => ({
        crateMul: e.crateMul * (d.effect.crateMul ?? 1),
        priceBonus: e.priceBonus + (d.effect.priceBonus ?? 0),
        sonar: e.sonar || Boolean(d.effect.sonar),
        catchRadius: e.catchRadius * (d.effect.catchRadius ?? 1),
      }),
      NONE,
    );
}

/** Einbauen; null, wenn schon da oder zu teuer. */
export function buyBig(save: Save, def: BigUpgradeDef): Save | null {
  if (save.big.includes(def.id) || save.coins < def.price) return null;
  return { ...save, coins: save.coins - def.price, big: [...save.big, def.id] };
}
