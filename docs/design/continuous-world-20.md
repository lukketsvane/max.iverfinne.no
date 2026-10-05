# Continuous world: twenty connected regions

**Design candidate · 5 October 2026 · no runtime promotion**

The supplied twelve-region stack establishes the visual direction: detailed native pixel environments, large distinct landmarks, dark architectural mass and small luminous refuges. This candidate expands it to **twenty regions inside one continuous vertical world**. Neighboring regions share terrain, material, light and a traversable connector. A viewer should discover the next place through the current one, without encountering a horizontal panel edge.

This is an alternative visual blueprint requested by the owner. Its region identities, including the sunset greenhouse summit, supersede the older campaign narrative **for this candidate only**. Existing game profiles, the underground-to-radioactive-dawn campaign, authored picture masters and Hollow Crown encounter retain their current behavior and authority.

## Sources and location

- Owner references: `combined(1).jpeg`, `01.jpeg`, `02.jpeg`, `04.jpeg`, `05.jpeg`.
- [Reference stack in Figma](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=692-113033), on level-design page `508:11825`.
- [Continuous-world candidate in Figma](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=729-117482), board `729:117482`: twenty editable semantic region frames, nineteen planned overlap frames and reusable annotations. The illustration is a raster concept; these overlays are not compiled/native terrain.
- [Connector manifest](continuous-world-20.json): twenty `garden-1`…`garden-20` records and nineteen consecutive joins. Existing identifiers are retained; the candidate names do not change runtime profiles.

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

## How the seams disappear

**Overlap the places.** Reserve roughly 18% of the shorter neighboring region as shared transition volume. Show the incoming material before the outgoing material recedes: ice and water, rail and submerged brick, bone and roots, bark and fungal veins, roots and machine anchors, cable and aqueduct piers, limestone and greenhouse ribs. The manifest specifies the overlap materials, palette anchors and connector geometry for each of the nineteen joins. These fractions are composition targets, not measured collision bounds.

**Carry three spines through the ascent.** Upper channels feed rivulets, marsh runoff, drains, the wheel tailrace and vault seepage. The hydraulic connection may be occluded by rock, but it must have a legible inlet and outlet. Roots thread from vault cracks through bones and fungus, become the hollow tree and bridges, grip machinery and finish as greenhouse vines. Iron and masonry joints persist from vault pipes to railway support, counterweights, cable anchors, aqueduct piers and greenhouse ribs. Their relative prominence changes; there is no repeated central elevator shaft.

**Use one atmosphere.** Cold vault light gradually gives way to cyan fungal depths, quiet green hollows, violet machine distance, pale limestone and amber sunset. A shared sky belongs to the upper world; do not insert a new horizon, moon or sun above every region. Light from an adjoining space should appear through a crack, arch, shaft or branch opening before arrival. Keep warm refuges small and let real landings carry the strongest local edges.

**Vary the route.** Alternate low passages, broad basins, side climbs, open crossings, tall shafts and spacious overlooks. Tall mushroom, ribcage and tree landmarks receive extra height; transition chambers compress between them. Use attached ledges and supported bridges with safe rest landings. Symbolic entry/exit ports specify intended connection points; they are not authored coordinates or proof of playability. Optional loops should rejoin the route.

## Current runtime and implementation boundary

The game already has twenty gardens. Today `ascent-presentation.inc.js` moves a frozen outgoing viewport downward over **640 ms** and inserts a **16 px masonry seam**. `enterLevel()` in `index.html` retires per-garden objects and relocates players to a distant stage origin. This is a screenshot handoff; it is not a continuously streamed world. See [the current handoff contract](ascent-handoff.md).

A true implementation needs one integer world coordinate system, nineteen real connectors, retained adjacent region layouts, shared-camera rendering and continuous collision queries. Prepare the next region before the camera enters the overlap. Region retirement must not itself relocate the ascender or reset the camera. Preserve the recorded actual plants when retiring completed content.

Existing product invariants still apply: a cleared exit plant must be physically climbed; only the authoritative host advances the shared region; ascender identity, shared seed, pressure clock, rewards and teammate catch-up remain intact. Native art stays at 1:1 with integer registration, disabled smoothing, binding pack palettes and [Figma production authority](../figma.md). Concept JPEGs and this manifest do not become runtime masters, live `designed` frames or collision overrides.

Before any promotion, author native connector geometry and verify every join in the real walking, jumping and climbing physics. Check portrait and landscape camera continuity, grounded landings, host/guest ascent, late join, PWA reconnect and reduced-motion behavior. Runtime code changes then require `npm test` and `npm run build`; runtime artwork changes additionally require `npm run figma:check`. This design-only branch claims structural manifest validation, not those future gameplay or artwork checks.
