// Original geometric tile designs; generated artwork/data dedicated under CC0-1.0.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {encodePlanar} from './lib/supaplex-planar.mjs';
const out=resolve(process.argv[2]||'.cache/open-tiles');await mkdir(out,{recursive:true});
const width=640,height=16,pixels=new Uint8Array(width*height);
const colors=['#101722','#8995a8','#223851','#397faf','#51c4d5','#75e5d1','#ffc36b','#ed805e','#485c73','#7994b5','#e3f2ff','#ff718c','#956ed9','#cadc81','#69a2fa','#ffffff'];
function put(tile,x,y,color){if(x>=0&&x<16&&y>=0&&y<16)pixels[y*width+tile*16+x]=color;}
function rect(tile,x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(tile,xx,yy,color);}
for(let tile=1;tile<40;tile++) {
  // Unsupported tiles have a conspicuous diagnostic cross; never silent blank placeholders.
  rect(tile,1,1,14,14,2);for(let i=3;i<13;i++){put(tile,i,i,11);put(tile,15-i,i,11);}
}
for(const tile of [1,2,3,4,5,6,7])rect(tile,0,0,16,16,0);
// Boulder: faceted hexagon. Base: sparse, removable diagonal substrate.
for(let y=2;y<14;y++)for(let x=2;x<14;x++)if(Math.abs(x-7.5)+Math.abs(y-7.5)<9)put(1,x,y,y<7?1:8);
rect(1,5,4,4,2,10);
for(let y=1;y<16;y+=4)for(let x=1;x<16;x+=4){put(2,x,y,3);put(2,x+1,y+1,2);}
// Player: small autonomous rover, deliberately distinct from the original character.
rect(3,3,4,10,8,4);rect(3,4,3,8,1,5);rect(3,5,6,6,3,0);rect(3,6,7,1,1,15);rect(3,9,7,1,1,15);rect(3,2,11,3,3,8);rect(3,11,11,3,3,8);
// Collectible: luminous triangular token.
for(let y=3;y<13;y++)for(let x=3;x<13;x++)if(Math.abs(x-7.5)<(y-2)/2)put(4,x,y,6);
rect(4,7,6,2,3,15);
// Chip and wall have different silhouettes and values.
rect(5,4,4,8,8,9);rect(5,6,6,4,4,0);for(let i=3;i<14;i+=3){rect(5,i,1,1,3,1);rect(5,i,12,1,3,1);}
rect(6,0,0,16,16,8);rect(6,1,1,14,2,9);rect(6,1,14,14,1,2);rect(6,7,3,1,11,2);
// Exit: framed gateway with an arrow pointing through it.
rect(7,2,1,12,14,5);rect(7,4,3,8,10,0);rect(7,5,7,6,2,10);for(let d=0;d<4;d++){put(7,10-d,7-d,10);put(7,10-d,8+d,10);}
const bytes=encodePlanar(pixels,width,height);await writeFile(resolve(out,'FIXED.DAT'),bytes);
const rects=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[pixels[y*width+x]]}"/>`);
await writeFile(resolve(out,'tiles-preview.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 16" width="1920" height="48">${rects.join('')}</svg>`);
await writeFile(resolve(out,'manifest.json'),JSON.stringify({license:'CC0-1.0',originalAssetsUsed:false,engineTested:false,palettePreviewOnly:colors,supportedTileIds:[0,1,2,3,4,5,6,7],unsupportedTileIds:Array.from({length:32},(_,i)=>i+8),file:{name:'FIXED.DAT',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}},null,2)+'\n');
console.log('Generated FIXED.DAT and vector preview. Animated sprites and runtime palette still pending.');
