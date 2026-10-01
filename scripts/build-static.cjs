'use strict';

const { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { buildSync } = require('esbuild');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const copy = file => {
  mkdirSync(dirname(join(output, file)), { recursive: true });
  cpSync(join(root, file), join(output, file), { recursive: true });
};
const files = ['run-results.js', 'run-results.css', 'game-menu.css', 'companion.js', 'build-paths.js', 'max-classes.js', 'stage-layout.js', 'levels-data.js', 'levels.js', 'high-tide-map.js', 'garden-places.js', 'stage-expeditions.js', 'guardian-sites.js', 'tiles.js', 'review.html', 'guardian-motion-review.html', 'playtest.html', 'night-relay-review.html', 'night-relay-playtest-pilot.js', 'high-tide-playtest-pilot.js', 'high-tide-playtest-routes.json'];
const configFile = join(root, 'supabase', 'public-config.json');
const savedConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
const config = {
  url: process.env.PUBLIC_SUPABASE_URL || savedConfig.url || 'https://zuezxsuqkvrzypjhbbqq.supabase.co',
  publishableKey: process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || savedConfig.publishableKey || '',
};
if (config.publishableKey && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) {
  throw new Error('Use a Supabase publishable key, never a secret or service-role key.');
}
if (config.publishableKey && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)) {
  throw new Error('Expected a hosted Supabase project URL.');
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) copy(file);
writeFileSync(join(output, 'index.html'), require('./game-source.cjs')());
require('./build-companion.cjs')(output);
for (const file of [
  'assets/audio', 'icons', 'assets/biomes-v1', 'assets/boon-symbols-v1', 'assets/plants-v1',
  'assets/garden-view-v1', 'assets/tiles-v1', 'assets/backdrop-v1', 'assets/night-v1',
  'assets/cavern-v1', 'manifest.webmanifest',
]) copy(file);
for (const file of ['levels-v1', 'assets/levels-v1']) if (existsSync(join(root, file))) copy(file);
for (const file of ['props.png', 'props.json', 'landmarks.png', 'landmarks.json']) copy('assets/district-props-v1/' + file);
for (const [pack, ids, sheets] of [
  ['max-skins-v1', ['tide', 'polge'], ['atlas.json', 'main.png', 'interaction.png']],
  ['characters-v2', ['rattle-norvegicus-pink', 'cairn', 'mycel'], ['atlas.json', 'main.png', 'interaction.png']],
  ['rat-enemies-v1', ['common', 'black', 'albino', 'plague'], ['atlas.json', 'sprites.png']],
  ['enemies-v1', ['seed-thief', 'spore-caster', 'shield-beetle', 'healing-moth', 'hollow-crown'], ['atlas.json', 'sprites.png']],
]) {
  for (const id of ids) {
    for (const file of sheets) copy(join('assets', pack, id, file));
  }
  const packManifest = JSON.parse(readFileSync(join(root, 'assets', pack, 'manifest.json'), 'utf8'));
  const shippedIds = pack === 'max-skins-v1' ? ids.concat('sligo') : ids;
  packManifest.assets = shippedIds.map(id => ({ id, manifest: id + '/atlas.json' }));
  writeFileSync(join(output, 'assets', pack, 'manifest.json'), JSON.stringify(packManifest, null, 2) + '\n');
}
for (const file of ['atlas.json', 'main.png', 'interaction.png', 'specials.png', 'specials.json', 'brood.png', 'brood.json', 'evergreen.png', 'evergreen.json', 'chain.png', 'chain.json']) copy('assets/max-skins-v1/sligo/' + file);
copy('assets/garden-guardians-v1/native');
for (const id of ['05-mossback', '10-bellkeeper', '15-moon-moth']) {
  for (const extension of ['json', 'png']) {
    copy('assets/boss-milestones-v1/native/' + id + '.' + extension);
  }
}
buildSync({
  entryPoints: [join(root, 'native-art.mjs')], outfile: join(output, 'native-art.js'),
  bundle: true, minify: true, format: 'iife', target: ['safari15', 'es2020'],
});
buildSync({
  entryPoints: [join(root, 'game-menu.mjs')], outfile: join(output, 'game-menu.js'),
  bundle: true, minify: true, format: 'iife', target: ['safari15', 'es2020'],
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify(config), __MAX_RELIC_REVIEW__: 'false' },
});

buildSync({
  entryPoints: [join(root, 'game-menu.mjs')], outfile: join(output, 'game-menu-review.js'),
  bundle: true, minify: true, format: 'iife', target: ['safari15', 'es2020'],
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ ...config, publishableKey: '' }), __MAX_RELIC_REVIEW__: 'true' },
});

console.log(`Built game in dist/. Accounts: ${config.publishableKey ? 'configured' : 'guest mode (publishable key missing)'}.`);
