# Hollow Crown browser playtest — 3 October 2026

The rebuilt final boss is visible at its actual native scale beside the gardener
in garden 20's radioactive sunrise. Chromium and WebKit both passed the real-game
review checks. The fixture has a single campaign guardian, living young soil
plant, normal collisions, ordinary inputs and authoritative combat timers.

## Review the encounter

Build and serve `dist/`, then open `crown-review.html`. Choose a character,
difficulty and desktop or phone viewport. **New playable fight** starts the
actual garden 20 encounter through `interactBossEvent()` at its real shrine.
The initial gardener remains at that shrine, 76 native pixels from the Crown;
the review does not pull the two actors together to disguise camera problems.

The expandable phase controls clearly distinguish demonstrations from normal
progression. Capture controls advance actual windup, attack and hazard timers,
then pause a selected frame. **Resume fight** restores normal simulation.
Keyboard and touch controls are the production controls. The external review
buttons dispatch ordinary key events. All storage is memory-only, the menu and
accounts are absent, and no production debug API is introduced.

Existing `review.html?mode=boss`, `mode=native-crown` and `mode=final-boss` links
route to the same usable encounter. The previous review-only, unbound Crown
objects no longer form the active fixture.

Useful direct links after serving the build:

- `crown-review.html?portrait=1` — touch phone, 390 × 844.
- `crown-review.html?phase=2` — seals and native ground/air guardians.
- `crown-review.html?capture=hammer-warning` — the raised maul's warning.
- `crown-review.html?capture=hammer-slam` — the released hammer strike.
- `crown-review.html?capture=leap` — the actual airborne slam.
- `crown-review.html?capture=lanes` — live ascendant pillars and safe lane.
- `crown-review.html?capture=wounded` — separate weaponless last-stand art.

## Evidence

`scripts/check-crown-browser.cjs` passed in Chromium and WebKit with zero page
errors or failed asset responses. It verified:

- Real shrine activation, garden 20 court binding and one living young plant.
- Four distinct acts, including three seals and three last-stand power cores.
- Five frozen attack captures drawn by the real renderer; the last stand uses
  the separate `wounded/` animation bank.
- Entire boss body and gardener visible at native scale on a touch phone,
  including the real initial spawn distance.
- Actual dodge frames, actual jumping, native attack effects and Tend input.
- A complete fight using only normal movement and attack input: acts I → II →
  III → IV → ordinary victory, with the garden still alive. This bounded check
  uses Cairn on Easy, level 20 and nineteen valid boon ranks through the isolated
  `build=campaign` review preset. It does not issue damage or phase commands.
- Original review links and class/difficulty selection.

The browser outputs include untouched 1200 × 800 encounter captures, untouched
390 × 844 phone captures, corresponding state JSON and verification results.
The four-act showcase is browser HTML composition of the original game captures
at exactly half size, with nearest-neighbor display. Source artwork and native
runtime exports remain separate from these presentation captures.

Two readability faults found during playtesting were corrected in the runtime:
the gardener is drawn after the Crown foreground, and the safe-lane marker stays
on the first sweep until its last contact lifetime ends. It then changes to the
second sweep. The final live-pillar capture shows the cyan marker between the
active beams. The boss name and health display reserve space below the local
guide and use compact act labels where needed on a phone.

Browser simulation is isolated; these checks do not contact a hosted shared
room. Host/guest attacks, snapshots and authority handoff are covered by the
game's Crown and co-op regression tests. Figma source import remains explicitly
pending reauthentication, as documented in the new asset pack.

Run the browser check with an installed Playwright module available to Node:

```sh
NODE_PATH=/path/to/browser-tools/node_modules node scripts/check-crown-browser.cjs
```

`--chromium-only` is available when WebKit is not installed. Full release checks
still require the repository regression suite, build, intended commit's CI and
verified production deployment.
