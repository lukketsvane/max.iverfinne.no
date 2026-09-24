PIXEL MILL — ruins

87 transparent assets.

FIGMA
1. Unzip this archive.
2. Drag PNG files from assets/ onto your Figma canvas. Each PNG is a separate asset.
3. Alternatively, import figma-import.svg for the arranged sheet with named pixel-vector groups (if included). Large SVGs may take longer to import.
4. Keep raster assets at native size or whole-number multiples for crisp pixels.

FILES
assets/ — individually named, isolated transparent PNGs.
atlas.png — packed sprites at native output resolution.
atlas.json — atlas frames, original processed-sheet coordinates and settings.
figma-import.svg — optional SVG built from exact pixel-color runs, with no background.

Each PNG includes 2px transparent padding on all sides. Coordinates in sourceRect refer to the processed image before packing.
The exported atlas contains only included parts; filtered specks are omitted.
Source: ruins.jpg
Processing: 1536 x 864 to 384 x 216.

Background removal is color based. Inspect dark details and adjust tolerance or use edge-connected mode if needed.
