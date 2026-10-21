/** ROM 内容的 64 位 FNV-1a，用作电池档的键。不用 BigInt，方便较低的编译目标。 */
export function romSaveKey(rom: ArrayBuffer): string {
  const bytes = new Uint8Array(rom);
  let h0 = 0x84222325;
  let h1 = 0xcbf29ce4;
  for (let i = 0; i < bytes.length; i += 1) {
    h0 = (h0 ^ bytes[i]) >>> 0;
    const prodLo = Math.floor(h0 * 0x1b3);
    const low = prodLo >>> 0;
    const high = (Math.floor(prodLo / 0x100000000) + h0 * 0x100 + h1 * 0x1b3) >>> 0;
    h0 = low;
    h1 = high;
  }
  return h1.toString(16).padStart(8, '0') + h0.toString(16).padStart(8, '0');
}
