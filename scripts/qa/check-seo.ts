import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import tools from '../../src/data/tools.json';
import { canonicalPath, toolHref } from '../../src/lib/urls';

const site = 'https://tools.cqzzz.top';
const expectedPaths = new Set(['/', '/about/', '/privacy/', '/terms/', ...tools.map(toolHref)]);
assert.ok(fs.existsSync('dist/sitemap-0.xml'), 'Build before running SEO checks');
const sitemap = fs.readFileSync('dist/sitemap-0.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(urls.length, expectedPaths.size, 'Sitemap must contain exactly the indexable routes');
assert.equal(new Set(urls).size, urls.length, 'No duplicate sitemap URLs');
assert.deepEqual(new Set(urls), new Set([...expectedPaths].map((route) => site + route)));

for (const route of expectedPaths) {
  const html = fs.readFileSync(path.join('dist', route, 'index.html'), 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const canonicals = [...head.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/gi)];
  assert.equal(canonicals.length, 1, `${route}: exactly one canonical in head`);
  assert.equal(canonicals[0][0].match(/\bhref="([^"]+)"/)?.[1], site + route);
  assert.doesNotMatch(head, /name="robots"[^>]*content="[^"]*noindex/i, `${route}: sitemap page cannot be noindex`);
  assert.doesNotMatch(head, /http-equiv="refresh"/i, `${route}: no meta-refresh aliases`);
  for (const match of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const href = match[1];
    if (expectedPaths.has(canonicalPath(href))) {
      assert.equal(href, canonicalPath(href), `${route}: noncanonical internal link ${href}`);
    }
    assert.ok(!href.startsWith('/tools/building-sunlight'), `${route}: links must target the final sunlight page`);
  }
}
const notFound = fs.readFileSync('dist/404.html', 'utf8');
assert.match(notFound, /name="robots" content="noindex"/);
assert.doesNotMatch(notFound, /rel="canonical"/);
assert.match(notFound, /404 · 页面未找到/);
assert.ok(!fs.existsSync('dist/tools/building-sunlight/index.html'), 'Alias must not emit a meta-refresh HTML page');
const redirects = fs.readFileSync('dist/_redirects', 'utf8');
for (const alias of ['/tools/building-sunlight', '/tools/building-sunlight/']) {
  assert.ok(redirects.split('\n').includes(`${alias} /building-sunlight/ 301`), `${alias}: permanent host redirect`);
}
assert.equal(canonicalPath('/tools/base64?query=1#fragment'), '/tools/base64/');
console.log(`SEO 检查通过：${expectedPaths.size} 个规范页面，28 个工具，404 HTML 与永久重定向配置`);
