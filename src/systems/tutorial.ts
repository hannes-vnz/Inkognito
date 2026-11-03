import type { Save } from './save';

/**
 * Tutorial im Heimathafen (die Stadt), danach geht es raus auf Meer 1:
 * auswerfen → Fang verkaufen → Upgrade kaufen → Seekarte öffnen → fertig.
 * Jeder Schritt wartet auf genau eine Handlung; Hinweis und leuchtender Knopf zeigen sie.
 */
export type TutorialStep = 'cast' | 'sell' | 'upgrade' | 'map' | 'done';

export type TutorialEvent = 'landed' | 'sold' | 'upgraded' | 'mapOpened';

const NEXT: Record<Exclude<TutorialStep, 'done'>, { on: TutorialEvent; to: TutorialStep }> = {
  cast: { on: 'landed', to: 'sell' },
  sell: { on: 'sold', to: 'upgrade' },
  upgrade: { on: 'upgraded', to: 'map' },
  map: { on: 'mapOpened', to: 'done' },
};

/** Nächster Schritt, wenn `event` der erwartete ist; ein leerer Fang zählt nicht (nichts zu verkaufen). */
export function advanceTutorial(save: Save, event: TutorialEvent): Save {
  const step = save.tutorial;
  if (step === 'done') return save;
  const n = NEXT[step];
  if (n.on !== event) return save;
  if (event === 'landed' && Object.keys(save.crate).length === 0) return save;
  return { ...save, tutorial: n.to };
}

/** Im Tutorial bleibt die Seekarte zu, bis der Schritt „Seekarte“ dran ist. */
export const mapAllowed = (save: Save): boolean => save.tutorial === 'map' || save.tutorial === 'done';
