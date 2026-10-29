import { describe, expect, it } from 'vitest';
import { decideSync, isEmail, isFresh, normalizeFriendCode, normalizeLoginCode } from '../src/systems/sync';
import { newSave, type Save } from '../src/systems/save';

const T = 1_800_000_000_000;
const played = (updatedAt: number): Save => ({ ...newSave(T), coins: 10, stats: { casts: 2, deepestMeters: 80 }, updatedAt });

describe('Abgleich', () => {
  it('neuer Stand gilt als unberührt', () => {
    expect(isFresh(newSave(T))).toBe(true);
    expect(isFresh(played(T))).toBe(false);
  });

  it('neues Gerät holt den Online-Stand, auch wenn sein Zeitstempel neuer ist', () => {
    expect(decideSync(newSave(T + 1e9), { updatedAt: T })).toBe('pull');
  });

  it('der neuere Stand gewinnt', () => {
    expect(decideSync(played(T + 5), { updatedAt: T })).toBe('push');
    expect(decideSync(played(T), { updatedAt: T + 5 })).toBe('pull');
    expect(decideSync(played(T), { updatedAt: T })).toBe('none');
  });

  it('ohne Online-Stand wird nur echter Fortschritt hochgeladen', () => {
    expect(decideSync(played(T), null)).toBe('push');
    expect(decideSync(newSave(T), null)).toBe('none');
  });
});

describe('Eingaben', () => {
  it('Freundescodes werden bereinigt und geprüft', () => {
    expect(normalizeFriendCode(' ab3-k7q ')).toBe('AB3K7Q');
    expect(normalizeFriendCode('AB3K7')).toBeNull();
    expect(normalizeFriendCode('AB0K7Q')).toBeNull();
    expect(normalizeFriendCode('ABIK7Q')).toBeNull();
  });

  it('Login-Code und E-Mail', () => {
    expect(normalizeLoginCode('123 456')).toBe('123456');
    expect(normalizeLoginCode('12345')).toBeNull();
    expect(isEmail('kalle@riff.de')).toBe(true);
    expect(isEmail('kalle@riff')).toBe(false);
  });
});
