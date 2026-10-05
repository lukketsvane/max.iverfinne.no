# MAX: twenty connected level concepts

Twenty separate wide images rework the owner's twelve-level reference into one ascending geography. Level 01 begins in the frozen seed archive; level 20 reaches an overgrown glasshouse in warm sunset light. The sequence preserves the reference landmarks and gives every material and biome transition its own connected place.

The images were generated sequentially, one at a time. Final selected PNGs live in `images/`. The original complete sequential pass is preserved unchanged in `source/`, including replaced candidates. Both sets have manifests binding original filenames, actual dimensions, byte counts and SHA-256 hashes. Generated dimensions vary slightly; no claim of a uniform native runtime size is made.

## Sequence

Read from the bottom upward: 01 below 02, continuing to 20 at the summit. `progression-plan.json` describes the route anchors and material progression.

| Level | Scene | Material continuing upward |
| --- | --- | --- |
| 01 | [Frostarkivet](images/level-01.png) | icy masonry, blue steel pipe and maintenance ladder |
| 02 | [Tinesjakta](images/level-02.png) | dark brick ventilation shaft and dripping blue pipe |
| 03 | [Den gløymde stasjonen](images/level-03.png) | rooted lift cage, red-brown brick and a drainpipe |
| 04 | [Rot- og beinbrotet](images/level-04.png) | pale calcite, fossil fragments and embedded roots |
| 05 | [Leviatanen](images/level-05.png) | mossy ivory rib and damp dark limestone |
| 06 | [Sopphvelvet](images/level-06.png) | turquoise seep, cave rock and stalactite beside a rope ladder |
| 07 | [Trykksisternene](images/level-07.png) | cyan sluice masonry, wet brick and water elevator cable |
| 08 | [Nattdemninga](images/level-08.png) | root-bound damp stone gate and narrow canal |
| 09 | [Rotslusa](images/level-09.png) | warm massive trunk, blue rivulet and root arch |
| 10 | [Holtreet](images/level-10.png) | bark, living roots and rope gantry |
| 11 | [Den poda planteskulen](images/level-11.png) | rust steel beam, cable and living tree roots |
| 12 | [Magnetgarden](images/level-12.png) | rusty truss, hoist cable and mossy stone pier |
| 13 | [Stormstillaset](images/level-13.png) | mossy aqueduct pier, water mist and rope |
| 14 | [Kråkeakvedukten](images/level-14.png) | wet mossy stone, reed roots and shallow runnel |
| 15 | [Klokkeblommyra](images/level-15.png) | reeds, muddy ledge and a hanging planted basket |
| 16 | [Sivklippene](images/level-16.png) | basalt, plant-covered cable support and moss shelf |
| 17 | [Taubanekløfta](images/level-17.png) | pale rock, windmill shaft and cable pulley |
| 18 | [Vindkvernløpet](images/level-18.png) | white travertine water channel, lift and pipe |
| 19 | [Kalkterrassene](images/level-19.png) | limestone, greenhouse irrigation pipe and iron frame |
| 20 | [Glashustoppen](images/level-20.png) | summit cap |

## Connecting the scenes

Water descends through the world. Blue service pipes connect the frozen vault to the railway and pressure machinery; fossil-bearing rock becomes fungal cavern and reservoir. Massive roots wrap the sluice and form the hollow tree, then meet salvage steel. Crane supports turn into aqueduct piers, reed roots join wetland to basalt cliffs, and mountain irrigation leads through pale terraces into the glasshouse.

The sequential pass continued upper landmarks in each next image's lower region. Those overlap regions require registration rather than naïve edge-to-edge stacking. The adjoining-band repair pass concentrates on weak joins while preserving each principal scene. The selected images are being registered in a cropped Figma concept master. Ten adjoining-band repairs improve material and landmark continuity. The adjoining image edges are not pixel-identical; literal edge registration is not certified. Movement reachability has not been tested.

`manifest.json` binds the final selected images and repair provenance. It identifies the Figma master and records binding-pending until the actual import audit is complete. `source/manifest.json` preserves the immutable first complete pass. `common-prompt.txt` records shared creative intent rather than claiming a verbatim log of every prompt.

## Figma and game integration

The assembled review belongs on the [level-design page](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=508-11825), with 01 at the bottom and 20 at the top. Concept frames use names outside the live `garden-NN` compiler pattern and contain no `designed` marker.

These are concept scenes. Playable integration requires native game-scale registration, authored standing surfaces and connecting geometry, then actual ascent checks. Current runtime PNG masters, collision geometry, controls, co-op state and deployment remain unchanged. Runtime art continues to follow [the Figma source contract](../../figma.md).
