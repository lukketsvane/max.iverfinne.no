'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function compile(sourceDirectory) {
  const source = sourceDirectory || path.join(root, 'docs/design/turtle-level-04/pixel-mill');
  const recipeBytes = fs.readFileSync(path.join(source, 'recipe.json'));
  const recipe = JSON.parse(recipeBytes), rects = JSON.parse(fs.readFileSync(path.join(source, 'turtle-native-rects.json')));
  if (rects.format !== 'max-native-pixel-rects' || rects.width !== 640 || rects.height !== 360 ||
      !rects.verification.losslessRGBA || !Array.isArray(rects.palette) || !Array.isArray(rects.rects)) throw new Error('Expected the verified native Pixel Mill turtle export');
  const data = { schema: 1, source: 'Pixel Mill', sourceSha256: recipe.inputSha256,
    recipeSha256: sha(recipeBytes), rgbaSha256: rects.source.rgbaSha256,
    width: rects.width, height: rects.height, palette: rects.palette, rects: rects.rects };
  const code = '// Generated lossless native rectangles; see docs/design/turtle-level-04.\n(function(root){"use strict";var data=' + JSON.stringify(data) + ';if(typeof module==="object"&&module.exports)module.exports=data;else root.MaxTurtleArtData=data;})(typeof window==="object"?window:globalThis);\n';
  return { code, data };
}
module.exports = compile;
if (require.main === module) {
  fs.writeFileSync(path.join(root, 'turtle-garden-art-data.js'), compile().code);
  console.log('Compiled the exact Pixel Mill native turtle rectangles.');
}
