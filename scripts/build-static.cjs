'use strict';

const { copyFileSync, cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { buildSync } = require('esbuild');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const files = ['index.html', 'run-results.js', 'run-results.css', 'game-menu.css', 'companion.js', 'build-paths.js', 'max-classes.js', 'stage-layout.js', 'review.html'];
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
  .replace('/* MAX_COOP_GAME */', readFileSync(join(root, 'coop-game.inc.js'), 'utf8'))
  .replace('/* MAX_RUN_DIRECTOR */', readFileSync(join(root, 'run-director.inc.js'), 'utf8'))
  .replace('/* MAX_RAT_ENEMIES */', readFileSync(join(root, 'rat-enemies.inc.js'), 'utf8')));
require('./build-companion.cjs')(output);
cpSync(join(root, 'assets/audio'), join(output, 'assets/audio'), { recursive: true });
cpSync(join(root, 'icons'), join(output, 'icons'), { recursive: true });
cpSync(join(root, 'assets/biomes-v1'), join(output, 'assets/biomes-v1'), { recursive: true });
copyFileSync(join(root, 'manifest.webmanifest'), join(output, 'manifest.webmanifest'));
for (const [pack, ids, sheets] of [
  ['max-skins-v1', ['moss', 'tide', 'ember', 'moon'], ['atlas.json', 'main.png', 'interaction.png']],
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
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify(config) },
});

// The isolated visual fixture has no connected account client.
buildSync({
  entryPoints: [join(root, 'game-menu.mjs')], outfile: join(output, 'game-menu-review.js'),
  bundle: true, minify: true, format: 'iife', target: ['safari15', 'es2020'],
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ ...config, publishableKey: '' }) },
});

console.log(`Built game in dist/. Accounts: ${config.publishableKey ? 'configured' : 'guest mode (publishable key missing)'}.`);
