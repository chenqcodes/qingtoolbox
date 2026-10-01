# Target image compression and A4 Chinese worksheets

## Local checks

Use the repository Node version (CI uses Node 24):

```sh
npm ci
npm run lint
npm run test:seo
npm run test:tools
npm run build
npm run qa:metadata
npm run qa:seo
npm run check:labs
npx playwright install --with-deps chromium
npm run test:browser
```

The browser suite runs against the production build on 127.0.0.1:4173. It covers
measured JPEG bytes, PNG target failure at fixed dimensions, aspect-fit dimensions,
batch ZIP downloads, stale-result invalidation, mobile page width, editable
per-occurrence pinyin, answer-free dictation, empty/over-limit input, fragment-only
transfer, browser-print invocation, A4 dimensions, and actual PDF page count.
Screenshots and an A4 PDF are uploaded as CI artifacts for seven days. Tests use
synthetic images and example characters; no personal files or text are uploaded.

## Product limits

- A size target is measured in 1024-byte KB. Width/height are maximum bounds, not
  a crop or a promise of exact width and height. The aspect ratio is preserved and
  source images are never enlarged. Disable automatic shrinking when computed
  pixel dimensions must remain fixed.
- JPEG uses a white background for transparent pixels. PNG does not support
  quality reduction. Animation is flattened. Output explicitly reports failure
  when the requested byte limit cannot be met. Check the destination's rules:
  byte size and dimensions do not establish portrait/content eligibility.
- Worksheets support up to 60 character occurrences, one to three rows each,
  ten 18 mm cells per row and eight rows per A4 page. Review automatic readings,
  especially polyphonic characters, before printing. Custom readings are local
  to the current page. System Chinese fonts determine glyph appearance; missing
  rare glyphs may require a suitable font installed on the printing device.
- Print at A4 portrait / 100% and disable browser headers and footers. Browser
  and printer margins/settings may differ. On mobile, availability of save-PDF
  depends on the browser's print/share support.
- Image data, worksheet inputs and generated files stay in the browser. No new
  backend, tracking, or paid service is introduced.
