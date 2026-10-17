# Five pixel display strategies

Owner-directed level-presentation checkpoint, 17 October 2026. Settings replaces the two-state Subpixels control with one button cycling Native, LCD, Scanlines, Grille and Dot mask. It changes the display, not level geometry or runtime art masters. The same choice applies to every ordinary and scene garden, including their gardeners and cues.

## Selection

| Mode | Treatment | Purpose |
| --- | --- | --- |
| Native | Original nearest-neighbour integer pixels, no mask or exposure pass | Unmodified reference and lowest-cost default |
| LCD | RGB cells with a fine horizontal pixel grid | Retains the earlier explicit Subpixels-on preference |
| Scanlines | Neutral horizontal lines without RGB separation | Compare horizontal structure without colour texture |
| Grille | Continuous vertical RGB stripes | A distinct aperture-grille-inspired surface without horizontal breaks |
| Dot mask | Alternating offset RGB cells | Compare a staggered phosphor-like texture against continuous stripes |

These are restrained display masks, not full historical display emulators. There is no bloom, curvature, motion blur, invented detail, palette replacement or AI-generated art. Native remains available immediately; comparisons must judge ladders, ledges, small characters and warning readability rather than texture alone.

Primary research: [MDN crisp pixel-art rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) and [Canvas imageSmoothingEnabled](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled) support retaining the integer game canvas without filtering. [Libretro's CRT shader overview](https://docs.libretro.com/shader/crt/) distinguishes scanlines and phosphor-mask treatments. These sources inform the selected families; they do not establish a measured performance or visual-quality win for MAX.

## Runtime contract

The mask is generated at physical display resolution only when resizing or selecting a mode. A repeated tile avoids per-frame pixel readback, shader compilation and asset downloads. Existing bounded exposure compensation is retained. Native releases the mask buffer; scales below three physical pixels and canvas-preparation failures fall back to Native without discarding the selected preference. Explicit legacy on/off choices migrate; new devices start Native.

The button retains focus, announces its position among five choices, persists locally and does not restart or pause the shared simulation. Source registration, camera bounds, hitboxes, input coordinates and production Figma PNGs remain unchanged.

## Verification

`node --test tests/pixel-render.test.cjs tests/menu.test.cjs`: 28 passed. The build passed. `scripts/check-pixel-render-browser.cjs` exercises the built game through the existing account-free review bundle: touch selection, reload, normal movement, live Settings, all five masks, keyboard focus and rotation. Chromium passed both phone orientations at DPR 3; its receipt is in `docs/verification/pixel-render/chromium.json`. CI runs this check alongside the existing Chromium/WebKit menu review and retains screenshots.

Full test completion, WebKit, target-device visual acceptance and release verification remain separate gates. Figma check was attempted but cannot reach the local desktop MCP server in this isolated environment. No artwork source or master is replaced by this checkpoint.
