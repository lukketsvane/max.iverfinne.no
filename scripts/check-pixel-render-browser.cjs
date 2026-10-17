const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '../dist');
const output = path.resolve(process.env.PIXEL_BROWSER_OUTPUT || 'pixel-browser-review');
const requested = process.env.PIXEL_BROWSER_ENGINE;
assert.ok(requested === undefined || ['chromium', 'webkit'].includes(requested), 'Unknown pixel review engine');
const engines = requested === undefined ? ['chromium', 'webkit'] : [requested];
const modes = ['auto', '4x', '6x', '8x', '10x'];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) throw Error('Outside build');
    let source = fs.readFileSync(file);
    if (file === path.join(root, 'index.html')) {
      source = source.toString().replace('src="game-menu.js"', 'src="game-menu-review.js"');
      source = source.replace(/(<script>)([\s\S]*?)(<\/script>)/, (_, open, code, close) => open + code.replace(/\}\)\(\);\s*$/, 'window.__pixelReview = function () { return {x:P.x,y:P.y,camX:camX,camY:camY,width:IW,height:IH,scale:SCALE,elapsed:runElapsed,active:runActive,paused:menuPaused,render:pixelRenderInfo()}; };\n})();') + close);
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(source);
  } catch { res.writeHead(404); res.end(); }
});
async function state(page) { return page.evaluate(() => window.__pixelReview()); }
async function main() {
  const { decode } = await import('./figma-sync.mjs');
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, results = [];
  try {
    for (const engine of engines) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        const cases = [
          { name: 'phone', viewport: { width: 390, height: 844 }, dpr: 3 },
          { name: 'landscape', viewport: { width: 844, height: 390 }, dpr: 3 },
          { name: 'small', viewport: { width: 320, height: 568 }, dpr: 1 },
          { name: 'desktop', viewport: { width: 1920, height: 1080 }, dpr: 1 }
        ];
        for (const { name, viewport, dpr } of cases) {
          const page = await browser.newPage({ viewport, deviceScaleFactor: dpr, hasTouch: true }), errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base);
          await page.getByRole('button', { name: 'Settings', exact: true }).tap();
          const control = page.getByRole('button', { name: /^Pixel rendering / });
          assert.equal((await state(page)).render.id, '8x');
          const initial = await state(page);
          if (name === 'phone') { assert.equal(initial.width, 146); assert.equal(initial.height, 316); assert.equal(initial.scale, 8); }
          await control.tap(); assert.equal((await state(page)).render.id, '10x');
          await page.reload();
          await page.getByRole('button', { name: 'Settings', exact: true }).tap();
          assert.equal((await state(page)).render.id, '10x');
          await control.tap(); assert.equal((await state(page)).render.id, 'auto');
          await page.getByRole('button', { name: 'Back', exact: true }).tap();
          await page.getByRole('button', { name: 'Play', exact: true }).tap();
          await page.getByRole('button', { name: 'Play', exact: true }).tap();
          await page.waitForFunction(() => window.__pixelReview().active && !window.__pixelReview().paused && window.__pixelReview().elapsed > 0 && document.querySelector('.max-menu').hidden);
          const start = await state(page);
          await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
          await page.waitForTimeout(200);
          const walked = await state(page);
          assert.ok(walked.x > start.x + 5, engine + '/' + name + ': ordinary input must move the gardener with real collision ' + JSON.stringify({start,walked}));
          await page.keyboard.press('Escape');
          const beforeMenu = await state(page);
          const controlBounds = await control.boundingBox();
          const sizes = new Set(), screenshots = [], scales = [];
          for (let i = 0; i < 5; i++) {
            const current = await state(page);
            assert.equal(current.render.id, modes[i]); assert.equal(current.paused, false);
            assert.ok(Number.isInteger(current.scale));
            const bounds = await control.boundingBox();
            assert.ok(bounds.width >= 44 && bounds.height >= 44);
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
            assert.equal(bounds.width, controlBounds.width);
            const canvas = await page.evaluate(() => {
              const c = document.querySelector('#c'), r = c.getBoundingClientRect(), context = c.getContext('2d');
              return { width: c.width, height: c.height, left: r.left, top: r.top, cssWidth: r.width, cssHeight: r.height, smoothing: context.imageSmoothingEnabled, transform: [context.getTransform().a, context.getTransform().d], mask: !!document.querySelector('#subpx') };
            });
            assert.equal(canvas.width,current.width); assert.equal(canvas.height,current.height);
            assert.ok(canvas.left >= -.01 && canvas.top >= -.01, 'no cropped leading edges');
            assert.ok(canvas.left + canvas.cssWidth <= viewport.width + .01 && canvas.top + canvas.cssHeight <= viewport.height + .01, 'no cropped trailing edges');
            assert.ok(viewport.width*dpr-current.width*current.scale < current.scale && viewport.height*dpr-current.height*current.scale < current.scale, 'full physical viewport used in both axes');
            assert.equal(canvas.smoothing,false); assert.equal(canvas.mask,false); assert.deepEqual(canvas.transform,[1,1]);
            assert.ok(Math.abs(canvas.cssWidth*dpr-current.width*current.scale)<.1);
            assert.ok(Math.abs(canvas.cssHeight*dpr-current.height*current.scale)<.1);
            assert.ok(canvas.left>=0 && canvas.top>=0);
            sizes.add(current.width+'x'+current.height);
            await page.getByRole('button', { name: 'Back', exact: true }).tap();
            const image = `${engine}-${name}-${modes[i]}.png`;
            await page.screenshot({ path: path.join(output, image) });
            const launcher = page.locator('.max-live-settings'), launcherBox = await launcher.boundingBox();
            assert.ok(launcherBox && launcherBox.width >= 44 && launcherBox.height >= 44);
            assert.ok(launcherBox.x >= 0 && launcherBox.y >= 0 && launcherBox.x + launcherBox.width <= viewport.width && launcherBox.y + launcherBox.height <= viewport.height, 'settings stays inside the full viewport');
            const screenshot = await page.screenshot({ style: '.max-live-settings{visibility:hidden!important}' });
            const pixels = decode(screenshot), block = current.scale, colours = new Set();
            assert.equal(pixels.width,Math.round(viewport.width*dpr)); assert.equal(pixels.height,Math.round(viewport.height*dpr));
            const left=Math.round(canvas.left*dpr),top=Math.round(canvas.top*dpr);
            for (let y=0;y<current.height*block;y+=block) for(let x=0;x<current.width*block;x+=block) {
              const colour=pixels.rgba.readUInt32BE(((top+y)*pixels.width+left+x)*4);colours.add(colour);
              for(let dy=0;dy<block;dy++)for(let dx=0;dx<block;dx++) assert.equal(pixels.rgba.readUInt32BE(((top+y+dy)*pixels.width+left+x+dx)*4),colour,`uneven ${block}x block at ${x},${y}`);
            }
            assert.ok(colours.size>16,'pixel proof must contain real game detail, not a blank frame');
            screenshots.push(image);scales.push({choice:modes[i],width:current.width,height:current.height,scale:block,uniformBlocks:true,colours:colours.size});
            await launcher.tap();
            await control.focus(); await page.keyboard.press('Enter');
            assert.equal(await control.evaluate(n => document.activeElement === n), true);
          }
          if(dpr===3)assert.ok(sizes.size>=3,'the choices must change native render resolution, not an overlay');
          assert.equal((await state(page)).render.id,'auto');
          assert.ok((await state(page)).elapsed>beforeMenu.elapsed,'live Settings must not pause the world');
          await control.tap();
          await page.setViewportSize({width:viewport.height,height:viewport.width});
          await page.waitForFunction(() => {
            const c=document.querySelector('#c'),r=c.getBoundingClientRect(),s=window.__pixelReview();
            return Math.abs(r.width*devicePixelRatio-c.width*s.scale)<.1 && Math.abs(r.height*devicePixelRatio-c.height*s.scale)<.1 && r.width<=innerWidth+.1 && r.height<=innerHeight+.1;
          });
          assert.equal((await state(page)).render.id,'4x');
          assert.deepEqual(errors,[]);
          results.push({engine,viewport:name,dpr,default8x:initial.scale===8,fiveChoices:true,persistence:true,liveClock:true,ordinaryWalk:walked.x-start.x,rotation:true,scales,screenshots,errors});
          console.log(engine + '/' + name + ': all five canvas scales have uniform pixel blocks');
          fs.writeFileSync(path.join(output, 'partial.json'), JSON.stringify({engines,results},null,2));
          await page.close();
        }
      } finally { await browser.close(); }
    }
    const evidence = { indexSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex'), engines, results };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally { server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
