# Garden guardians — 2026-09-26

The main garden now has twenty mandatory guardians, with eight new native sprite
designs and later rematches. Mech places stationary bombs with a two-second fuse.

## Input-driven two-player iterations

`node scripts/playtest-garden-guardians.cjs` runs two independent clients through
the real frame loop, sends keyboard input and exchanges authoritative snapshots
with 100 ms simulated latency. It never writes player position, damage or rewards.
It uses generated layouts in the VM harness; this is not a substitute for browser
or human playtesting, and the simple pilot does not deliberately collect elevated
route upgrades. Random terrain and choices vary between runs.

| Iteration | Outcome | Observation |
| --- | --- | --- |
| Initial usable pilot | Cleared guardians 1–3, physically climbed into 4 at 176.5 s | Fights took 32.6, 47.2 and 67.2 s; mandatory fights were getting too long |
| Repeat | Lost the plant on guardian 3 at 119.1 s | Tending alone did not guarantee survival |
| Reduced health and softer boss clock resistance | Cleared guardians 1–4; lost against Mossback at 201.2 s | Fights took 27.6, 26.1, 30.6 and 21.7 s; fifth guardian remained a difficulty step |

The changes reduce ordinary guardian base health and apply square-root clock
resistance to mandatory bosses. Enemy pressure still increases with elapsed time;
ordinary pest durability and damage are unchanged. A route-focused player can
collect additional upgrades before choosing to wake a guardian.

Moon Moth now descends during recovery and remains vulnerable for a full Mech
fuse. Focused tests exercise all twenty gates, distinct attack warnings and
exposure windows, delayed bombs at 30/60/120 Hz, ledge placement, guest input,
duplicate delivery, rewards for both players and authority handoff.

## Art verification

All eight 256×256 runtime PNGs were imported at native size into Figma production
group 366:2, and read back byte-for-byte. The legacy whole-project `figma:check`
cannot run here: its desktop endpoint is unavailable and its configured source
section 52:2 is absent from the current file. New sheets remain hash-pinned in
the documented pending manifest until that global source manifest is reconciled.
