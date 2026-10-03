# Hollow Crown Ascendant source review

This directory preserves the actual OpenAI imagegen source masters for the
user-requested final boss redesign. The packed native artwork and binding
registration contract are in `assets/crown-ascendant-v1/README.md`.

`recipe.json` records grid and explicit crop/registration choices.
`frame-sources.json` maps every native frame back to its unchanged generated
source. The importer converts the original generated drawings into a new
native master using fixed scale, nearest-neighbor sampling, 24 colors and clean
binary transparency; pose holds are recorded rather than presented as unique
art. Both last death cells intentionally disappear.

`import.use-figma.js` is a prepared, retry-safe import of the exact native PNG
bytes into runtime bosses section `451:4` on page `10:2`. It remains unexecuted
while the connected Figma account requires reauthentication. It performs hash
and dimension preflight, names each source rectangle by its repository path,
and returns every created/mutated node ID. Preparation is not synchronization.
