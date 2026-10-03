# Rattus norvegicus

Rattus is a mobile rat wrestler. Real sprint travel, a tail pull and confirmed
boot contacts build Momentum. She can keep a latch while charging a Driving
dropkick, spend the meter on a short collision-resolved kick, then finish with
one splits-stomp landing. Gardening, ordinary climbing and dodge remain
separate actions.

## Kit

Damage below uses D: one unupgraded grounded Rattus kick against one target.
Shared level power, enemy durability, exposure and existing owner upgrades
still apply. The Driving/stomp caps limit their base formulas before those
preserved modifiers. Distances are native pixels.

| Action | Base timing, contact and resource |
| --- | --- |
| Ring traction | Momentum 0–100. Actual sprinting above 80% of current class sprint speed earns 20/s; real actor displacement during a latch earns 30/s. One confirmed B/V/E enemy boot action earns +5, regardless of victims. After .8 s without qualifying movement, decay is 18/s. |
| Boot combination / B | .5 s base recovery; grounded 1 D at 34 px reach, airborne 1.1 D at 24 px body-centred reach. Each target takes one hit per action; solid walls still block contact. |
| Tail latch / C | Aim within 96 px at a live legal pest, mature living stem, real platform or solid terrain. Full 5 s cooldown starts on accepted attachment; an empty miss gets only a .25 s retry. Heavy anchors pull Rattus; an ordinary light pest takes .25 D once and is tugged toward her. Releasing keeps actual accepted velocity. |
| Driving dropkick / V | Hold .2–.6 s, then release. At least 45 Momentum spends 45 and deals `min(3.2, 1.4 + .018 × pre-spend Momentum)` D. Below 45, spend the remaining meter and deal 1.4 D. Accepted release starts an independent 5 s cooldown; an early release or uncommitted cancellation spends nothing. Travel is horizontal or diagonal, at most 80 px through real collision. One hit per target. |
| Splits stomp / E | Accepted activation spends 50 or the remaining meter and starts 8 s cooldown. Ground start uses her existing legal leap; air/climb start detaches into descent. Only the first actual floor/platform landing deals `min(3.6, 1.8 + .01 × pre-spend Momentum + .008 × min(actual apex-to-landing fall, 96))` D in a 38 px radius. Grounded recovery and 20% knockback resistance last .2 s. |

Traction checks the **current contact-time** meter before the +5 reward. At
40 or more, a genuine boot contact grants 3 s of 20% knockback resistance;
refreshing it does not stack. The cost's pre-spend damage sample does not
substitute for this check. Tail-only tugs, guardian objectives and follow-up
waves earn neither boot Momentum nor traction. Wall pressure, poses, camera
movement, corrections, placement and reconnects earn no travel resource.

Only **Last Seed** adds temporary barrier health: +8 on an eligible traction
contact, cap16, expiring with the refreshed 3 s traction window. It absorbs
ordinary damage after existing mitigation, never heals HP and never grants
timed immunity. Garden and High Tide gain knockback resistance only. Landing
guard and traction use the same .8 factor rather than multiplying.

## Bounded motion decisions

The proposal leaves pull speed, recovery, release timing and signature
details unspecified. These are the implemented prototype choices:

- Actor pull: 180 px/s, at most .75 s and 96 px cumulative Euclidean path.
  Light pest tug: 120 px/s, at most .25 s and 30 px. Bosses/guardians, shield
  beetles, rammers, queens and elites pull the actor; a guardian is never
  displaced. Revalidate the actual living anchor and real terrain each step.
- Driving: 180 px/s; a .2–.6 s charge maps path48–80 px. Direction is
  horizontal or at most 35° diagonal. Recovery is .2 s at base. An airborne
  recovery remains airborne. A hard **real** .2 s hold is required before
  Ring tempo's charge benefit applies; client-reported hold is ignored.
- At least 4 px of actual actor pull establishes 3 s of grapple proof.
  Selecting an anchor, tugging a light pest or showing a tail pose does not.
  Only a subsequent confirmed Driving boot contact can prime Flying press.
- Driving commitment releases the latch and cancels an active dodge path
  while keeping its paid cooldown; it adds no invulnerability. E rejects
  an active dodge and cancels uncommitted latch/charge. Water, hazard, down,
  world travel or an invalid anchor cancels motion while retaining already
  spent resource and accepted cooldowns.

During C or held V, B remains available. A latch blocks jump/dodge, tending,
ladder/autocatch and ordinary steering while pulling the actor; light tug
keeps normal steering. Held V alone allows ordinary movement/jump/dodge but
blocks tending and ladder/autocatch. Committed V, E flight and recovery lock
new combat/care actions. E retains ordinary air steering; grounded recovery
locks steering. Matched release/cancel remains available for its own start.

## Controls

| Action | Keyboard | Touch | Standard controller | Horizontal single controller |
| --- | --- | --- | --- | --- |
| Primary | B / threat aim | Tap a threat | Existing primary | Existing primary |
| Tail latch | Hold C, release | — | Hold View/minus (8) | Hold View/minus (8) |
| Driving | Hold V, release | — | Hold left trigger (6) | Hold stick click (10) |
| Stomp | E | Tap Rattus | Left shoulder (4) | Top face (3) |
| Tend | Space / down | Drag down | Existing Tend | Existing Tend |
| Dodge | X | Quick horizontal flick | Existing stick click (10/11) | Existing left shoulder (4) |
| Refill nearby rover | R | Tap a nearby rover | Hold Tend + Latch (8) | Hold Tend + Latch (8) |
| Lantern | L | — | Home (16), or hold Tend + Utility (6) | Home (16), or hold Tend + Utility (10) |

Refill/lantern chords suppress garden work while held. They do not start a
latch or Driving charge. Normal jump, sprint, mature-plant climbing, separate
gardening and Sligo's own Q/left-trigger exchange keep their roles. Gameplay
has no on-screen action buttons. Tail latch, Driving and lantern require
keyboard or controller input; touch retains canvas movement, attack, Stomp,
gardening, dodge, refill and plant climbing. Blur and released controls cancel
an uncommitted charge.

## Existing upgrades

IDs, ranks, prerequisites, mode lists and owner attribution are unchanged.

| Boon | Live effect |
| --- | --- |
| Heavy boots (`needle`, 3 ranks) | Preserve B/V/E damage ×`(1 + .25 × rank)`; ordinary primary knockback +10%/rank, cap30%. No extra boss force; C retains its own .25 D. |
| Wide stance (`fletching`, 3 ranks) | Primary reach +3 px/rank, stomp radius +4 px/rank. Global stomp radius cap54 includes Flying press. |
| Ring tempo (`tailwind`, 3 ranks) | E cooldown and Driving/stomp recovery ×`.88^rank`; after the hard .2 s hold, effective charge `min(.6, rawHold × (1 + .08 × rank))`; Momentum decay `18 × .92^rank`. Idle delay stays .8 s. |
| Crowd crush (`crosswind`) | Preserve +25% for each additional primary victim. A stomp sampled at100 Momentum schedules exactly one .45 D wave .12 s later at its real landing centre, using the same legal radius≤54 and wall checks. No resource/ward/proc recursion. |
| Flying press (`updraft`) | Preserve airborne-primary ×1.25 and stomp radius +12 subject to54 cap. Genuine pull → confirmed Driving contact primes the next accepted stomp ×1.2 for4 s; consume it at activation even if the landing later misses. |

## Native presentation and shared authority

All original PNG and atlas bytes remain unchanged. The approved motion bank
has 25 clips/189 frames, 64×40 cells (tail-whip96×40), variable native timing
and integer anchor(32,39). Original 32×32 main/interaction poses, anchor(16,31),
still supply planting, climbing, menus and results. Planting uses its full
split and existing sow hit marker. No pose creates a combat contact.

`rattus-motion.mjs` reads accepted wrestler state and the pure phase policy:
tail-whip for latch, guard for held charge, authored pounce for Driving,
split-kick/dive for stomp flight and a grounded crouch for recovery. Four
seconds of grounded/free **input silence** begins the existing idle routine;
any key, pointer, held control, wall pressure, care or charge cancels it.
Fidgets remain cosmetic. The unuploaded Notion dance/8×8 concept masters are
not runtime replacements. No fresh Figma export or synchronization is claimed.

The owner state is `rogueRun.wrestler` or `member.wrestler`. The host accepts
tags, resource, anchor IDs, server-held charge, physical travel and the first
landing. Cast-specific target stamps and consumed landing IDs prevent replay.
Finite captured clocks/budgets survive late join, reconnect and promotion;
private elapsed-time origins rebase without resetting a charge or ascent.
The accepted leap's ascent ends at its original peak time. A delayed
correction resumes descent from the height actually reached; an expired
launch with no observed airborne movement cancels with its cost and cooldown
still paid.
An old start snapshot cannot re-arm locally released guest input. Neither
guest pose, raw velocity, claimed apex/drop nor client hold decides hits.

Ordinary plants still need half their maximum **physical height** to climb.
High Tide uses its bent current stem and genuine head/water/breath checks.
Anchors, motion and contacts cannot bypass stage bounds, water, guardian
locks, physical exit ascent, shared seeds or exclusive player reservations.

`review.html?mode=runner` provides real mature plants, natural nearby ledges
and warned sentries with no unearned Momentum. `&boons=1` enables the existing
complete wrestler build. Review saves stay in memory; observations only read
actual phase/resource/contact state, and held buttons use normal inputs.

Sources: [Rattus proposal](https://app.notion.com/p/3ec1c6815f7881d2b50aeee994c0c500),
[Ring traction](https://app.notion.com/p/3ec1c6815f7881da84a9d4fe076e510b),
[Boot combination](https://app.notion.com/p/3ec1c6815f78814c9ea7d7b64ec0185d),
[Tail latch](https://app.notion.com/p/3ec1c6815f788178b7affc261c6244a7),
[Driving dropkick](https://app.notion.com/p/3ec1c6815f7881868b8befe22bc7e8d3),
[Splits stomp](https://app.notion.com/p/3ec1c6815f78813f97cff6ab376530eb),
[shared input](https://app.notion.com/p/3ec1c6815f7881478cc0c10177a46ed7),
[art concept](https://app.notion.com/p/3ec1c6815f788142ba31ccd618bffadd).
