import type { Save } from './save';

export interface QuestDef {
  id: string;
  nameKey: string;
  giver: string;
  goal: { type: 'residentsAtLeast'; count: number };
  reward: { shells: number };
  doneTextKey: string;
}

export function startQuest(save: Save, id: string, now: number): Save {
  if (save.quests.active.includes(id) || save.quests.done.includes(id)) return save;
  return { ...save, updatedAt: now, quests: { ...save.quests, active: [...save.quests.active, id] } };
}

function goalMet(save: Save, q: QuestDef): boolean {
  switch (q.goal.type) {
    case 'residentsAtLeast':
      return save.residents.length >= q.goal.count;
  }
}

/** Schließt erfüllte aktive Aufträge ab und zahlt Belohnungen aus. */
export function completeQuests(save: Save, defs: readonly QuestDef[], now: number): { save: Save; completed: QuestDef[] } {
  const completed = defs.filter((q) => save.quests.active.includes(q.id) && goalMet(save, q));
  if (completed.length === 0) return { save, completed };
  const ids = new Set(completed.map((q) => q.id));
  return {
    completed,
    save: {
      ...save,
      updatedAt: now,
      shells: save.shells + completed.reduce((n, q) => n + q.reward.shells, 0),
      quests: { active: save.quests.active.filter((id) => !ids.has(id)), done: [...save.quests.done, ...ids] },
    },
  };
}
