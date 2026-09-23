# Figma: the source of runtime art

The game's runtime PNG files live in one Figma file and are mirrored byte for byte in this repository.

- File: **max.iverfinne.no max fuglesprenger** (team cells.garden), <https://www.figma.com/file/TC0PHGMTCMR6im4hb3CSbF>, key `TC0PHGMTCMR6im4hb3CSbF`.
- Link: `assets/figma-manifest.json` (generated), `scripts/figma-sync.mjs` (the tool), `tests/figma-assets.test.cjs` (offline guard).

## The rule

Section **52:2 "PRODUCTION ASSETS — CURRENT MAIN — NATIVE 1×"** on the Draft page is the source of truth for every PNG file the runtime loads. Its notes say it plainly: *ACTIVE RUNTIME ONLY · SOURCE OF TRUTH* and *Layer names = exact repository paths · every source sheet remains at native dimensions · PNG export preset = 1×*.

A production layer is:

- a rectangle inside one of the group frames of 52:2,
- named with the exact repository path (`assets/native/rover.png`),
- whose only fill is the PNG itself at native 1×, so layer W×H = PNG W×H,
- on integer X / Y / W / H, with nothing drawn over it.

Figma names each stored image by the SHA-1 of its bytes, so the manifest records exactly what Figma holds. `npm test` then requires, offline:

- every production entry exists in the repo with the same SHA-1 and IHDR size;
- every PNG file the runtime loads (native-art atlases, companion sheets, the pixel font, literal and concatenated `assets/…png` paths in the shipped JS, HTML and CSS) is a production layer, and every PNG the build copies is a production or `unused` layer;
- every production PNG has binary alpha, RGB 0 under alpha 0, only its pack's palette (`atlas.json` / `<name>.json` `palette`), and is not an exact k× upscale;
- every production atlas `opaqueBounds` matches the pixels of its sheet.

Not covered yet: the 16 images inlined as `data:image/png` URIs in `index.html` (terrain sheets, backgrounds, plant and NPC atlases, crow, swan, garden, ants, soil). They predate the Figma file and are pinned by hash in `tests/figma-assets.test.cjs`, so a new or changed inline image fails the test. New art goes into `assets/` and 52:2, never into a data URI; moving the pinned ones into 52:2 is open work.

## Map

Draft page `0:1`:

| Node | Section | Role |
| --- | --- | --- |
| 52:2 | PRODUCTION ASSETS — CURRENT MAIN — NATIVE 1× | source of truth |
| 52:5 | 01 PLAYERS | `assets/max-skins-v1/*/main.png`, `interaction.png` (generated) |
| 52:7 | 02 ENEMIES | `assets/enemies-v1/*/sprites.png` role enemies (generated) |
| 52:9 | 03 RATS | `assets/rat-enemies-v1/*/sprites.png` (generated; the Figma label says 32×32 cells, the contract is 48×32) |
| 52:11 | 04 BOSSES | `assets/boss-milestones-v1/native/05, 10, 15`; Hollow Crown `assets/enemies-v1/hollow-crown/sprites.png` (generated) |
| 52:13 | 05 COMPANION + CORE UI | rover, robot, large rover, water FX, 5×7 pixel font |
| 34:11 | UNUSED ASSETS — MEGASHEET (frame 34:12) | path-named layers the runtime does not load; manifest `unused` |
| 34:2, 34:3 | ARCHIVE — old megasheet / contact sheets | history |
| 38:2 | PIXEL ART WORKBENCH | rules 38:4, master grids 39:2, palette 39:39, primitives 40:40, scratch 40:37, export check 40:47 |
| 39:28 | BRAND / LOGO — 104×40 | draft |
| 40:2 | PWA ICON — 64×64 master → 192/512 | draft |
| 62:2 | DRAFT — STORM ROOK RIDGE | draft |
| 62:27 | NEW BIOME ASSETS — PROCESSED CANDIDATES | draft |
| 62:33 | SOURCE REFERENCES — JPEG — DO NOT EXPORT | comparison only, never exported |
| 69:2 | DRAFT — FROSTWING HIGHLANDS | draft |
| 69:3 | OWL / NIGHT BIRD | draft |

Page `10:2` is named "production" but holds flattened contact sheets: 9:13 (megasheet, section 10:3) and 9:14–9:19 (groups, section 10:4). They are recorded as `reference` with their image hashes; they are not repository files.

## Pixel-art rules

Verbatim from the Figma frame 38:4:

- 1 game pixel = 1 Figma pixel
- Work only on integer X / Y / W / H
- No rotation · no blur · no fractional scaling
- Use solid pixels or binary transparency
- Zoom in to 1600–6400% instead of enlarging masters
- Export PNG at 1× with transparency
- Keep anchors / sockets on integer coordinates
- Use the 1×1 pixel primitive for drawing

Export check, verbatim from 40:47:

- ✓ master frame is the intended native pixel dimensions
- ✓ every shape sits on integer coordinates
- ✓ no rotations, blur, shadows or fractional scale
- ✓ transparent background where required
- ✓ anchors / sockets match the game contract
- ✓ export PNG at 1× only
- ✓ compare beside Max / crow / current enemies before Git

The repository contracts are binding and win over anything in the Figma workbench:

- **Cell size and anchor** come from the pack README and its `atlas.json`. The master grids in 39:2 (16×16 icon · 32×32 actor, anchor 16,31 · 40×32 rat, anchor 20,27 · 64×48 robot/drone, anchor 32,44 · 64×64 FX/hover, anchor 32,32 · 64×96 plant, anchor 32,95 · 128×128 boss · 192×128 huge boss) are starting templates only. Known mismatches: rats are 48×32 at anchor 28,28; role enemies 16×16 at 8,15; bosses and the Hollow Crown 32×32 cells; the robot 48×40 at 24,36; the large rover 80×48 at 40,44; the starter rover 32×32 at 16,31.
- **Colours** come from the pack's own palette (`atlas.json` / `<name>.json` `palette`, pack README). The palette frame 39:39 (copied into the manifest as `rules.palette`) is a picking aid for new art, not a rule; none of the current sheets is limited to it.

Contracts to read: `README.md` → *Pixel-art contract*; `assets/max-skins-v1/README.md`, `assets/enemies-v1/README.md`, `assets/rat-enemies-v1/README.md`, `assets/boss-milestones-v1/README.md`, `assets/native/README.md`, `assets/companion/README.txt`, `assets/companion/large-README.md`, `assets/results-native/`, `assets/expansion/`; before touching the Mech companion, `docs/asset-review/watering-robot/selection.md`.

## Generated packs

Three packs are written by scripts from pack sources, not drawn as sheets:

| Sheets | Source | Generator |
| --- | --- | --- |
| `assets/max-skins-v1/*/main.png`, `interaction.png` | `assets/max-skins-v1/source/*.png` | `python scripts/build-native-art.py` |
| `assets/enemies-v1/*/sprites.png` (incl. Hollow Crown) | `assets/enemies-v1/source/*.png` | `python scripts/build-native-art.py` |
| `assets/rat-enemies-v1/*/sprites.png` (indexed, plus `frames/*.png`) | `assets/rat-enemies-v1/source-poses.json` | `python scripts/build-rat-assets.py` |

For these the pack source and its generator come first. A change goes into the source, the generator is rerun (it also rewrites `atlas.json`, frames and previews), `npm test` passes, and then the generated PNG is placed into the Figma layer. Until then `figma:check` reports REPO-CHANGED; afterwards MANIFEST-STALE, which `figma:pull` records without downloading anything. `figma:pull` refuses to download Figma pixels into these packs: an edit made in Figma has to be carried back into the source by hand.

## Tools

`scripts/figma-sync.mjs` talks to the Figma desktop app's local Dev Mode MCP server (`http://127.0.0.1:3845/mcp`; `FIGMA_MCP_URL` overrides it, for a local replay server only). It needs no token. Before running it:

1. open the Figma desktop app (the browser has no local server),
2. open the file and keep it as the active tab,
3. switch to Dev Mode (Shift+D),
4. enable the desktop MCP server.

CI never talks to Figma; `npm test` is offline.

| Command | What it does |
| --- | --- |
| `npm run figma:check` | Compares every path-named layer in 52:2 with the repo file and the manifest; exits non-zero on any problem. |
| `npm run figma:pull` | Downloads DRIFT / NEW-IN-FIGMA / MISSING-IN-REPO layers, validates them, writes the PNGs and their manifest entries; records MANIFEST-STALE entries. `-- --dry-run` writes nothing; `-- --allow-resize` allows a new size. |
| `npm run figma:manifest` | Regenerates the whole manifest: production, unused, reference, rules, draft index. Refuses to write while a production layer breaks a rule or differs from its repo file. |
| `npm run figma:drafts` | Lists draft sections and their candidates with sizes, flagging off-grid nodes, labels that disagree with the size, and cells that do not tile. Read-only. |
| `npm run figma:levels` | Exports the live garden frames of the levels page into `levels-data.js` and prints a reach report (`docs/design/figma-levels.md`). |

Figma caps MCP tool calls per day; once spent it answers "Rate limit exceeded, please try again tomorrow". Image downloads are not tool calls, and any other Figma MCP use during the day spends from the same budget. Every run prints the tool calls it spent.

`check` statuses:

| Status | Meaning | Fix |
| --- | --- | --- |
| MATCH | Figma = repo = manifest | none |
| DRIFT | Figma changed | `figma:pull` (generated packs: carry it into the source) |
| NEW-IN-FIGMA | a path-named layer not in the manifest | `figma:pull` |
| MISSING-IN-REPO | the repo file is gone | `figma:pull` restores it, or move the layer out of 52:2 |
| MANIFEST-STALE | bytes agree, manifest entry is old (moved, re-created) | `figma:pull` |
| REPO-CHANGED | the repo file changed, Figma did not | put the new PNG into the Figma layer, or restore the file |
| CONFLICT | both changed | decide, then make the other side match |
| REMOVED-FROM-FIGMA | the layer left 52:2 | remove the runtime use, then `figma:manifest` |
| REJECTED | the layer or its pixels break a rule; the listed problems say which, the status it would have had is in brackets | fix it; nothing is pulled |

A layer is REJECTED when it is off the integer grid, has not exactly one image fill, has anything drawn over or inside it, differs in size from its PNG, or has a name that is not a posix path inside `assets/`. A download is REJECTED when it is not a PNG, differs from the Figma hash or the layer size, differs from the current repo size (without `--allow-resize`), has partial alpha, colour under alpha 0 or colours outside the pack palette, is an exact k× upscale, or targets a generated pack.

## Draft → production

1. Choose the target first: the pack, its README and `atlas.json` (cell size, anchor, palette), and whether it is a generated pack.
2. Draw or process the asset in a Draft section at native 1× in that pack's cell size, anchor and palette, following the rules and the export check above. A master grid in 39:2 is a starting frame only. Source JPEGs stay in 62:33.
3. `npm run figma:drafts` to see the candidates and their flags.
4. Integrate it in the repo following the pack README: atlas JSON, loader, tests, the exact repository path. For a generated pack, change its source and rerun its generator here.
5. In Figma, export the finished sheet as PNG at 1× (for a generated pack: take the generated PNG from the repo) and place it as the only image fill of a rectangle in the right group frame of 52:2 (dropping the PNG onto the canvas creates exactly that), at the PNG's size, on integer coordinates, named with the exact repository path. To replace an existing asset, replace the image fill of its layer. To revive an unused asset, move its layer from 34:11 into 52:2; the six `docs/asset-review/raider-drone-v1/*.png` layers first need their files moved under `assets/` (following that folder's README) and the layers renamed to the new paths.
6. `npm run figma:pull -- --dry-run`, then `npm run figma:pull`.
7. `npm run figma:manifest`.
8. `npm test` and `npm run build`; `npm run figma:check` reports all MATCH. Commit the PNG, the manifest and the runtime change together: the runtime test fails if either side lands alone.

To retire an asset: `npm run figma:check` (all MATCH), move its layer from 52:2 to 34:11, remove the runtime use, `npm run figma:manifest`, `npm test`.

The logo (39:28) and the PWA icon (40:2, a 64×64 master exported at 192 and 512) are not runtime atlases and are not in the repository yet. Their scaled exports are outside what `figma:pull` handles; add them by hand when they are needed.
