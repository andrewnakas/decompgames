// File-format implementation based on the pinned engine's graphics.c, not game artwork.
export function encodePlanar(pixels,width,height) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width%8||width*height!==pixels.length)
    throw Error('Invalid planar bitmap dimensions');
  const output=new Uint8Array(width*height/2),stride=width/8;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const color=pixels[y*width+x];
    if(!Number.isInteger(color)||color<0||color>15)throw Error('Palette index must be 0–15');
    for(let plane=0;plane<4;plane++)output[y*stride*4+plane*stride+(x>>3)]|=((color>>plane)&1)<<(7-(x%8));
  }
  return output;
}

export function decodePlanar(bytes,width,height) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width%8||bytes.length!==width*height/2)
    throw Error('Invalid planar byte length');
  const pixels=new Uint8Array(width*height),stride=width/8;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let plane=0;plane<4;plane++)
    pixels[y*width+x]|=((bytes[y*stride*4+plane*stride+(x>>3)]>>(7-x%8))&1)<<plane;
  return pixels;
}
