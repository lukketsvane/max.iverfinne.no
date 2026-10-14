'use strict';
// Uses the real built game and menu, with the existing isolated account-free menu bundle.
// Selection never starts a run or enters a shared room.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '../dist');
const output = path.resolve(process.env.MENU_BROWSER_OUTPUT || 'menu-browser-review');
const selectors = ['.max-menu-header', '.max-character-stage', '.max-character-intro', '.max-role-picker', '.max-difficulty-picker', '.max-skill-picker', '.max-play-actions', '.max-status'];
const viewports = { phone: { width: 390, height: 844 }, narrow: { width: 320, height: 640 }, compact: { width: 568, height: 320 }, desktop: { width: 960, height: 760 } };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested.endsWith('/') ? requested + 'index.html' : requested));
    if (!file.startsWith(root + path.sep)) throw Error('Outside build');
    const source = fs.readFileSync(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(file === path.join(root, 'index.html') ? source.toString().replace('src="game-menu.js"', 'src="game-menu-review.js"') : source);
  } catch { res.writeHead(404); res.end(); }
});
async function measure(page) {
  return page.evaluate(selectors => {
    const overlay = document.querySelector('.max-menu');
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y + overlay.scrollTop, width: r.width, height: r.height }; };
    const contains = (outer, inner) => inner.x >= outer.x - .5 && inner.y >= outer.y - .5 && inner.x + inner.width <= outer.x + outer.width + .5 && inner.y + inner.height <= outer.y + outer.height + .5;
    const name = document.querySelector('.max-character-name'), nameBox = box(name);
    const nameInk = [...name.querySelectorAll('canvas.pixel-label')].map(canvas => {
      const bounds = box(canvas), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3]) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      const painted = right >= left && bottom >= top;
      const ink = painted ? { x: bounds.x + left * bounds.width / canvas.width, y: bounds.y + top * bounds.height / canvas.height, width: (right - left + 1) * bounds.width / canvas.width, height: (bottom - top + 1) * bounds.height / canvas.height } : null;
      return { bounds, painted, ink, contained: painted && contains(nameBox, bounds) && contains(nameBox, ink) && contains(box(document.querySelector('.max-character-intro')), bounds) && contains(box(document.querySelector('.max-character-hero')), bounds) };
    });
    return {
      scroll: overlay.scrollTop,
      sections: Object.fromEntries(selectors.map(selector => [selector, box(document.querySelector(selector))])),
      readout: box(document.querySelector('.max-skill-readout')),
      slots: [...document.querySelectorAll('.max-skill-slot')].map(box),
      icons: [...document.querySelectorAll('.max-skill-choice')].map(node => ({ ...box(node), text: node.textContent, label: node.getAttribute('aria-label'), selected: node.getAttribute('aria-pressed'), symbol: node.querySelector('img').getAttribute('src'), ink: box(node.querySelector('img')) })),
      alignment: getComputedStyle(overlay).alignItems,
      width: innerWidth,
      overflow: document.querySelector('.max-menu-card').scrollWidth > document.querySelector('.max-menu-card').clientWidth + 1,
      readoutFits: document.querySelector('.max-skill-readout').scrollHeight <= document.querySelector('.max-skill-readout').clientHeight + 1,
      name: { text: name.textContent, bounds: nameBox, ink: nameInk, fullyVisible: nameInk.length > 0 && nameInk.every(word => word.contained) },
      card: { bounds: box(document.querySelector('.max-menu-card')), width: document.querySelector('.max-menu-card').clientWidth, scrollWidth: document.querySelector('.max-menu-card').scrollWidth, back: box(document.querySelector('.max-back')) },
    };
  }, selectors);
}
async function nativeMenuReady(page) {
  await page.waitForFunction(() => {
    const title = document.querySelector('.max-menu-header h2');
    const words = [...document.querySelectorAll('.max-character-name canvas.pixel-label')];
    return title?.classList.contains('pixel-ready') && words.length > 0 && words.every(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    }) && [...document.querySelectorAll('.max-skill-choice img')].every(image => image.complete && image.naturalWidth === 9);
  });
}
function sameBounds(before, after, message) {
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) <= .5, `${message} ${key}: ${before[key]} → ${after[key]}`);
}
async function run() {
  const requested = process.env.MENU_BROWSER_ENGINE;
  assert.ok(requested === undefined || ['chromium', 'webkit'].includes(requested), 'Empty or unknown menu review engine');
  const engines = requested === undefined ? ['chromium', 'webkit'] : [requested];
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, results = [];
  for (const engine of engines) {
    const launch = engine === 'chromium' && process.env.MENU_BROWSER_EXECUTABLE ? { executablePath: process.env.MENU_BROWSER_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {};
    const browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...launch });
    try {
      for (const [viewport, size] of Object.entries(viewports)) {
        const page = await browser.newPage({ viewport: size, hasTouch: true }), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('max-easter-eggs-v1', JSON.stringify({ local: ['sligo'], accounts: {} })));
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('.max-home-button.primary').tap();
        await nativeMenuReady(page);
        const initial = await measure(page);
        assert.equal(initial.alignment, 'flex-start', 'setup is not recentered by content changes');
        assert.equal(initial.readout.height, 58);
        const classes = await page.locator('[data-class-id]').evaluateAll(nodes => nodes.map(node => node.dataset.classId));
        assert.deepEqual(classes, ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo']);
        for (const classId of classes) {
          await page.locator(`[data-class-id="${classId}"]`).tap();
          await nativeMenuReady(page);
          const layout = await measure(page);
          fs.writeFileSync(path.join(output, 'last-layout.json'), JSON.stringify({ engine, viewport, classId, initial, layout }, null, 2));
          for (const selector of selectors) sameBounds(initial.sections[selector], layout.sections[selector], `${engine}/${viewport}/${classId} ${selector}`);
          sameBounds(initial.readout, layout.readout, `${classId} readout`);
          assert.equal(layout.slots.length, 2);
          layout.slots.forEach((box, i) => sameBounds(initial.slots[i], box, `${classId} slot ${i}`));
          assert.equal(layout.icons.length, classId === 'sligo' ? 2 : 4);
          assert.equal(layout.overflow, false, `${engine}/${viewport}/${classId}: no horizontal card overflow ${JSON.stringify(layout.card)}`);
          assert.equal(layout.readoutFits, true, 'ability effect fits the separate readout');
          assert.equal(layout.name.fullyVisible, true, `${engine}/${viewport}/${classId}: every actual native name canvas and painted pixel fits the title, intro and hero ${JSON.stringify(layout.name)}`);
          for (const icon of layout.icons) {
            assert.ok(icon.width >= 44 && icon.height >= 44, 'each icon has a usable touch target');
            assert.ok(icon.x >= 0 && icon.x + icon.width <= layout.width + .5, 'touch targets stay on screen');
            assert.equal(icon.ink.width, 27); assert.equal(icon.ink.height, 27);
            assert.equal(icon.text, ''); assert.ok(icon.label.includes(': '));
          }
          const choices = await page.locator('.max-skill-choice').evaluateAll(nodes => nodes.map(node => ({ slot: node.dataset.skillSlot, id: node.dataset.skillId })));
          for (const { slot, id } of choices) for (const input of ['touch', 'keyboard']) {
            const choice = page.locator(`[data-skill-slot="${slot}"][data-skill-id="${id}"]`);
            if (input === 'touch') await choice.tap();
            else { await choice.focus(); await page.keyboard.press('Enter'); }
            assert.equal(await choice.getAttribute('aria-pressed'), 'true');
            assert.equal(await choice.evaluate(node => document.activeElement === node), true);
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('max-loadout-v1')));
            assert.equal(saved.classId, classId);
            assert.equal(saved.skills?.[slot] || 'base', id, `actual ${input} choice persists`);
            const selected = await measure(page);
            fs.writeFileSync(path.join(output, 'last-layout.json'), JSON.stringify({ engine, viewport, classId, slot, id, input, initial, layout: selected }, null, 2));
            for (const selector of selectors) sameBounds(initial.sections[selector], selected.sections[selector], `${classId}/${slot}/${id} ${selector}`);
            sameBounds(initial.readout, selected.readout, `${classId}/${slot}/${id} readout`);
            assert.equal(selected.overflow, false);
            assert.equal(selected.readoutFits, true);
            assert.equal(selected.name.fullyVisible, true, `${classId}/${slot}/${id}: skill selection cannot clip name artwork`);
          }
          if (viewport === 'phone' && ['runner', 'sligo'].includes(classId)) {
            await page.locator('.max-menu').evaluate(node => { node.scrollTop = 0; });
            await page.screenshot({ path: path.join(output, `${engine}-${viewport}-${classId}.png`) });
          }
          results.push({ engine, viewport, classId, initial, layout, touchSelection: true, keyboardSelection: true });
          fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results }, null, 2));
        }
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results }, null, 2));
  process.stdout.write(`Menu layout: ${results.length} class/viewport cases passed.\n`);
}
run().catch(error => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack }, null, 2));
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
}).finally(() => server.close());
