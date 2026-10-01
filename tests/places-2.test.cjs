const { test } = require('node:test');
const { sweepPlaces } = require('./world-sweep.cjs');

test('gardens 6–10: reachable caches, two-way crossings and no traps', () => sweepPlaces([6, 7, 8, 9, 10]));
