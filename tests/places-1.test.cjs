const { test } = require('node:test');
const { sweepPlaces } = require('./world-sweep.cjs');

test('gardens 1–5: reachable caches, two-way crossings and no traps', () => sweepPlaces([1, 2, 3, 4, 5]));
