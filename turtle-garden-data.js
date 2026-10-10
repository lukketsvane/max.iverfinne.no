// Native collision authored against the owner's Pixel Mill turtle, not a MASTER export.
(function (root) {
  'use strict';
  var registration = { width: 640, height: 360, originX: 180, soilY: 234, imageX: 0, imageY: 0 };
  var sourceKey = '35e9e8ab3deef23d9cc3c5911460c2306ac6dc7bb52d7168232b1f6f1d6510c3';
  function point(x, y) { return { x: x - registration.originX, rise: registration.soilY - y }; }
  function ledge(x, y, w) { return Object.assign(point(x, y), { w: w, style: 'branch' }); }
  function block(x, y, w, h) { return Object.assign(point(x, y), { w: w, h: h, style: 'root' }); }
  function region(kind, x, y, w, h) { return Object.assign(point(x, y), { kind: kind, w: w, h: h }); }
  function ladder(x, top, bottom) { return Object.assign(point(x, top), { w: 14, h: bottom - top }); }
  var garden = {
    frame: 'pixel-mill-turtle-04', pixelMillTurtle: true, pixelMillSourceKey: sourceKey,
    replacePicture: true,
    ledges: [
      ledge(97, 203, 67), ledge(147, 166, 47),
      ledge(130, 142, 100), ledge(225, 132, 68), ledge(270, 110, 60),
      ledge(326, 126, 35), ledge(362, 142, 37), ledge(394, 158, 37),
      ledge(426, 174, 37), ledge(454, 190, 37), ledge(484, 206, 37),
      ledge(512, 222, 37), ledge(540, 238, 37),
      ledge(225, 171, 100), ledge(333, 181, 38), ledge(371, 190, 42),
      ledge(388, 233, 100), ledge(273, 240, 46),
      ledge(183, 208, 22), ledge(202, 185, 34), ledge(355, 213, 28),
      ledge(506, 242, 38), ledge(542, 255, 24)
    ],
    blocks: [
      block(0, 239, 50, 54), block(50, 259, 62, 43),
      block(112, 265, 44, 38), block(156, 274, 67, 31),
      block(166, 234, 104, 6), block(223, 285, 130, 22),
      block(353, 265, 58, 39), block(411, 233, 54, 71),
      block(465, 259, 119, 35), block(584, 272, 56, 22)
    ],
    // Courts also replace the procedural surface: the lower source chambers
    // must not retain an invisible floor at the entry gallery's y234 datum.
    terrain: [
      region('court', 0, 239, 50, 54), region('court', 50, 259, 62, 43),
      region('court', 112, 265, 44, 38), region('court', 156, 274, 10, 31),
      region('court', 166, 234, 104, 6),
      region('court', 353, 265, 58, 39), region('court', 411, 233, 54, 71),
      region('court', 465, 259, 119, 35), region('court', 584, 272, 56, 22),
      region('void', 166, 240, 57, 34), region('void', 223, 240, 130, 45),
      region('entrance', 270, 234, 83, 51)
    ],
    ladders: [
      ladder(130, 203, 265), ladder(151, 166, 203), ladder(175, 166, 234),
      ladder(191, 142, 166), ladder(282, 110, 132), ladder(239, 171, 234),
      ladder(258, 234, 285), ladder(397, 233, 265), ladder(413, 190, 233),
      ladder(371, 190, 213), ladder(482, 233, 259), ladder(52, 239, 259)
    ],
    start: [point(180, 234)], reward: [point(180, 142), point(438, 233)],
    seed: [point(300, 240)], trial: [point(150, 203), point(520, 242)],
    bonus: [point(299, 110)], secret: [point(130, 203)],
    guardianSites: []
  };
  [
    { id: 'shell-west', name: 'West shell shrine', x: 250, y: 132, platform: 3 },
    { id: 'shell-heart', name: 'Shell heart shrine', x: 300, y: 171, platform: 13 },
    { id: 'shell-east', name: 'Headward shrine', x: 438, y: 233, platform: 16 }
  ].forEach(function (site) {
    garden.guardianSites.push(Object.assign(point(site.x, site.y), {
      id: site.id, name: site.name, platformId: '4:d' + site.platform,
      courtX: 218 - registration.originX, courtRise: 0,
      courtLeft: 166 - registration.originX, courtRight: 270 - registration.originX
    }));
  });
  var api = {
    garden: garden, registration: registration, sourceKey: sourceKey,
    // Newly fitted timber stair lips remain visible through the native painter.
    supplementalLedges: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16],
    supplementalBlocks: [3, 4, 6],
    paths: {
      crown: ['4:d2', '4:d3', '4:d4', '4:d5', '4:d6', '4:d7', '4:d8', '4:d9', '4:d10', '4:d11', '4:d12'],
      gallery: ['4:d13', '4:d14', '4:d15'],
      entry: { x: 180, y: 234 }, lowerRoom: { x: 258, y: 285 },
      dryCourt: { left: 166, right: 270, y: 234 }
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MaxTurtleGarden = api;
    var data = root.MaxLevelData;
    if (data && data.gardens && !(data.gardens[4] && data.gardens[4].length)) data.gardens[4] = [garden];
  }
})(typeof window === 'object' ? window : globalThis);
