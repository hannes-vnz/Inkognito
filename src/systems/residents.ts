import type { FishDef } from './fish';
import type { Save } from './save';

/** Eintrag aus data/buildings.json. */
export interface BuildingDef {
  id: string;
  nameKey: string;
  type: string;
  /** Was die Höhle bietet; muss zu `fish.home.needs` passen. */
  provides: string;
  capacity: number;
  sprite: string;
  position: { x: number; y: number };
  placeholderColor: string;
}

export type MoveInCheck = 'ok' | 'wrongHome' | 'full' | 'notHeld';

export function checkMoveIn(save: Save, heldUid: number, building: BuildingDef, fishDefs: ReadonlyMap<string, FishDef>): MoveInCheck {
  const held = save.holding.find((h) => h.uid === heldUid);
  if (!held) return 'notHeld';
  const def = fishDefs.get(held.fishId);
  if (!def || def.home.needs !== building.provides) return 'wrongHome';
  if (save.residents.filter((r) => r.buildingId === building.id).length >= building.capacity) return 'full';
  return 'ok';
}

/** Lässt einen wartenden Fisch einziehen. Gibt einen neuen Stand zurück. */
export function moveIn(save: Save, heldUid: number, building: BuildingDef, fishDefs: ReadonlyMap<string, FishDef>, now: number): Save {
  const check = checkMoveIn(save, heldUid, building, fishDefs);
  if (check !== 'ok') throw new Error(`Einzug nicht möglich: ${check}`);
  const held = save.holding.find((h) => h.uid === heldUid)!;
  return {
    ...save,
    updatedAt: now,
    holding: save.holding.filter((h) => h.uid !== heldUid),
    residents: [...save.residents, { uid: held.uid, fishId: held.fishId, buildingId: building.id, producedUntil: now }],
  };
}

/** Fische aus einem Tauchgang ins Wartebecken, bis zur Kapazität. Gibt Stand und Anzahl übernommener Fische zurück. */
export function addCatch(save: Save, fishIds: readonly string[], capacity: number, now: number): { save: Save; added: number } {
  const room = Math.max(0, capacity - save.holding.length);
  const take = fishIds.slice(0, room);
  let nextUid = save.nextUid;
  const holding = [...save.holding, ...take.map((fishId) => ({ uid: nextUid++, fishId }))];
  return { save: { ...save, holding, nextUid, updatedAt: now, diveCount: save.diveCount + 1 }, added: take.length };
}

/** Welche wartenden Fische in diese Höhle passen würden. */
export function candidatesFor(save: Save, building: BuildingDef, fishDefs: ReadonlyMap<string, FishDef>): number[] {
  return save.holding.filter((h) => fishDefs.get(h.fishId)?.home.needs === building.provides).map((h) => h.uid);
}
