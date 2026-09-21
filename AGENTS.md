# Developer-agent handoff

## Graphics lead and soundtrack

Read [the shared graphics direction](docs/graphics-direction.md) before changing
visuals or audio. Coordinate in [issue #10](https://github.com/lukketsvane/max.iverfinne.no/issues/10).
Preserve the native atlas/pixel scale and approved run-bouquet requirements below.
The direction note records soundtrack implementation status.

## Integrated watering-robot artwork

The supplied candidates were compared and selected for the three-tier runtime.
Before changing the companion artwork, read
[the selection and rationale](docs/asset-review/watering-robot/selection.md)
and [the original candidate handoff](docs/asset-review/watering-robot/README.md).
The game uses the native 32×32 starter, supplied 48×40 upgrade and supplied
80×48 rover, with each tier's original pixels, anchors and animation timing.

The review folder contains real PNG/JSON sheets and an atlas inspection page.
The selected runtime assets are integrated separately; the review folder remains
a comparison reference. Evaluate any replacement against the current game,
not the earlier generated concept backgrounds, and update the selection note
with its rationale.

Preserve concurrent work on main, including the menu, accounts, saves, original
artwork and result/bouquet assets. Do not merge draft PR #5 wholesale: its build
changes and game snapshot predate the newer main work. Its source remains a
reference for selectively adapting the candidate or its render fixture.

## Approved run-bouquet screen

Before further game-over or leaderboard work, read
[the user's approved bouquet reference and requirements](docs/asset-review/bouquet/README.md).
The bouquet must represent the player's actual saved run, using the game's native
plant art and growth data. The note also contains the requested preview names.
