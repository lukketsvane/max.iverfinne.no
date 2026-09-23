# Secrets, easter eggs and special nights

`secrets.inc.js` is injected into the game closure at `/* MAX_SECRETS */`. Everything here is rare, seeded, never pauses the garden and never takes a finger away from the one-thumb controls. Tests: `tests/secrets.test.cjs`.

Rules:

- A garden's night is rolled once, by the host, from `rogueRun.seed` (or a hash of the run's record id and start time) and the garden number. Guests receive it in `coopCapture().secrets` and never roll their own.
- The banner that shows the garden number on arrival adds one word for a special night.
- Balance effects are small, and device-date decorations have none.

## Special nights (about one garden in five, never garden 1)

| Night | Word | What happens |
| --- | --- | --- |
| Full moon | MOON | A brighter moon, twice the fireflies, moths circle Max's lit lamp, garden plants glow faintly. Decoration only. |
