# Native ascent handoff

The campaign retains its existing twenty layouts and physical exit-plant climb.
After the host validates a consecutive ascent, `ascent-presentation.inc.js`
slides the last native world view downward and reveals the next live world above
it over 640 ms. A 16 px dark masonry seam connects the views. This is a visual
handoff, not continuous collision geometry or world streaming.

The HUD stays fixed. Simulation, pressure time, run seed, rewards and co-op
authority do not wait for presentation. Both host and active guests use the same
local presentation. Initial joins, stale reconnects, unrelated world changes,
relic modes and reduced-motion users retain direct entry. Resize, hiding the
page, ending/leaving a run and resets cancel it. Pointer targets are transformed
only into the live scene; taps on the frozen outgoing scene cannot act on it.

## Figma

- [Editable handoff storyboard](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=646-54963)
  on level-design page `508:11825`: three native source-crop examples, exact
  duration/seam specification and a clearly marked partial source-import status.
- [Existing twenty-world board](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=607-14028)
  remains unchanged and has no live `designed` markers.
- Frost Archive is already the native **Seed Vault** at 557×314, production
  master `477:11669`. Railway Ruins remains master `477:11670`. No production
  PNG, palette, collision surface or source-manifest pin changed.

The twenty original separated concept images and five full scene references
were recovered. The image-upload endpoint rejected transfers with HTTP 405/413.
Only the isolated ice bridge was imported, using a bounded original-byte
transfer: node `653:55096`, 1672×941, image SHA-1
`6187b90e9239b846d4c0313a056721e336c16e26`. Temporary import buffers and empty
holders were removed. The other nineteen separated images and five references
are **not imported or promoted to runtime**. Outdoor skies remain concept
references, consistent with the underground Gardens 1–17 campaign contract.

## Verification

- Full regression suite: 304/304 passed; production static build passed.
- New deterministic tests cover all nineteen consecutive handoffs, co-op
  ascender/catch-up paths, clocks, seeds, late joins, stale reconnects, pointer
  targeting, reduced motion and cancellation.
- Isolated Chromium visual checks passed actual physical ascents 1→2 portrait,
  11→12 landscape and 19→20 portrait at start, 20%, 50%, 80% and completion.
  No page, console or HTTP errors; seed unchanged and clock advancing.
- Safari/WebKit and live multi-client/PWA reconnect smoke were not performed.

Do not describe this as a single continuously streamed world or claim the full
separated source kit has been imported.
