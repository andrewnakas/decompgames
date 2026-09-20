/** OpenRCT2 imports require a directory tree, unlike single-file WAD/PAK inputs. */
export interface RCT2FileMetadata { path: string; size: number }
export interface RCT2ImportItem { index: number; path: string; size: number }
const directories = new Map(['Data','ObjData','Scenarios','Landscapes','Tracks'].map(name => [name.toLowerCase(), name]));
const maxBytes = 512 * 1024 * 1024;

/** Validate every path and budget before reading any file bytes. No network access. */
export function planRCT2Import(files: RCT2FileMetadata[]): RCT2ImportItem[] {
  if (!files.length) throw new Error('Choose your RollerCoaster Tycoon 2 installation folder.');
  if (files.length > 20000) throw new Error('The selected folder contains too many files (maximum 20,000).');
  const parts = files.map(file => {
    if (!file || typeof file.path !== 'string' || file.path.length > 4096 ||
        file.path.includes('\\') || file.path.includes('\0') || file.path.includes(':') ||
        file.path.split('/').some(part => !part || part === '.' || part === '..') ||
        !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('Invalid game file path or size.');
    return file.path.split('/');
  });
  // The upstream browser bootstrap uses Data/ch.dat as the installation marker.
  const markers = parts.map((path,index) => ({path,index})).filter(({path}) =>
    path.length >= 2 && path.at(-2)!.toLowerCase() === 'data' && path.at(-1)!.toLowerCase() === 'ch.dat');
  if (markers.length !== 1) throw new Error('Choose one installation containing Data/ch.dat.');
  const prefix = markers[0].path.slice(0,-2);
  const seen = new Set<string>();
  const result: RCT2ImportItem[] = [];
  let total = 0;
  parts.forEach((path,index) => {
    if (!prefix.every((part,i) => path[i] === part)) return;
    const relative = path.slice(prefix.length);
    const directory = directories.get(relative[0]?.toLowerCase());
    if (!directory || relative.length < 2) return; // Exclude installers and unrelated installation files.
    relative[0] = directory;
    if (directory === 'Data' && relative.length === 2 && /^(ch|g1)\.dat$/i.test(relative[1])) relative[1] = relative[1].toLowerCase();
    const target = `/RCT/${relative.join('/')}`;
    const key = target.toLowerCase();
    if (seen.has(key)) throw new Error('The selected folder contains conflicting file names.');
    seen.add(key);
    total += files[index].size;
    if (total > maxBytes) throw new Error('Selected game data exceeds the 512 MiB import limit.');
    result.push({index,path:target,size:files[index].size});
  });
  if (!files[markers[0].index].size) throw new Error('Data/ch.dat is empty. Choose a complete installation.');
  for (const path of seen) {
    const segments = path.split('/');
    for (let i=2;i<segments.length;i++) if (seen.has(segments.slice(0,i).join('/'))) throw new Error('Conflicting file and directory paths.');
  }
  return result;
}

export async function readRCT2Folder(files: File[]) {
  const plan = planRCT2Import(files.map(file => ({path:file.webkitRelativePath || file.name,size:file.size})));
  const loaded = [];
  for (const item of plan) {
    const bytes = new Uint8Array(await files[item.index].arrayBuffer());
    if (bytes.length !== item.size) throw new Error('A selected game file changed during import. Please select the folder again.');
    loaded.push({path:item.path,bytes});
  }
  return loaded;
}
