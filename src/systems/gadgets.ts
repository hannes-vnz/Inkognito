import type { Save } from './save';

/**
 * Gadgets von Professor Blinker: einmal kaufen, eins hängt am Haken, wechseln jederzeit.
 * Wirkung als Faktoren auf die Wurf-Parameter (Sinkgeschwindigkeit, Fangradius) und Schutz vor Bissen im Abstieg.
 */
export interface GadgetDef {
  id: string;
  nameKey: string;
  descKey: string;
  price: number;
  effect: Partial<GadgetEffect>;
}

export interface GadgetEffect {
  /** Faktor auf die Sinkgeschwindigkeit (0.7 = 30 % langsamer). */
  fallSpeed: number;
  /** Faktor auf den Fangradius im Aufstieg. */
  catchRadius: number;
  /** So viele Bisse im Abstieg prallen ab. */
  shield: number;
}

const NONE: GadgetEffect = { fallSpeed: 1, catchRadius: 1, shield: 0 };

/** Wirkung des angehängten Gadgets (ohne Gadget: keine). */
export function gadgetEffect(save: Save, defs: readonly GadgetDef[]): GadgetEffect {
  const def = defs.find((d) => d.id === save.gadgets.equipped);
  return def ? { ...NONE, ...def.effect } : NONE;
}

/** Kaufen und gleich anhängen. Null, wenn schon gekauft oder zu teuer. */
export function buyGadget(save: Save, def: GadgetDef): Save | null {
  if (save.gadgets.owned.includes(def.id) || save.coins < def.price) return null;
  return { ...save, coins: save.coins - def.price, gadgets: { owned: [...save.gadgets.owned, def.id], equipped: def.id } };
}

/** Ein gekauftes Gadget anhängen. */
export function equipGadget(save: Save, id: string): Save {
  if (!save.gadgets.owned.includes(id)) return save;
  return { ...save, gadgets: { ...save.gadgets, equipped: id } };
}
