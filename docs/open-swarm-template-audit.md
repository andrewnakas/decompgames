# Open Swarm template audit

Private candidate, not released or counted. Source revision e849d086f4168c9a0e1ab501d62efbe3766def8a. This is a bounded static audit, not a completeness certificate.

## Object dispatch and authored scope

Upstream `walkObjectTable.js` treats record byte0=0xfe as a skip and 0xff as the end. Bytes3/4 select the handler; timers and gate must drain before dispatch. `seedWorkRamImage.js` copies 192 bytes from1b00 to2000 on round setup; boot instead copies256. These distinct lengths leave cold-boot-only state requiring separate review.

| ROM record | RAM record | Handler | Current saucer experiment |
| --- | --- | --- | --- |
| 1b10 | 2010 | 028e player | Enabled; independent craft descriptor |
| 1b20 | 2020 | 03bb player shot | Enabled; independent beam and finite retirement |
| 1b30 | 2030 | 0476 alien shot2 | Enabled after timer; pinned copyback correction |
| 1b40 | 2040 | 04b6 alien shot3 | Skipped by fe sentinel; not a functional shot lane |
| 1b50 | 2050 | 0682 saucer/shot4 | Saucer poll enabled; pinned patch removes hostile-shot delegation |
| 1b60 | 2060 | End sentinel | ff terminates object traversal; later bytes also hold explosion descriptor |

There is **one enabled hostile-shot lane**, not two. Previous wording about a second lane being omitted was ambiguous: both slot3 and slot4 hostile-shot paths are absent. Enabling slot3 is not just a bitmap task: its handler requires shared mode2080=1, a column cursor/reset, rate cells, and a valid11-byte work strip. Its non-blowup path copies a16-byte template back, so its state-retention behavior also needs examination before enabling. Current mode is2 for saucer service. Do not enable it by merely removing the skip sentinel.

## Attract substitutions

The independent data intentionally provides blank12-byte transitions at1a95,1bb0,1fc9, and empty draw-script terminators at1dbe/1dcf. They bound control flow but do not reproduce the original choreography. A separate16-byte reveal record at1bc0 uses handler050e, own sprite1ced, three rows, and finite two-tick blowup. These substitutions are explicit scope omissions; they do not establish that every attract branch has been reviewed visually.

## Remaining gate

Keep the manifest incomplete. The remaining work-RAM fields and cold-boot/reset paths need a named-field audit, plus current-artifact normal-clock gameplay and visual checks. Synthetic round handoffs verify table selection and player-page retention only. A final package must document reduced hostile-shot scope and simplified attract behavior, with independent-asset provenance and all existing release-gate requirements.

Reproduction: generate with both experimental flags; data SHA-256 remains05a65651e4aabaf1af47554cd946214db2f404441eefb1d8ee966ce4642c0913. October9 regeneration after metadata/comment corrections produced identical bytes. No browser, audio, server, or deployment was started for this audit.
