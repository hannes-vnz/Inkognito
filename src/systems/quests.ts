import type { Save } from './save';
import { buildingLevel, workersOn } from './colony';

export type QuestGoal =
  | { type: 'fishAtLeast'; count: number }
  | { type: 'jobAssigned'; job: string; count: number }
  | { type: 'sold'; count: number }
  | { type: 'buildingLevel'; building: string; level: number };

export interface QuestDef {
  id: string;
  nameKey: string;
  giver: string;
  goal: QuestGoal;
  reward: { shells?: number; food?: number };
  doneTextKey: string;
}

export function startQuest(save: Save, id: string, now: number): Save {
  if (save.quests.active.includes(id) || save.quests.done.includes(id)) return save;
  return { ...save, updatedAt: now, quests: { ...save.quests, active: [...save.quests.active, id] } };
}

export function goalMet(save: Save, goal: QuestGoal): boolean {
  switch (goal.type) {
    case 'fishAtLeast':
      return save.fish.length + save.waiting.length >= goal.count;
    case 'jobAssigned':
      return workersOn(save, goal.job).length >= goal.count;
    case 'sold':
      return save.counters.sold >= goal.count;
    case 'buildingLevel':
      return buildingLevel(save, goal.building) >= goal.level;
  }
}

/** Schließt erfüllte aktive Aufträge ab und zahlt Belohnungen aus. */
export function completeQuests(save: Save, defs: readonly QuestDef[], now: number): { save: Save; completed: QuestDef[] } {
  const completed = defs.filter((q) => save.quests.active.includes(q.id) && goalMet(save, q.goal));
  if (completed.length === 0) return { save, completed };
  const ids = new Set(completed.map((q) => q.id));
  return {
    completed,
    save: {
      ...save,
      updatedAt: now,
      shells: save.shells + completed.reduce((n, q) => n + (q.reward.shells ?? 0), 0),
      food: save.food + completed.reduce((n, q) => n + (q.reward.food ?? 0), 0),
      quests: { active: save.quests.active.filter((id) => !ids.has(id)), done: [...save.quests.done, ...ids] },
    },
  };
}
