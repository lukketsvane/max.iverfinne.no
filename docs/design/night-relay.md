# Night Relay

A short, replayable cooperative light heist for **2–4 human players** in the
existing MAX engine. Public artifact stone in Garden. Not another planting,
growth or wave-defense mode. No new sprites, accounts, equipment or controls.

## The whole loop

Pick up the light with Tend. One player carries it to the gold rune while a
different player holds Tend on the blue switch. Hold both for 1.4 seconds to
open the lock. Three locks progressively put the operator, then the carrier,
on higher platform routes. Each lock requires a different carrier from the
previous lock. Stand together and both hold Tend to hand over the light.

The light heats up: 28/22/19/16 seconds on Easy/Medium/Hard/Insane. Passing cools
it. Overheating returns it to the last unlocked checkpoint and costs 16 light.
Light drains at .55/.8/1/1.2 per second. Four optional wisps restore 22 light
and 25 health; locks restore 25 light and heal standing teammates by 35.
Handoffs cannot manufacture energy by repeatedly passing back and forth.

Floor strips warn for .8 seconds before a 1.3-second pulse. Jump, dodge or wait.
Stay within the light: separation beyond 150 native pixels damages gardeners.
Hold Tend beside a fallen partner for three seconds to revive. All down or no
light ends the attempt. After lock three, the whole living team must reach the
exit; two different players hold the two exit runes for two seconds, one with
the light. A real result screen records locks, handoffs, time and remaining
light. Retry returns to the same mode. No fabricated plants or normal scores.

## Multiplayer contract

The first member may enter and wait. Fewer than two fresh room members freezes
the mode clock, light, heat and hazards. Sligo cells and stale avatars do not
count. Departure drops the seed at a reachable checkpoint; late joiners spawn
there. The host owns objectives, energy, heat and health. Remote Tend requires
an accepted avatar and input newer than 500 ms. Snapshots preserve the entire
heist and health through host handoff. Existing character reservation, room
limits, invite validation and access controls remain authoritative in Supabase.

## Iteration evidence

The first input-only paired runs exposed an unsafe walk-off edge beside lock
two. Its platform was shortened so a player can always return to the team.
The input pilot was separately corrected to finish each actual landing before
planning the next jump. These tests use ordinary keys and real physics; no
teleports, bonus health, forced damage or direct objective changes.

Three pairs (Mech/Herbalist, Moss/Bulwark, Sligo/Pølge) subsequently completed
all three locks and escaped, with 100 ms latency each way. A Bulwark/Pølge pair
also completes Hard at 250 ms. Optimal pilots take roughly 36–40 seconds; they
know the route, so this is not a human completion-time or enjoyment estimate.
Mechanics tests separately cover waiting alone, stale members, remote inputs,
handoff latching, overheating, revives, defeat, completion, late joining and
host promotion. Four players must all reach the exit, not just the rune pair.

The first paired WebKit pass reached all three locks after reconnect and host
handoff, then exposed an existing shared results renderer calling an undefined
sprite helper. The renderer now draws the saved class's native idle frame
directly. A full-scene regression covers all four game modes, pixel size and
live-state restoration; browser completion also checks both visible results.

`night-relay-review.html` runs isolated, memory-only browser clients, with manual
controls, input pilots, a connection-cut switch and host handoff. The production
game exports no test API. `scripts/check-night-relay-browser.cjs` runs the paired
flow in Chromium and WebKit and retains screenshots. Test infrastructure is
not a substitute for a final play session with two people.

## Backend review

Migration `20260926192312_night_relay.sql` only extends the room mode constraint
and the inspected private join function's allowlist. It changes no grants,
policies, auth settings or existing data. Hosted history was checked before
preparing it. PGlite tests exercise real join, class reservation, mode isolation,
invite targeting, difficulty inheritance and authority handoff for both public
artifacts.

Pre-existing Supabase advisor notices, outside this feature's scope:

- [Leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [Public SECURITY DEFINER RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) are flagged. Existing status/unlock endpoints are unchanged.
- [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) on private RPC-only tables and the egg catalog is unchanged.
- [One unindexed unlock foreign key](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [run-stats RLS initialization](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) and [an unused archive index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) are unrelated existing findings.
