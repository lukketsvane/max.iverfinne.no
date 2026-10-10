# Figma level source and local studio

Create and edit campaign levels in the configured Figma **MASTER** `863:15150`,
editor `863:15149`, on page `508:11825`. Its existing `level_01`…`level_20` rows,
inside per-level Layout + Assets workspaces, are authoritative. The row number
sets the game stage; ASSETS and archived references are not compiler rows.

The bottom Level01 is the session Hollow Tree source: row `887:13528`, workspace
`880:78`, ASSETS `880:79`, ART `887:13531`, ROUTES `887:13532`, POINTS `887:13533`,
REGISTRATION `887:13534`, TERRAIN `887:13535`. Its native plane is 640×400 with
origin x320 and soil y280. [Replacement receipt](hollow-master-replacement-receipt.json)
and [geometry import receipt](hollow-geometry-import-receipt.json) record actual
Figma changes. The old Magnet study row `840:66835` is preserved outside MASTER
in REFERENCE `887:13527`; it no longer authors Stage1.

Use the [local development plugin](plugin/README.md): import its manifest once,
run `npm run build` and `npm run figma:studio`, paste the local session key, edit
the existing row and click **Preview in game**. The preview uses actual built
game code and the validated native ART/terrain source. Download JSON remains a
fallback. The connection creates temporary local candidates; source compilation,
verified main and production deployment are separate checked steps.

Earlier standalone `garden-01b` / `garden-02b` drafts and setup scripts have been
superseded by MASTER. [figma-frames.json](figma-frames.json),
[master-inspection.json](master-inspection.json),
[master-geometry.json](master-geometry.json) and
[master-row-01-geometry.json](master-row-01-geometry.json) preserve historical
capture evidence. Their former row1 geometry is not the current Hollow Tree.
The setup-frame recipe is blocked from execution to prevent recreating a
parallel source. Historical receipt bytes remain preserved. Old quickstart and
toolkit creation bounds in [figma-state.json](figma-state.json) are creation
history; current MASTER IDs and the replacement receipts determine authoring.

Native ART captures bind actual editable operation IDs and unchanged registered
PNG crops to row registration. Unsupported scenery does not become gameplay.
Every new physical terrain and water route still needs actual input verification;
a successful compiler export alone does not prove traversal, boss progression
or deployment.
