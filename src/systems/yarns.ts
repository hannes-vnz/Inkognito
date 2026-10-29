import type { Save } from './save';

/** Eine Behauptung von Opa Knut: wahr oder Seemannsgarn. */
export interface Yarn {
  id: string;
  /** Art aus dem Fischbuch, um die es geht (null: allgemeines Meereswissen). */
  species: string | null;
  true: boolean;
  textKey: string;
  explainKey: string;
  source: string;
}

export interface YarnParams {
  yarnEveryCasts: number;
  yarnReward: { base: number; perKnown: number };
  yarnRequires: string;
}

export const yarnReady = (save: Save, p: YarnParams): boolean =>
  save.story.seen.includes(p.yarnRequires) && save.stats.casts >= save.yarn.nextAtCast;

/** Der Reihe nach: so kommt jede Geschichte dran, bevor sich eine wiederholt. */
export const nextYarn = (save: Save, yarns: readonly Yarn[]): Yarn => yarns[save.yarn.asked % yarns.length]!;

export function answerYarn(save: Save, yarn: Yarn, saidTrue: boolean, p: YarnParams): { save: Save; right: boolean; reward: number } {
  const right = saidTrue === yarn.true;
  const reward = right ? p.yarnReward.base + p.yarnReward.perKnown * Object.keys(save.fishbook).length : 0;
  return {
    right,
    reward,
    save: {
      ...save,
      coins: save.coins + reward,
      yarn: { nextAtCast: save.stats.casts + p.yarnEveryCasts, asked: save.yarn.asked + 1, correct: save.yarn.correct + (right ? 1 : 0) },
    },
  };
}
