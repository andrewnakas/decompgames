// Adds the October 8 bring-your-own-ROM batch to the catalogue (idempotent):
// Pokémon Crystal, Sonic the Hedgehog 2, Mario Party 2, Mario Party 3.
import {readFile,writeFile} from 'node:fs/promises';
const file='src/data/games.json';
const games=JSON.parse(await readFile(file,'utf8'));
const tested='2026-10-08';
const browsers=['Edge (headless, muted)'];
const n64Controls=['Arrow keys — stick','X — A','C — B','Z — Z','Q / S — L / R','I J K L — C buttons','T F G H — D-pad','Enter — Start','Gamepad — standard mapping'];
const n64Limits=game=>[
 'Requires your own ROM; none is provided.',
 'This is the rebuilt cartridge running on an N64 emulator core, not a native port of the game code.',
 'The decompilation is partial: much of the game is still assembly, even though the build matches byte for byte.',
 'Audio is unverified: every test ran muted.',
 `Only the scope under Verification was played; the rest of ${game} is untested.`,
 'Keyboard and gamepad only: no on-screen touch pad. Single browser tab, so no netplay.',
];
const batch=[
 {after:'pokemon-gold-silver',game:{
  id:'pokemon-crystal',title:'Pokémon Crystal',aliases:['pokecrystal','Pokemon Crystal','crystal'],year:2000,genre:'RPG',kind:'Decompilation',mode:'files',
  engine:'The real ROM, built byte-for-byte from the pret/pokecrystal disassembly, running on the libretro Gambatte core (EmulatorJS 4.2.3, WebAssembly)',
  description:'Johto again, with Suicune, the Battle Tower and animated Pokémon.',
  overview:'Pokémon Crystal built from the pret/pokecrystal disassembly with rgbds 1.0.4, byte-identical to the v1.1 cartridge, running in the browser on a WebAssembly Game Boy Color core. You supply your own ROM: it is read in the tab, never uploaded, and the page recognises v1.0 or v1.1 by its SHA-1. Battery saves persist in this browser.',
  source:'https://github.com/andrewnakas/pokecrystal-web',
  engineLicense:'EmulatorJS is GPL-3.0 and the Gambatte core is GPL-2.0; the pret/pokecrystal disassembly is unlicensed research. See web/THIRD_PARTY.md.',
  assetLicense:'No game data is distributed. Everything comes from the ROM you load.',
  assetRequirements:'You supply your own Pokémon Crystal ROM (USA/Europe, 2,097,152 bytes). It is read in the browser and never uploaded. v1.1 sha1 f2f52230b536214ef7c9924f483392993e226cfb (the ROM this build reproduces), v1.0 sha1 f4cd194bdee0d04ca4eac29e09b8e4e9d818c133.',
  controls:['Arrow keys — D-pad','X — A','Z — B','Enter — Start','Shift — Select','Gamepad — standard mapping','Touch — on-screen Game Boy pad on phones and tablets'],
  saveInstructions:'Save in game the normal way (START → SAVE). The battery save is kept in this browser\'s storage and survives a reload. Clearing site data removes it.',
  limitations:['Requires your own ROM; none is provided.','Only the opening was play-tested: a new game to the bedroom, walking, and an in-game save read back in a fresh session. Nothing after that has been exercised.','Audio is unverified: every test ran muted.','Real-time-clock behaviour over days is untested.','Link trading, battling and the mobile adapter features are not possible in a single browser tab.'],
  inputs:['Gamepad','Keyboard','Touch'],downloadMB:null,complete:false,color:'#7fb8d8',shelf:'classic',platform:'Game Boy Color',launch:'embed',touch:true,
  embedUrl:'https://andrewnakas.github.io/pokecrystal-web/',
  verification:{status:'smoke-tested',date:tested,browsers,scope:'The v1.1 ROM builds byte-identical to the cartridge (sha1 match). In the browser, muted: new game to the player\'s bedroom, movement, an in-game SAVE, and the 32 KiB battery save restored in a fresh session showing the saved player. The published page was loaded through its own file picker to the title menu with the save store active and no off-origin requests.',playthrough:false},
 }},
 {after:'sonic-the-hedgehog',game:{
  id:'sonic-the-hedgehog-2',title:'Sonic the Hedgehog 2',aliases:['sonic2','sonic 2','s2disasm'],year:1992,genre:'Platformer',kind:'Decompilation',mode:'files',
  engine:'the sonicretro/s2disasm disassembly, reassembled to a matching ROM and run on mdcore, an MIT-licensed Mega Drive core (WebAssembly)',
  description:'Tails joins in, the spin dash arrives, and Emerald Hill sets the pace.',
  overview:'Sonic the Hedgehog 2 reassembled from the sonicretro/s2disasm disassembly, byte-identical to the cartridge, and run in the browser on mdcore, this project\'s own MIT-licensed Mega Drive core. You supply your own ROM: it is read in the tab and never uploaded.',
  source:'https://github.com/andrewnakas/sonic2-web',
  engineLicense:'mdcore is MIT; sonicretro/s2disasm is unlicensed research. See web/THIRD-PARTY-NOTICES.txt.',
  assetLicense:'None distributed — the player supplies their own ROM',
  assetRequirements:'Your own Sonic the Hedgehog 2 ROM (1,048,576 bytes). Rev B from the Sonic Classics compilation, sha1 2af1003247aec262089c8df22d05e80d04a1b5e4, is the one tested; REV01, sha1 8bca5dcef1af3e00098666fd892dc1c2a76333f9, is also recognised. Nothing is uploaded.',
  controls:['Arrow keys — move','Z / X / C — A / B / C (any jumps)','Enter — Start','Gamepad — standard mapping'],
  saveInstructions:'Sonic 2 has no battery save, and this page keeps nothing in browser storage — your ROM is asked for again after a reload.',
  limitations:['Requires your own ROM; none is provided.','Sound is on by default (the Sound button under the game turns it off); it was measured, not listened to.','Verified only as far as running through the start of Emerald Hill Zone. Later zones, bosses, special stages and two-player mode have not been play-tested.','mdcore was tuned against Sonic 1; small timing differences from real hardware are possible.','No on-screen touch pad.'],
  inputs:['Keyboard','Gamepad'],downloadMB:null,complete:false,color:'#2f7fe0',shelf:'classic',platform:'Mega Drive',launch:'embed',touch:false,
  embedUrl:'https://andrewnakas.github.io/sonic2-web/',
  verification:{status:'smoke-tested',date:tested,browsers,scope:'Rev B reassembles byte-identical to the Sonic Classics image once the retail header checksum (two bytes) is restored; REV01 passes upstream\'s bit-perfect check. In the browser, muted: the ROM was read through the page\'s file picker with a matching sha1, booted through the SEGA and title screens into Emerald Hill Zone, and Sonic ran right under keyboard input with rings and the HUD counting. No page errors and no off-origin requests.',playthrough:false},
 }},
 {after:null,game:{
  id:'mario-party-2',title:'Mario Party 2',aliases:['mp2','marioparty2','mario party 2'],year:1999,genre:'Party',kind:'Decompilation',mode:'files',
  engine:'The real ROM, rebuilt byte-for-byte from the mariopartyrd/marioparty2 decompilation, running on the libretro Mupen64Plus-Next core (EmulatorJS 4.2.3, WebAssembly)',
  description:'Costumed boards, item shops and a fresh set of minigames.',
  overview:'Mario Party 2 rebuilt from the mariopartyrd/marioparty2 decompilation, all 32 MiB identical to the USA cartridge, running in the browser on a WebAssembly N64 core. You supply your own ROM: it is read in the tab and never uploaded, and the page recognises it by its SHA-1 in any of the three N64 byte orders.',
  source:'https://github.com/andrewnakas/marioparty2-web',
  engineLicense:'EmulatorJS is GPL-3.0 and the Mupen64Plus-Next core is GPL-2.0; the mariopartyrd/marioparty2 decompilation is unlicensed research. See web/THIRD_PARTY.md.',
  assetLicense:'No game data is distributed. Everything comes from the ROM you load.',
  assetRequirements:'You supply your own Mario Party 2 USA ROM (33,554,432 bytes; .z64, .v64 or .n64). It is read in the browser and never uploaded. sha1 166eda1c05670d337e2c3f15a5db528ae1e5d6e3 in .z64 order — the same ROM this project\'s build produces.',
  controls:n64Controls,
  saveInstructions:'The game\'s own cartridge save is kept in this browser\'s storage and survives a reload. Clearing site data removes it. Save states are available from the emulator menu.',
  limitations:n64Limits('Mario Party 2'),
  inputs:['Gamepad','Keyboard'],downloadMB:null,complete:false,color:'#e0563a',shelf:'classic',platform:'N64',launch:'embed',touch:false,
  embedUrl:'https://andrewnakas.github.io/marioparty2-web/',
  verification:{status:'smoke-tested',date:tested,browsers,scope:'The full ROM rebuilds with zero differing bytes (sha1 match). In the browser, muted: a Space Land round, the Tile Driver minigame through its results screen, a save-state restore in a fresh session and a cartridge-save round trip. The published page was loaded through its own file picker to the title screen with the save store active and no off-origin requests.',playthrough:false},
 }},
 {after:'mario-party-2',game:{
  id:'mario-party-3',title:'Mario Party 3',aliases:['mp3','marioparty3','mario party 3'],year:2000,genre:'Party',kind:'Decompilation',mode:'files',
  engine:'The real ROM, rebuilt byte-for-byte from the mariopartyrd/marioparty3 decompilation, running on the libretro Mupen64Plus-Next core (EmulatorJS 4.2.3, WebAssembly)',
  description:'The Millennium Star, duel boards and seventy more minigames.',
  overview:'Mario Party 3 rebuilt from the mariopartyrd/marioparty3 decompilation, all 32 MiB identical to the USA cartridge, running in the browser on a WebAssembly N64 core. You supply your own ROM: it is read in the tab and never uploaded, and the page recognises it by its SHA-1 in any of the three N64 byte orders.',
  source:'https://github.com/andrewnakas/marioparty3-web',
  engineLicense:'EmulatorJS is GPL-3.0 and the Mupen64Plus-Next core is GPL-2.0; the mariopartyrd/marioparty3 decompilation is unlicensed research. See web/THIRD_PARTY.md.',
  assetLicense:'No game data is distributed. Everything comes from the ROM you load.',
  assetRequirements:'You supply your own Mario Party 3 USA ROM (33,554,432 bytes; .z64, .v64 or .n64). It is read in the browser and never uploaded. sha1 6beb80ff822b96bcf85dcdb512e8b2b7969d8259 in .z64 order — the same ROM this project\'s build produces.',
  controls:n64Controls,
  saveInstructions:'The game\'s own cartridge save is kept in this browser\'s storage and survives a reload. Clearing site data removes it. Save states are available from the emulator menu.',
  limitations:n64Limits('Mario Party 3'),
  inputs:['Gamepad','Keyboard'],downloadMB:null,complete:false,color:'#3a8fe0',shelf:'classic',platform:'N64',launch:'embed',touch:false,
  embedUrl:'https://andrewnakas.github.io/marioparty3-web/',
  verification:{status:'smoke-tested',date:tested,browsers,scope:'The full ROM rebuilds with zero differing bytes (sha1 match). In the browser, muted: a Chilly Waters board turn with a star awarded, the Crazy Cogs minigame and the return to the board, a save-state restore in a fresh session and a cartridge-save round trip. The published page was loaded through its own file picker to the title screen with the save store active and no off-origin requests.',playthrough:false},
 }},
];
let added=0;
for(const {after,game} of batch){
 if(games.some(g=>g.id===game.id))continue;
 const at=after?games.findIndex(g=>g.id===after):-1;
 if(at>=0)games.splice(at+1,0,game);else games.push(game);
 added++;
}
if(added)await writeFile(file,JSON.stringify(games,null,1)+'\n');
console.log(`added ${added}; catalogue now ${games.length}`);
