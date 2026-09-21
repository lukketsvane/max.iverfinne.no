# Companion selection — 21 September 2026

The current request is to implement a small companion with later upgrades and
publish it to production. Reviewed the incoming handoff, both asset branches,
`robot_developer_pack(1).zip`, and `MAX_watering_robot_assets(1).zip`.

Selected the 32×32 native candidate as the starter. Its 20–22 px visible height
stays below Max's 24 px standing silhouette; its restrained palette comes from
the original game. It reads as a little helper beside the existing plants.
Selected the supplied 48×40 robot (29 px visible height) for the first upgrade
and the 80×48 rover (31 px visible height, wider tank/chassis) for the second.
These are different supplied drawings, not enlarged copies of the starter.

Each source PNG is byte-for-byte intact. Each tier keeps its documented frame
rectangles, timing and ground anchor. Larger robots follow farther behind Max
so the wider silhouette does not cover him. Normal scene lighting still runs
after all actors. The starter's spray is anchored to its frame's nozzle; larger
water clips already contain their own spray. Tanks, rate, range and upgrades
are run state rather than permanent account advantages.

`/review.html` places each candidate in the current engine with Max and actual
plants at the same camera/viewport. Its portrait/landscape fixtures also check
the incoming bouquet compositor. Production verification is recorded in the
integration pull request. These fixtures use in-memory saves and no account UI.

The old draft PR #5 is not merged. Its historical build and index are not used.
The main-branch review folder remains intact for comparison with other artwork.
