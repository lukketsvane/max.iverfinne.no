# Figma level source and local studio

Create and edit campaign levels in the configured Figma **MASTER** `863:15150`,
current [editor `941:450`](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/max-fuglesprenger?node-id=941-450),
on page `508:11825`. Its twenty direct `level_01`…`level_20` source rows are
stacked from 20 to 01. The row number sets the game stage. ASSETS workspaces and
archived references are outside this editor and are not compiler rows.

The October 11 continuation added editable, inactive drafts for previously
missing levels 07, 19 and 20. Their registered ART, ROUTES, POINTS and
REGISTRATION planes use native integer coordinates; reading guides sit outside
those planes. All twenty titles fit inside the editor, with 96 px between rows.
The [current layout receipt](../levels-overview/native-layouts-oct11.json) records
the actual source IDs, captures and isolated gameplay review. Twenty source rows
do not imply that every existing row validates or is activated in the game.
The [scene overview](../levels-overview/README.md) contains one unique scene per
level and the separate Level 04 mossy turtle study.

The current bottom Level 01 is Hollow Tree Entrance, row `941:2783`, source
`941:2784`. Its native plane is 640×400 with origin x320 and soil y280.
[Replacement receipt](hollow-master-replacement-receipt.json) and
[geometry import receipt](hollow-geometry-import-receipt.json) preserve the
October 10 source identities: row `887:13528`, workspace `880:78`, ASSETS
`880:79`, ART `887:13531`, ROUTES `887:13532`, POINTS `887:13533`, REGISTRATION
`887:13534` and TERRAIN `887:13535`. Those historical IDs are not the current
editor binding. The old Magnet study remains an archived reference and does not
author Stage 1.

Use the [local development plugin](plugin/README.md): import its manifest once,
run `npm run build` and `npm run figma:studio`, paste the local session key, edit
the existing row and click **Preview in game**. The preview uses actual built
game code and the validated native ART/terrain source. Unfinished other rows are
reported without blocking a valid selected preview; whole-editor exports still
require every row to validate. Download JSON remains a fallback. The connection
creates temporary local candidates; source compilation, verified main and
production deployment are separate checked steps. Live capture never falls
back to old editor `863:15149`; historical offline replay requires an explicit
legacy selection and preserves its original IDs.

Earlier standalone `garden-01b` / `garden-02b` drafts and setup scripts have been
superseded by MASTER. [figma-frames.json](figma-frames.json),
[master-inspection.json](master-inspection.json),
[master-geometry.json](master-geometry.json) and
[master-row-01-geometry.json](master-row-01-geometry.json) preserve historical
capture evidence. Their former row1 geometry is not the current Hollow Tree.
The setup-frame recipe is blocked from execution to prevent recreating a
parallel source. Historical receipt bytes remain preserved. Old quickstart and
toolkit creation bounds in [figma-state.json](figma-state.json) are creation
history; current MASTER IDs and the October 11 receipt determine authoring.

Native ART captures bind actual editable operation IDs and unchanged registered
PNG crops to row registration. Unsupported scenery does not become gameplay.
Every new physical terrain and water route still needs actual input verification;
a successful compiler export alone does not prove traversal, boss progression
or deployment.
