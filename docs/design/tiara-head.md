# Tiara — Garden 10

The owner's approved head sheet supplies eight native rows of eight frames:
idle, bounce, jump, fall, land, roll, headbutt and hurt. Its runtime master is
`assets/tiara-head-v1/sprites.png`, 320×320; cells are 40×40 with fixed anchor
20,39. It renders at 1×, mirrored for facing with smoothing disabled. The head
centre sits 19 px above the soil. Rendering reads accepted combat state and
does not trigger hits, attacks, resources or phase changes.

Tiara replaces the required Bellkeeper encounter at Garden 10. All existing
shrine, court, reward and physical ascent rules remain. Bellkeeper retains its
original art and combat for roaming overstay encounters.

The host alternates jump → roll → headbutt. Amber destination marks precede
every committed attack (1.5 s on Easy; 1.15 s otherwise, 1.25 s for a roll).
Jump follows a .8 s arc, roll a .9 s court crossing and headbutt a .36 s short
lunge. Each attack owns a bounded four-player contact ledger. Swept, reachable
body contacts can strike each player once, using the shared health, dodge, brace
and tun rules. A short owner-scoped contact receipt supplies the existing local
knockback on every difficulty without duplicating host damage or counters. Contact causes health loss only in modes which enable it;
campaign Hard and Insane already enable gardener health. A guest cannot run
these decisions or spend its own damage.

Movement slows reduce the actual horizontal path. A jump's ground shock starts
at the actual landing and has its own .3 s warning; phases 2–3 add two side
shocks, warned for .5 s. All active shocks finish before the ordinary recovery
opening: 3.2/2.75/2.5/2.35 s on Easy/Medium/Hard/Insane. The exposed head sits
on the ground, takes double damage and stays reachable by a two-second bomb.
At one-third health newly committed attacks move 10% faster and jump higher.
Jump height is frozen when its warning ends; threshold damage cannot teleport
an airborne head. The
ordinary run clock continues scaling durability and damage; after a minute
the wait following recovery is shorter, preserving the full damage window.

The head's action, committed destination, movement clock, last landing clock
and per-player contacts are ordinary scalar pest fields carried by the existing
host snapshots and authority handoff. Defeat removes outstanding guardian
strikes, pays the normal reward and opens the physical ascent. The hurt row
plays once while fading; a new attempt clears presentation state.

Review the actual encounter at `review.html?mode=boss10`.
