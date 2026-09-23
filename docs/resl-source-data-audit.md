# Open Junction source-data audit (provisional)

Pinned reSL revision: `470cca330ee9abcf6173c843f4c89686c0c7e525` ([upstream](https://github.com/konovalov-aleks/reSL/tree/470cca330ee9abcf6173c843f4c89686c0c7e525)). The goal is to separate presentation and scenario content from engine rules before considering a hosted replacement build. This is a technical inventory, not legal clearance or proof of playability.

| Pinned source table | Role found in code | Replacement / decision |
| --- | --- | --- |
| `src/game/resources/dispatcher_glyph.cpp`, `impasse_glyph.cpp`, `static_object_glyph.cpp`, `train_finished_exclamation_glyph.cpp` | Drawn people, track-end signs, scenery, completion markers | Independently generated CC0 tables; private compile passed. Visual review pending. |
| `rail_glyph.cpp`, `semaphore_glyph.cpp`, `train_glyph.cpp` | Track, signals, moving vehicles | Independently generated CC0 tables; private compile passed. Geometry and redraw tests pending. |
| `small_font.cpp`, `text_glyphs.cpp` | Bitmap fonts | Independently generated CC0 tables; private compile passed. Legibility and localization pending. |
| `glyph_empty_background.cpp` | Full-bit sprite erase mask | Independently regenerated functional mask; private compile passed. |
| `allowed_cursor_rail_types.cpp` | Buildable board cells | Independent candidate board generated; private compile passed, gameplay pending. |
| `entrance_rails.cpp` | Eligible entrance positions | Independent candidate left/right entrance banks generated; private compile passed, placement and routing pending. |
| `train_specification.cpp` | Train availability, speed, and composition | Independent candidate roster generated; private compile passed, gameplay balance pending. |
| `chunk_bounding_boxes.cpp` | Incremental redraw regions | Candidate bounds enlarged for new rail sprites; private compile passed, ghosting checks pending. |
| `carriage_bias.cpp`, `semaphore_glyph_bias.cpp` | Sprite placement offsets | Functional geometry coupled to new art. Keep under review; adjust after visual tests. |
| `src/game/resources/entrance.cpp` | Entrance state and color combinations | The nine initial color pairs are still upstream presentation data. Generate an independent set and test legibility. |
| `src/system/driver/sdl/video.cpp` palette | 16 rendered ARGB colors | The runtime still uses its original presentation palette while generated screens use an independent palette. Replace the runtime colors with a matching independently authored palette and test all UI contrasts. |
| `movement_paths.cpp` | Discrete motion paths | Likely reconstructed engine movement data. Review whether new rail geometry needs paths changed; test collisions. |
| `rail_connection_bias.cpp`, `rail_connection_rule.cpp`, `rail_type_meta.cpp` | Routing, connection, and signal rules | Treat as engine logic pending gameplay/provenance review. |
| `src/system/driver/sdl/mouse.cpp` cursor planes | Custom pointer artwork | Independent CC0 cursor generated and patched; private compile passed. Appearance pending. |
| `src/graphics/text.cpp` character traits | Width/spacing logic | Functional table. Check readability with replacement fonts. |

The top-level upstream `resources/` directory is excluded from the private build; only generated external files are embedded. A source-wide search for static byte arrays found the SDL cursor outside `src/game/resources`; other matches reviewed so far were control, text, audio, or rendering logic. Re-run this audit after source changes and before distribution. Do not infer that an exhaustive asset clearance has already happened.

The candidate build is still private. A successful compile establishes only that the patch set links. Release requires a muted browser test of menu input, rail placement, train dispatch, a completable objective, save/reload/import, and the final provenance review. It remains outside the five-release count.
