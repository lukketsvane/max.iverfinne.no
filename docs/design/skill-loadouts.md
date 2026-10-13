# Pre-run skill loadouts

`MaxClasses.skillLoadouts` is the shared class-specific choice catalogue. `player-loadout.mjs` cleans and saves only known non-base selections; old loadouts remain unchanged. The pre-run menu exposes two choices for secondary and special, or the two tun choices for Sligo. Primary attacks, utility skills and their normal bindings stay fixed.

`CoopSession` carries the choices in the accepted selection and lobby. A known playing member retains their original selection across reconnects. `coopMember` and snapshots retain the cleaned owner choices. Ordinary input cannot change them; the host dispatches the equipped ability rather than trusting the packet's variant claims. Existing action IDs and class tags reject replay.

`polge.inc.js` owns the alternate casts. They make one immediate, line-of-sight checked contact group, spend one owner resource debit and start the existing class cooldown clock. Offensive misses spend nothing. These casts create no new movement permission, projectiles, healing debt or recursive resource rewards.

| Character | Secondary: cost / cooldown / reach / damage | Special: cost / cooldown / reach / damage |
| --- | --- | --- |
| Max | Shock: 1 Circuit / 6 s / 40 px / .9 D, Wet | Steam: 2 Circuit / 14 s / 56 px / 1.6 D, Wet |
| Rattus | Snapkick: 15 Momentum / 4 s / 28 px / 1 D, forward push | Earthshaker: 35 Momentum / 8 s / 44 px / 1.8 D, grounded |
| Cairn | Fault clap: 1 Strata / 5 s / 32 px / 1.3 D, forward | Quake: 2 Strata / 16 s / 56 px / 1.8 D, grounded |
| Mycel | Miasma: 2 Culture / 5 s / 36 px / .9 D, .7 s slow | Storm: 4 Culture / 12 s / 72 px / 2 D, no restoration |
| Pølge | Rising clinch: 1 Rhythm / 4 s / 24 px / 1 D, one forward target | Haymaker: 3 Rhythm / 10 s / 32 px / 3.2 D, one forward target |
| Sligo | Existing controls | Watchful tun: 1.5 s / existing 9 s cooldown after uncurl / 64 px plant protection |

Base abilities retain their existing code and balance. Alternate hits still use the acting owner's ordinary combat build and global run power. Pølge's Many hands adds real close echoes to Haymaker; Ringcraft shortens its authoritative remaining cooldown, and Second wind requires the actual finishing contact. Mycel's Storm consumes a genuinely primed stronger pulse and Living chorus readies the owner's primary after real contact. Native body sheets, anchors and atlas bytes are unchanged. Planting, Tend, dodge, ladders, physical exits and the special survival-mode constraints remain separate.

Tests exercise real contacts, resource debits, cooldown rejection, solid walls, missed casts, no-plant Storm, single-target melee Haymaker, Watchful tun's actual range, saved selection, accepted guest input, replay and host handoff.
