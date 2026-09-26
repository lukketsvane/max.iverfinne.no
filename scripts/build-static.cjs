'use strict';

const { copyFileSync, cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { buildSync } = require('esbuild');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const files = ['index.html', 'run-results.js', 'run-results.css', 'game-menu.css', 'companion.js', 'build-paths.js', 'max-classes.js', 'stage-layout.js', 'levels-data.js', 'levels.js', 'high-tide-map.js', 'garden-places.js', 'stage-expeditions.js', 'tiles.js', 'review.html', 'playtest.html', 'night-relay-review.html', 'night-relay-playtest-pilot.js', 'high-tide-playtest-pilot.js', 'high-tide-playtest-routes.json'];
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
for (const file of files) copyFileSync(join(root, file), join(output, file));
writeFileSync(join(output, 'index.html'), readFileSync(join(root, 'index.html'), 'utf8')
  .replace('/* MAX_SLIGO_LIFE */', readFileSync(join(root, 'sligo-life.inc.js'), 'utf8'))
  .replace('/* MAX_POLGE */', readFileSync(join(root, 'polge.inc.js'), 'utf8'))
  .replace('/* MAX_LAST_SEED */', readFileSync(join(root, 'last-seed.inc.js'), 'utf8'))
  .replace('/* MAX_HIGH_TIDE */', readFileSync(join(root, 'high-tide.inc.js'), 'utf8'))
  .replace('/* MAX_NIGHT_RELAY */', readFileSync(join(root, 'night-relay.inc.js'), 'utf8'))
  .replace('/* MAX_COOP_GAME */', readFileSync(join(root, 'coop-game.inc.js'), 'utf8'))
  .replace('/* MAX_RUN_DIRECTOR */', readFileSync(join(root, 'run-director.inc.js'), 'utf8'))
  .replace('/* MAX_RAT_ENEMIES */', readFileSync(join(root, 'rat-enemies.inc.js'), 'utf8'))
  .replace('/* MAX_SECRETS */', readFileSync(join(root, 'secrets.inc.js'), 'utf8')).replace('/* MAX_WONDERS */', readFileSync(join(root, 'wonders.inc.js'), 'utf8')));
require('./build-companion.cjs')(output);
cpSync(join(root, 'assets/audio'), join(output, 'assets/audio'), { recursive: true });
cpSync(join(root, 'icons'), join(output, 'icons'), { recursive: true });
for (const d of ['levels-v1', 'assets/levels-v1']) if (existsSync(join(root, d))) cpSync(join(root, d), join(output, d), { recursive: true });
cpSync(join(root, 'assets/biomes-v1'), join(output, 'assets/biomes-v1'), { recursive: true });
cpSync(join(root, 'assets/boon-symbols-v1'), join(output, 'assets/boon-symbols-v1'), { recursive: true });
cpSync(join(root, 'assets/plants-v1'), join(output, 'assets/plants-v1'), { recursive: true });
cpSync(join(root, 'assets/garden-view-v1'), join(output, 'assets/garden-view-v1'), { recursive: true });
cpSync(join(root, 'assets/tiles-v1'), join(output, 'assets/tiles-v1'), { recursive: true });
cpSync(join(root, 'assets/backdrop-v1'), join(output, 'assets/backdrop-v1'), { recursive: true });
cpSync(join(root, 'assets/night-v1'), join(output, 'assets/night-v1'), { recursive: true });
cpSync(join(root, 'assets/cavern-v1'), join(output, 'assets/cavern-v1'), { recursive: true });
copyFileSync(join(root, 'manifest.webmanifest'), join(output, 'manifest.webmanifest'));
for (const [pack, ids, sheets] of [
  ['max-skins-v1', ['moss', 'tide', 'ember', 'moon', 'polge'], ['atlas.json', 'main.png', 'interaction.png']],
  ['rat-enemies-v1', ['common', 'black', 'albino', 'plague'], ['atlas.json', 'sprites.png']],
  ['enemies-v1', ['seed-thief', 'spore-caster', 'shield-beetle', 'healing-moth', 'hollow-crown'], ['atlas.json', 'sprites.png']],
]) {
  for (const id of ids) {
    const directory = join(output, 'assets', pack, id);
    mkdirSync(directory, { recursive: true });
    for (const file of sheets) copyFileSync(join(root, 'assets', pack, id, file), join(directory, file));
  }
  copyFileSync(join(root, 'assets', pack, 'manifest.json'), join(output, 'assets', pack, 'manifest.json'));
}
// Sligo's pack and its specials (the tun's sac and its burst) ship with the game.
mkdirSync(join(output, 'assets/max-skins-v1/sligo'), { recursive: true });
for (const file of ['atlas.json', 'main.png', 'interaction.png', 'specials.png', 'specials.json', 'brood.png', 'brood.json']) copyFileSync(join(root, 'assets/max-skins-v1/sligo', file), join(output, 'assets/max-skins-v1/sligo', file));
const milestoneDirectory = join(output, 'assets/boss-milestones-v1/native');
mkdirSync(milestoneDirectory, { recursive: true });
for (const id of ['05-mossback', '10-bellkeeper', '15-moon-moth']) {
  for (const extension of ['json', 'png']) {
    copyFileSync(join(root, 'assets/boss-milestones-v1/native', id + '.' + extension), join(milestoneDirectory, id + '.' + extension));
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

// The isolated visual fixture has no connected account client.
buildSync({
  entryPoints: [join(root, 'game-menu.mjs')], outfile: join(output, 'game-menu-review.js'),
  bundle: true, minify: true, format: 'iife', target: ['safari15', 'es2020'],
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ ...config, publishableKey: '' }), __MAX_RELIC_REVIEW__: 'true' },
});

console.log(`Built game in dist/. Accounts: ${config.publishableKey ? 'configured' : 'guest mode (publishable key missing)'}.`);
