# Whole-stack folding close-up

The old decorative top leaf has been removed. A separate action close-up bends the entire existing layered cross-section about one hinge. Its moving half retains the same thickness as its stationary half. Every visible layer is joined through the curved spine, and a closed fold is twice the starting bundle thickness.

After closure the close-up continuously recentres and reframes the result for the next fold. This lets consecutive folds remain readable. Close-up width, thickness and texture are explicitly schematic: up to 16 layer groups are drawn, while the exact BigInt layer count remains in the numeric panel. The physical thickness tower and all 46 source-defined reference objects still share their original length scale. Neither the close-up nor the 100–107-fold endpoint implies a physically feasible folding process.

Pause freezes the visible pose; resuming finishes it before starting the next fold. Backward single steps reverse the same mesh. Long jumps and their interruptions interpolate from the visible connected cross-section rather than rapidly replaying dozens of folds. Reset, paper changes and reduced-motion updates also end at a coherent resting bundle.

## Verification

- Geometry tests check rotation of the complete moving thickness, layer/hinge connectivity, exact doubling at closure, continuous endpoint bounds, finite bounded geometry through every fractional fold, and interruption interpolation endpoints
- Browser coverage records five consecutive folds and a reverse fold at 1440, 390 and 320 pixels, with screenshots during each turn
- A second motion recording covers pause/resume, interrupted jumps/reset, a whole-bundle fold at the cosmic endpoint, and reduced motion
- Existing science, model, reference, dynamic-endpoint, keyboard, mobile and scale-visibility checks remain in place
- Browser recordings and screenshots are uploaded by the existing full CI workflow for inspection; local Chromium launch is unavailable in the execution sandbox
