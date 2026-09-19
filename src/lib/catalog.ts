import entries from '../data/games.json';
import type { GameEntry, PlayMode } from './types';
export const games = entries as GameEntry[];
export const labels: Record<PlayMode, string> = {instant:'Play now', files:'Play with your files', demo:'Play demo', project:'View project'};
export const gameUrl = (id: string) => `/games/${id}/`;
export function playerUrl(id: string) { return `${import.meta.env.PUBLIC_PLAYER_ORIGIN || ''}/play/${id}/`; }
export const counts = { all: games.length, instant: games.filter(g=>g.mode==='instant').length, files:games.filter(g=>g.mode==='files').length, project:games.filter(g=>g.mode==='project').length };
