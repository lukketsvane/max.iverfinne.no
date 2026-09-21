# Native pixel sprites for MAX FUGLESPRENGER

Nine transparent PNG sheets; 432 registered frame/state slots. These are the
asset files, not screenshots of sprite sheets. No labels, grid lines, glow
backgrounds or reference figures are baked into them.

## Files

| PNG | Sheet pixels | Cell pixels | Frames/states | Origin |
| --- | --- | --- | --- | --- |
| [watering_robot.png](watering_robot.png) | 512 x 512 | 64 x 64 | 64 | 32,56 |
| [plant_thief_drone.png](plant_thief_drone.png) | 512 x 512 | 64 x 64 | 64 | 32,24 |
| [water_fx.png](water_fx.png) | 512 x 512 | 64 x 64 | 64 | 32,56 |
| [robot_parts.png](robot_parts.png) | 256 x 128 | 32 x 32 | 32 | 16,24 |
| [garden_stations.png](garden_stations.png) | 512 x 256 | 64 x 64 | 32 | 32,56 |
| [plant_growth.png](plant_growth.png) | 512 x 768 | 64 x 96 | 64 | 32,80 |
| [plant_cargo.png](plant_cargo.png) | 256 x 512 | 64 x 64 | 32 | 32,51 |
| [inventory_items.png](inventory_items.png) | 128 x 32 | 16 x 16 | 16 | 8,8 |
| [interaction_fx.png](interaction_fx.png) | 512 x 512 | 64 x 64 | 64 | 32,56 |

## Scale and registration

One PNG pixel equals one game-world art pixel. The robot chassis is 28 x 19
pixels; the drone body is 31 x 10. Arms, propellers, cables and particles occupy
additional pixels. A 64 x 64 cell is transparent padding, NOT a 64-pixel robot.
Do not resize each frame to fill its cell or recenter its visible bounding box.

The robot's lowest opaque row stays at cell y=55; ground is y=56. Every frame
has the same origin. The drone uses a body origin, not a ground origin. Water
is a separate layer aligned to the robot's watering animation. Carried plants
attach to moving claw sockets, including mirrored drawing.

All exported pixels are fully opaque or fully transparent. No anti-aliasing,
resampling or dithering is applied by the drawing adapter. Apply the game's
shared integer display zoom after drawing, never a separate scale per object.

## Animations

Robot rows: idle, drive, deploy_arm, water, retract_arm, empty_tank, refill,
power_down. Drone rows: hover, approach, brake_turn, lower_claw, grip, haul_up,
carry_flight, release. Both are 8 columns by 8 rows, read left to right.

The JSON lists every clip. In schema 2 each clip is
`[firstFrame, numberOfFrames, framesPerSecond, loop]`; loop is 0 or 1.
Zero frames per second means explicitly selected states, not an animation.
A socket is either a constant [x,y] or one [x,y] pair per frame. PNG names are
sheet keys plus `.png`. Frame i starts at
`x=(i % columns)*cellWidth, y=floor(i/columns)*cellHeight`.

The separate parts, stations, inventory and plant states have named groups.
Plant-growth rows cover eight families, with eight stages each. Some early
seed states repeat intentionally; 432 slots does not mean 432 unique drawings.

## Drawing

Load [sprites.js](sprites.js), then:

```js
const pack = await MaxExpansionSprites.load('./assets/expansion/');
// Pass the game's low-resolution canvas context and world/camera coordinates.
pack.drawRobot(ctx, 'water', elapsedSeconds, robotX, groundY, {x:camX,y:camY}, 1);
pack.drawDrone(ctx, 'carry_flight', elapsedSeconds, droneX, droneY,
               {x:camX,y:camY}, -1, 5); // cargo frame 5
```

`drawFrame`, `sample`, `socket`, and `draw` are also exposed. Directions are
1 (as authored) and -1 (mirrored). The adapter validates frame ranges and PNG
sizes, snaps world-minus-camera coordinates once, and draws equal source and
destination rectangles. One-shots hold their final frame. Static states never
advance automatically. [preview.html](preview.html) is an isolated atlas bench;
serve the repository root over HTTP to open it.

## Source and verification

Native component edits/assemblies use the supplied IMG_3018.png reference and
original plant modules. Technology colours are sampled from the native robot
and drone references; plant colours were checked against PLANT_ATLAS_SRC in the
game. The audited renderer snapshot is commit
`cca0f5c46ca2a2e55bdae52569984f44499d4b11`. Original game artwork is not replaced.
These exports are not cut from the generated illustrated presentation boards.

Run `node --test tests/expansion-assets.test.cjs` from the repository root.
The tests decode the PNGs, check SHA-256 hashes, binary alpha, exact grids,
constant wheel contact, clip ranges, integer 1:1 drawing, mirrored origins,
water timing and plant/claw registration. [checksums.json](checksums.json)
records the exact PNG bytes.

This is an optional art candidate and drawing adapter, not autonomous NPC AI.
It does not spawn robots or drones, change saves, or modify the menu, account,
production build or game entry point. Other robot candidates and any existing
companion implementation are untouched by this addition. Integration and final
art selection belong to the game developer after comparison.
