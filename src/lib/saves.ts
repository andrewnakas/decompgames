export interface SaveBackup { format: 1; game: string; version: string; files: {path: string; data: number[]}[] }

/** Validate the complete backup before changing any existing files. */
export function validateBackup(value: unknown, game: string, version: string, roots: string[]): SaveBackup {
  const backup = value as SaveBackup;
  if (backup?.format !== 1 || backup.game !== game || backup.version !== version || !Array.isArray(backup.files) || backup.files.length > 500) {
    throw new Error('This backup belongs to another game or incompatible runtime version.');
  }
  let bytes = 0;
  const paths = new Set<string>();
  for (const file of backup.files) {
    if (!file || typeof file.path !== 'string' || file.path.length > 4096 || file.path.endsWith('/') || file.path.includes('\\') || file.path.includes('\0') ||
      file.path.split('/').some(p => p === '.' || p === '..') || file.path.includes('//') ||
      !roots.some(root => file.path.startsWith(root + '/') && file.path.length > root.length + 1) || paths.has(file.path) ||
      !Array.isArray(file.data) || !file.data.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
      throw new Error('Invalid save data or path.');
    }
    paths.add(file.path);
    bytes += file.data.length;
    if (bytes > 8 * 1024 * 1024) throw new Error('Save data exceeds 8 MB.');
  }
  // A file cannot also be the parent directory of another file. Check both
  // orderings before the caller removes any existing saves.
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 2; i < parts.length; i++) {
      if (paths.has(parts.slice(0, i).join('/'))) throw new Error('Conflicting save file and directory paths.');
    }
  }
  return backup;
}
