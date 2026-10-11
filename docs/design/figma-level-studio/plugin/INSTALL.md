# Install the local Figma development plugin

Unzip this bundle. In Figma Design choose **Plugins → Development → Import plugin
from manifest**, then select the extracted `manifest.json`. Run **MAX Native
Level Studio** in the configured MAX file. Import once; this does not require a
published plugin or account publishing access.

From the current game checkout, run:

```sh
npm run build
npm run figma:studio
```

Paste the printed local session key into the plugin, select the existing MASTER
level, edit its native source, and click **Preview in game**. Open the game link
after validation. The selected row must use aligned native planes and the
supported ART contract. Unfinished other rows remain visible in diagnostics and
do not block a valid selected draft preview. Whole-editor exports require every
row to validate. Download remains a fallback.

The plugin targets file `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, MASTER
`863:15150`, current editor `941:450`. The row names `level_01`…`level_20` determine
stages. It re-resolves the existing rows and preserves per-level ASSETS.
Live capture never falls back to historical editor `863:15149`; explicit
read-only legacy replay retains that source's original identity.

The local bridge creates temporary actual-game candidates. It does not deploy.
Source changes still pass compiler, gameplay, CI and production verification
before release. Close the bridge with Ctrl-C when finished. Full authoring and
source-contract documentation is in the repository's
`docs/design/figma-level-studio/plugin/README.md`.
