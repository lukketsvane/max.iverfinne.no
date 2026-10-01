# Agent instructions

Read `README.md` and `CLAUDE.md` before editing this repository. They describe the current product contract, multiplayer model, release gate and infrastructure.

Keep `main` authoritative. Do not merge old asset/gameplay branches wholesale into current code; preserved divergent branches contain archival or optional work and must be reviewed selectively.

Before changing runtime artwork, read the relevant `assets/**/README.md` and preserve native 1:1 pixel registration, integer anchors and disabled smoothing.

For any art change, follow `docs/figma.md`: Figma frame 160:2 holds every runtime PNG file, the pack README, `atlas.json` and palette are binding, all packs are edited in their native Figma source layer and exported with their existing atlas, anchors and palette, and `npm run figma:check` must report all MATCH.

Before changing bouquet/results behavior, read `docs/asset-review/bouquet/README.md`. Results must represent the player's actual run and exact plant data.

Before changing the Mech companion, read `docs/asset-review/watering-robot/selection.md`.

For every code change:

```sh
npm test
npm run build
```

Do not call a release live until CI is green and the production Vercel deployment SHA is verified.
