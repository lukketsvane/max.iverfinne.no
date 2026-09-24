const { test } = require('node:test');
const { sweepPlaces } = require('./place-sweep.cjs');

test('gardens 16-20: a walking Bulwark reaches every cache of the place, is never stranded and can cross it both ways', () => sweepPlaces([16,17,18,19,20]));
