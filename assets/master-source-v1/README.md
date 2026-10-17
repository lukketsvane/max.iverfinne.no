# Current MASTER

The map authority is Figma file `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, section `1433:22060`. The ordinary game uses its artwork and coordinates through the existing game engine, controls, character animation, bombs, planting and raids.

`map.png` is Figma's actual 836×561 PNG export at scale 1 for section-local bounds `(100,100,836,561)`, with only the Max instance `1433:22063` omitted during export. Max's visibility is restored in Figma immediately afterward. There is no resampling, recoloring or pixel processing. `map-source.json` records the authenticated production source and export comparison.

The game draws this map once at native size and draws its controlled, animated character separately. Max's instance starts at crop-local `(15,349)` with the existing 32×32 cell and `(16,31)` anchor, giving foot position `(31,380)`. The Cavern instance `1433:22080` starts at `(0,381)` and supplies the ground support, with Max's foot pixel immediately above it. Map bounds constrain movement and the camera. No additional terrain, platforms, routes or decorations are generated.

One Figma pixel maps to one native game pixel. The existing pixel setting enlarges native pixels by an integer amount for display, with smoothing disabled. Dynamic gameplay entities use the ordinary engine. The same current MASTER map supplies each campaign stage; no exit route is invented where MASTER has none.

`master-source.json` pins export dimensions and SHA-256, and `master-map-data.js` stores the source binding, spawn and ground geometry. The build validates the map receipt before producing the normal game. After editing MASTER, export at 1×, refresh the production mirror and local bytes, update the geometry and authenticated manifest, and rebuild.

`master.png` and production rectangle `1449:21994` preserve the earlier complete snapshot, including the still Max. It is historical comparison evidence and is not the gameplay map. The discarded static viewer is removed. Loose railway modules remain outside MASTER until placed there deliberately.
