// Original procedural rover frames. Generated data CC0-1.0; no original sprites read.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {encodePlanar} from './lib/supaplex-planar.mjs';
const out=resolve(process.argv[2]||'.cache/open-moving');await mkdir(out,{recursive:true});
const width=320,height=462,pixels=new Uint8Array(width*height),regions=[];
function rect(x,y,w,h,c){if(x<0||y<0||x+w>width||y+h>height)throw Error('Sprite outside atlas');for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels[yy*width+xx]=c;}
function rover(x,y,phase){
  rect(x+3,y+4,10,8,4);rect(x+4,y+3,8,1,5);rect(x+5,y+6,6,3,0);
  rect(x+6,y+7,1,1,15);rect(x+9,y+7,1,1,15);
  rect(x+2,y+11,3,3,8);rect(x+11,y+11,3,3,8);
  rect(x+2+(phase%2),y+12,1,1,10);rect(x+11+(phase%2),y+12,1,1,10);
}
// Groups 0–3 share vertically overlapping 16x18 windows in the native atlas.
// Draw each shared region once, preserving the intended two-pixel vertical offset.
for(let frame=0;frame<6;frame++){rover(frame*16,66,frame);regions.push({x:frame*16,y:64,width:16,height:20,role:'vertical walking'});}
// Fill every coordinate referenced by the pinned engine's player animation table.
// This reads placement metadata from GPL engine source, never its bitmap resources.
const animationSource=process.argv[3];
const wideFrames=[];
const animationMetadata=new Map();
if(animationSource) {
  const source=await readFile(animationSource,'utf8');
  const start=source.indexOf('kMurphyAnimationFrameCoordinates'),end=source.indexOf('const Point kBugFrameCoordinates');
  if(start<0||end<=start)throw Error('Pinned player animation table not found');
  const coordinates=[...source.slice(start,end).matchAll(/\{\s*(\d+),\s*(\d+)\s*\}/g)].map(match=>[Number(match[1]),Number(match[2])]);
  if(coordinates.length<100)throw Error('Unexpected player animation coverage');
  for(const [x,y] of coordinates)if(x+16<=width&&y+16<=height)rover(x,y,(x+y)/16);

  const descriptorStart=source.indexOf('kMurphyAnimationDescriptors'),descriptorEnd=source.indexOf('const AnimationFrameCoordinates');
  const descriptorSection=source.slice(descriptorStart,descriptorEnd);
  const descriptorMarkers=[...descriptorSection.matchAll(/\{\s*\/\/\s*(\d+)\s*\n/g)];
  const animationSection=source.slice(start,end);
  const animationMarkers=[...animationSection.matchAll(/\{\s*\/\/\s*(\d+)\s*\n/g)];
  if(descriptorMarkers.length!==50||animationMarkers.length!==37)throw Error('Pinned animation metadata shape changed');
  for(let i=0;i<descriptorMarkers.length;i++) {
    const block=descriptorSection.slice(descriptorMarkers[i].index,descriptorMarkers[i+1]?.index??descriptorSection.length).replace(/\/\/.*$/gm,'');
    const values=[...block.matchAll(/0x[0-9a-f]+|\b\d+\b/gi)].map(m=>Number.parseInt(m[0],0));
    if(values.length<5)throw Error('Malformed player animation descriptor');
    const signed=value=>value>0x7fff?value-0x10000:value;
    const candidate={width:values[2]*8,height:values[3],speedX:signed(values[5]),speedY:signed(values[6])};
    const previous=animationMetadata.get(values[4]);
    if(!previous||candidate.width>previous.width)animationMetadata.set(values[4],candidate);
  }
  for(let i=0;i<animationMarkers.length;i++) {
    const index=Number(animationMarkers[i][1]),metadata=animationMetadata.get(index)||{width:16,height:16,speedX:0,speedY:0};
    if(metadata.width<=16)continue;
    const block=animationSection.slice(animationMarkers[i].index,animationMarkers[i+1]?.index??animationSection.length).replace(/\/\/.*$/gm,'');
    let frameIndex=0;
    for(const match of block.matchAll(/\{\s*(\d+)\s*,\s*(\d+)\s*\}/g))wideFrames.push({x:Number(match[1]),y:Number(match[2]),...metadata,animationIndex:index,frameIndex:frameIndex++});
  }
}
// Repaint every multi-tile player frame after generic coordinate coverage.
// Each horizontal frame clears the full transition region, then places one
// rover at the engine's post-increment position. This covers the old pixels
// and lands the final frame exactly on the destination tile.
for(const frame of wideFrames){
  rect(frame.x,frame.y,frame.width,frame.height,0);
  if(Math.abs(frame.speedX)===2&&frame.speedY===0) {
    const roverX=frame.speedX>0?(frame.frameIndex+1)*2:frame.width-16-(frame.frameIndex+1)*2;
    if(roverX>=0&&roverX+16<=frame.width)rover(frame.x+roverX,frame.y,frame.frameIndex);
  }
  regions.push({...frame,role:'multi-tile transition'});
}
// Engine cursor frames: 4 columns, 2 rows with a one-row gap.
for(let frame=0;frame<8;frame++){const x=(frame%4)*8,y=445+Math.floor(frame/4)*9;for(let i=0;i<6;i++)rect(x,y+i,i+1,1,frame%2?5:10);}
// Plain original edging. No texture is sampled from the old atlas.
rect(288,388,32,24,8);
const bytes=encodePlanar(pixels,width,height);await writeFile(resolve(out,'MOVING.DAT'),bytes);
await writeFile(resolve(out,'manifest.json'),JSON.stringify({license:'CC0-1.0',originalAssetsUsed:false,engineCoordinateMetadataUsed:Boolean(animationSource),engineTested:false,multiTileTransitions:'descriptor-driven horizontal rover',regions,limitations:['Player animation coordinates are populated with one provisional rover drawing','Non-horizontal multi-tile interactions are clear placeholders','Exit, collectible and hazard animations remain unsupported','Walking placement requires in-engine verification'],file:{name:'MOVING.DAT',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}},null,2)+'\n');
console.log('Generated partial moving atlas; not ready for release.');
