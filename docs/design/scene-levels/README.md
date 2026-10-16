# Scene levels

Twelve campaign gardens are tall, bounded rooms built from the owner's Figma
`levelart` pairs (section `1271:34` on page `508:11825`): one transparent
foreground terrain painting and one backdrop painting per level. The game draws
the foreground 1:1 over the collision, the backdrop behind it with parallax, and
keeps the camera and players inside the room. Tiers sit 80–150 px apart and are
joined by the painted ladders, so the rooms climb instead of stretching flat.

| Stage | Scene | Figma foreground / backdrop |
| --- | --- | --- |
| 3 | Frozen Seed Wheel | `1266:18` / `1271:36` |
| 5 | Railway Depot | `1266:19` / `1263:6` |
| 7 | Living Root Vault | `1266:23` / `1263:10` |
| 8 | Magnetworks | `1266:24` / `1263:11` |
| 9 | Mycelium Sanctuary | `1266:21` / `1263:8` |
| 10 | Giant Beaked Fossil | `1266:20` / `1263:7` |
| 12 | Bellflower Marsh | `1266:26` / `1263:13` |
| 13 | Night Watermill | `1266:22` / `1263:9` |
| 15 | Corvid Aqueduct | `1266:25` / `1263:12` |
| 17 | Salt Cistern Terraces | `1271:31` / `1266:17` |
| 18 | Heliostat Greenhouse | `1271:37` / `1266:30` |
| 19 | Twin Gondola Ravine | `1266:29` / `1263:16` |

Stages 3, 8, 12 and 18 are live. The other eight pairs are processed and in
Figma production; each one ships when its collision frame passes the sweep.

Hollow Tree (1), Railway Ruins (2), Mossback Sanctuary (4) and the Crown arena
(20) keep their existing authored sources; the compiler refuses scenes on 1, 4
and 20. The remaining stages keep their seeded layouts until they get art.

## Pipeline

1. **Art.** `build_art.py` reads each raw Figma image (pinned by its Figma image
   hash in `art-recipe.json`), paints out the reference figures that are not
   player characters (gardeners, rovers, crows, rats, beetles, drone), scales to
   0.75 so the painted figures match the player sprites, makes alpha binary,
   reduces each layer to 64 colours and paints any ladder a spec lists under
   `paintLadders`. Output: `assets/levels-v2/<id>-fg.png` and `-bg.png`.
   Run it with `SCENE_SOURCES=<folder with <id>-fg.png and <id>-bg.png>`.
2. **Figma production.** Both PNGs of every scene are byte-exact production
   layers in `Environment/Scene Levels` (section `451:2`, page `10:2`) and in
   `assets/figma-manifest.json`, under the normal runtime-art contract.
3. **Collision in Figma.** Section `03 · SCENE LEVELS` on page `508:11825` holds
   one frame per level, named `scene · NN · id · Title`. Each frame contains the
   locked BACKDROP and FOREGROUND instances and a `COLLISION` frame of plain
   rectangles: `GROUND · n` (floor steps; a step over 6 px becomes a wall),
   `LEDGE · key` (one-way top), `BLOCK · key` (solid), `LADDER · key` (14 px
   wide, top and bottom on a surface), `POOL · key` (water level at the top
   edge), `POINT · kind · key` (7×7, standing on its bottom edge), `SITE · key`
   and `COURT · key` (guardian shrine and its 100 px ground court). Rename the
   frame's `NN` to move a scene to another stage.
4. **Export.** `npm run figma:scenes` reads that section through the Figma
   desktop Dev Mode MCP server, validates every rule, writes
   `scene-levels-data.js` atomically and records the capture in
   `figma-capture.json`. `--from <capture.json>` replays a capture offline and
   `--specs` compiles the JSON specs in `specs/` instead. A refused export keeps
   the previous output.
5. **Check.** `node scripts/scene-sweep.mjs specs/<file>.json 60 bulwark fast`
   explores a scene with the real game physics from the spawn: every marker and
   ledge reached, every ladder climbed both ways, nothing cut off from the spawn.
   `tests/scene-levels.test.cjs` runs the same sweep for every scene and proves
   the committed data is exactly the compiled capture.
