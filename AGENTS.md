# Agent instructions

Read `README.md` and `CLAUDE.md` before editing this repository. They describe the current product contract, multiplayer model, release gate and infrastructure.

Keep `main` authoritative. Do not merge old asset/gameplay branches wholesale into current code; preserved divergent branches contain archival or optional work and must be reviewed selectively.

Before changing runtime artwork, read the relevant `assets/**/README.md` and preserve native 1:1 pixel registration, integer anchors and disabled smoothing.

For any art change, follow `docs/figma.md`: the configured Figma runtime sections on page 10:2 hold the established runtime PNG files, the pack README, `atlas.json` and palette are binding, and native Figma source edits must pass `npm run figma:check`. The user's 3 October 2026 generated-sprite instruction authorizes the three pinned PNGs in `assets/crown-ascendant-v1/` to use their documented local generated source while Figma requires reauthentication. Preserve the narrow provenance/native checks and truthful pending-import status; do not extend that exception to other artwork or claim remote synchronization.

Before changing bouquet/results behavior, read `docs/asset-review/bouquet/README.md`. Results must represent the player's actual run and exact plant data.

Before changing the Mech companion, read `docs/asset-review/watering-robot/selection.md`.

For every code change:

```sh
npm test
npm run build
```

Do not call a release live until CI is green and the production Vercel deployment SHA is verified.
