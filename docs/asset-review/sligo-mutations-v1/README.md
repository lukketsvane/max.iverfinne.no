# Sligo tissue mutations

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
80 poses selected from the owner's `Untitled(1).zip` (334 assets). Unchanged
source cuts live in `source.zip`; each runtime frame records its filename in
`assets/max-skins-v1/sligo/mutations.json`.

| Clip | Frames | Game use |
| --- | --- | --- |
| crawl | 11 | Running: the body spreads into a low tissue crawler |
| throw | 8 | Throws: a chain of clot-like body parts |
| tend | 14 | Watering and picking: the chain reaches out |
| float | 22 | Floating: thin tissue wings unfurl |
| fall | 16 | Falling: the head grows a fleshy canopy |
| rise | 9 | Jumping: long tissue legs |

[historical build-sligo-mutations.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-mutations.py) applies one shared 0.75 scale to
all source cuts, then snaps colour to the existing Sligo specials palette.
The 512×640 atlas has 8×10 exact 64×64 cells, anchor (32,63), binary alpha
and clean transparent pixels. Tissue extensions keep their relative size;
the renderer draws native pixels with integer positioning and no smoothing.
The original skin and 40 specials remain the loading fallback and supply
idle, walking, dodge, hurt, digging, sleep, sac and blood-clot effects.

The new poses change presentation only. Throw release, movement, damage,
planting, cooldowns and co-op authority remain unchanged. Both remote and
local avatars use the same renderer. Young plants of kinds 25 and 26 draw
the red clot from specials, with a red pixel fallback while it loads.

The new PNG is hash-pinned in the existing Figma pending-art workflow.
Figma desktop sync remains pending; see `docs/figma.md`.
