# Sanctuary tiles — painted sheet

The owner's painted tile sheet (`source.png`, 1536×1024, transparent background) cut into its loose parts:
`parts/<group>/<nn>.png` with `parts.json` (groups in `groups.json`: ruins and wood, lights and props, water,
stone, branches, tiles and ground flora). Rebuild with

    python3 scripts/split-alpha-sheet.py docs/asset-review/sanctuary-painted-v1/source.png docs/asset-review/sanctuary-painted-v1 docs/asset-review/sanctuary-painted-v1/groups.json

This sheet is painted, not pixel art: the game uses the pixel sheet (`../sanctuary-tiles-v1`), and these parts
are reference for redrawing at native scale.
