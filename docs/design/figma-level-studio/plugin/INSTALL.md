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
after validation. The selected row must use the supported native ART contract;
the Hollow Tree Level01 is the first converted source. Download remains a
fallback. Other rows can download geometry explicitly while their ART conversion
is pending.

The plugin targets file `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, MASTER
`863:15150`, editor `863:15149`. The row names `level_01`…`level_20` determine
stages. It re-resolves the existing rows and preserves per-level ASSETS.

The local bridge creates temporary actual-game candidates. It does not deploy.
Source changes still pass compiler, gameplay, CI and production verification
before release. Close the bridge with Ctrl-C when finished. Full authoring and
source-contract documentation is in the repository's
`docs/design/figma-level-studio/plugin/README.md`.
