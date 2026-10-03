# Main developer handoff: selected raven and Moonroot

User: “make them pixelated correctly isolat each one of the spires etc and pass on to the dev agent in lukketsvane/max.iverfinne.no”. Earlier the user selected these exact designs and asked for implementation. This delivery supplies isolated artwork; the main developer owns encounter/gameplay integration.

## Ready

32 raven poses; 30 Moonroot poses; 33 separate effects/sprouts. Fixed body anchor (24,44) in 48×48 cells, drawn 1:1. Native first-idle visible sizes are **27×22 (raven)** and **25×37 (Moonroot)**. Moonroot was enlarged after the user explicitly said it should be larger. The same 48×48 cell and foot anchor are retained; do not scale either actor again at draw time.

`megasheet.png` / `megasheet.json` contain **all 95 assets in one native transparent sheet**. The original per-actor atlases and every isolated PNG remain available for normal runtime loading.

Compare beside original Max and Crown without resizing per sprite. The current `assets/native-atlas.mjs` API is used; no competing global loader introduced. Inspect `preview.html`, `megasheet.png` and `frames/`.

## Current-main integration points (audited a24a164)

`native-art.mjs` maps every `enemy.boss` to `hollow-crown`, adds 13 to body-centre y, and expects phase1/2/3 idle, windup, vulnerable, hurt and recover clips. These creatures have separate semantic clips. Blindly changing an image URL is wrong. Give entities distinct stable art IDs, map actual states and set actor-specific foot/hover registration. Do not reuse the 13px offset without checking the new physics box.

Historical user placements: raven level10 and Moonroot level20. Reconcile with the latest stage plan and existing Hollow Crown. Record whether Moonroot is a replacement, separate encounter or later phase. This asset branch makes no gameplay or victory-condition decision.

## Separate effects

`effects.json` contains `vine_lash`, `moon_seed_00..03`, `sprout_blue`, `sprout_curl`, `sprout_pink`, feathers, petals, dirt and glow fragments. Attach lash using the body `sockets.lash` and effect anchor, mirroring offsets consistently with the adapter. Moonroot body sockets were enlarged with the same 4:3 anchor-relative transform as the body pixels. The projectile-only and shared-sprout source cells deliberately are not fake duplicate bosses.

## Simulation owns combat

Suggested events are metadata only. Deliver once on the host using transitions/event IDs even when steps skip frames; never repeatedly spawn from a displayed frame. Guests render snapshots rather than independently applying damage or spawning sprouts.

Keep amber tells/cyan exposure synchronized to actual windows; add overlays if needed. Define collision separately from opaque artwork bounds. Preserve invulnerability, damage, rewards, checkpoint/reload, boon-only pause, non-pausing settings and co-op.

Before activation: render all clips in current gameplay; test hitboxes, facings, terrain/platforms, lash/projectile sockets, summon cleanup, tells/exposure, death once-only rewards, stage progression, reconnect and retry. These gameplay checks have not been completed by this asset handoff.

Coordinate in issue #10. The PNGs/JSON are import files; the preview and megasheet are art inspection/import resources, not implemented boss fights.
