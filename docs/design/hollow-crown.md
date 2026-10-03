# Hollow Crown at radioactive dawn

The twentieth garden opens onto the radioactive surface at sunrise. Hollow
Crown is the final encounter: a tall, slender silver king, a faceless crown
helmet, an unmistakable block maul and thin cyan seams. Its native body is roughly three times a
gardener's height. The fight remains at the discovered shrine's actual court;
the garden and its living plants remain the stakes.

## Reference and adaptation

The user requested a worthy 2D recreation of Risk of Rain 2's final boss.
[Mithrix](https://riskofrain2.wiki.gg/wiki/Mithrix) supplies the encounter
structure: fast hammer duel, Lunar Chimera interlude, empowered return, then a
wounded final reversal. His huge weapon, pale armor, cyan energy and broken,
weaponless final form supply the important visual reads. The new sprites were
generated for this game; no original game assets are redistributed.

The reference's hammer smash/swing, jumpable shockwave, needle volley,
phase-three rotating pillars and phase-four spiraling orbs are translated into
side-view combat. Vertical lanes replace the rotating 3D spokes. Temporary
Crown energy replaces item theft, preserving every player's movement, attacks
and upgrades. Original RoR2 damage percentages and adaptive-armor statistics
are not copied into the garden's smaller damage economy.

Sources: [Mithrix mechanics and appearance](https://riskofrain2.wiki.gg/wiki/Mithrix),
[unique boss scaling](https://riskofrain2.wiki.gg/wiki/Difficulty#Unique_scaling),
[adaptive armor](https://riskofrain2.wiki.gg/wiki/Armor#Adaptive_Armor), and a
[contemporary fight guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2203124722).
The wiki text was retrieved through a public text reader; its original model
image downloads were unavailable. The artwork is an interpretation of the
documented appearance, with Hollow Crown's containment motifs. The second art
pass replaces the broad bone creature with a narrow waist, long legs, a smaller
helmet and a clean hammer silhouette. The wounded bank loses the weapon and
uses a visibly damaged stance; both armored and wounded deaths actually collapse.

## Four acts

| Act | Appearance and play |
| --- | --- |
| Crown duel | Armored king stalks gardeners, winds up the maul, strikes or follows with a second swing, and leaps into a grounded impact with outward, jumpable shockwaves. |
| Containment break | The king kneels and stops attacking. Plated lunar sentries and flying chimeras guard three visible breakable seals. Breaking the seals earns a safe opening on the return. A bounded interlude cannot stall the run. |
| Dawn sovereign | The armored king returns with an empowered core. Learned maul and leap attacks combine with needle volleys and alternating tall energy lanes. Gaps require lateral movement; low waves require jumps. |
| Hollow king | Armor breaks and the hammer disappears. A slow wounded king uses needles and a kneeling orb cast. Three breakable cores hold its temporary power. Breaking them reduces that pressure and earns another cyan opening; the player's build stays intact. |

Large hits and damage over time respect act boundaries. Short protected
transitions make the return and armor break readable. The wounded act can be
finished through ordinary attacks; optional cores never make an invincible
target. Defeat uses the existing final-victory and actual-run result path.

## Combat and presentation contracts

- Amber anticipation follows authoritative attack timers. Cyan exposure starts
  only after every owned strike has finished, including its contact lifetime.
- Recovery retains the existing difficulty-specific planted-bomb window:
  3.2 seconds on Easy, 2.75 on Medium, 2.5 on Hard and 2.35 on Insane.
- Leap targets and strike positions are chosen before contact. Low wave crests
  remain jumpable; tall lanes leave actual traversable gaps, including in the
  narrowest shrine courts with an unupgraded walking Cairn.
- Boss art, warnings, effects and objectives render above decorative vegetation.
  Camera framing includes the boss and the nearby player without moving either
  actor or changing native pixel scale.
- The larger visible body has a matching attackable rectangle; every class can
  strike it from the ground and a planted bomb can reach a grounded recovery.
- Host authority owns damage, phase changes, hazards and objectives. Encounter
  timers are scalar fields and cores use the existing replicated node format,
  so late joins and authority handoffs preserve the fight.
- Native sheets preserve integer registration, binary alpha, a declared palette
  and disabled smoothing. Packing removes generated source padding while keeping
  a fixed body scale within each source bank; runtime never stretches frames.

## Art source and review

The [Crown Ascendant pack](../../assets/crown-ascendant-v1/README.md) contains
the armored and wounded animations, matching lunar constructs and filled cyan
combat effects: 192 native frames in three sheets. The original generated sources,
previous pass and reproducible native export pins are retained. The current
[Figma source contract](../figma.md) records synchronization and native registration.

The court is built around the actual final shrine: a jointed stone floor, broken
outer pylons and a quiet central fighting space. Existing ledges and planting
slots keep their physical bounds. Layered scorched ridges and ruined silhouettes
frame the radioactive sunrise. A compact two-line phase strip keeps instructions
above the battle, with health on its underline. Camera limits preserve both the
player and the complete raised hammer, including the leap on a 320-pixel phone.

Earlier chapters close the upper climb with rock vaults, buried steel braces,
frozen shafts and reactor housings. Stages 1–17 retain a sealed underground sky;
only the bounded breaches in 18–19 reveal dawn.

`crown-review.html` runs the real twentieth-garden shrine encounter with isolated
memory storage. It offers ordinary playable controls and separately labeled
act/pose demonstrations for inspection. Review hooks are scoped to the review
fixture and are absent from the production game.

`review/crown-ascent/` stitches all twenty world-only game captures vertically,
with garden 1 at the bottom and the radioactive sunrise at the top. The viewer
supports native size and fit modes. Its metadata records exact seed, world bounds
and capture source; these review images never replace editable routes or sprite
masters. The complete editable Figma stack is
[607:14028](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=607-14028).
