// Adds the Pokemon Red and Blue clean-room build to the catalogue (idempotent).
import {readFile,writeFile} from 'node:fs/promises';
const file='src/data/games.json';
const games=JSON.parse(await readFile(file,'utf8'));
if(!games.some(g=>g.id==='pokemon-red-blue')){
 games.splice(games.findIndex(g=>g.id==='skate-3'),0,{
  id:'pokemon-red-blue',title:'Pokémon Red and Blue',aliases:['pokered','pokemon red','pokemon blue'],year:1996,genre:'RPG',kind:'Decompilation',mode:'embed',
  engine:'the pret/pokered disassembly on EmulatorJS (gambatte)',
  description:'Catch, train and battle across Kanto.',
  overview:'Pokémon Red and Blue running in the browser, built from the pret/pokered disassembly on EmulatorJS (gambatte). Every picture — tilesets, sprites, all 151 Pokémon, trainers, font and menus — has been redrawn by the clean-room pipeline from coarse facts, so the build ships no original ROM or artwork. Switch between Red and Blue on the game page.',
  source:'https://github.com/andrewnakas/pokered-cleanroom',
  engineLicense:'See the upstream project and the clean-room repository',
  assetLicense:'Regenerated clean-room assets; no retail data is distributed',
  assetRequirements:'No original game files needed.',
  controls:['Arrow keys — move','X — A','Z — B','Enter — Start','Shift — Select','Gamepad — any standard controller, detected automatically','Touch — on-screen Game Boy pad on phones and tablets'],
  saveInstructions:'Saving in the game is kept in this browser, under andrewnakas.github.io. Clearing site data removes it.',
  limitations:['Work in progress: redrawn pictures differ from the retail game by design.'],
  inputs:['Gamepad','Keyboard','Touch'],downloadMB:null,complete:false,color:'#e0a030',shelf:'cleanroom',platform:'Game Boy',launch:'embed',touch:true,
  embedUrl:'https://andrewnakas.github.io/pokered-cleanroom/',
  verification:{status:'smoke-tested',date:null,browsers:[],scope:'Headless Edge test of the live build: boots, picture, sound, input. A local run went through the intro and naming screens into Red’s house.',playthrough:false},
  image:'/images/pokemon-red-blue.png',
 });
 await writeFile(file,JSON.stringify(games,null,1)+'\n');
}
console.log(`catalogue now ${games.length}`);
