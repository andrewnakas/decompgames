import {readdir,writeFile} from 'node:fs/promises';
async function walk(dir){const list=await readdir(dir,{withFileTypes:true});return (await Promise.all(list.map(f=>f.isDirectory()?walk(`${dir}/${f.name}`):`${dir}/${f.name}`))).flat();}
const files=await walk('dist');
const paths=files.filter(p=>p.endsWith('/index.html')&&!p.includes('/play/')&&!p.includes('/engine/')&&!p.includes('/runtime/')).map(p=>p.replace(/^dist/,'').replace(/index.html$/,''));
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>https://decompgames.com${p}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nDisallow: /runtime/\nSitemap: https://decompgames.com/sitemap.xml\n');
await writeFile('dist/feed.xml','<?xml version="1.0"?><rss version="2.0"><channel><title>Decomp Games updates</title><link>https://decompgames.com/updates/</link><description>Game additions and compatibility updates.</description><item><title>Building the first collection</title><link>https://decompgames.com/updates/</link><guid>https://decompgames.com/updates/#first-collection</guid><pubDate>Fri, 18 Sep 2026 12:00:00 GMT</pubDate><description>A searchable collection with source links and explicit verification records.</description></item></channel></rss>');
console.log(`Generated sitemap with ${paths.length} indexable pages.`);
