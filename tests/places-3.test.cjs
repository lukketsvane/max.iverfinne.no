const { test } = require('node:test');
const { sweepPlaces } = require('./world-sweep.cjs');

test('gardens 11–15: reachable caches, two-way crossings and no traps', () => sweepPlaces([11, 12, 13, 14, 15]));
