# Active contracts

`npm test` runs the current gameplay, class, co-op, reconnect, bounded transport, mode, full-run results, account ownership and native-art contracts. The world matrix keeps all 20 run seeds at 30/60/120 Hz, all 20 garden places, both opening picture levels and all 60 shrine candidates for two seeds. Figma export tests retain round trips and runtime replacement of authored gardens.

The former 123-file suite is preserved in Git history. The smaller suite deliberately drops historical import/prototype checks, repeated structural assertions and many narrow scenario tests; it does not claim identical test coverage. Native production artwork is checked centrally by `figma-assets.test.cjs`. No production simulation or asset is removed by this test consolidation.

The three browser review jobs remain in GitHub Actions. A local browser installation is not currently available; deterministic and DOM tests do not replace a visual Safari check.
