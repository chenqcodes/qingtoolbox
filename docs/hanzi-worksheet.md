# A4 汉字练习纸

Route: `/tools/hanzi-worksheet/`

## Behavior

- Accepts up to 60 Han-script characters from at most 2,000 Unicode code points. Non-Hanzi characters are skipped; repeated Hanzi and their order are retained. Oversized input is rejected, never silently printed as a shortened list.
- Uses the existing bundled `pinyin-pro` dependency with phrase context. Each occurrence can have its own manually edited reading. Changing the source text resets readings; changing sheet options preserves them.
- Each row has ten 18 mm square 田字格 cells. Tracing options are 0, 2, 5, 8, or 10 filled cells. Each character can receive one to three consecutive rows.
- Dictation mode omits all answer characters from printable cells. Optional pinyin makes it a 看拼音写汉字 worksheet; turning pinyin off makes it suitable for oral dictation.
- No worksheet text is uploaded or persisted. Links from the pinyin and stroke-practice tools transfer text through a URL fragment, which is removed after import. The optional import button only reads the existing `hanzi-learn-chars` local-storage key.
- Uses only locally available fonts for the paper, and introduces no font downloads, dependencies, tracking, or external service calls. Unsupported rare glyphs may require a device with an appropriate system font.

## Print layout

Each `.worksheet-sheet` is exactly 210 × 297 mm, with 12 mm vertical and 15 mm horizontal inset. The 273 mm inner height accommodates a 24 mm header, eight 29 mm rows, and a 12 mm footer, leaving 5 mm safety space. The last partial page retains the same footer placement. Real borders supply both outer grid lines and dashed crosshairs, so grids do not require background printing.

Only sheet content remains visible in print media; navigation, editor, help, and site footer are excluded. Each sheet has a forced page break except the last one. The screen preview scales the entire sheet to the available width, while print CSS removes transforms and restores physical measurements.

Use A4 portrait, 100% scale, and turn browser headers/footers off. Desktop browsers commonly offer “Save as PDF.” Mobile printing and PDF destinations depend on the OS and browser; the UI explains browser-menu / Share → Print fallbacks.

## Verification

Run:

```sh
node --import tsx --test src/scripts/hanzi-worksheet/*.test.ts
ASTRO_TELEMETRY_DISABLED=1 npm run lint
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

The unit tests cover contextual polyphonic readings, supplementary-plane Hanzi, duplicate positions, empty input, limits, all tracing ratios, dictation answer removal, manual readings, safe HTML escaping, maximum pagination, fragment transfer, and CSS layout invariants.

Browser QA should verify:

1. At desktop and 375 px width, preview and controls do not overflow horizontally.
2. Eight default characters produce one page; nine characters produce two. Sixty characters with three rows produce 23 pages, with no clipped rows or trailing blank page.
3. Actual PDF output has A4 dimensions, visible grid crosshairs, and only paper content when background graphics are disabled.
4. Editing each occurrence's pinyin updates only its row(s); disabling pinyin removes printed readings. Switching to dictation removes all traced Hanzi; switching back restores the selected tracing ratio.
5. Clearing or pasting only non-Hanzi disables printing and shows an empty state; 61 Hanzi shows a limit error and no printable pages.
6. Both source-page links transfer input, preserve repeated characters and Unicode, then remove the fragment. Local-storage import handles empty, corrupt, and blocked storage without changing existing source-page behavior.
7. Cancel printing, change settings, print again, and use narrow/mobile layout. Confirm the editing interface remains usable afterward.

Real browser print/PDF QA is distinct from passing unit/build/type checks. It must run in an environment where Chromium can start; a browser blocked by the execution environment cannot establish print-layout correctness.
