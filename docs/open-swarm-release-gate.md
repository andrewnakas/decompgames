# Open Swarm release gate — private candidate

Status: **not released, not counted**. The strict milestone remains 4/5.

## Current reproducible experiment

- Upstream: `qarl/arcade-js`, revision `e849d086f4168c9a0e1ab501d62efbe3766def8a`.
- Apply the four checked patches in `patches/arcade-js`: edge-clear, alien-trail-clear, alien-shot2-copyback, saucer-only.
- Generate independent CC0 data with `python scripts/generate-open-swarm-data.py OUTPUT --shot2-experiment --saucer-experiment`.
- Current 8192-byte data SHA-256: `05a65651e4aabaf1af47554cd946214db2f404441eefb1d8ee966ce4642c0913`.
- Private browser harness: `scripts/test-open-swarm-browser-probe.mjs`; audio disabled in the player and browser. The detailed historical evidence is in [the feasibility log](arcade-js-invaders-replacement-feasibility.md).

## Required before deployment

- Resolve the generator's `missingComponents` list through a source/data audit. Do not simply relabel the draft complete. Document intentional omissions (including the second hostile-shot lane) and the playable scope.
- Review inactive saucer-hit flags and determine whether unrelated collisions cause incorrect later awards. Cumulative hit flags are not unique kills.
- Verify normal-clock launch, actual controls, representative play, wave completion, loss/restart, and visible scoring on the exact final artifact. Accelerated worker-injected controls and synthetic collision fixtures remain separate diagnostics.
- Visually inspect saucer hit/bonus, later-wave layout, player damage, score and credit display, and attract transitions.
- Record save behavior honestly: the current private probe has no saved progress. Do not claim persistence without implementing and testing it.
- Produce a pinned, repeatable distributable build recipe, source archive, GPL notices and patch provenance, CC0 generator/art provenance, dependency inventory, and checksums for every shipped file. Current data checksums alone are insufficient.
- Verify the package contains no upstream original ROM, sample audio, or proprietary assets. Preserve the permanently silent test configuration.
- Integrate controls/help and accurate limitations in the site, pass local release checks, then deploy within existing authorization and verify the production artifact.

Only after these checks pass may this candidate become addition 5. Existing catalog additions and bring-your-own-ROM entries do not satisfy this milestone.
