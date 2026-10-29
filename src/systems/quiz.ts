import { createRng } from './rng';
import type { Save } from './save';
import type { RewardParams } from './requests';

export interface QuizQuestion {
  species: string;
  questionKey: string;
  answerKeys: string[];
  correct: number;
}

export interface QuizParams {
  quizEveryCasts: number;
  quizMinKnown: number;
  quizReward: RewardParams;
  quizRequires: string;
}

/** Eine gestellte Frage mit gemischten Antworten. */
export interface QuizRound {
  species: string;
  questionKey: string;
  answerKeys: string[];
  correct: number;
}

export function quizReady(save: Save, questions: readonly QuizQuestion[], p: QuizParams): boolean {
  if (!save.story.seen.includes(p.quizRequires)) return false;
  if (save.stats.casts < save.quiz.nextAtCast) return false;
  return questions.filter((q) => save.fishbook[q.species]).length >= p.quizMinKnown;
}

/** Frage zu einer bekannten Art, Antworten per Seed gemischt. */
export function pickQuiz(seed: string, save: Save, questions: readonly QuizQuestion[]): QuizRound | null {
  const known = questions.filter((q) => save.fishbook[q.species]);
  if (known.length === 0) return null;
  const rng = createRng(seed);
  const q = rng.pick(known);
  const order = q.answerKeys.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return {
    species: q.species,
    questionKey: q.questionKey,
    answerKeys: order.map((i) => q.answerKeys[i]!),
    correct: order.indexOf(q.correct),
  };
}

/** Wertet eine Antwort aus; richtig gibt Münzen. Die nächste Frage kommt erst nach ein paar Würfen. */
export function answerQuiz(save: Save, round: QuizRound, choice: number, value: number, p: QuizParams): { save: Save; right: boolean; reward: number } {
  const right = choice === round.correct;
  const reward = right ? Math.round(p.quizReward.base + p.quizReward.perValue * value) : 0;
  return {
    right,
    reward,
    save: {
      ...save,
      coins: save.coins + reward,
      quiz: { nextAtCast: save.stats.casts + p.quizEveryCasts, correct: save.quiz.correct + (right ? 1 : 0), asked: save.quiz.asked + 1 },
    },
  };
}
