# Garden guardians — 2026-09-26

The main garden now has twenty mandatory guardians, with twenty distinct designs and combat kits.
Mech and Moss place stationary bombs with a two-second fuse.

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

All sixteen new 256×256 runtime PNGs were imported at native size into Figma production
groups 366:2 and 369:2, and read back byte-for-byte. The legacy whole-project `figma:check`
cannot run here: its desktop endpoint is unavailable and its configured source
section 52:2 is absent from the current file. New sheets remain hash-pinned in
the documented pending manifest until that global source manifest is reconciled.

## Original encounter expansion

The eight rematches were replaced with Glass Snail, Wick Hermit, Spindle Widow,
Orchard Mimic, Tuning Fork, Ash Ferryman, Compost Choir and Seed Engine. Each has
its own sprite sheet and a different combat objective. Objective completion
opens a longer core window; armour never makes normal attacks ineffective.
Dew Relay, Rain Loom and Echo Nest add carrying, care and targeting trials.

Focused checks cover shell breaking and flanking, interrupt ownership, wicks,
anchors, rotating seeds, false fruit, regrowing choir voices, carrying dew,
trial completion/expiry, guest held care and a host change with carried dew.
Moss's planted bombs are exercised at 30/60/120 Hz. All sprites pass the native
palette, binary alpha, bounds and fixed-anchor checks.

Additional input-driven Moss + Herbalist trials use 100 ms simulated latency.
The first pilot cleared guardian 1 but mishandled Moss's ordinary plant climb.
After correcting the pilot's exit input, it cleared guardians 1 and 2 in 23.5
and 26.6 seconds, climbed into garden 3, then lost its new plant. An isolated
Glass Snail arena cleared in 46.7 seconds and physically climbed into garden 9.
Isolated late-stage arenas start at player level 1 with no inherited upgrades;
they test controls and failure paths, not the balance of a fully equipped run.
These are automated VM playtests, not a claim of a human twenty-stage clear.

The browser review exercises every guardian's live warning and native art in
Chromium and WebKit, and checks movement, placement, stationary ticking and
explosion for both bomb classes. Screenshots are uploaded by the dedicated
Garden guardians browser review workflow.

## Guardian animation expansion — 26 September 2026

This pass changes artwork and presentation, not boss health, attack timings,
movement, damage, rewards or progression. Seventeen targeted rendering/co-op
checks pass, including complete real-simulation attack cycles for all nineteen
nonfinal guardians and guest death animations. The final Crown's corpse now
finishes even after victory stops the simulation clock.

Two independent-client automated runs used normal input, Medium difficulty and
100 ms snapshot latency. Mech + Herbalist defeated gardens 1–3 and physically
entered garden 4 at 126.9 seconds. Moss + Herbalist defeated gardens 1–2, entered
3 at 57.7 seconds, then lost the plant at 89.4 seconds while the Thorn Duelist
was active. These are automated controller samples, not human playtests or a
claim that the full campaign has been cleared.
