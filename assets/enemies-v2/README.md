# Native role coverage

The Dew leech, Thorn caster and Rammer use the original enemy master restored
from MAX's actual Figma archive. Its PNG is unchanged: SHA-1
`dd8c215a6ed39ec1db6a4e197ab5eb1829c84e2e`, 256×288, binary transparency,
23 original colours. On 14 October 2026 its existing source rectangle `414:3`
moved from archive frame `425:2` into production enemy section `451:3`, frame
`1040:21976`. [The authenticated promotion](figma-promotion.json) records the
exact image fill, native bounds and parent. The repository PNG came from that
Figma image's original bytes, not a screenshot or a regenerated imitation.

These three roles use **32×32 native cells at anchor (16,31)**. This is their
pack contract; the four existing enemies-v1 roles retain their 16×16 cells.
Every runtime draw is 1:1, without smoothing or rescaling. The existing enemy
body-centre to foot offset remains five pixels. Physics, damage, hitboxes and
spawn schedules are unchanged.

| Role | Atlas | Source row, zero based | Visible tell |
| --- | --- | --- | --- |
| Dew leech / kind 10 | `../enemies-v1/dew-leech/atlas.json` | 1 | Slug silhouette, raised body, pale dew discharge |
| Rammer / kind 11 | `../enemies-v1/rammer/atlas.json` | 4 | Horned, armoured body, raised head and charging dust |
| Thorn caster / kind 9 | `../enemies-v1/thorn-caster/atlas.json` | 6 | Branch creature, raised head and thorn burst |

The original sheet has eight 32px columns and nine rows; its final row is
empty. The selected rows were visually inspected at native and integer zoom.
Their eight existing poses supply idle, movement, preparation, release,
recovery, hurt and collapse. The empty final-row cell ends the clamped death
animation. `drain`, `charge` and `cast` are explicit atlas clips; runtime state
timers select the clips without driving gameplay. They are bindings of
reviewed existing poses, not a claim about undocumented historical row names.

`atlas.json` here records the whole source's palette and exact opaque bounds.
The three role atlases reference this same PNG, avoiding duplicate masters.
All other source rows remain preserved but are not newly spawnable enemies.
Future edits follow the ordinary Figma PNG source and palette contract.
