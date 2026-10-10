These are actual-game captures of the offline Garden 1 tree prototype. The
production build, runtime level data and native asset files remain unchanged.
[browser-review.json](browser-review.json) preserves the complete browser report;
[capture-manifest.json](capture-manifest.json) binds the copied image/report bytes
and records the preserved earlier scratch evidence.

The phone and desktop stories use ordinary keyboard controls from one explicit
initial court spawn: walk to the entrance, descend the real ladder, hold against
the right wall at x246 and left wall at x−141 for 0.4 simulation seconds each,
return up the ladder to the court, then plant with Tend. Each plant spends one
seed against the balance after legitimate route pickups. No actor is relocated
after input begins. A prior planted-first run naturally ended when the unattended
plant died; that failed evidence remains in scratch. Plant health, fauna and
engine clocks are not disabled.

Phone/desktop PNGs contain only the actual game iframe. The fixed world captures
use the actual drawing body at native 640×400 and 640×440, camera x−320/y−272,
without bitmap resizing. The observer restores all 405 mutable main-closure
bindings, 1,906 reachable objects, DOM and live canvas after offscreen rendering.
The report records zero page, console, request and WebSocket errors, ready native
assets, disabled smoothing, isolated storage and unchanged input bytes.

The new below-soil behavior is explicit: review-only solid court/floor/side walls,
one-way entrance lip, lower ladder, native pond, initial spawn, a player-floor
fallback and a guarded presentation adapter. Importing the upper compiler
candidate alone does not produce this lower passage. This evidence verifies one
seed-1 Max review story in each viewport; it does not establish a production
release or other-class lower-room coverage. The separate upper-route proof covers
the four classes at 30/60/120 Hz.

Reproduce with an existing Playwright installation and Chromium, after
`npm run build`:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
  node docs/design/tree-hollow-entrance/evidence/capture.cjs \
  --out /tmp/max-tree-hollow-fresh-capture --story yes
```

`CHROMIUM_PATH` defaults to `/usr/bin/chromium`. The runner resolves the repository
from its own path, serves `dist` read-only on loopback, and injects the candidate,
scene and fixture only in local HTTP responses. It rejects existing output paths,
repository-contained paths and repository ancestors. The pinned bindings cache
is read-only; newly derived bindings are written only to the output directory.
All waits are bounded; long leg/clock deadlines accommodate concurrent tests
without changing game physics. Camera timing and native fauna can vary between
runs. [baseline-seed-vault](baseline-seed-vault) retains the original actual-game
Garden 1 baseline bytes and renderer hashes from before this prototype.
