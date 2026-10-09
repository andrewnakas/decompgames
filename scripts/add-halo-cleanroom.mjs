// Adds the Halo: Combat Evolved clean-room build to the catalogue (idempotent).
import {readFile,writeFile} from 'node:fs/promises';
const file='src/data/games.json';
const games=JSON.parse(await readFile(file,'utf8'));
if(!games.some(g=>g.id==='halo-combat-evolved')){
 games.splice(games.findIndex(g=>g.id==='graveshift'),0,{
  id:'halo-combat-evolved',title:'Halo: Combat Evolved',aliases:['halo','halo ce','halo 1','halo combat evolved','blood gulch'],year:2001,genre:'Shooter',kind:'Decompilation',mode:'embed',
  engine:'the OpenCE decompilation of the Xbox game, compiled to WebAssembly (WebGL2)',
  description:'The original Xbox shooter in the browser, with clean-room multiplayer maps.',
  overview:'Halo: Combat Evolved running in the browser from the CC0 OpenCE decompilation of the Xbox game, compiled to WebAssembly and drawn with WebGL2. The menu and all 13 multiplayer maps are rebuilt by the clean-room pipeline: map geometry and scripts are kept, and every texture, sound and font is regenerated or replaced with CC0 material, so no retail data is distributed. You can also import your own Xbox disc image to play the retail game locally.',
  source:'https://github.com/andrewnakas/halo-cleanroom',
  engineLicense:'CC0-1.0 (OpenCommunityEdition/OpenCE and the fqlx web port)',
  assetLicense:'Regenerated clean-room maps with CC0 textures and sounds; no retail data is distributed',
  assetRequirements:'No original game files needed. Optional: import your own Xbox disc image, which is read in the browser and never uploaded.',
  controls:['W A S D — move','Mouse — look, left button fires, right button throws a grenade','Space — jump, Ctrl — crouch','E — action, R — reload, Tab — switch weapon','Gamepad — original Xbox layout'],
  saveInstructions:'Downloaded maps and settings are kept in this browser\'s storage. Clearing site data removes them.',
  limitations:['Opens in its own tab: the build needs cross-origin isolation for threads.','Desktop Chrome or Edge recommended; phones are not supported.','Blood Gulch is a 30 MB download; all 13 maps are 274 MB.','Multiplayer maps only so far: the campaign is still being rebuilt.','Work in progress: regenerated textures and sounds differ from the retail game by design, and only three of the maps have been looked at in the browser.'],
  inputs:['Gamepad','Keyboard'],downloadMB:30,complete:false,color:'#e0a030',shelf:'cleanroom',platform:'Xbox',launch:'tab',touch:false,
  embedUrl:'https://andrewnakas.github.io/halo-cleanroom/',
  verification:{status:'smoke-tested',date:'2026-10-09',browsers:['Chrome (headless, muted)'],scope:'Headless Chrome boots the main menu and loads Blood Gulch, Beaver Creek and Sidewinder from the clean maps (first person, HUD, walking). Nobody has played a match by hand yet.',playthrough:false},
  image:'/images/halo-combat-evolved.png',
 });
 await writeFile(file,JSON.stringify(games,null,1)+'\n');
}
console.log(`catalogue now ${games.length}`);
