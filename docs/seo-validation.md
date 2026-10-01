# SEO reporting and static routing checks

## Local checks

Use Node 24 (as CI does), then:

```sh
npm ci
npm run lint
npm run test:seo
npm run build
npm run qa:metadata
npm run qa:seo
npm run check:labs
```

`qa:seo` validates the built sitemap against all tool destinations and informational
pages, one self-canonical in each indexable page's head, canonical internal links,
absence of alias HTML, the top-level noindex `404.html`, and permanent redirect rules.
It is a build-artifact check, not proof of deployed HTTP behavior.

## Cloudflare Pages routing

This repository deploys `dist` using `.github/workflows/deploy.yml`.
Cloudflare Pages treats builds without a top-level `404.html` as single-page
applications and serves the homepage for unknown paths. `src/pages/404.astro`
produces that required file. Do not replace it with a `/* /index.html 200` rewrite.

`public/_redirects` implements the legacy sunlight aliases as HTTP 301s. The old
Astro redirect page was removed so no timed meta-refresh HTML is built or indexed.
The destination is `/building-sunlight/`. Static Astro preview does not process
Cloudflare `_redirects`; use `wrangler pages dev dist` for local host emulation.

References:
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/redirects/

After a separately authorized deployment, verify without following redirects:

```sh
curl -sS -o /dev/null -D - https://tools.cqzzz.top/__seo_probe_missing_20260930
curl -sS -o /dev/null -D - https://tools.cqzzz.top/tools/building-sunlight
curl -sS -o /dev/null -D - https://tools.cqzzz.top/tools/building-sunlight/
curl -sS -o /dev/null -D - https://tools.cqzzz.top/building-sunlight/
```

Expected: unknown route 404; both aliases 301 with `Location: /building-sunlight/`
(or its absolute equivalent); destination 200. Also check a missing nested tool URL,
canonical tags, and the sitemap on the deployed host. Dashboard-level redirects,
Workers, or custom caches can override repository behavior and need separate review
if live results differ. Do not submit a sitemap or deploy as part of local validation.

## Interpretation limits

GSC search analytics is not an index-coverage report. Query-dimensional rows can
be suppressed or absent even when page/property impressions exist. Empty rows do
not establish that the site is unindexed. Dimension sums and ungrouped property
totals are different aggregations and should not be treated as interchangeable.
Bing feed counts likewise do not establish discovered or indexed page counts.
These technical fixes do not establish the cause of low search impressions.
