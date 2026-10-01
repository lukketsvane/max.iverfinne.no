const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

module.exports = () => readFileSync(join(root, 'index.html'), 'utf8')
  .replace(/"MAX_([A-Z_]+)";/g, (_, name) =>
    readFileSync(join(root, name.toLowerCase().replaceAll('_', '-') + '.inc.js'), 'utf8'));
