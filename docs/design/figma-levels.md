# Designing a garden in Figma

The gardens can be drawn in Figma and exported into the game. The authored picture levels take precedence in gardens 1–2 unless their selected live Figma variant explicitly contains `replace-picture`; other gardens use the seeded generator unless a Figma frame is live. Expeditions and guardian destinations are furnished by the runtime after the base layout is chosen.

## Where the frames are

- File **max.iverfinne.no max fuglesprenger** (`TC0PHGMTCMR6im4hb3CSbF`), level-design page [`508:11825`](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=508-11825), as recorded in [the current Figma map](../figma.md). `scripts/figma-levels.mjs` targets this page.
- Runtime frames are named `garden-01` … `garden-20`; frame size can expand to fit the native layout. Inspect the current page for component and frame IDs before editing. The former page `218:2` and its historical frame IDs remain in the test fixture and Git history, not as current remote pins.
- `npm run figma:level-drafts` prepares an offline snapshot of all twenty actual seed-1 runtime layouts, including the authored picture levels, places, expeditions and guardian courts. [The prepared source and import instructions](level-review-source/README.md) record the local source hash and compiler limitations. An offline snapshot does not establish Figma synchronization.
- 1 Figma px = 1 art px. Keep the instances on whole pixels.
- The locked `terrain` vector and `water` rectangles show the real ground and ponds under that garden. The ground depends only on the stage, not on the run seed. They are reference and are never exported.

## Live frames

A frame is used by the game only when it contains an instance of **`designed`**. Without one, the frame is a draft and the generator keeps building that garden with fresh ledges every run. A live frame with no ledges and no blocks also leaves the garden to the generator.

A copy named `garden-07b` or `garden-07c` is a variant of garden 7. When several frames of one garden are live, the run seed picks one of them. Every co-op client picks the same one, because they share the seed and the build.

`replace-picture` opts a live variant of garden 1 or 2 into replacing the existing picture level. Keep it off drafts and variants that should retain the Seed Vault or Railway Ruins. The marker does not make a frame live by itself. Picture masters remain in the repository.

`furnish-place` opts a live frame into the existing native garden place, including its false walls, two authoritative seed caches and available bounce blooms. The runtime adds the place before expeditions and guardian destinations, once per layout. Leave the marker off a layout that already contains its own place geometry. The authored base routes keep their coordinates and IDs.

## The components

The layer name is the tag. Instances keep their component's name, so do not rename them.

| Tag | How it is read | In the game |
| --- | --- | --- |
| `origin` | x is the garden centre | `levelOriginX(stage)` |
| `soil` | y is ground level at the origin. Rise is measured up from this line. | `floor(surfaceY(origin))` |
| `ledge:stone` `ledge:branch` `ledge:ruin` `ledge:root` | Left edge, width, and top edge. The top edge is where you stand. | A one-way platform in `layout.platforms` |
| `block:stone` `block:ruin` `block:root` `block:branch` | Left edge, top edge, width and height | A solid platform (`solid: true`, `h`). Its top is walkable. |
| `ladder` | Centre x, top edge, width and height, all integer pixels | A climbable ladder in `layout.ladders`, using the existing keyboard, controller and touch controls. Geometry is not lifted or snapped. |
| `replace-picture` | Presence | Allows the selected live variant to replace picture garden 1 or 2. |
| `furnish-place` | Presence | Adds the garden's existing native place and available bounce blooms. |
| `reward` | Centre x, bottom y (7×7) | `layout.rewards`, where the feathers are dropped |
| `seed` | Centre x, bottom y | The last entry of `layout.rewards`, which holds the seed reserve |
| `bonus` | Centre x, bottom y | `layout.bonuses`: embers or dew from garden 3 on |
| `trial` | Centre x, bottom y | `layout.trials`. The run uses the first two, left to right. |
| `puzzle` `door` `dig` `secret` `start` | Centre x, bottom y | `layout.spots.<tag>`; puzzle, door, dig and secret are used by runtime interactions; start is not used for spawning |
| `decor:<png path>` | Left edge, top edge, width and height | Exported as `layout.decor`: `{ src, x, y, w, h }`; the generic layout renderer does not draw it |
| `designed` | Anywhere in the frame | Makes the frame live |

Groups are not read. Put the instances directly in the garden frame. Text is ignored; unrecognized names are ignored. The compiler recognizes tag names on direct children, so keep reference layers clearly named and avoid giving ordinary rectangles or vectors compiler tag names.

### How positions become world positions

- x is the offset from the origin.
- y is `floor(surfaceY(origin)) − rise`, so the whole garden keeps the shape it has in Figma.
- A ledge that comes within 6 px of the ground under it is lifted until it clears the ground. Blocks are not lifted, so they may touch the ground or sink into it.
- A spot whose bottom is within 6 px of a ledge or block top stands on that platform.
- A spot on the soil line (within 2 px), or within 6 px of the real ground, stands on the ground.
- Any other spot floats, and the report says so.

## Export

1. Open the Figma desktop app with the file as the active tab.
2. Switch to Dev Mode with Shift+D and enable the desktop MCP server.
3. Run `npm run figma:levels`.

The command reads the levels page in one Figma tool call. It checks every garden frame against the real terrain with the stage-layout reach rules, writes `levels-data.js` (live frames only), and prints a report:

```
garden-07   224:1639   live   canopy · 20 ledges · C0 18 · C1 0 · C2 2 · C3 0 · unreachable 0 · reward 1 · seed 1 · bonus 2 · trial 2
  ledge:root    x  +42  rise 118  needs C2 Moss or Spring Step 2
  reward        x  +40  rise 120  needs C2 Moss or Spring Step 2: a walking Bulwark cannot reach it
  trial         x  -12  rise  30  floats 9 px above the soil and every ledge: stand it on one
```

Tiers are C0 walking, C1 running, C2 Moss or Spring Step 2, and C3 the air jump. The report tells you:

- every ledge, block top and spot that is out of reach for a walking Bulwark, with the tier it needs, or that it is unreachable at every tier;
- ledges that were lifted clear of the ground;
- spots that float or sit in a pond;
- a trial count that is not two.

A ledge on or under the top of a block that the player can reach is not reported as unreachable. Rewards, the seed and trials should stay C0. Draft frames get one summary line each. A live frame without an origin is not exported, and the command exits with code 1.

Ladder routes include their ladder IDs and explicit climb steps. A ladder joins the jump graph only when both endpoints have usable dry ground or platform support and an endpoint is reachable. A disconnected ladder does not make an elevated reward reachable. Check climbs and returns with actual player physics as well as the graph report.

Structural errors in any live frame stop the entire write and preserve the previous output byte for byte. Successful exports replace the output atomically. Invalid, nonpositive or fractional ladder geometry is a structural error; existing legacy tags retain their documented rounding and reach warnings.

Other modes:

- `npm run figma:levels -- --watch` exports again whenever the page changes. It polls every 3 s after a change and backs off to every 30 s while nothing changes. Press Enter to export at once.
- `npm run figma:levels -- --from <fixture.json>` exports offline from a recorded page, `{ "page": "<captured page ID>", "metadata": "<get_metadata XML>" }`. The historical `tests/fixtures/figma-levels.json` explicitly uses `218:2`; it remains valid as an offline compiler fixture.
- `npm run figma:levels -- --from <fixture.json> --out /tmp/max-levels-review.js` writes a separate review export, leaving runtime `levels-data.js` intact. `--out` also works with live reads and `--watch`; `--watch` and `--from` cannot be combined.
- `npm run figma:level-drafts -- --seed 2026 --out /tmp/max-level-review` prepares an editable review snapshot and a local Figma plugin without contacting Figma or changing `levels-data.js`. The generated `import.use-figma.js` can also be executed through the connected Figma Plugin API once access is restored.

Each poll is one Dev Mode MCP tool call, and Figma caps those per day. Once the cap is spent, Figma answers "Rate limit exceeded, please try again tomorrow".

## Before committing

Run `npm test`. It holds live gardens to the same tests as generated ones:

- `platform-layouts` checks that route ledges clear the soil, rise at most 19 px per hop, and have at least three real gaps.
- The `seeded-physics` sweeps jump every route hop with all four classes.

A failure names the garden and the ledge. Then run `npm run build` and commit `levels-data.js` together with any Figma-driven change.

## What the game does with it

`levels.js` exposes `window.MaxLevels.layout(stage, origin, ground, wet, seed)`. `stageLayout()` in `index.html` asks it first and falls back to `MaxStageLayout.create`. A designed layout has the same shape as a generated one, plus a few extra fields:

- `designed: true` and `frame`.
- `nodes`, the stage-layout capability tiers.
- `routes`: per side, the shortest C0 path from the soil to that side's reward ledge (or its highest ledge), with the launch point on the soil.
- `spots` and `decor`.

Designer spots are active: `initRunStage` in `run-director.inc.js` places the hidden cache at `secret`; `digSpots` and `digBlast` in `index.html` use `dig`; `rollWonders` in `wonders.inc.js` uses `puzzle` and `door` when provided. Door availability still follows the runtime stage rules. `start` remains metadata and does not override spawning.

`layout.decor` remains exported metadata and is not drawn by the generic layout renderer. Place ornamentation and authored picture artwork have their own render paths.

The compiler encodes authored ladders and can opt into existing native place furnishing. It does not encode custom place false walls and caches, authored bounce blooms, guardian courts or expedition objectives. The runtime review import still marks those annotations as references and keeps `review-garden-NN` names outside the live frame pattern. Do not rename a complete furnished runtime snapshot and mark it designed without translating its intended base geometry: doing so can lose those interactions and duplicate the runtime expedition furnishing. Keep picture replacement explicit and preserve seeded gameplay and physical exit climbs.

The newer twenty-level concept stack at [746:117481](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=746-117481), preserved in [PR #51](https://github.com/lukketsvane/max.iverfinne.no/pull/51), contains composition references rather than authored collision coordinates. Its normalized entry/exit percentages are not native geometry. This importer supports the next authoring pass; it does not promote the concept images to runtime masters or implement continuous world connectors. New runtime artwork still follows [the Figma source contract](../figma.md).
