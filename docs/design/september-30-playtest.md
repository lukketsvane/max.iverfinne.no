# Twenty-garden co-op playtest

The stored summaries at 00:14 Oslo time on 30 September show a two-player Easy victory at garden 20, lasting 40:11. They report 372 plants, 112 harvests and two lost plants. One client retained the full garden timeline; the other retained only the final checkpoint. Both summaries reported the same class, so those older class fields are not reliable for comparing the two builds. These are balance summaries, not a video or input replay.

## Changes

- Native atlas loading is limited to four concurrent packs, retries a failed pack once and accepts actual loaded pixels when a mobile decoder rejects `decode()`. The boss renderer also supports browsers without `Object.hasOwn`. Hit-flash atlases are allocated only when needed. Failed pack names enter future balance records.
- Shrines and trial stations use completed native district prop assets.
- Each garden has dry, matching horizontal loop boundaries outside its authored geometry. Crossing preserves player height, velocity, camera framing and parallax continuity. Co-op accepts a legitimate seam crossing while rejecting positions outside the finite map.
- XP costs continue increasing beyond 45. Preparation raids no longer award an additional guaranteed boon; the guardian keeps its guaranteed reward. Existing build branches and signature prerequisites remain available, with fewer surplus choices.
- Guardians scale their starting health with player power and team size. Their health is fixed at summoning.
- The final garden requires lighting three summit beacons before summoning the Crown. The Crown has three damage-gated stages, protected transitions, increasingly strong existing attack patterns and explicit stage announcements. The result screen says VICTORY or GAME OVER; victory identifies the defeated Crown and Garden 20/20.
- Future records retain the run seed, actual local class, each player's build, shared timeline, asset load status, guardian fight duration and Crown transition times. A balance copy is stored with the finished local garden as well as sent to the existing stats sink.
- Game copy, High Tide zones and prompts, review controls and new Figma labels are English.
- Enemy variety now starts with rats in garden 2, thieves in 3, beetles in 4, spore casters in 5 and healing moths in 6 on every difficulty. Small waves lead with the new role; later groups favor two non-bird roles plus a bird. Rat variants cycle from gardens 4, 7 and 10. Future balance summaries retain the actual spawned mix per garden and spawn source. See `enemy-encounters.md`.

## Figma handover

[Level Design](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=382-2) contains twenty editable draft blueprints, the geometry kit, native shrine/relay/cache components and the finale brief. All 632 path-named production PNGs and fifteen legacy inline source images are available individually at native resolution. Their original hashes were verified.

The drafts provide an authoring starting point. They are not twenty newly deployed hand-authored maps. Activate a frame through the documented `designed` marker, export it and physically test reach before release. Generated expedition geometry is shown as locked reference.

## Validation scope

The automated suite checks gameplay, co-op authority, timing and real movement physics at supported frame rates. The hosted Figma snapshot check verifies 632 MATCH against the repository. A fresh Android device session is still needed to confirm the original rendering report on the friend's browser and to judge the new difficulty and finale pacing. No video of the reported run exists in the stored summaries.
