# Designing a garden in Figma

The gardens can be drawn in Figma and pushed into the game. The generator in `stage-layout.js` still builds every garden unless a Figma frame is live.

## Where the frames are

- [Level Design page](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=382-2), page **382:2**.
- Geometry components: **382:3**. Native district props: **391:2**.
- Twenty frames named `garden-01` through `garden-20`, each 1800×720 at native 1:1.
- These are editable draft blueprints from seed 123. Picture geometry, core routes, rewards, trials and bonus markers are visible. Locked terrain and expedition paths are reference geometry.
- The final garden includes the three-beacon preparation and three-stage encounter brief in English.
- The former page 218:2 is gone. Its frame IDs are historical.

| Garden | Frame | Garden | Frame |
| --- | --- | --- | --- |
| 01 | 383:2 | 11 | 383:724 |
| 02 | 383:80 | 12 | 383:780 |
| 03 | 383:215 | 13 | 383:840 |
| 04 | 383:274 | 14 | 383:898 |
| 05 | 383:348 | 15 | 383:954 |
| 06 | 383:419 | 16 | 383:1025 |
| 07 | 383:474 | 17 | 383:1093 |
| 08 | 383:537 | 18 | 383:1164 |
| 09 | 383:592 | 19 | 383:1217 |
| 10 | 383:652 | 20 | 383:1288 |

The current blueprints are drafts: moving a component alone does not change the deployed game. Some optional or picture geometry requires upgrades or further reach work. Add `designed` only after the export report and a real-physics playtest pass. Gardens 1 and 2 retain their production picture layouts; replacing those requires explicit runtime integration.

The geometry snapshot in `docs/design/figma-level-workbench.json` can be replayed offline with `npm run figma:levels -- --from docs/design/figma-level-workbench.json`. It exports no live gardens while every frame remains a draft.

## Live frames

A frame is used by the game only when it contains an instance of **`designed`**. Without one, the frame is a draft and the generator keeps building that garden with fresh ledges every run. A live frame with no ledges and no blocks also leaves the garden to the generator.

A copy named `garden-07b` or `garden-07c` is a variant of garden 7. When several frames of one garden are live, the run seed picks one of them. Every co-op client picks the same one, because they share the seed and the build.

## The components

The layer name is the tag. Instances keep their component's name, so do not rename them.

| Tag | How it is read | In the game |
| --- | --- | --- |
| `origin` | x is the garden centre | `levelOriginX(stage)` |
| `soil` | y is ground level at the origin. Rise is measured up from this line. | `floor(surfaceY(origin))` |
| `ledge:stone` `ledge:branch` `ledge:ruin` `ledge:root` | Left edge, width, and top edge. The top edge is where you stand. | A one-way platform in `layout.platforms` |
| `block:stone` `block:ruin` `block:root` `block:branch` | Left edge, top edge, width and height | A solid platform (`solid: true`, `h`). Its top is walkable. |
| `reward` | Centre x, bottom y (7×7) | `layout.rewards`, where the feathers are dropped |
| `seed` | Centre x, bottom y | The last entry of `layout.rewards`, which holds the seed reserve |
| `bonus` | Centre x, bottom y | `layout.bonuses`: embers or dew from garden 3 on |
| `trial` | Centre x, bottom y | `layout.trials`. The run uses the first two, left to right. |
| `puzzle` `door` `dig` `secret` `start` | Centre x, bottom y | `layout.spots.<tag>` |
| `decor:<png path>` | Left edge, top edge, width and height | `layout.decor`: `{ src, x, y, w, h }` |
| `designed` | Anywhere in the frame | Makes the frame live |

The `art:` prop instances are visual authoring aids and are ignored by the geometry exporter. Their source PNGs are editable in production.

Groups are not read. Put the instances directly in the garden frame. Text, vectors and rectangles are ignored.

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

Other modes:

- `npm run figma:levels -- --watch` exports again whenever the page changes. It polls every 3 s after a change and backs off to every 30 s while nothing changes. Press Enter to export at once.
- `npm run figma:levels -- --from <fixture.json>` exports offline from a recorded page, `{ "page": "218:2", "metadata": "<get_metadata XML>" }`. See `tests/fixtures/figma-levels.json`.

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

Still open:

- `layout.spots` (puzzle, door, dig, secret, start) is exported but not yet read. `wonders.inc.js` still rolls its own puzzle, door and shovel spots, and the player still spawns where the run puts them.
- `layout.decor` is not drawn yet.
