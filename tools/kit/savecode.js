// Short save codes, for any game. Copy into src/ (or inline into a single-file game). No dependencies:
// CompressionStream is in every current browser and in Node 18+.
//
// The problem: a long game's save, deflated and written in base64, outgrows a chat message (Vikingr's passed the
// 20,000 characters the Claude app will carry, and arrived cut). Nearly all of the saving here is the alphabet:
// base64 carries 6 bits a character; this code writes 14 bits in each CJK ideograph (U+4E00-U+8DFF), so the same bytes
// take 2.3 times fewer characters. Chat boxes, text fields and most messaging apps count characters, not bytes.
// Before compressing, every array of objects is stored by column (all the days together, all the names together),
// which deflate packs a few percent tighter.
//
// Measured on a Vikingr save of eight years (60 journal lines, 117 deeds, 56 places; docs/KIT-SAVECODE.md has more):
//   deflate + base64 (the old code)          17,476 characters
//   columns + deflate + base64 (plain form)  16,759
//   columns + deflate + base16384 (short)     7,233
// Rebuilt rows keep every key and value; their keys come back in column order (JSON objects are unordered).
//
// Two forms, one decoder:
//   PREFIX~...  the short form (CJK characters). The default: paste it in chat, a note, an email.
//   PREFIX....  the plain form (A-Z a-z 0-9 - _). For places that only take plain letters, or count bytes:
//               in UTF-8 a CJK character is three bytes, so a byte-counted box carries more of the plain form.
// The decoder ignores spaces and line breaks a messenger puts in, and says plainly when a code is cut short.
//
// Usage:
//   const code = await packCode('MYGAME1', save);             // short
//   const plain = await packCode('MYGAME1', save, { plain: true });
//   const save = await unpackCode('MYGAME1', text);            // either form
// Version the prefix with the save format (MYGAME1, MYGAME2): a code says what it holds.

const BASE = 0x4e00; // 16,384 CJK Unified Ideographs, U+4E00-U+8DFF: assigned since Unicode 1.1, unchanged by NFC/NFD
const TAIL = 0x3400; // one closing character, U+3400 + the number of padding bits (0-13) in the last one
const COLS = '\u0000c';
const VALS = '\u0000v';
const MISSING = '\u0000';

/** Arrays of plain objects stored by column, recursively. Reversed by uncolumnize. */
export function columnize(x) {
  if (Array.isArray(x)) {
    if (x.length >= 4 && x.every((e) => e !== null && typeof e === 'object' && !Array.isArray(e))) {
      const keys = [];
      for (const e of x) for (const k of Object.keys(e)) if (!keys.includes(k)) keys.push(k);
      return { [COLS]: keys, [VALS]: keys.map((k) => x.map((e) => (k in e && e[k] !== undefined ? columnize(e[k]) : MISSING))) };
    }
    return x.map(columnize);
  }
  if (x !== null && typeof x === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(x)) if (v !== undefined) out[k] = columnize(v);
    return out;
  }
  return x;
}

export function uncolumnize(x) {
  if (Array.isArray(x)) return x.map(uncolumnize);
  if (x !== null && typeof x === 'object') {
    if (COLS in x && VALS in x) {
      const keys = x[COLS];
      const vals = x[VALS];
      const n = vals.length ? vals[0].length : 0;
      const rows = [];
      for (let i = 0; i < n; i++) {
        const row = {};
        keys.forEach((k, j) => { const v = vals[j][i]; if (v !== MISSING) row[k] = uncolumnize(v); });
        rows.push(row);
      }
      return rows;
    }
    const out = {};
    for (const [k, v] of Object.entries(x)) out[k] = uncolumnize(v);
    return out;
  }
  return x;
}

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Bytes as CJK ideographs, 14 bits each, and one closing character. */
export function toBase16384(bytes) {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 14) { bits -= 14; out += String.fromCharCode(BASE + ((acc >> bits) & 0x3fff)); }
    acc &= (1 << bits) - 1;
  }
  const pad = bits ? 14 - bits : 0;
  if (bits) out += String.fromCharCode(BASE + ((acc << pad) & 0x3fff));
  return out + String.fromCharCode(TAIL + pad);
}

export function fromBase16384(text) {
  const end = text.charCodeAt(text.length - 1) - TAIL;
  if (!(end >= 0 && end < 14)) throw new Error('cut short');
  const total = (text.length - 1) * 14 - end;
  if (total < 0 || total % 8) throw new Error('cut short');
  const out = new Uint8Array(total / 8);
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const v = text.charCodeAt(i) - BASE;
    if (v < 0 || v > 0x3fff) throw new Error('not a code');
    acc = ((acc << 14) | v) & 0x3fffff;
    bits += 14;
    while (bits >= 8 && o < out.length) { bits -= 8; out[o++] = (acc >> bits) & 0xff; }
  }
  return out;
}

function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Any JSON-able value as a code: PREFIX~ (short) or PREFIX. (plain). */
export async function packCode(prefix, value, opts = {}) {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(columnize(value))), new CompressionStream('deflate-raw'));
  return opts.plain ? `${prefix}.${toBase64Url(bytes)}` : `${prefix}~${toBase16384(bytes)}`;
}

/** The value inside a code made by packCode with this prefix, either form. Throws a sentence a player can act on. */
export async function unpackCode(prefix, text) {
  const t = text.replace(/\s+/g, '');
  if (!t.startsWith(prefix)) throw new Error(`That is not a code for this game (it should begin ${prefix}).`);
  const form = t.charAt(prefix.length);
  const body = t.slice(prefix.length + 1);
  let bytes;
  try {
    bytes = await pipe(form === '~' ? fromBase16384(body) : fromBase64Url(body), new DecompressionStream('deflate-raw'));
  } catch {
    throw new Error('The code is damaged or cut short. Check it was copied in full.');
  }
  return uncolumnize(JSON.parse(new TextDecoder().decode(bytes)));
}
