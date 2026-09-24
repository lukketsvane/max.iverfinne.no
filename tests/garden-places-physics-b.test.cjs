const { test } = require('node:test');
const { sweepPlaces } = require('./place-sweep.cjs');

test('gardens 6-10: a walking Bulwark reaches every cache of the place, is never stranded and can cross it both ways', () => sweepPlaces([6,7,8,9,10]));
