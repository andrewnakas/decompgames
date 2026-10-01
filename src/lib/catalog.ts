import entries from '../data/games.json';
import type { GameEntry, PlayMode } from './types';
export const games = entries as GameEntry[];
export const labels: Record<PlayMode, string> = {instant:'Play now', files:'Play with your files', embed:'Play now'};
export const gameUrl = (id: string) => `/games/${id}/`;
export function playerUrl(id: string) { return `${import.meta.env.PUBLIC_PLAYER_ORIGIN || ''}/play/${id}/`; }
export const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const cleanroom = games.filter(g => g.shelf === 'cleanroom');
export const classics = games.filter(g => g.shelf === 'classic');
export const platforms = [...new Set(games.map(g => g.platform))];
export const genres = [...new Set(games.map(g => g.genre))].sort();
export const statusLabel = (g: GameEntry) => g.verification.status === 'gameplay-tested' ? 'Playable' : g.verification.status === 'smoke-tested' ? 'Boots, lightly tested' : 'Untested';
// Categories a card can be filtered by: shelf, platform, genre.
export const cats = (g: GameEntry) => [g.shelf, slug(g.platform), slug(g.genre)];
