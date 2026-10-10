# First three native level drafts

Frostarkivet, Tinesjakta and Den gløymde stasjonen now have authored native collision prototypes: 46 standing surfaces, seven ladders, two trials per room, rewards, seed reserves and cache/dig markers. The layouts follow the first three compositions in the newer [twenty-level concept board](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=746-117481), pinned to `b12d88a3ab2a6d39a5c2deda4ef51cb30e95a4c1`.

[The second batch](../native-level-drafts-batch-02/README.md) adds concepts 4–6, bringing the six prototypes to 96 standing surfaces and 15 ladders. Each batch keeps its own source, compiled candidate and execution evidence.

These are offline drafts. They have not been imported into Figma or promoted to production. Both Figma connections required reauthentication when this batch was prepared. The synthetic local compiler fixture is labeled explicitly and is not evidence of Figma synchronization. Production `levels-data.js` and every runtime PNG remain unchanged.

[geometry.json](geometry.json) is the editable coordinate source. Positions are newly authored integer game pixels relative to the stage origin and soil line. The concept board's normalized entry/exit percentages are composition hints; they are not collision coordinates. [The route overview](route-overview.svg) shows the authored surfaces and ladders at native scale.

| Garden | Route composition | Surfaces | Ladders |
| --- | --- | --- | --- |
| 1 · Frostarkivet | Two wheel-side stairs, maintenance ladders and a joined upper gallery | 16 | 2 |
| 2 · Tinesjakta | Offset bridges, a middle gallery and a second climb to the upper-left landing | 14 | 3 |
| 3 · Den gløymde stasjonen | Broken lower platforms, solid carriage/lift supports and stepped overhead rails | 16 | 2 |

The layout references existing native sources. The vault master is `assets/levels-v1/seed-vault.png` at 557×314 (Figma `477:11669`). The railway master is `assets/levels-v1/railway-ruins.png` at 1080×224 (Figma `477:11670`); it still belongs to production garden 2. No art is reassigned or rescaled. The isolated previews draw existing cavern, architecture and tile materials. New ice vitrines, thaw pipes, carriage details and rooted-lift artwork still need native Figma authoring.

Prepare the editable import and separate simulation data with:

```sh
node scripts/figma-authored-drafts.mjs \
  --from docs/design/native-level-drafts/geometry.json \
  --out docs/design/native-level-drafts/review
```

The output includes an editable local Figma plugin (`manifest.json` and `code.js`), [import.use-figma.js](review/import.use-figma.js), a source snapshot, a [compiler report](review/compiler-report.txt), a [reach report](review/reach-report.md), and separate `candidate-levels-data.js` for isolated simulation. Review frames use `review-garden-NN` and contain no `designed` marker. The wrapper refuses production-source and build destinations. Its digest includes both authored geometry and the runtime baseline.

The graph places all 46 surfaces and required rewards, seeds and trials at walking tier C0. [Player-physics verification](verification/candidate-verification.json) passed all 36 room/class/rate combinations: four base classes at 30, 60 and 120 Hz, with 552 surface reaches, 384 marker contacts, 108 reward/seed returns, 84 ladder round trips and 96 continuous gallery crossings/returns. Another 27 guardian round trips passed across three seeds. The routes use actual movement inputs; [the verifier notes](verification/README.md) describe resets, alternate descents and reproduction commands.

[Six browser previews](previews/preview-report.json) passed with the candidate loaded only into a scratch copy of the built game: all three rooms on desktop and phone, correct authored selection, disabled smoothing, and no browser or asset errors. The preserved physics reports keep their original execution digest. Later importer safeguards changed the package digest while leaving compiled geometry and runtime bytes identical; [artifact reconciliation](verification/artifact-reconciliation.json) records that equivalence separately.

| Garden | Desktop | Phone |
| --- | --- | --- |
| 1 | [Preview](previews/garden-01-desktop.png) | [Preview](previews/garden-01-phone.png) |
| 2 | [Preview](previews/garden-02-desktop.png) | [Preview](previews/garden-02-phone.png) |
| 3 | [Preview](previews/garden-03-desktop.png) | [Preview](previews/garden-03-phone.png) |

Once authenticated access returns, import these drafts into page `508:11825` of the existing MAX file and inspect their native geometry in Figma. Preserve the draft copy; promote approved base-geometry frames explicitly to `garden-NN` with `designed`, then compile fresh authenticated metadata to a separate review output before replacing runtime data. Keep the picture replacement markers explicit for gardens 1–2. Existing expedition and guardian furnishing stays in the runtime and is not baked into these source frames.

The next release still requires authenticated Figma import and export, review and physics checks against that exported source, the full regression/build gate, green CI, and a READY production deployment on the intended SHA. Nineteen continuous-world connectors, authored spawn behavior and new regional runtime masters are outside this geometry prototype.
