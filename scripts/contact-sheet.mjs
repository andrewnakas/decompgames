// Contact sheets of the clean-room captures (test-results/capture), eight games per sheet.
import {chromium} from '@playwright/test';
import {readdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ids=[...new Set(readdirSync('test-results/capture').map(f=>f.replace(/-\d\.png$/,'')))].sort();
const browser=await chromium.launch({channel:'msedge'});
for(const [n,part] of [ids.slice(0,8),ids.slice(8)].entries()){
 const html=`<body style="margin:0;background:#111;color:#fff;font:12px system-ui">${part.map(id=>`<div style="display:flex;align-items:center"><div style="width:110px;padding:4px">${id}</div>${[1,2,3,4].map(i=>`<img src="capture/${id}-${i}.png" width="200" height="150" style="margin:2px">`).join('')}</div>`).join('')}</body>`;
 writeFileSync('test-results/sheet.html',html);
 const page=await browser.newPage({viewport:{width:940,height:part.length*154+4}});
 await page.goto(pathToFileURL('test-results/sheet.html').href);
 await page.screenshot({path:`test-results/sheet-${n}.png`});await page.close();
}
await browser.close();
