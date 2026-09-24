const { test } = require('node:test');
const { sweepPlaces } = require('./place-sweep.cjs');

test('gardens 1-5: a walking Bulwark reaches every cache of the place, is never stranded and can cross it both ways', () => sweepPlaces([1,2,3,4,5]));
