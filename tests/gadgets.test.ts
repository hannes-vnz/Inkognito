import { describe, expect, it } from 'vitest';
import gadgetsJson from '../data/gadgets.json';
import texts from '../data/texts.de.json';
import { buyGadget, equipGadget, gadgetEffect, type GadgetDef } from '../src/systems/gadgets';
import { createRound, stepRound, type SpeciesDef } from '../src/systems/fishing';
import { migrate, newSave } from '../src/systems/save';

const defs = gadgetsJson as GadgetDef[];
const def = (id: string) => defs.find((d) => d.id === id)!;

describe('Gadgets', () => {
  it('haben Texte und Preise', () => {
    for (const d of defs) {
      expect(texts).toHaveProperty([d.nameKey]);
      expect(texts).toHaveProperty([d.descKey]);
      expect(d.price).toBeGreaterThan(0);
    }
  });

  it('kaufen hängt an, wechseln geht nur mit gekauften, doppelt kaufen geht nicht', () => {
    expect(buyGadget(newSave(1), def('brake'))).toBeNull();
    const rich = { ...newSave(1), coins: 5000 };
    const a = buyGadget(rich, def('brake'))!;
    expect(a.coins).toBe(5000 - def('brake').price);
    expect(a.gadgets).toEqual({ owned: ['brake'], equipped: 'brake' });
    expect(buyGadget(a, def('brake'))).toBeNull();
    const b = buyGadget(a, def('magnet'))!;
    expect(b.gadgets.equipped).toBe('magnet');
    expect(equipGadget(b, 'brake').gadgets.equipped).toBe('brake');
    expect(equipGadget(b, 'shield')).toBe(b);
  });

  it('Wirkung: ohne Gadget neutral, sonst aus den Daten', () => {
    expect(gadgetEffect(newSave(1), defs)).toEqual({ fallSpeed: 1, catchRadius: 1, shield: 0 });
    const s = { ...newSave(1), gadgets: { owned: ['shield'], equipped: 'shield' } };
    expect(gadgetEffect(s, defs).shield).toBe(1);
  });

  it('Panzerhaken: der erste Biss prallt ab, der Haken sinkt weiter', () => {
    const fish: SpeciesDef = { id: 'f', nameKey: '', factKey: '', commentKey: '', depthMeters: [0, 99999], value: 1, weight: 1, behavior: 'drift', speed: 0, glow: false, sprite: '', frame: { width: 16, height: 16 }, placeholderColor: '', group: '', shape: '', source: '', factChecked: '', sea: 'x' };
    const map = { surfaceY: 0, unitsPerZone: 1000, zones: [{ depthMeters: [0, 1000] }] } as never;
    const p = { fallSpeed: 300, riseSpeed: 600, steerSpeed: 0, biteRadius: 8, catchRadius: 30, fishPerThousandUnits: 0, spawnStartBelowSurface: 0, spriteScale: 1 };
    const s = createRound('x', 100, 500, 3, [fish], map, p, 0, [{ species: fish, meters: 10 }]);
    const target = s.fish[0]!;
    target.x = s.hookX;
    target.vx = 0;
    s.shield = 1;
    const species = new Map([['f', fish]]);
    const events = [];
    for (let i = 0; i < 60 && s.phase === 'descent'; i++) events.push(...stepRound(s, null, species, map, p, 1 / 60));
    expect(events.map((e) => e.type)).toContain('shield');
    expect(target.escaped).toBe(true);
    expect(s.shield).toBe(0);
  });

  it('Spielstand v14: alte Stände bekommen leere Gadgets', () => {
    const old = { ...newSave(1), version: 13 } as Record<string, unknown>;
    delete old.gadgets;
    expect(migrate(old, 1).gadgets).toEqual({ owned: [], equipped: null });
  });
});
