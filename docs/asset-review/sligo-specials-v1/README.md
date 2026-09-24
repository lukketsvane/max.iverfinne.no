# Sligo specials

The owner's unchanged Max Level Studio export (`level.json`) contains the transparent versions of the uploaded drawings. `scripts/build-sligo-specials.py` extracts the existing painted poses, reduces all of them at the same body-relative scale, and packs 31 exact 40×40 cells with anchor (20,39), binary alpha and 16 colours.

| Frames | Use |
| --- | --- |
| 0–3 | Protective sac |
| 4–7 | Sac / blood-clot burst |
| 8–11 | Clot-holding throw |
| 12–19 | Cord lash while digging, watering and picking |
| 20–22 | Hurt |
| 23–26 | Floating tendrils |
| 27–28 | Sleeping |
| 29–30 | Detached clot and cord tip projectiles |

The exact source boxes and clips are recorded in `specials.json`. No sprite is enlarged to fill its cell. The runtime preserves throw/hit/pour timing and original combat balance. Other characters retain ordinary bombs; Sligo has no fuse spark or orange explosion. Projectile and blast identity replicate to guests.

Run `python scripts/build-sligo-specials.py`, `npm test`, and `npm run build`. The expanded PNG is pinned in the existing `assets/figma-pending.json` workflow; `npm run figma:check` cannot connect to the desktop MCP server in this environment, so Figma sync is still pending.
