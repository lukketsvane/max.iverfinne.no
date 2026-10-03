# Pølge: Rhythm boxer

Pølge remains the owner's limbless mannequin and the glue of the pølgevenner.
His playstyle is close contact and timing: build Rhythm with a three-part combo,
use a clinch to interrupt pressure, slip an actual warned attack for a counter,
then spend Rhythm in a flurry while steering beside the target. Gardening,
climbing and shared progression retain their normal controls.

Source: [MAX characters and game](https://app.notion.com/p/tingogtang/MAX-karakterar-og-spel-3ec1c6815f7881f08a79e6012e9b517b),
[Pølge proposal](https://app.notion.com/p/3ec1c6815f788158badaed2b29af47b6).
This document describes the implemented runtime contract. The Notion proposal
is design evidence; its remote status has not been changed by this code pass.

## Abilities

`D` is an ordinary damage unit before the existing ember, player level,
difficulty, exposure and enemy durability rules. Reaches are in game pixels.
All damage comes from the current actor's close contact and line of sight.

| Ability | Base behavior |
| --- | --- |
| Rhythm | Confirmed primary enemy contact earns one beat, capped at three. A missed or objective-only strike earns none. After two seconds without a confirmed contact, lose one beat per second. |
| Primary | Jab, cross, uppercut deal .52 / .72 / 1.1 D at reaches 18 / 20 / 24 px. Base recovery is .22 s; the next confirmed strike continues the combo within .95 s. A missed strike keeps its combo step. Expiry returns to jab. Uppercuts suppress the nearest contacted ordinary pest’s windup for .6 s; guardians retain their existing interruption rules. |
| Clinch break | A 20 px close press deals .7 D, or 1.0 D while spending one Rhythm beat. It interrupts an ordinary pest for .35 s. Base cooldown is 4 s. No legal enemy contact means no resource spend or cooldown. It never drags a boss, teammate or plant. |
| Slip and counter | A steerable .18 s ground weave travels at most 24 px through legal terrain. Base cooldown is 3.5 s. Avoiding an actual warned attack primes one ×1.5 primary for 1.1 s. An empty slip grants no counter; the next confirmed primary consumes a primed counter once. |
| Close flurry | Six .35 D close pulses followed by a 1.2 D uppercut finish at .95 s. Each spent Rhythm beat adds one pulse, up to three. The unupgraded maximum is 4.35 D. Base cooldown is 8 s. It requires a legal close enemy at the first pulse and spends its beats once after that confirmed contact. |

Flurry follows the player's changing position and facing. It permits steering
and does not create a locked stationary turret. Each later pulse independently
checks contact and walls; moving away or losing the target can miss the rest.
Clinch and flurry do not generate new Rhythm. Threat interruption cancels the
ordinary enemy's relevant pending strike; a boss's body remains resistant to
lift and knockback.

Shared attack recovery boons still apply. Light step reduces Slip recovery but
does not extend its duration or maximum displacement. Quick hands reduces
primary recovery without increasing reach. Upgrades never turn a close strike
into a traveling fist, bomb, autonomous decoy or projectile.

## Controls

| Action | Keyboard | Touch | Controller |
| --- | --- | --- | --- |
| Primary | B | Tap a threat or the normal attack gesture | Existing attack input |
| Clinch | C | — | View/minus, button 8 |
| Slip | X | Quick horizontal flick | Existing dodge: standard stick click 10/11; horizontal Joy-Con left shoulder 4 |
| Flurry | E | Tap Pølge | Existing special: standard left shoulder 4; horizontal Joy-Con top face 3 |
| Tend / plant / harvest | Space or ↓ | Drag down | Existing Tend input |

Threat taps keep their ordinary priority, including a threat overlapping the
character. Exit climbing keeps its normal tap-to-climb behavior. Gameplay has
no on-screen action buttons; Clinch requires keyboard or controller input. Slip
uses the existing canvas dodge flick. Settings,
boon selection and controller input release keep the shared game's existing
rules; they never stop the world clock.

## Build directions

Saved upgrade IDs remain compatible with earlier accounts. Each effect is
exclusive to Pølge and changes actual authoritative combat.

| Upgrade | Runtime ID | Effect |
| --- | --- | --- |
| Many hands | `varnish` | One additional .35 D local flurry pulse per rank, maximum three. Base, Rhythm and boon pulses total at most 12, followed by one finish. |
| Heavy hands | `splinters` | Primary uppercut damage ×(1 + .25 × rank), maximum three ranks. The flurry finish retains its separate 1.2 D damage. |
| Ringcraft | `raincoat` | A confirmed combo or flurry strike restores .2 s of special cooldown per rank, maximum three. Misses and objective-only contacts recover none. |
| Haymaker | `haymaker` | Primary uppercuts reach 36 px, lift ordinary pests at 110 instead of 85, and deal 25% more damage against an applicable active guard. Bosses are never lifted. Requires Heavy hands 2 and Ringcraft 1. |
| Second wind | `secondwind` | Once when a flurry finish actually contacts an enemy, restore 15% health and 12% moisture to living plants within 48 px of the current actor. No cast-start or miss recovery. Requires Many hands 2 and Light step 1. |

Flurry's fully upgraded raw ceiling is 5.4 D before common run modifiers: 12
bounded .35 D pulses and one 1.2 D finish. Heavy hands and Haymaker modify the
primary combo's uppercut rather than multiplying that special ceiling.

The three directions reward different choices: more flurry contacts, stronger
uppercuts against pressure, or cooldown recovery through accurate close combat.
Haymaker strengthens the uppercut route; Second wind pays accurate finish
positioning beside the garden. Plant recovery is clamped to normal health and
moisture limits and is applied once per successful finish.

## Shared simulation

The host owns combo continuation, Rhythm and decay, accepted clinches, Slip
movement and genuine avoidance, counter expiry, flurry scheduling, contacts,
resource spend and cooldowns. Guests send the same normal action paths and
receive validated effects. Duplicate tags cannot repeat a clinch, spend,
counter or flurry. A guest's live actor supplies each pulse's position.

Fighter state is scalar and travels in ordinary snapshots: `combo`, `window`,
`rhythm`, `rhythmIdle`, `rhythmDecay`, `clinchCool`, `utilityCool`, `slip`,
`counter`, `flurry`, `flurryBeats`, `flurryFinish`, `flurryAge` and `flurryStep`.
Skill and attack cooldowns travel with the existing player/member state.
Authority handoff continues remaining timers and strikes without recreating
spent beats. The host checks legal motion, terrain, position, cooldown and
actor state; client-supplied resources or cooldowns never grant an ability.

The shared close-hit objective handlers still break seals, cracked soil and
guardian objectives. Objective-only contacts do not award Rhythm, Ringcraft
or Second wind. Skills reject paused/downed/illegal actor states through the
ordinary class-action checks.

## Appearance and review

Runtime PNGs are preserved byte for byte. The existing 32×32 body cells retain
their (16,31) foot anchor, binary alpha, palette and integer registration.
Short contact glove echoes are separate effects drawn beside a hit; the body
does not grow limbs and effects do not travel independently. Native pixels
remain unsmoothed. Source provenance is in
[Pølge's asset review](../asset-review/polge-v1/README.md).

The current Figma player section is `451:5` on production page `10:2`.
Connected Figma accounts required reauthentication during this October 3 pass;
there is no fresh remote synchronization claim or new art export. Future art
changes must follow [the current Figma contract](../figma.md).

`review.html?mode=polge&portrait=1` opens the unupgraded kit beside close trial
sentries. Their real AI generates warned attacks and can damage the garden.
`&boons=1` enables all five Pølge upgrades and Light step 1. Two nearby damaged
plants make actual successful finish recovery observable. Reset replaces only
the isolated fixture, whose storage remains in memory.

Review buttons dispatch normal B/C/X/E key events. The observation panel and
`#status`'s `data-guardian` expose fighter state, enemy contacts and warnings,
strike counts, cooldowns and plant state. They never advance combat or award
Rhythm. Compare phone, small-phone, landscape and desktop views, and exercise
misses, combo expiry, clinch contact, empty slips, warned counters, moving
flurries and upgraded finishes. Regression checks must cover host and guest
behavior, duplicate actions and authority handoff before release.
