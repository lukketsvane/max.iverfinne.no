# Guardian motion expansion

The sixteen newer garden guardians now have four authored drawings for each of
eight actions: idle, move, windup, attack, recover, vulnerable, hurt and death.
Their previous eight-pose sheets repeated single drawings through most actions.
The new pack contains 512 authored poses, plus one transparent death terminator
per guardian. The four older milestone designs keep their existing larger packs.

| Guardian | Motion character |
| --- | --- |
| Sprout Sentinel | Leaves unfold, roots stamp, the seed pod splits |
| Dew Duke | Belly swells, legs compress, water splashes on landing |
| Thorn Duelist | Blade flourishes, cloak follows the slash, knees buckle |
| Spore Oracle | Cap breathes, gills open, spores puff, stalk crumples |
| Root Ram | Hooves paw, antlers lower, roots drive the charge |
| Silk Weaver | Legs articulate and the abdomen pumps silk |
| Glass Snail | Eye stalks flex, body glides, the shell opens and breaks |
| Wick Hermit | Wax sways, flames flicker, the candle body slumps |
| Frostjaw | Mandibles spread and snap, the body shivers and lunges |
| Spindle Widow | Needle legs cross and spindles work the thread |
| Orchard Mimic | Fruit body breathes, hinged jaws gape and bite |
| Tuning Fork | Opposed prongs flex, strike and rebound |
| Kiln Beetle | Wing cases lift and the bellows breathe |
| Ash Ferryman | Hull rocks, oar paddles, lantern swings, boat capsizes |
| Compost Choir | Three mouths sing in turns and slump apart |
| Seed Engine | Pistons compress and seed rotors turn before breaking |

Built-in `image_gen` produced the masters from each guardian's existing sprite
reference. The exact prompts and source hashes are recorded in
`assets/garden-guardians-v1/motion-prompts.json` and `provenance.json`.
Checked-in native sources reproduce the runtime sheets without regenerating art.

Runtime drawing remains 32×32 at 1× with a fixed (16,31) anchor. The actual host
timers select windup and attack frames. Cyan stays visible throughout exposure.
Hurt animation lasts 0.3 seconds when no stronger combat signal is active; the
flash is still immediate. Guest snapshots retain animation clocks and now queue
boss collapses. Corpse-only presentation can finish after victory freezes time.

`guardian-motion-review.html` exercises all eight actions through the game's
renderer without accounts, saved progress or live rooms. The browser regression
checks it in Chromium and WebKit, alongside all twenty real boss arenas and both
planted-bomb classes. `scripts/preview-guardian-motion.cjs` exports the accompanying
four-times enlarged contact animation directly from native source frames.

The contact animation is an art review, with equal time per drawing; the game
uses its own attack durations and state-specific animation speeds.
