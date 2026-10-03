# Hollow Crown and ascent — second design pass

The final boss uses a slender, faceless silver king with a large block maul, a kneeling second act, an upright empowered return and a damaged weaponless last stand. All 192 native frames preserve fixed anchors, the shared 24-color palette, binary transparency and complete death endings. Five generated originals and the entire earlier pass remain unchanged in the source archive.

The twentieth shrine has a jointed stone floor, ruined outer pylons and an open central fighting space against the radioactive dawn. Compact phase instructions stay above the fight. The camera reserves the actual highest leap pose and uses an integer whole-canvas zoom when a shallow viewport needs at least 200 native pixels of height. Existing actor coordinates, hitboxes, platforms and planting slots are preserved.

Earlier chapters now enclose the upper routes with rock vaults, steel braces, frozen shafts and reactor housings. Gardens 1–17 remain underground, 18–19 have only bounded dawn breaches, and 20 is the surface sunrise. `review/crown-ascent/` presents twenty native world captures with garden 1 at the bottom. Its boss gallery contains eight actual desktop/phone captures and a four-act contact sheet; these are review images, not runtime art masters.

## Actual Figma source verification

Authenticated Figma capture and ordinary comparison are preserved in `docs/asset-review/crown-secondpass/`. All **665 production PNGs MATCH**, zero problems: the previous 662 pins plus three exact new Crown masters. The new source frame is `619:13527`; source rectangles are `619:13529`, `619:13530` and `619:13531`. Direct remote PNG byte audits match native SHA-1, SHA-256, dimensions and registration. The provenance guard parses the actual capture and comparison rather than trusting their status labels. The temporary local generated-source exception is closed.

The editable twenty-scene Figma stack is `607:14028`, top20/bottom1. Its 1,569 route instances match the real seed1 platform snapshot. Existing authored level1/2 masters are preserved. Review imagery and editable geometry keep separate source roles.

## Local verification

`npm test` passed all **290 tests**, with zero failures. `npm run build` passed. After source promotion, the focused Crown/Figma audit passed10/10; after integrating main’s later exit-reward test correction, the co-op suite passed9/9. The game artifact remained byte-identical across those source/test changes. A later High Tide-only health-bar regression fix passed22 focused High Tide, Crown rendering and guide tests; its actual fifth guardian was checked in both browsers. The complete ordinary Crown victory was repeated in both engines on the final build.

## Final-build browser verification

The final tested game `index.html` SHA-256 is `d99c560b61832e120ff1e08dfad003a9b97a47646c72561a4d96c9a56c2d862f`. Earlier supplementary captures retain their `05169d7e…` source hash: the only subsequent game change restored the High Tide Crown health bar, leaving campaign presentation unchanged. Browser evidence is preserved in `browser-verification.json` and `crown-browser-verification.json` beside the Figma capture.

- Chromium and WebKit: actual stage20 shrine, all four acts, hammer warning and strike, leap, continuous energy lanes, wounded volley, ordinary controls and a complete Cairn victory with a living garden.
- Both engines: nine additional 320×568 phone cases and three coarse-pointer 1200×800 landscape cases, including the peak maul and grounded player at native300×200. No page errors.
- The shipped ascent viewer loads all twenty native images, orders them20→1 and supports native/fit navigation.
- Independent visual review accepted boss visibility, phase posture, native registration, phone framing, safe-lane meaning, final arena and changing underground chapters.

Main `d97b84bc81b199b70780a42e6b6189cda1d78e83` was integrated before final browser testing. Its later test-only correction `9e2150317775fcef7a3b765128b8ba8139160dc1` was also integrated and verified, preserving the same game artifact. Max Circuit/irrigation/Overload, Pølge authority and warning rules, companions and alternate modes remain present. The Max browser conservation assertion now counts actual rover delivery sources, excluding manual Tend, while explicitly checking the input lock during Overload's real warning.

The independent Max, Pølge, guardians and High Tide browser suites also passed in both engines. Their summary is preserved in `main-browser-verification.json`.

GitHub checks and Vercel deployment status remain the authority for publication of the branch; browser evidence does not claim a production release.
