# Integrated fold → quarter-turn cycle

The folding mechanism now occupies the original paper bay of the comparison scene. There is one canvas and no separate lower close-up. The exact layer count remains in the controls, with a compact live layer/phase caption in the scene.

Each cycle bends all existing layer groups along the current long side of an A-series rectangle. The bundle closes, then rotates rigidly by 90 degrees about its closed centroid. The next fold uses the other material axis. A uniform √2 footprint magnification is distributed across the bend; it stops before the quarter turn. The turn never stretches either edge, the paper never unfolds to create the next long side, and there is no between-cycle reset/hold in autoplay. A fixed orthographic camera, world-space face lighting, backface culling and regrouped perimeter seams keep the geometry coherent across the material-coordinate rebase.

The folding mesh is a mechanics schematic. Its display thickness is continuously compressed into readable layer groups; it is not a physical volume or a single metre-scale solid. The slim gold thickness guide immediately beside it retains the exact shared metres-to-pixels scale of all 46 reference objects. The numeric model still uses thickness × 2ⁿ and exact BigInt layer counts, with the 100/103/107 endpoints for 1/0.1/0.01 mm paper. The scientific limitations remain explicit on the page.

## Controls and interrupted motion

- Pause freezes the visible bend or quarter turn; resume continues from that pose
- A one-fold reverse traverses the same rotation/bend backward
- Large jumps interpolate from the actual visible connected mesh and crossfade sampled layer groups; rapid interruptions preserve that visible starting state
- Reset, thickness changes, resize and reduced motion stay consistent with the selected model state
- The paper and its caption remain inside the original left comparison bay; references retain the right bay and their separate readable detail cards

## Verification

- Node geometry checks cover whole-thickness bending, closure, rigid quarter-turn distances, normalized footprint halving, crease/silhouette continuity, bounded projections and interruption endpoints
- Direct local raster review checks seam, lighting and boundary continuity with the available canvas renderer; no new production dependency is added
- Dedicated Playwright videos record six uninterrupted cycles at 1440/390/320 px, then high-count folds to 103 and a reverse fold, with per-frame fold/yaw/axis/reference telemetry
- A separate recording covers pause during both phases, resume, rapid step/jump/reset interruption, resize and reduced motion
- Non-recording browser tests capture both fold and quarter-turn poses, all reference scales and paper-dependent endpoints; still screenshots do not interrupt the motion recordings
- Full exact-head CI runs lint, SEO/tool/science tests, laboratory checks, static build, metadata/SEO checks and the complete browser suite
