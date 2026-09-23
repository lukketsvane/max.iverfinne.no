# Designing a garden in Figma

The gardens can be drawn in Figma and pushed into the game. The generator in `stage-layout.js` still builds every garden unless a Figma frame is live.

## Where the frames are

- File **max.iverfinne.no max fuglesprenger** (`TC0PHGMTCMR6im4hb3CSbF`), page **levels** (`218:2`).
- The components live in frame `218:3`.
- One frame per garden, named `garden-01` … `garden-20`, 700×290. Their node IDs:
  - 01 `219:2` · 02 `219:300` · 03 `219:616` · 04 `219:938` · 05 `219:1233`
  - 06 `224:1401` · 07 `224:1639` · 08 `224:1942` · 09 `224:2181` · 10 `224:2463`
  - 11 `225:2630` · 12 `225:2868` · 13 `225:3227` · 14 `225:3453` · 15 `225:3737`
  - 16 `226:3913` · 17 `226:4175` · 18 `226:4521` · 19 `226:4723` · 20 `226:5032`
- Every frame starts as a copy of the garden that seed 1 generates, so a designer starts from a garden that already plays.
- 1 Figma px = 1 art px. Keep the instances on whole pixels.
- The locked `terrain` vector and `water` rectangles show the real ground and ponds under that garden. The ground depends only on the stage, not on the run seed. They are reference and are never exported.

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
