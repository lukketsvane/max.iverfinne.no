# Hollow Crown Ascendant source review

This directory preserves the actual OpenAI imagegen originals for the
user-requested final boss redesign. The second pass uses a tall, faceless silver
moon king, a large block maul, clear kneeling and upright return poses, a visibly
weaponless wounded stance, and complete collapse animations. The packed native artwork and binding
registration contract are in `assets/crown-ascendant-v1/README.md`.

`recipe.json` records grid and explicit crop/registration choices.
`frame-sources.json` maps every native frame back to its unchanged generated
source. The importer converts the original generated drawings into a new
native master using fixed scale, nearest-neighbor sampling, 24 colors and clean
binary transparency; pose holds are recorded rather than presented as unique
art. All four final death cells intentionally disappear.

The five second-pass originals are under `source/pass2/`. The earlier five
originals remain under `source/`, unchanged. `prior-pass/` preserves their native
exports, recipe, source mapping, provenance and the unexecuted first-pass import
script. Current provenance pins the previous-pass archive as well as the active
originals and exports.

Semantic row mapping matters: main row 7 is exposure; armored rows 0–3 are
pillar, volley, summon/kneel and actual armored death. The `intermission` alias
holds real kneeling poses, and `empowered` holds an upright returning king.
Wounded row 5 and both chimera death rows genuinely collapse and end empty.

The active native PNGs were imported as exact bytes into configured Figma
runtime bosses section `451:4`, frame `619:13527`, on page `10:2`. Actual source
rectangles `619:13529` through `619:13531`, hashes, native bounds and remote PNG
byte audits are pinned in `assets/crown-ascendant-v1/provenance.json`. The
[authenticated capture](../crown-secondpass/figma-capture.json) and
[ordinary comparison](../crown-secondpass/figma-comparison.json) reported
665 MATCH and zero problems on 3 October 2026. Figma is now the native master;
the generated source audit grants no continuing local exception.
