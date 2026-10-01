import {readdir,readFile,writeFile} from 'node:fs/promises';
async function walk(dir){const list=await readdir(dir,{withFileTypes:true});return (await Promise.all(list.map(f=>f.isDirectory()?walk(`${dir}/${f.name}`):`${dir}/${f.name}`))).flat();}
const files=await walk('dist');
const paths=files.filter(p=>p.endsWith('/index.html')&&!p.includes('/play/')&&!p.includes('/engine/')&&!p.includes('/runtime/')&&!p.includes('/404')).map(p=>p.replace(/^dist/,'').replace(/index.html$/,''));
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>https://decompgames.com${p}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nDisallow: /runtime/\nSitemap: https://decompgames.com/sitemap.xml\n');
// The feed is built from the dated headings in the updates page: "## September 27, 2026 — Title".
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const updates=(await readFile('src/pages/updates/index.md','utf8')).split(/^## /m).slice(1).map(block=>{
 const [head,...body]=block.split('\n');
 const [date,title]=head.split(' — ');
 const when=new Date(`${date} 12:00:00 GMT`);
 return {title:(title||head).trim(),when,text:body.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim()};
}).filter(u=>!isNaN(u.when));
const items=updates.map(u=>`<item><title>${esc(u.title)}</title><link>https://decompgames.com/updates/</link><guid isPermaLink="false">decompgames-${u.when.toISOString().slice(0,10)}-${esc(u.title)}</guid><pubDate>${u.when.toUTCString()}</pubDate><description>${esc(u.text)}</description></item>`).join('');
await writeFile('dist/feed.xml',`<?xml version="1.0"?><rss version="2.0"><channel><title>Decomp Games updates</title><link>https://decompgames.com/updates/</link><description>Game additions and compatibility updates.</description>${items}</channel></rss>`);
console.log(`Generated sitemap with ${paths.length} indexable pages and a feed with ${updates.length} items.`);
