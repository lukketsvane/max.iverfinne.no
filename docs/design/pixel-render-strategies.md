# Native low-resolution canvas

The owner's 17 October clarification replaces display masks with actual low-resolution rendering. Settings → Pixels cycles **Auto, 4x, 6x, 8x, 10x**, defaulting to **8x**. This is one small game canvas, not a high-resolution scene with a pixel-pattern overlay.

A 390×844 CSS-pixel phone viewport at devicePixelRatio 3 uses a **146×316 native canvas** displayed as **1168×2528 physical pixels** at 8x. Every source pixel occupies one uniform 8×8 block. The existing portrait/landscape frame is centred, with whole-pixel letterboxing rather than fractional stretching.

## Rendering contract

Draw source artwork into the small canvas at native 1:1. Keep `imageSmoothingEnabled = false` and `image-rendering: pixelated`. The canvas's CSS width and height equal its native dimensions. A single origin-zero `translate(...) scale(SCALE / devicePixelRatio)` transform aligns and enlarges it. The scale is an integer in **physical display pixels**, not CSS layout pixels.

Direct fractional CSS width/left sizing shifted the grid in both local browser tests: the isolated checkerboard had 112,320 wrong physical pixels. Keeping native CSS dimensions and using the transform produced zero mismatches on the same test. The actual game screenshot check now verifies every block, not just CSS properties.

Auto retains adaptive sizing. Explicit enlargement is reduced only when necessary to preserve 128 native pixels on the shorter axis; the existing Crown minimum-height safeguard remains. The menu reports the actual native dimensions and applied scale. Higher magnification shows less of the world, rather than resampling sprites or changing collision. Normal input maps through the real transformed canvas bounds.

The saved key is `max-pixel-scale-v1`. Retired mask preferences cannot re-enable a mask. Selection retains focus and does not pause, restart, teleport or alter the shared run. The old mask and additive exposure pass are removed. Runtime PNG masters, scene geometry, source files and camera logic are unchanged.

## Evidence

48 focused tests passed, including all six characters' unchanged state, DPR 1/1.25/1.5/2/3, native dimensions, persistence, input mapping, real scene roof/ladder/jump clearance and the existing Crown framing guard. Exact old fixture extents change by one pixel because floor fitting replaces clipped ceil fitting; the geometry and clearance assertions remain.

Chromium and WebKit passed phone, landscape, small-screen and desktop flows: **8 cases and 40 pixel-verified game screenshots**, all with uniform integer blocks and no page errors. Tests retain ordinary movement with real collision, live Settings, reload persistence, keyboard focus and rotation. The first actual simulation frame must run before movement input, avoiding a startup event race without fabricating player state. The durable summary is `docs/verification/pixel-render/native-canvas.json`; repository browser CI retains full screenshots.

`npm run build` passed. The initial full `npm test` was stopped when the renderer changed, so it is not a complete pass. Full final-SHA regression CI and production verification remain pending. Real-iPhone performance and human readability are not certified by automated browser screenshots.

Primary references: [MDN crisp pixel-art rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) and [Canvas imageSmoothingEnabled](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled). The fractional-sizing comparison above is this project's measured result, not a performance claim from those references.
