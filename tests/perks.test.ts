import { describe, expect, it } from 'vitest';
import game from '../data/game.json';
import { boardCharter, buyTip, charterBonus, charterHooks, charterReady, landCharter, tipBonus, tipPrice, useTip, type PerkParams } from '../src/systems/perks';
import { migrate, newSave, type Save } from '../src/systems/save';

const p = game.perks as PerkParams;
const rich = (): Save => ({ ...newSave(1), coins: 10_000 });

describe('Giselas Schwarm-Tipp', () => {
  it('kostet mehr mit jedem Upgrade', () => {
    const s = rich();
    expect(tipPrice({ ...s, upgrades: { line: 3, hook: 2, crew: 0, engine: 1 } }, p)).toBe(tipPrice(s, p) + 6 * p.tip.pricePerLevel);
  });

  it('nennt einen erreichbaren Platz, zieht Münzen ab und gilt für ein paar Würfe', () => {
    const s = buyTip(rich(), ['shelf', 'open'], 'seed', p)!;
    expect(['shelf', 'open']).toContain(s.perks.tip!.spot);
    expect(s.coins).toBe(10_000 - tipPrice(rich(), p));
    const spot = s.perks.tip!.spot;
    expect(tipBonus(s, spot, p)).toBe(p.tip.bonus);
    expect(tipBonus(s, 'harbor', p)).toBe(0);
    let t = s;
    for (let i = 0; i < p.tip.casts; i++) t = useTip(t, spot);
    expect(t.perks.tip).toBeNull();
    expect(useTip(s, 'harbor')).toBe(s);
  });

  it('ohne Geld oder Plätze gibt es nichts, ein neuer Tipp nennt einen anderen Platz', () => {
    expect(buyTip(newSave(1), ['shelf'], 'x', p)).toBeNull();
    expect(buyTip(rich(), [], 'x', p)).toBeNull();
    const first = buyTip(rich(), ['shelf', 'open'], 'a', p)!;
    for (const seed of ['b', 'c', 'd']) expect(buyTip(first, ['shelf', 'open'], seed, p)!.perks.tip!.spot).not.toBe(first.perks.tip!.spot);
  });
});

describe('Schulzes Bootscharter', () => {
  it('einmal am Tag: zahlt mehr, kostet einen Haken, klebt neue Arten ins Album', () => {
    const s = boardCharter(newSave(1), '2026-10-30');
    expect(charterReady(s, '2026-10-30')).toBe(false);
    expect(charterHooks(s, 3, p)).toBe(2);
    expect(charterHooks(s, 1, p)).toBe(1);
    expect(charterBonus(s, p)).toBe(p.charter.bonus);
    const r = landCharter(s, ['cod', 'cod', 'herring']);
    expect(r.photos).toEqual(['cod', 'herring']);
    expect(r.save.perks.charter.aboard).toBe(false);
    expect(charterReady(r.save, '2026-10-30')).toBe(false);
    expect(charterReady(r.save, '2026-10-31')).toBe(true);
    const again = landCharter(boardCharter(r.save, '2026-10-31'), ['cod', 'plaice']);
    expect(again.photos).toEqual(['plaice']);
    expect(charterHooks(newSave(1), 3, p)).toBe(3);
    expect(landCharter(newSave(1), ['cod']).photos).toEqual([]);
  });
});

describe('Spielstand v12', () => {
  it('alte Stände bekommen leere Dienste', () => {
    const old = { ...newSave(1), version: 11 } as Record<string, unknown>;
    delete old.perks;
    expect(migrate(old, 1).perks).toEqual(newSave(1).perks);
  });
});
