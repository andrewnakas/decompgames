# r/decomps opportunity scan — September 20, 2026

Reddit is a discovery input, not proof of licensing, completeness, or browser compatibility. Search coverage: recent r/decomps threads about DOS games, recommended ports, missing projects, and project overload. No posts, comments, messages, or downloads of game data were made.

## Leads and primary checks

| Lead | Discovery | Primary evidence and next action |
| --- | --- | --- |
| Mario Kart 64 / SpaghettiKart | [What am I missing?](https://www.reddit.com/r/decomps/comments/1w2uzwo/what_am_i_missing/) | [Upstream](https://github.com/HarbourMasters/SpaghettiKart/tree/2b3ddb4a579887d7ab41c56445691b9411996399) has source and native build instructions. README requires the US z64 ROM and generates mk64.o2r; it does not support otr archives. No top-level license was visible in the inspected tree; review file and dependency terms before hosting. Browser graphics and local extraction need investigation. High-priority research candidate, not a promised browser port. |
| Spyro / OpenPete | [Release discussion](https://www.reddit.com/r/decomps/comments/1vnn8hw/spyro_the_dragon_recomp_out_now_openpete/) | [Official site](https://openpete.com/) says source is not yet public. It describes a static recompilation with matched decompiled functions substituted, and requires the NTSC-U disc. Vulkan-only native renderer adds a browser-port obstacle. Watch for source publication; do not classify it as a fully available open-source decompilation. The separate [matching decomp](https://github.com/TheMobyCollective/spyro-1) is public and should be evaluated separately. |
| Stunt Car Racer | [DOS discussion](https://www.reddit.com/r/decomps/comments/1wipa3i/decompilations_of_dos_games/) | [Linked project's README](https://github.com/fluffyfreak/stuntcarracer) describes a partial Amiga conversion using DirectX and original data. Not ready to promote as a complete browser decompilation; establish code ancestry, license and data permissions first. |
| Ecstatica / Alone in the Dark | Same DOS discussion | Reddit names alone do not establish actual decompilation. [FITD](https://github.com/yaz0r/FITD) describes an engine reimplementation; keep that distinction. Find a specific Ecstatica upstream before adding a record. Lower priority than confirmed decomps. |

## Product opportunities

- [Project overload discussion](https://www.reddit.com/r/decomps/comments/1v8gpmq/am_i_the_only_one_overwhelmed_by_this_decomp/): participants want project status, working-build evidence, and clarity about unfinished releases. Supports prioritizing dated gameplay/save tests and clear source links. This is qualitative feedback, not a market-size estimate.
- [Mod discovery discussion](https://www.reddit.com/r/decomps/comments/1v8gq8t/recomps_with_mod_support_is_there_a_single/): difficulty locating mods suggests linking official mod hubs from game pages. Start with curated external links; avoid introducing a public upload service.
- [Community directory lead](https://www.reddit.com/r/decomps/comments/1ualhas/list_of_recomp_and_decomp_projects_the_gaming/): The Gaming Emporium is another discovery source to inspect and deduplicate against the catalog. Do not copy its descriptions or assume its categories are independently verified.

## Ongoing search procedure

Include r/decomps in future discovery passes. Prefer release announcements with source links; separate wishlists from released projects. Follow each candidate to the primary repo, inspect license and exact revision, record supported original data, assess browser work, and retain a blocker when it cannot be hosted. Deduplicate by game. No new playable claims resulted from this scan.
