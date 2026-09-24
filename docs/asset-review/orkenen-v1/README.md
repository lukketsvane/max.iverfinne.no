# 03 Ørkenen — concept split with the clown mask

**source.jpg** is the 03 Ørkenen concept board (1536×1024): the level scene, five stage thumbnails and the modular asset sheet. **clown-mask.webp** is the same picture painted in flat colours, one colour per part. `split.py` uses the mask to take the board apart.

This is concept art at source pixels 1:1. It is not native 1× game art and nothing here is loaded by the game.

## Files

- **parts/<panel>/<panel>-part-NN.png**: the 138 loose sprites of the modular sheet across 13 panels (terrain tiles, ruins, structures, props, plants, underground tiles, underground props, water & FX, enemies, NPCs, details/FX, background layers, palette + mark). The mask decides which sprite a pixel belongs to. The source decides where the sprite ends, because the sheet background is flat dark grey. This keeps each cut on the drawn pixels, not on the mask's smoothed outline. Alpha is 0 or 255, with RGB 0 under alpha 0. Panel headings and the footer tagline are text and are left out.
- **layers/<panel>/<panel>-layer-NNN.png**: the level scene (108 layers) and the five thumbnails (10–16 layers each). There is one layer per mask colour, cropped to its bounds, largest first. The layers partition the panel, so stacking them at their offsets rebuilds it exactly. Layer outlines follow the mask, which is looser than the painting.
- **manifest.json**: every file with its position on the board (parts) or in its panel (layers), its size, and the Figma node it fills.
- **figma-nodes.json**: the Figma nodes, input to `split.py`.
- **split.py**: regenerates everything (`python docs/asset-review/orkenen-v1/split.py`, needs numpy, pillow and scipy).
- **post-uploads.py**: posts each PNG to a Figma `upload_assets` URL for its node.

## Known merges

The mask joins a few things the sheet draws as neighbours: the underground pillar with its shrine, the camel with the shrine it stands beside, and the small cactus with the tall palm. The six palette swatches form one strip.

## Figma

File `TC0PHGMTCMR6im4hb3CSbF`, page **References** (162:2), section **03 ØRKENEN — clown-mask split** (269:246):

- 13 component sets `orkenen/01_terrain_tiles` … `orkenen/13_palette_mark`. Each part is a component `part=NN`, laid out as on the sheet, following `08_cliff_edges`.
- Frames `orkenen/scene` and `orkenen/thumb_1_start` … `thumb_5_boss`, one rectangle per layer.

Every node is sized and placed. The image fills are pending: this session's network policy refused `mcp.figma.com`, where `upload_assets` posts. To finish, call `upload_assets` with the `figma` node ids from manifest.json (at most 60 per call), save the returned `uploads` array and run `post-uploads.py` on it.
