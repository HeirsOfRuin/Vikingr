// Types for savecode.js (the drop-in kit file stays plain JavaScript, so any game can copy it).
export function columnize(x: unknown): unknown;
export function uncolumnize(x: unknown): unknown;
export function toBase16384(bytes: Uint8Array): string;
export function fromBase16384(text: string): Uint8Array;
export function packCode(prefix: string, value: unknown, opts?: { plain?: boolean }): Promise<string>;
export function unpackCode(prefix: string, text: string): Promise<unknown>;
