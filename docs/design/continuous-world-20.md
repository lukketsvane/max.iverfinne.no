# Twenty wide scenes for a continuous ascent

**Design candidate · 5 October 2026 · no runtime promotion**

The requested deliverable is **twenty separate wide horizontal images, composed for 16:9**: one thoughtfully composed environment per region. The supplied twelve-region stack and individual examples establish detailed pixel environments, large distinct landmarks, dark architectural mass and small luminous refuges. The earlier single tall panorama is a superseded draft. These twenty scene concepts plan one continuous vertical ascent, with neighboring places sharing physical transition openings, terrain, material and light.

This is an alternative visual blueprint requested by the owner. Its region identities, including the sunset greenhouse summit, supersede the older campaign narrative **for this candidate only**. Existing game profiles, the underground-to-radioactive-dawn campaign, authored picture masters and Hollow Crown encounter retain their current behavior and authority.

## Sources and location

- Owner references: `combined(1).jpeg`, `01.jpeg`, `02.jpeg`, `04.jpeg`, `05.jpeg`.
- [Reference stack in Figma](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=692-113033), on level-design page `508:11825`.
- [Candidate scene gallery in Figma](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=746-117481), board `746:117481`: twenty separate 1536×864 horizontal concept frames with 1024-pixel-wide display previews and reusable scene/source/transition annotations. Original full source PNGs are supplied separately in the image package. Individual scene node bindings and export filenames are recorded in the manifest. These are concept images, not compiled/native terrain.
- [Scene and connector manifest](continuous-world-20.json): twenty `garden-1`…`garden-20` scene records and nineteen consecutive joins. Existing identifiers are retained; candidate names do not change runtime profiles.

## Twenty separate exports

The image package uses these stable ASCII filenames. Generated source PNGs are 1672×941 (approximately 16:9), retained without resizing; Figma display frames are 1536×864. Source dimensions and frame dimensions are recorded separately. The Git branch contains the compact design document and manifest, rather than twenty large PNG files. Download package: `max-20-wide-levels.zip`, containing exactly twenty full source PNGs, this document, the connector manifest and a short README. There is no tall overview. The Figma gallery holds display previews rather than the original full PNG bytes.

| Region | Filename |
| --- | --- |
| 1 | `01-frozen-seed-vault.png` |
| 2 | `02-thawing-cistern.png` |
| 3 | `03-railway-ruins.png` |
| 4 | `04-drowned-station.png` |
| 5 | `05-tidal-waterwheel.png` |
| 6 | `06-drainage-tunnels.png` |
| 7 | `07-mossy-ribcage.png` |
| 8 | `08-root-ossuary.png` |
| 9 | `09-mushroom-cave.png` |
| 10 | `10-mycelium-fissure.png` |
| 11 | `11-hollow-tree.png` |
| 12 | `12-root-bridges.png` |
| 13 | `13-winding-drums.png` |
| 14 | `14-cable-ravine.png` |
| 15 | `15-broken-aqueduct.png` |
| 16 | `16-terrace-gardens.png` |
| 17 | `17-bell-marsh.png` |
| 18 | `18-limestone-channel.png` |
| 19 | `19-greenhouse-terraces.png` |
| 20 | `20-greenhouse-crown.png` |

## Bottom to top

| Region | Landmark | Spatial phrase |
| --- | --- | --- |
| 1 | Frozen mechanical seed vault | Wheel, glass tanks, uneven service floors |
| 2 | Thawing cistern | Broad melt basin, offset maintenance shelves |
| 3 | Railway ruins | Tilted carriage, viaduct, lift tower |
| 4 | Drowned station | Flooded halls below broken station platforms |
| 5 | Tidal waterwheel basin | Monumental wheel within an unequal basin |
| 6 | Drainage tunnels | Narrow approach, vertical drain, fossil mouth |
| 7 | Enormous mossy ribcage | Unequal buried ribs, dark skull refuge |
| 8 | Root ossuary | Compressed bone chambers between roots |
| 9 | Giant bioluminescent mushroom cave | Tilted cap, dark gills, distant fungi |
| 10 | Mycelium fissure | Split chasm with branching fungal ledges |
| 11 | Hollow monumental tree | Thick trunk with three unequal chambers |
| 12 | Root bridges | Braided crossings, offset return loop |
| 13 | Winding drums and counterweights | Unequal drums and a counterweight shaft |
| 14 | Cable ravine | Wide asymmetrical chasm, suspended platforms |
| 15 | Broken aqueduct | Grounded unequal arches, fractured channel |
| 16 | Terrace gardens | Uneven planted terraces and seed refuge |
| 17 | Hanging bells and reed marsh | Bell stems above irregular slow water |
| 18 | Limestone channel | Pale terraces linked by shallow falls |
| 19 | Greenhouse terraces | Incomplete glazing above planted courts |
| 20 | Sunset greenhouse crown | Open conservatory and broad summit garden |

## Individual scene and transition contracts

**Compose twenty individual places.** Each image is one wide 16:9 scene, with its own deliberate landmark, spatial phrase and returning side route. Include a tiny gardener and small cart at a consistent scale. Keep text, UI, grids, panel borders and montage composition out of the artwork. Tall landmarks fill the wide scene through strong silhouettes and layered chambers; they do not turn it into a tall multi-biome panorama.

**Continue through paired ports.** Scene N has an open physical exit across its top edge; scene N+1 has the same intended connector entering across its bottom edge. Each pair shares a normalized horizontal center, opening width, structural cross-section, material order, palette and water/root/structure continuation. The first vault-to-cistern pair is an open thawing brick service shaft at x = 0.78 of scene width, width about 0.14, with a connected water spine around x = 0.62. There is no portal or load doorway.

**Overlap the places.** Reserve roughly 18% of local scene height around the join for material and light overlap. Show the incoming material before the outgoing material recedes: ice and water, rail and submerged brick, bone and roots, bark and fungal veins, roots and machine anchors, cable and aqueduct piers, limestone and greenhouse ribs. The manifest specifies the overlap materials, palette anchors and connector geometry for each of the nineteen joins. These fractions and ports are composition targets, not measured collision bounds. Generated illustrations may express the same connector without identical edge pixels. **Exact PNG seam equality and playable traversal are not verified**; a later native seam-authoring pass must compare and resolve the adjoining crops.

**Carry three spines through the ascent.** Upper channels feed rivulets, marsh runoff, drains, the wheel tailrace and vault seepage. The hydraulic connection may be occluded by rock, but it must have a legible inlet and outlet. Roots thread from vault cracks through bones and fungus, become the hollow tree and bridges, grip machinery and finish as greenhouse vines. Iron and masonry joints persist from vault pipes to railway support, counterweights, cable anchors, aqueduct piers and greenhouse ribs. Their relative prominence changes; there is no repeated central elevator shaft.

**Use one atmosphere.** Cold vault light gradually gives way to cyan fungal depths, quiet green hollows, violet machine distance, pale limestone and amber sunset. A shared sky belongs to the upper world; do not insert a new horizon, moon or sun above every region. Light from an adjoining space should appear through a crack, arch, shaft or branch opening before arrival. Keep warm refuges small and let real landings carry the strongest local edges.

**Vary the route.** Alternate low passages, broad basins, side climbs, open crossings, tall shafts and spacious overlooks. Monumental mushroom, ribcage and tree landmarks receive large unequal silhouettes and interior depth; smaller transition chambers compress between them inside the wide scenes. Use attached ledges and supported bridges with safe rest landings. Symbolic entry/exit ports specify intended connection points; they are not authored coordinates or proof of playability. Optional loops should rejoin the route.

## Known seam work

Final concept refinements open the bone/root mouths in regions 8, 9 and 11 and warm the marsh fog in region 17. The nineteen connector records define intended continuity, not verified adjoining pixels. Cistern → Railway Ruins (2→3) and Mushroom Cave → Mycelium Fissure (9→10) still need route/edge realignment. Upper scenes need one shared sky layer rather than repeated baked suns or horizons. Native connector collision, physical world coordinates and uninterrupted camera traversal are not implemented. These limitations remain explicit even where the concept images visually share a passage, root, pipe or stream.

## Current runtime and implementation boundary

The game already has twenty gardens. Today `ascent-presentation.inc.js` moves a frozen outgoing viewport downward over **640 ms** and inserts a **16 px masonry seam**. `enterLevel()` in `index.html` retires per-garden objects and relocates players to a distant stage origin. This is a screenshot handoff; it is not a continuously streamed world. See [the current handoff contract](ascent-handoff.md).

A true implementation needs one integer world coordinate system, nineteen real connectors, retained adjacent region layouts, shared-camera rendering and continuous collision queries. Prepare the next region before the camera enters the overlap. Region retirement must not itself relocate the ascender or reset the camera. Preserve the recorded actual plants when retiring completed content.

Existing product invariants still apply: a cleared exit plant must be physically climbed; only the authoritative host advances the shared region; ascender identity, shared seed, pressure clock, rewards and teammate catch-up remain intact. Native art stays at 1:1 with integer registration, disabled smoothing, binding pack palettes and [Figma production authority](../figma.md). Concept JPEGs and this manifest do not become runtime masters, live `designed` frames or collision overrides.

Before any promotion, author native connector geometry and verify every join in the real walking, jumping and climbing physics. Check portrait and landscape camera continuity, grounded landings, host/guest ascent, late join, PWA reconnect and reduced-motion behavior. Runtime code changes then require `npm test` and `npm run build`; runtime artwork changes additionally require `npm run figma:check`. This design-only branch claims structural manifest validation, not those future gameplay or artwork checks.
