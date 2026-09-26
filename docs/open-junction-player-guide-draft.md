# Open Junction player guide draft (private candidate)

This guide describes the replacement-only private build based on reSL revision `470cca330ee9abcf6173c843f4c89686c0c7e525`. Open Junction is not yet published or counted toward the five-game milestone. The mappings below were checked against the pinned `src/game/main_loop.cpp` and `src/game/mouse/mouse.cpp`; the identified actions were also used in muted Chromium tests unless marked otherwise.

- Choose **Go** from the main menu to start. The scenario begins with two connected stations; new stations appear over time.
- Press **Space** to switch between management and construction. In construction, move the pointer over an eligible diamond, left-click repeatedly to cycle available rail shapes, then right-click to build the selected track. The game may refuse a conflicting rail.
- In management, left-click a switch to change its branch or a signal to change its state. A train occupying a switch can lock it temporarily. Right-click near an entrance to call a service train if funds and that entrance allow it; this action has not yet been separately verified in the browser.
- Press **1**, **2**, or **3** to set simulation speed. These keys have been used in the private browser tests.
- Click the in-game menu button to pause. Choose **Save** to write an in-game record, **Go** to resume, or **Bye** to return to the main menu. From the main menu, **Archive** and **Go** restore a saved game. Save/Archive restoration passed private browser tests.
- In the surrounding site player, **Export saves** downloads a backup of the game save volume. **Import saves** restores one; **Delete saves** clears the volume. A private export/delete/import/Archive round trip passed. Export a backup before deleting or changing browsers.

Newly spawned trains need both their departure branch and their destination branch set correctly. For a trip from a branch station, keep its exit switch set until the train has passed onto the main line, then change it if the return path requires another branch. Waiting until a train passes a junction can leave that train circling the board. Multiple naturally assigned deliveries, including one from station six to station five, passed in private tests; the full scenario, continuous year progression, and natural game-over state have not.

The private engine uses a null audio backend, and the site player starts with **Sound: off**. Audio playback has not been verified or enabled. This draft must be revised after final gameplay and visual review before publication.
