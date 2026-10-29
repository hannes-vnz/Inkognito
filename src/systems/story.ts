import type { Save } from './save';

export type StoryTrigger =
  | { type: 'start' }
  | { type: 'casts'; value: number }
  | { type: 'species'; value: number }
  | { type: 'deepest'; value: number }
  | { type: 'caught'; value: string };

export interface StoryBeat {
  id: string;
  npc: string;
  node: string;
  trigger: StoryTrigger;
  requires?: string;
}

export function triggerMet(t: StoryTrigger, save: Save): boolean {
  switch (t.type) {
    case 'start':
      return true;
    case 'casts':
      return save.stats.casts >= t.value;
    case 'species':
      return Object.keys(save.fishbook).length >= t.value;
    case 'deepest':
      return save.stats.deepestMeters >= t.value;
    case 'caught':
      return save.fishbook[t.value] !== undefined;
  }
}

/** Nächster fälliger Story-Moment in Datenreihenfolge, oder null. */
export function nextBeat(save: Save, beats: readonly StoryBeat[]): StoryBeat | null {
  const seen = save.story.seen;
  return beats.find((b) => !seen.includes(b.id) && (b.requires === undefined || seen.includes(b.requires)) && triggerMet(b.trigger, save)) ?? null;
}

export const markSeen = (save: Save, id: string): Save =>
  save.story.seen.includes(id) ? save : { ...save, story: { seen: [...save.story.seen, id] } };

export const hasSeen = (save: Save, id: string): boolean => save.story.seen.includes(id);

/** Eine Figur steht im Hafen, sobald einer ihrer Story-Momente gesehen wurde. */
export const npcMet = (save: Save, beats: readonly StoryBeat[], npc: string): boolean =>
  beats.some((b) => b.npc === npc && save.story.seen.includes(b.id));
