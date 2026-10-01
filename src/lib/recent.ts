// Recently played ids, newest first, for the home page's "Continue playing" row.
export function remember(id: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem('dg:recent') || '[]');
    localStorage.setItem('dg:recent', JSON.stringify([id, ...list.filter(x => x !== id)].slice(0, 12)));
  } catch { /* storage unavailable */ }
}
