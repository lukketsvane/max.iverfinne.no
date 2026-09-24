const { test } = require('node:test');
const { sweepPlaces } = require('./place-sweep.cjs');

test('gardens 11-15: a walking Bulwark reaches every cache of the place, is never stranded and can cross it both ways', () => sweepPlaces([11,12,13,14,15]));
