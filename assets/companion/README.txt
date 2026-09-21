PLANT-WATERING ROBOT -- DEVELOPER HANDOFF
For max.iverfinne.no

FILES
robot.png   Transparent, native-resolution spritesheet. No labels/background.
robot.json  Named frame rectangles, anchors, timing and animation definitions.
README.txt  This guide.

This is the robot-only subset of the earlier native asset pack. Existing frame
pixels and timing are preserved exactly; only their sheet positions changed.
No animals, menu mockups, presentation boards or unrelated props are included.

IMPORT CONTRACT
Sheet:           384 x 560 pixels, RGBA PNG.
Grid:            8 columns x 14 rows; zero margin and zero spacing.
Frame:           48 x 40 pixels, including transparent padding.
Animation data:  88 frames across 14 clips (7 states x 2 directions).
Anchor:          (24, 36) measured from each frame's top-left corner.
Normalized:      (0.5, 0.9), only for engines using top-left normalized origins.
Ground baseline: y = 36; charging effects may extend below the wheel baseline.
Transparency:    Hard alpha (0 or 255), not a black/checkerboard background.

Draw at native world scale. Apply the same integer camera zoom as the existing
assets, with nearest-neighbour filtering and integer pixel positions. Disable
smoothing, linear texture filtering and mipmaps. Do not independently stretch
sprites to their cell bounds. The cell is NOT the visible robot size.
Do not trim/recenter individual frames: this would change the shared anchor.
The JSON uses top-left coordinates, with y increasing downward.

GRID MAP (ZERO-BASED ROWS)
Each animation starts at column 0. Play only its listed frame count; the rest
of that row is transparent padding, not additional frames.

Row  Face   State    Frames  Loop  Duration in playback order
 0   right  idle      4      yes   360, 120, 180, 540 ms
 1   right  drive     8      yes   80 ms each
 2   right  deploy    6      no    90 ms each
 3   right  water     8      yes   100 ms each
 4   right  retract   6      no    90 ms each
 5   right  empty     4      yes   180 ms each
 6   right  charge    8      yes   120 ms each
 7   left   idle      4      yes   360, 120, 180, 540 ms
 8   left   drive     8      yes   80 ms each
 9   left   deploy    6      no    90 ms each
10   left   water     8      yes   100 ms each
11   left   retract   6      no    90 ms each
12   left   empty     4      yes   180 ms each
13   left   charge    8      yes   120 ms each

Rectangle for column c, row r:
  x = c * 48, y = r * 40, width = 48, height = 40
Grid-index importers: index = r * 8 + c. Use cellIndices from robot.json;
indices include gaps for unused cells and are not a contiguous 0..87 sequence.
Directions are already supplied; do not mirror the left-facing clips again.
Frame count includes deliberately held poses and mirrored directions.

JSON
frames[frameId].frame contains the crop rectangle in robot.png.
frames[frameId].anchorPx contains the local draw anchor.
frames[frameId].contentBounds contains visible bounds, not a collision box.
animations[clipId] contains ordered frames, durationsMs, loop and next.
Example clip ID: robot/right/water
Example frame ID: robot/right/water/00

This is engine-neutral metadata, not a promise of a one-click animation import
for every engine. Adapt the timing definitions to the game's animation loader.
The frames use a conventional untrimmed atlas structure.

SUGGESTED STATE FLOW
idle / drive -> deploy (once) -> water (loop)
water -> retract (once) -> idle
empty: extended arm without a water stream; use for an empty-tank condition.
charge: looping indicator/charging effect; use when connected to a charger.

After deploy finishes, next points to water in the same direction.
After retract finishes, next points to idle in the same direction.
Looping states have next = null: the game decides when to leave them.
Reset the animation clock on state changes. For looping clips wrap elapsed
milliseconds by totalDurationMs; for one-shots clamp to the last frame, then
apply next when the full duration has elapsed.

These are visual states only. Movement, collision, plant targeting, watering
range, water consumption, refill/charging and plant growth belong to the game
controller. Water droplets are baked into the watering frames; do not emit a
second matching stream on top of them. Do not use droplets or the whole padded
frame as the robot's collision geometry.

CANVAS DRAW EXAMPLE (NATIVE WORLD PIXELS)
// image = loaded robot.png, data = parsed robot.json
// currentFrame = selected frame within the clip using durationsMs
const clip = data.animations['robot/right/water'];
const entry = data.frames[clip.frames[currentFrame]];
const f = entry.frame;
const [ax, ay] = entry.anchorPx;
ctx.imageSmoothingEnabled = false;
ctx.drawImage(image, f.x, f.y, f.w, f.h,
  Math.round(robotX - ax), Math.round(groundY - ay), f.w, f.h);

Keep any global camera zoom consistent with all other native game sprites.
robotX and groundY identify the ground anchor, not the sprite's top-left.

VERIFICATION
All 88 sheet crops match the existing source frames byte-for-byte. Frame sizes,
anchors, binary alpha, animation references and unused transparent cells were
checked after export. No game repository was changed; this handoff has not been
integrated or play-tested in the live game.
