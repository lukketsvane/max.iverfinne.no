# Campaign chambers

The owner's level references call for enclosing rooms, large landmarks and detailed native materials. The campaign retains its ascent: 1–17 are entirely buried, 18–19 expose a bounded roof opening, and 20 emerges into radioactive sunrise for the Hollow Crown. The authored Seed Vault and Railway Ruins already contain the architectural detail shown in the first two references; their source pixels and geometry remain intact.

`campaign-architecture.js` builds the other underground worlds around the actual generated layout. Each main route, expedition and side place gets enclosing masonry. Wide real ledges receive supporting piers that reach the actual ground profile; smaller ledges receive brackets. Lamps are anchored to real rest landings. These are rear scenery, without collision surfaces, water pools, ladders or implied alternate routes. Actual platforms, shrine destinations, caches and player movement remain authoritative.

| Garden | Large landmark |
| --- | --- |
| 3 | Buried aqueduct |
| 4 | Chapel vault |
| 5 | Root shell |
| 6 | Quarry cut |
| 7 | Mycelium cathedral |
| 8 | Counterweight hoist |
| 9 | Broken tower |
| 10 | Buried carillon |
| 11 | Frozen seed wheel |
| 12 | Root glass cistern |
| 13 | Twin shafts |
| 14 | Ancient rib vault |
| 15 | Fault monolith |
| 16 | Magnetic crane |
| 17 | Reactor heart |
| 18 | Last sluice aperture |
| 19 | Broken conservatory |

Geometry is cached by layout identity, actual platform coordinates and ground function. Drawing uses native integer rectangles and exact crops from the approved Sanctuary and Seed Vault masters. The 230×171 wheel crop keeps its source size. Viewport culling bounds the work on phones. Broken arch sectors, masonry patches and hanging vegetation avoid repeating an identical screen-wide pattern. Late roof apertures draw above this scenery; earlier worlds cannot reveal exterior sky.

`garden-places.js` adds material detail to the existing room surfaces: chipped ashlar, cracks, bark grain, light recesses, lichen, cold cornices and amber pipework. Gardens 7 and 12 have restrained mycelium. Room grids, hidden-wall fades, platform rows and anchors stay unchanged. Crown room and ledge pixels retain their existing rendering.

The complete [vertical stack](../../review/crown-ascent/) uses actual seed-1 runtime captures with expanded bounds for the enclosing roofs. The separate [boss gallery](../../review/crown-ascent/boss/) shows the four existing acts. The Figma review board preserves its scene IDs and actual route coordinates; it does not become a live geometry override.

Two generated mushroom and fossil sprite studies were produced separately. The supported Figma image upload was rejected by the environment's network proxy before reaching Figma. Those candidates remain development studies: they are not shipped runtime assets or registered native masters. The implemented chamber art uses original editable geometry and already registered native image sources.

Verification covers native crop registration, bounded operations, deterministic regeneration, nonmutation of collision geometry, all room styles and hidden-wall fades, unchanged Crown pixels, underground sky rules and actual browser traversal.
