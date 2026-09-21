# Robot candidates: compare before selecting

**Neither candidate is selected. The user explicitly said other robot assets may be better.** This document adds concrete alternatives to the existing main-branch handoff; it does not import a second pack, replace art, or enable robot gameplay.

## Revisions inspected

- Main handoff: `cfc630995727c1adc6f3290b94160f5c0bd3800b`.
- Candidate A: [PR #5](https://github.com/lukketsvane/max.iverfinne.no/pull/5), source `31805b7cdadaaa9a11dc2ac74ebb21187364cffe`. Its PNG/JSON files are already staged in this handoff's [native directory](native/).
- Candidate B: [PR #6](https://github.com/lukketsvane/max.iverfinne.no/pull/6), branch `codex/native-pixel-assets`, inspected at `14f0c2a59fd2e9921077726edc7ebf9cf6192cec`. This is separate native-resolution work, not the earlier independently scaled concept-image exports.

Re-read main and the PRs before integration. Parallel asset work may have advanced.

## Import differences, not a ranking

| Contract | Candidate A: staged PR #5 rover | Candidate B: PR #6 watering robot |
|---|---|---|
| Rover PNG | 256 x 192 | 512 x 384 per direction |
| Transparent cell | 32 x 32 | 64 x 48 |
| Frames per direction | 48, mirrored at draw time | 64, with separate right/left sheets |
| Ground anchor | (16,31) | (32,44) |
| First idle frame bounds in JSON | 25 x 21 | 27 x 25; collision box is 28 x 25 |
| Water drawing | Separate 16 x 16 effects attached to `emitter` | Aligned 64 x 48 overlays and `nozzle` sockets |
| States | idle, drive, deploy, water, retract, dry, refill, sleep | idle, drive, deploy, water, retract, empty, refill, sleep |
| Additional material | Refill/dock/seed props and optional UI | Drone, cargo, plants, fauna, props and other sheets |

Sources: A's [rover metadata](native/rover.json) and [adapter](native/runtime.js); B's pinned [robot metadata](https://github.com/lukketsvane/max.iverfinne.no/blob/14f0c2a59fd2e9921077726edc7ebf9cf6192cec/assets/native/watering-robot.json) and [asset README](https://github.com/lukketsvane/max.iverfinne.no/blob/14f0c2a59fd2e9921077726edc7ebf9cf6192cec/assets/native/README.md). The dimensions above describe the first idle frame, not all animation poses. B's README describes a 28 x 25 idle silhouette; verify the actual opaque pixels rather than assuming its collision bounds are its visible bounds.

**A 64 x 48 cell is not automatically oversized.** Padding and world scale are different. Both candidates must be drawn one PNG pixel to one native canvas pixel, using their own anchors. Do not shrink B to 32 x 32, enlarge A to 64 x 48, or use identical cell origins just to make thumbnails align. Compare visible silhouettes beside the original Max and crow. More frames or a smaller atlas does not establish better artwork.

## Integration hazards to check

The candidates have different metadata and adapter APIs. A uses `new MaxNativeSprites().load(base)`, `drawRover()` and `drawSpray()`; B documents a shared `MaxNativeSprites.load()`, `draw()` and `cargo()` API. **Do not load both scripts into the same window under that global name.** Use separate review iframes, or explicitly namespace an adapter in a scratch comparison. Never pair one pack's PNG with the other's JSON or water effects.

A's staged adapter retains its historical `assets/native/` default. The current atlas inspection page passes `native/` explicitly. Supply `docs/asset-review/watering-robot/native/` when loading it from the repository root. B's left-facing robot and water sheet must be used together, with its own origin and elapsed time.

The inspected current `drawPlayer()` still draws native-size source/destination rectangles with `dx = px - CELL / 2, dy = py - CELL + 1`. The game's device-pixel canvas enlargement must remain responsible for screen scale. Do not alter the game's camera, player size or original atlas to make a candidate fit.

PR #5 contains an old build-script change and predates main's menu/account work. Do not merge it wholesale. The review material is already on main, without that change. PR #6 describes explicit staging rather than replacing the bundler; inspect its actual diff and current CI before any merge. Neither pack implements autonomous watering AI merely by providing animation frames.

## Decision requested from the main developer agent

Render both candidates, and any newer alternative, in the same current-engine scene with identical ground baseline, camera and lighting. Inspect silhouette, palette, detail density, wheel contact, arm clipping, nozzle attachment and spray reach. Exercise every state in both directions at phone size. Treat the earlier GIF as historical renderer-fixture evidence, not deployed gameplay or proof of autonomous watering.

Choose A, choose B, adapt one, or reject both. Record the visual reason and current-engine captures here before wiring gameplay, water consumption, targeting, refill behaviour, persistence or balance. Preserve the existing original art, menu/account work, result/bouquet assets and deployment settings.

### Decision record

- Status: awaiting developer evaluation; neither candidate selected.
- Selected candidate and revision: pending.
- Current-engine comparison captures: pending.
- Reasons and any rejected alternatives: pending.
- Gameplay integration tests: pending.
