const { test } = require('node:test');
const { sweepPlaces } = require('./world-sweep.cjs');

test('gardens 16–20: reachable caches, two-way crossings and no traps', () => sweepPlaces([16, 17, 18, 19, 20]));
