'use strict';

const { copyFileSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const files = ['index.html', 'run-results.js', 'run-results.css'];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) copyFileSync(join(root, file), join(output, file));

console.log(`Built ${files.length} static game files in dist/`);
