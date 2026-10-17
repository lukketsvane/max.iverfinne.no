# Agent instructions

Read `README.md` and `CLAUDE.md` before editing this repository. They describe the current product contract, multiplayer model, release gate and infrastructure.

For game development, read `docs/design/finished-game-master-plan.md` and its execution ledger. Work toward the earliest unfinished milestone and preserve MAX's native garden identity. New user instructions and actual critical defects may change that order; record the reason and update the ledger.

For current level-design work, use only the twelve foreground/backdrop pairs in Figma `levelart` section `1271:34`, page `508:11825`, as explicitly selected by the owner on 17 October 2026. The exact source IDs and image hashes are pinned in `docs/design/scene-levels/art-recipe.json`. Do not substitute the older twenty-level MASTER drafts or generated scenery for these paintings. See `docs/design/levels-16-20/README.md` for the corrected scope of PR 58.

Keep `main` authoritative. Do not merge old asset/gameplay branches wholesale into current code; preserved divergent branches contain archival or optional work and must be reviewed selectively.

Before changing runtime artwork, read the relevant `assets/**/README.md` and preserve native 1:1 pixel registration, integer anchors and disabled smoothing.

For any art change, follow `docs/figma.md`: the configured Figma runtime sections on page 10:2 hold the runtime PNG masters, the pack README, `atlas.json` and palette are binding, and native Figma source edits must pass `npm run figma:check`. The user-authorized Crown creation pipeline has been imported and verified: its three masters use ordinary Figma production coverage. Preserve its immutable original-source audit, previous-pass archive, native registration and actual authenticated evidence in `provenance.json`; do not treat historical generated sources as an ongoing Figma exception.

Before changing bouquet/results behavior, read `docs/asset-review/bouquet/README.md`. Results must represent the player's actual run and exact plant data.

Before changing the Mech companion, read `docs/asset-review/watering-robot/selection.md`.

For every code change:

```sh
npm test
npm run build
```

Do not call a release live until CI is green and the production Vercel deployment SHA is verified.
