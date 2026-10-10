These are offline candidate physics verifiers and the preserved results of their
10 October 2026 execution. They load the real game harness and compiled candidate
data without editing runtime `levels-data.js` or activating a level.

The preserved reports were executed against source digest
`216c186c49594472b69ef654ca662c879e95fc04d05994b5084ebb87e8ba08ac`, geometry digest
`3e25e088d07b81b71331f9f1a50ca3fc7a287152b1bb4747b2b66623e482de9b`, and compiled
candidate SHA-256
`678edbfff3c66cc647cb32c827fb2afb863cc93cbe5d30d3aa4a409fda40bc6d`.
Their original bindings and execution paths remain intact. A later package-code
revision may change the wrapper source digest while retaining identical compiled
candidate and runtime bytes. Such equivalence must be recorded separately; these
historical reports do not certify execution of a newer wrapper revision.

`candidate-verification.json` summarizes 36 class/rate/stage combinations,
552 authored surface reaches, 384 marker contacts including 36 supplemental start
checks, 108 reward/seed returns, 84 independent ladder round trips, 96 continuous
gallery crossings/returns, and 27 guardian round trips across three seeds. The
detailed route, guardian, and start results are in the other JSON files.

The portable scripts derive the repository root from their own directory and
require explicit candidate and output paths. From the repository root:

```sh
node docs/design/native-level-drafts/verification/playtest-authored-candidates.cjs docs/design/native-level-drafts/review/candidate-levels-data.js /tmp/max-native-routes.json
node docs/design/native-level-drafts/verification/playtest-candidate-guardians.cjs docs/design/native-level-drafts/review/candidate-levels-data.js /tmp/max-native-guardians.json
node docs/design/native-level-drafts/verification/playtest-candidate-starts.cjs docs/design/native-level-drafts/review/candidate-levels-data.js /tmp/max-native-starts.json
```

With two positional arguments, all three runners select stages 1–3. Use the
optional `--stages` flag for a different candidate batch:

```sh
node docs/design/native-level-drafts/verification/playtest-authored-candidates.cjs /path/to/stages-04-06/candidate-levels-data.js /tmp/max-native-routes-04-06.json --stages 4,5,6
node docs/design/native-level-drafts/verification/playtest-candidate-guardians.cjs /path/to/stages-04-06/candidate-levels-data.js /tmp/max-native-guardians-04-06.json --stages 4,5,6
node docs/design/native-level-drafts/verification/playtest-candidate-starts.cjs /path/to/stages-04-06/candidate-levels-data.js /tmp/max-native-starts-04-06.json --stages 4,5,6
```

Selections must contain unique integers from 1–20, separated by commas, with no
empty entries, spaces or leading zeros. The candidate must contain exactly those
stage keys and one matching authored source frame per stage. Missing or extra
stages fail before physics and preserve any prior report. No geometry fields are
filtered or rewritten. Reports record the selected stages and expected case
counts: twelve class/rate cases per stage for routes and starts, and three seeded
cases per stage with three ordinary guardian sites for the guardian verifier.
All three reports hash the actual candidate input bytes. Adjacent synthetic
fixture metadata, when included, is declared provenance with
`fixturePairingVerified: false`; reading that file does not prove it compiles to
the executed candidate. Any verified fixture pairing belongs in separate
round-trip evidence.

The route verifier places each independent scenario once at its grounded C0 soil
entry, then uses actual movement between surfaces, marker contacts, ladder
endpoints, and gallery crossings. Jump retries restore the same takeoff state.
When a lower stair lies directly beneath a wider upper stair, the return verifier
searches an alternative descent from the reached reward and replays actual inputs.
That replay rejects automatic furnished supports. Coplanar overlapping gallery
surfaces are crossed by supported walking, since the collision sweep may change
the selected platform ID within their shared footprint.

The guardian verifier begins at the real settled `enterLevel` entrance. Its
outbound and return searches replay actual inputs, retaining normal expedition
and guardian furnishing. The local altar helper preserves the existing search
at 60 Hz and adds configurable rates and authored-support filtering for reward
returns. The start verifier checks dry-soil contact and return independently.

The packaged route verifier includes start-marker checks inline; the preserved
execution counted those same 36 checks in the supplemental start report. This
changes the grouping of marker counts, not the executed geometry or physics.
Packaging added path portability and explicit report arguments. The subsequent
verifier audit added a shared atomic report writer that rejects candidate/runtime
aliases, symlinks, and hard-linked report destinations before physics begins.
Candidates must contain exactly the selected stages, one garden per stage, with nonempty native surfaces,
reward/seed markers, two trials, and positive start-marker coverage. Success
requires all distinct selected class/rate/stage cases, complete expected surface,
marker, reward-return and ladder coverage, and positive gallery crossings in
every case. Completed verification claims appear only on successful reports.
Syntax checks, bounded CLI rejection tests, atomic-write failure tests, and the
portable start-marker smoke passed. The full matrix was not repeated for
byte-identical candidate/runtime data; its historical reports remain unchanged.

Fresh authenticated Figma synchronization, complete artwork composition and
browser visual review, authored inter-stage connectors, and runtime activation
remain outside this physics evidence.
