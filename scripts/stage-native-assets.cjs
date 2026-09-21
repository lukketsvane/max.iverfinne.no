'use strict';
// Run after the game's normal build. Never deletes dist or replaces game files.
const { copyFileSync, cpSync, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const root = join(__dirname, '..');
const output = join(root, 'dist');
if (!existsSync(join(output, 'index.html'))) {
  throw new Error('Run npm run build before staging native assets.');
}
execFileSync(process.execPath, [join(__dirname, 'build-native-assets.cjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(__dirname, 'build-native-review.cjs')], { stdio: 'inherit' });
mkdirSync(join(output, 'assets'), { recursive: true });
cpSync(join(root, 'assets', 'native'), join(output, 'assets', 'native'), { recursive: true });
for (const file of ['native-sprites.js', 'native-asset-review.html']) {
  copyFileSync(join(root, file), join(output, file));
}
console.log('Staged native PNG assets and review; existing game build left intact.');
