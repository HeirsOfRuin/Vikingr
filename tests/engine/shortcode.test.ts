// The short save code (tools/kit/savecode.js; Josh, 2026-11-09: "most of the games we make have huge save codes").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { content, sandboxGame } from '../helpers';
import { packCode, unpackCode, columnize, uncolumnize, toBase16384, fromBase16384 } from '../../tools/kit/savecode.js';
import { encodeSaveCode, decodeSaveCode, encodeCode, CODE_PREFIX } from '../../src/engine/savecode';
import { toSave, fromSave } from '../../src/engine/save';

describe('the kit', () => {
  it('base16384 round-trips every length, and says when a code is cut', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 97 + n * 31) & 0xff);
      expect(Array.from(fromBase16384(toBase16384(b)))).toEqual(Array.from(b));
    }
    expect(() => fromBase16384(toBase16384(new Uint8Array([1, 2, 3, 4, 5])).slice(0, -1))).toThrow();
  });

  it('columns round-trip, missing keys and nested arrays of objects included', () => {
    const v = { rows: [{ a: 1, b: 'x' }, { a: 2 }, { b: null, c: [{ d: 1 }, { d: 2 }, { d: 3 }, { e: 4 }] }, { a: 4, b: 'y' }], k: [1, 2, 3, 4, 5] };
    expect(uncolumnize(JSON.parse(JSON.stringify(columnize(v))))).toEqual(v);
  });

  it('a code survives the spaces and line breaks a messenger adds; both forms load', async () => {
    const v = { name: 'Ragnavald', deeds: Array.from({ length: 30 }, (_, i) => ({ n: i, type: 'raid', day: 1000 + i })) };
    const short = await packCode('TEST1', v);
    const plain = await packCode('TEST1', v, { plain: true });
    expect(short.length).toBeLessThan(plain.length);
    expect(await unpackCode('TEST1', short.slice(0, 20) + '\n ' + short.slice(20))).toEqual(v);
    expect(await unpackCode('TEST1', plain)).toEqual(v);
    await expect(unpackCode('TEST1', short.slice(0, -5))).rejects.toThrow(/cut short/);
    await expect(unpackCode('OTHER', short)).rejects.toThrow(/not a code for this game/);
  });
});

describe('Vikingr save codes', () => {
  it('a life saves to the short code and loads back; the old VIKR1 codes still load', async () => {
    const s = sandboxGame(5);
    const save = toSave(s, content);
    const code = await encodeSaveCode(save);
    expect(code.startsWith('VIKR2~')).toBe(true);
    expect(fromSave(await decodeSaveCode(code), content).state.hero.name).toBe(s.hero.name);
    const old = await encodeCode(CODE_PREFIX, save);
    expect(fromSave(await decodeSaveCode(old), content).state.hero.name).toBe(s.hero.name);
    const plain = await encodeSaveCode(save, { plain: true });
    expect(plain.startsWith('VIKR2.')).toBe(true);
    expect(fromSave(await decodeSaveCode(plain), content).state.day).toBe(s.day);
    void readFileSync;
  });
});
