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
const modes = ['native', 'lcd', 'scanlines', 'grille', 'shadow'];
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
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, results = [];
  try {
    for (const engine of engines) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        for (const [name, viewport] of Object.entries({ phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } })) {
          const page = await browser.newPage({ viewport, deviceScaleFactor: 3, hasTouch: true }), errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base);
          await page.getByRole('button', { name: 'Settings', exact: true }).tap();
          const control = page.getByRole('button', { name: /^Pixel rendering / });
          for (let i = 0; i < 4; i++) await control.tap();
          assert.equal((await state(page)).render.id, 'shadow');
          await page.reload();
          await page.getByRole('button', { name: 'Settings', exact: true }).tap();
          assert.equal((await state(page)).render.id, 'shadow');
          await control.tap();
          assert.equal((await state(page)).render.id, 'native');
          await page.getByRole('button', { name: 'Back', exact: true }).tap();
          await page.getByRole('button', { name: 'Play', exact: true }).tap();
          await page.getByRole('button', { name: 'Play', exact: true }).tap();
          await page.waitForFunction(() => window.__pixelReview().active && !window.__pixelReview().paused);
          const start = await state(page);
          await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
          await page.waitForTimeout(200);
          const walked = await state(page);
          assert.ok(walked.x > start.x + 5, 'ordinary input must move the gardener with real collision');
          await page.keyboard.press('Escape');
          const beforeMenu = await state(page);
          const controlBounds = await control.boundingBox();
          const maskSignatures = new Set(), screenshots = [];
          for (let i = 0; i < 5; i++) {
            const current = await state(page);
            assert.equal(current.render.id, modes[i]); assert.equal(current.render.active, modes[i]);
            assert.equal(current.paused, false); assert.equal(current.width, beforeMenu.width); assert.equal(current.height, beforeMenu.height);
            const bounds = await control.boundingBox();
            assert.ok(bounds.width >= 44 && bounds.height >= 44);
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
            assert.equal(bounds.width, controlBounds.width);
            const mask = await page.evaluate(() => {
              const node = document.querySelector('#subpx'), canvas = node.querySelector('canvas'), game = document.querySelector('#c');
              const box = n => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
              const visible = getComputedStyle(node).display !== 'none';
              return { visible, bounds: visible ? box(node) : null, game: box(game), pointer: getComputedStyle(node).pointerEvents, smoothing: game.getContext('2d').imageSmoothingEnabled, pixels: visible ? Array.from(canvas.getContext('2d').getImageData(0, 0, 24, 24).data) : [] };
            });
            assert.equal(mask.smoothing, false); assert.equal(mask.pointer, 'none'); assert.equal(mask.visible, i !== 0);
            if (mask.visible) {
              mask.bounds.forEach((n, axis) => assert.ok(Math.abs(n - mask.game[axis]) < .5));
              maskSignatures.add(crypto.createHash('sha256').update(Buffer.from(mask.pixels)).digest('hex'));
            }
            await page.getByRole('button', { name: 'Back', exact: true }).tap();
            const image = `${engine}-${name}-${modes[i]}.png`;
            await page.locator('#stage').screenshot({ path: path.join(output, image) }); screenshots.push(image);
            await page.keyboard.press('Escape');
            await control.focus(); await page.keyboard.press('Enter');
            assert.equal(await control.evaluate(n => document.activeElement === n), true);
          }
          assert.equal(maskSignatures.size, 4); assert.equal((await state(page)).render.id, 'native');
          assert.ok((await state(page)).elapsed > beforeMenu.elapsed, 'live settings must not pause the shared world');
          await control.tap();
          const rotated = { width: viewport.height, height: viewport.width };
          await page.setViewportSize(rotated);
          await page.waitForFunction(() => {
            const a = document.querySelector('#c').getBoundingClientRect(), b = document.querySelector('#subpx').getBoundingClientRect();
            return Math.abs(a.width - b.width) < .5 && Math.abs(a.height - b.height) < .5;
          });
          assert.equal((await state(page)).render.active, 'lcd');
          assert.deepEqual(errors, []);
          results.push({ engine, viewport: name, dpr: 3, fiveModes: true, persistence: true, liveClock: true, ordinaryWalk: walked.x - start.x, rotation: true, screenshots, errors });
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
