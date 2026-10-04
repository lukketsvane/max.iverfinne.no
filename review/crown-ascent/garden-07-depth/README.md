# Garden 7 fungal depth review

Actual seed-1 runtime captures from October 4, 2026. These are development evidence, not native asset masters, background paintings or live Figma geometry overrides.

| View | Evidence |
| --- | --- |
| Same 540×320 native hero camera | [Before](before-hero.png), [after](after-hero.png) |
| Complete current room | [Native world panorama](full-room.png) |
| 390×844 phone | [Normal camera](portrait.png), [real ledge landing](portrait-landing.png) |
| 568×320 compact landscape | [Normal camera](landscape.png) |
| Exact comparisons and actual input results | [Verification](verification.json) |

The baseline is main `805551b`; the final source SHA-256 is `96f327458c353fc8d6c601d699bb3a3304ebb243361c4466e42478d78848253d`. All 661 built runtime PNGs, the complete rolled layout, room/footing bounds and existing controls are identical. The same seed and camera bounds are used before/after. Expanded world/hero views synchronously call the actual renderer with saved/restored camera and clock state; they do not modify the live game.

Chromium runs each desktop, portrait and landscape story with genuine directional and jump input, then proves a grounded landing on actual ledge `7:1:0` while the world clock advances. No teleport or manually manufactured landing is used. Captures are not pixel-equality tests for moving players or pests: the scenery, geometry, source bytes and cameras are compared exactly, while ordinary live motion continues. The private observer exists only in intercepted local review responses, never in production.

The source archive supplies visual direction only. The new canopy and cave forms are original integer-native geometry with existing source-size crops, no scaled PNGs. The normal phone camera intentionally reveals the monumental canopy through ascent. Earlier stack/Figma screenshots remain historical snapshots and are not represented as updated by this pass.
