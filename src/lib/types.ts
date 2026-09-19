export type PlayMode = 'instant' | 'files' | 'demo' | 'project';
export type ProjectKind = 'Decompilation' | 'Recompilation' | 'Engine recreation' | 'Source port';
export interface Verification { status: 'unverified' | 'smoke-tested' | 'gameplay-tested'; date: string | null; browsers: string[]; scope: string; playthrough: boolean; }
export interface GameEntry {
  id: string; title: string; aliases: string[]; year: number; genre: string; kind: ProjectKind;
  mode: PlayMode; engine: string; description: string; overview: string; source: string; website?: string;
  engineLicense: string; assetLicense: string; assetRequirements: string; controls: string[];
  saveInstructions: string; limitations: string[]; inputs: string[]; downloadMB: number | null;
  complete: boolean; image?: string; color: string; runtime?: string; dataKey?: string;
  verification: Verification;
}
export interface RuntimeManifest { id: string; packageRevision: string; sourceRevision: string | null; repository: string; toolchain: string; recipe: string; sourceArchive: string; requirements: string[]; files: { path: string; sha256: string; bytes: number }[]; }
export interface GameAdapter { start(files?: File[]): Promise<void>; stop(): void; exportSave(): Promise<Blob>; importSave(file: File): Promise<void>; deleteSave(): Promise<void>; }
