# Authenticated runtime PNG verification

Actual Figma file `TC0PHGMTCMR6im4hb3CSbF`, production page `10:2`, was captured
on 10 October 2026 at **11:16:52–11:17:06 UTC**. The unchanged repository
`npm run figma:check` command then returned **665 MATCH, zero problems, exit 0**.

The capture includes the complete six configured runtime section hierarchies,
actual image hashes, native coordinates, paint properties and workbench rules.
It excludes unfinished ART `887:13531` and unrelated review compositions.
All 1,349 historical hierarchy rows are unchanged; all 1,355 inspected transforms
are unit transforms. All 665 source IDs, native bounds and image hashes match
the manifest and repository PNG bytes.

The existing 60-source holder `797:13527` was reclassified from runtime section
`451:2` into review-only section `903:13527` on the same page. Its source IDs,
image fills and local native registration were preserved, and the original 665
runtime masters retained absolute registration. The receipt records all created,
mutated and preserved IDs. Repository PNGs and the manifest were unchanged.

## Evidence

- `production-capture.json`: complete fresh authenticated capture.
- `capture-part-*.json`: seven bounded authenticated results, with matching
  snapshot fingerprints; `assemble-capture.py` validates and decodes them.
- `figma-check.log` and `figma-check-exit.json`: unchanged comparison output and
  completed exit status. The localhost URL records the replay used at that time.
- `native-source-audit.json`: actual source identity and repository byte audit.
- `registration-comparison.json`: preserved historical hierarchy and transforms.
- `runtime-source-review-receipt.json`: portable copy of the receipt also stored
  in `docs/design/figma-level-studio/runtime-source-review-receipt.json`.
- `artifact-manifest.json`: SHA-256 and byte counts for the packaged evidence.

## Repeat the unchanged comparison

From the repository root, start the scoped replay in one terminal:

```sh
python3 docs/design/master-levels/evidence/figma-assets/replay-production-check.py \
  --capture docs/design/master-levels/evidence/figma-assets/production-capture.json \
  --receipt /tmp/max-figma-production-replay.json
```

Startup prints a localhost URL with the selected port. In another terminal,
substitute that printed port and run from the repository root:

```sh
FIGMA_MCP_URL=http://127.0.0.1:PORT/mcp npm run figma:check
```

Stop the replay after the check. It serves only captured production metadata and
actual image identities, rejects missing evidence, and does not use repository
pins to fabricate Figma results. It supports the comparison command, not
manifest regeneration or exporting uncaptured PNG bytes.

## Fresh synchronization

This evidence proves synchronization at its capture time. After changing the
configured runtime source hierarchy or images, obtain a new authenticated
capture before claiming a fresh check.

`capture-production-part.use-figma.js` contains the actual read-only collector.
Load `c10/figma-use` before every authenticated call, use the configured account
and file, and serialize calls in an exclusive Figma window. Start at index 0,
save its result as `capture-part-0.json`, then change only the index through
`chunkCount - 1`. Assemble all consistent parts into a new capture and run the
unchanged comparison above.
