# Import the local scene-reference plugin

Unzip the plugin bundle. Open the configured MAX Design file:
<https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF>.

Choose **Plugins → Development → Import plugin from manifest**, select the
extracted `manifest.json`, and run **MAX — Level Stack Scene References**.
The twenty scene images and twenty current previews are embedded in `code.js`;
no image server, token or network connection is required by the plugin.

**Add / update all 20 level references** validates the actual page, MASTER,
editor and all twenty saved row/plane identities, then creates or updates one
owned scene reference for each level. It uses safe free ASSETS space; when that
is unavailable, an aligned reference goes into a clear adjacent page column.
Existing gameplay/art planes, registration and unrelated references remain
unchanged. The file-address checkbox is needed only if Figma does not expose
its file key to the local plugin.

**Create comparison stack · 20 → 01** creates the secondary editable comparison
view or selects the validated identical owned stack. **Save import receipt**
downloads the actual returned node IDs after successful execution.

This bundle was prepared and tested in local VM fixtures. Its import has not
been executed through the unavailable configured Figma backend, and it claims
no new cloud nodes or synchronization. The images are generated scene-design
references. Importing them does not activate playable geometry or publish the
game; native authoring and actual-game preview use the existing Level Studio
workflow separately.
