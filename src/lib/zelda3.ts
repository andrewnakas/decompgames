// assets.h / main.c at snesrev/zelda3 fbbb3f967a51fafe642e6140d0753979e73b4090.
const signature = [90,101,108,100,97,51,95,118,48,32,32,32,32,32,10,0,27,174,233,45,74,174,252,50,49,27,153,197,27,43,216,197,132,101,173,169,36,108,15,155,176,169,57,131,174,101,51,207];
const assetCount = 165;
export const MAX_ZELDA3_BYTES = 32 * 1024 * 1024;

export function validateZelda3Assets(bytes: Uint8Array): void {
  const headerSize = 88 + assetCount * 4;
  if (bytes.length > MAX_ZELDA3_BYTES) throw Error('Zelda asset file exceeds the 32 MB limit.');
  if (bytes.length < headerSize || signature.some((value, i) => bytes[i] !== value))
    throw Error('Not a compatible zelda3_assets.dat. Extract assets using the documented Zelda3 source revision.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(80, true) !== assetCount) throw Error('Zelda asset count does not match this engine.');
  let offset = headerSize + view.getUint32(84, true);
  if (offset > bytes.length) throw Error('Zelda asset header extends beyond the file.');
  for (let i = 0; i < assetCount; i++) {
    // Arithmetic avoids the 32-bit wraparound of bitwise alignment on hostile input.
    offset = Math.ceil(offset / 4) * 4;
    const size = view.getUint32(88 + i * 4, true);
    if (offset + size > bytes.length) throw Error(`Zelda asset ${i + 1} extends beyond the file.`);
    offset += size;
  }
}

export async function readZelda3Files(files: File[]) {
  if (files.length !== 1 || files[0].name.toLowerCase() !== 'zelda3_assets.dat')
    throw Error('Choose one zelda3_assets.dat file extracted from your supported game copy.');
  if (files[0].size > MAX_ZELDA3_BYTES) throw Error('Zelda asset file exceeds the 32 MB limit.');
  const bytes = new Uint8Array(await files[0].arrayBuffer());
  validateZelda3Assets(bytes);
  return [{name: 'zelda3_assets.dat', bytes}];
}
