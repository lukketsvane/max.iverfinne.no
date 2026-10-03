# Rattus animation bank

Figma is the master: file `TC0PHGMTCMR6im4hb3CSbF`, animation studio
`548:13527`, production strips `558:13527` inside player section `451:5`.
The 25 PNG strips were exported from the authored Figma frames at 1×.

189 frames use the existing ring-gear palette, binary alpha and integer
anchor (32,39). Cells are 64×40, except the complete tail-whip poses at
96×40. Padding does not change the body size or collision box. Never
stretch a pose to fill its cell. The older 32×32 character sheets remain
the source for tending, planting, climbing, menus and result portraits.

The atlas records each frame's actual bounds and each pose's duration.
Walk and sprint run on all fours and follow travel speed. A stop from a
run plays braking. After four seconds of grounded, free input silence,
Rattus kneels, rests, performs her rat-call and transformation fidgets, and
rises. Any input, including held controls against a wall, cancels idle
immediately. Accepted latch, Driving and stomp phases read the existing
tail, guard, kick, dive and crouch poses without advancing combat clocks.
Ground and air boot strikes vary their presentation; gameplay owns validated
damage, reach and cooldowns. The rat fidgets are cosmetic and do not spawn
combat allies.

Animation name and time travel in the existing co-op avatar snapshot.
Both local and remote players use the same native renderer and anchor.
