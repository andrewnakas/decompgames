import {unzipSync} from 'fflate';
export const MAX_IMPORT_BYTES=256*1024*1024;
export type LocalAsset={name:string;bytes:Uint8Array};
export function validateContainer(name:string,bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const magic=new TextDecoder().decode(bytes.subarray(0,4));
 if(/\.wad$/i.test(name)){if(bytes.length<12||!['IWAD','PWAD'].includes(magic))throw Error(`${name}: not a valid WAD.`);const count=view.getInt32(4,true),offset=view.getInt32(8,true);if(count<0||offset<12||offset+count*16>bytes.length)throw Error(`${name}: damaged WAD directory.`);for(let i=0;i<count;i++){const pos=view.getInt32(offset+i*16,true),size=view.getInt32(offset+i*16+4,true);if(pos<0||size<0||pos+size>bytes.length)throw Error(`${name}: damaged WAD entry.`);}}
 else if(/\.pak$/i.test(name)){if(bytes.length<12||magic!=='PACK')throw Error(`${name}: not a valid PAK.`);const offset=view.getInt32(4,true),size=view.getInt32(8,true);if(offset<12||size<0||size%64||offset+size>bytes.length)throw Error(`${name}: damaged PAK directory.`);for(let i=offset;i<offset+size;i+=64){const pos=view.getInt32(i+56,true),len=view.getInt32(i+60,true);if(pos<0||len<0||pos+len>bytes.length)throw Error(`${name}: damaged PAK entry.`);}}
 else throw Error('Select WAD or PAK game data, or a ZIP containing it.');
}
export async function readGameFiles(files:File[],engine:string):Promise<LocalAsset[]>{
 if(!files.length)throw Error('Select your game files first.');
 if(files.reduce((n,f)=>n+f.size,0)>MAX_IMPORT_BYTES)throw Error('The import exceeds the 256 MB limit.');
 const assets:LocalAsset[]=[];let total=0;
 const add=(name:string,bytes:Uint8Array)=>{const base=name.replaceAll('\\','/').split('/').pop()!.toLowerCase();if(!/\.(wad|pak)$/.test(base))return;total+=bytes.length;if(total>MAX_IMPORT_BYTES)throw Error('Extracted data exceeds the 256 MB limit.');if(assets.some(a=>a.name===base))throw Error(`Duplicate file: ${base}`);validateContainer(base,bytes);assets.push({name:base,bytes});};
 for(const file of files){const bytes=new Uint8Array(await file.arrayBuffer());if(/\.zip$/i.test(file.name)){let count=0,declared=0;const entries=unzipSync(bytes,{filter(entry){count++;declared+=entry.originalSize;if(count>256||declared>MAX_IMPORT_BYTES||entry.originalSize>MAX_IMPORT_BYTES)throw Error('ZIP exceeds extraction limits.');return /\.(wad|pak)$/i.test(entry.name);}});for(const [name,data] of Object.entries(entries))add(name,data);}else add(file.name,bytes);}
 if(engine==='quake'&&!assets.some(a=>a.name==='pak0.pak'))throw Error('Quake needs pak0.pak from the id1 folder.');
 if(engine==='doom'&&!assets.some(a=>new TextDecoder().decode(a.bytes.subarray(0,4))==='IWAD'))throw Error('Doom needs a base IWAD, not only a mod PWAD.');
 return assets.filter(a=>engine==='quake'?/^pak[01]\.pak$/.test(a.name):a.name.endsWith('.wad'));
}
