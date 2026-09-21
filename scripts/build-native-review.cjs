'use strict';
// Render the new sprites through the actual game renderer, with isolated in-memory
// saves. index.html itself is NEVER rewritten by this asset-only build.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = `<script src="../../native-sprites.js"></script><script>
window.__reviewStorage={getItem:function(k){return this.data[k]||null;},setItem:function(k,v){this.data[k]=String(v);},removeItem:function(k){delete this.data[k];},data:{'max-fuglesprenger-rogue-intro-v6':'1'}};
MaxNativeSprites.load('./').catch(function(e){document.body.appendChild(document.createTextNode(e.message));});
window.addEventListener('message',function(e){if(e.origin!==location.origin)return;if(e.data&&e.data.type==='native-animation'){MaxNativeSprites.preview[e.data.actor]=e.data.state;MaxNativeSprites.preview.start=performance.now();}});
</script>`;
html = html.replace('<style>', boot + '<style>')
  .replace('href="run-results.css"','href="../../run-results.css"')
  .replace('src="run-results.js"','src="../../run-results.js"')
  .replace(/window\.localStorage\./g, 'window.__reviewStorage.')
  .replace(/(?<![.\w])localStorage\./g, 'window.__reviewStorage.')
  .replace('  drawCrows();', `  drawCrows();
  if(window.MaxNativeSprites)window.MaxNativeSprites.drawReview(ctx,{playerX:P.x,camX:camX,camY:camY,surfaceY:surfaceY});`);
const setup = `
// This seed garden exists only in this isolated asset review.
gardenPlots=[0,5,6].map(function(kind,i){return {x:P.x-51+i*51,kind:kind,growth:1.15,moisture:1,health:1,pulse:0,hit:0,age:0,dead:0,seed:42+i,seedMark:0,harvestGrowth:0};});
window.__assetReviewSource='Actual MAX renderer; in-memory saves only';
`;
const anchor = 'if (window.claude && window.claude.hot) {';
if (!html.includes(anchor)) throw Error('Game renderer review insertion point changed');
html = html.replace(anchor, setup + '\n' + anchor);
fs.writeFileSync(path.join(root, 'assets/native/game-review.html'), html);
console.log('Built isolated asset review using the actual game renderer');
