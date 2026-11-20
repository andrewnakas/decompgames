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
// llms.txt (https://llmstxt.org): the indexable pages, grouped by section, each
// described by its own <title> and meta description. Built from dist rather
// than written by hand, so a new game or guide appears without anyone
// remembering to add it.
const unesc=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const meta=async p=>{const html=await readFile(`dist${p}index.html`,'utf8');
 const title=unesc((html.match(/<title>([^<]*)<\/title>/)||[,''])[1]).replace(/ — Decomp Games$/,'').trim();
 const desc=unesc((html.match(/<meta name="description" content="([^"]*)"/)||[,''])[1]).trim();
 return {p,title,desc};};
const pages=await Promise.all(paths.map(meta));
const home=pages.find(x=>x.p==='/');
const line=x=>`- [${x.title}](https://decompgames.com${x.p})${x.desc&&(x.p==='/'||x.desc!==home.desc)?`: ${x.desc}`:''}`;
const byTitle=(a,b)=>a.title.localeCompare(b.title);
const sections=[
 ['Start here',['/','/games/','/guides/getting-started/'].map(p=>pages.find(x=>x.p===p)).filter(Boolean)],
 ['Guides',pages.filter(x=>x.p.startsWith('/guides/')&&x.p!=='/guides/getting-started/')],
 ['Platforms',pages.filter(x=>x.p.startsWith('/platform/')).sort(byTitle)],
 ['Games',pages.filter(x=>x.p.startsWith('/games/')&&x.p!=='/games/').sort(byTitle)],
 ['About the project',pages.filter(x=>!/^\/(games|guides|platform)\//.test(x.p)&&x.p!=='/')],
];
const listed=new Set(sections.flatMap(([,xs])=>xs.map(x=>x.p)));
const missed=pages.filter(x=>!listed.has(x.p));
if(missed.length)throw new Error(`llms.txt: no section for ${missed.map(x=>x.p).join(', ')}`);
await writeFile('dist/llms.txt',`# Decomp Games

> ${home.desc} Games run in a browser tab with no account; selected game files are read locally, never uploaded, and saves stay in your browser.

Decomp Games is an independent open-source catalog of decompilations, engine recreations and source ports. Every entry links to its upstream source. The website source and catalog are public at https://github.com/andrewnakas/decompgames.

${sections.filter(([,xs])=>xs.length).map(([h,xs])=>`## ${h}\n\n${xs.map(line).join('\n')}`).join('\n\n')}
`);
console.log(`Generated sitemap with ${paths.length} indexable pages, llms.txt and a feed with ${updates.length} items.`);
