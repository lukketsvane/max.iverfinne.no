# Developer-agent handoff

## Pending watering-robot art review

Before selecting or integrating a watering robot, read
[the candidate handoff](docs/asset-review/watering-robot/README.md).
The user explicitly wants comparison with the other supplied robot assets;
this candidate is optional, not approved, and may be replaced by a better fit.

The review folder contains real PNG/JSON sheets and an atlas inspection page.
It is not imported into gameplay or the production build. Evaluate against the
current game, not the earlier generated concept backgrounds. Record the chosen
candidate and why it fits before integrating it.

Preserve concurrent work on main, including the menu, accounts, saves, original
artwork and result/bouquet assets. Do not merge draft PR #5 wholesale: its build
changes and game snapshot predate the newer main work. Its source remains a
reference for selectively adapting the candidate or its render fixture.
