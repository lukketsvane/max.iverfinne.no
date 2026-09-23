const { test } = require('node:test');
const { sweepSeeds } = require('./platform-sweep.cjs');

test('seeded gardens, seeds 11-20: all four unupgraded classes walk and jump every core hop at 30, 60 and 120 Hz', () => sweepSeeds(10, 20));
