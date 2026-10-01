import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { bingReportLines, latestBingCrawl, parseBingDate, summarizeBingFeeds, summarizeBingTraffic } from './bing-reporting';
import { gscCsv, gscReportLines, summarizeGsc, summarizeGscCsv, unavailableGsc } from './gsc-reporting';
import { gscDateRange, metric, parseCsv, safeErrorCode, toCsv } from './reporting-utils';

const root = path.resolve(import.meta.dirname, '../..');
const wcf = (date: string) => `/Date(${Date.parse(`${date}T00:00:00Z`)})/`;

function gscFixture() {
  return {
    ...gscDateRange(new Date('2026-09-30T16:00:00Z')),
    datasets: {
      totals: summarizeGsc([{ impressions: 12, clicks: 1 }], [], 'byProperty'),
      pages: summarizeGsc([{ impressions: 12, clicks: 1 }], ['page'], 'byPage'),
      queries: summarizeGsc([], ['query']), pageQuery: summarizeGsc([], ['page', 'query']),
    },
  };
}

function runScript(script: string, fixture: (cwd: string) => void, env: NodeJS.ProcessEnv = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'qingtoolbox-seo-'));
  try {
    fs.mkdirSync(path.join(cwd, 'reports/daily'), { recursive: true });
    fixture(cwd);
    const preload = path.join(cwd, 'mock-fetch.mjs');
    const result = spawnSync(process.execPath, [
      '--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href,
      ...(fs.existsSync(preload) ? ['--import', pathToFileURL(preload).href] : []),
      path.join(root, 'scripts/seo', script),
    ], { cwd, encoding: 'utf-8', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS_JSON: '', BING_WEBMASTER_API_KEY: '', ...env } });
    assert.equal(result.status, 0, result.stderr);
    return { cwd, result, read: (file: string) => fs.readFileSync(path.join(cwd, 'reports/daily', file), 'utf-8'), cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) };
  } catch (error) {
    fs.rmSync(cwd, { recursive: true, force: true });
    throw error;
  }
}

test('GSC default range is exactly 28 inclusive Pacific calendar days, including DST boundaries', () => {
  const range = gscDateRange(new Date('2026-03-11T01:00:00Z'));
  assert.equal(range.startDate, '2026-02-09');
  assert.equal(range.endDate, '2026-03-08');
  assert.equal(range.days, 28);
  assert.equal(gscDateRange(new Date('2026-09-30T16:00:00Z'), undefined, '2026-08-31').startDate, '2026-08-04');
  assert.equal(gscDateRange(new Date(), '2026-08-01', '2026-08-01').days, 1);
  assert.throws(() => gscDateRange(new Date(), '2026-09-30', '2026-09-01'));
  assert.throws(() => gscDateRange(new Date(), '2026-02-30', '2026-03-01'));
});

test('GSC nonzero page/totals impressions with empty queries never imply no impressions or no indexing', () => {
  const lines = gscReportLines(gscFixture(), 0).join('\n');
  assert.match(lines, /曝光 12 \/ 点击 1/);
  assert.match(lines, /页面-查询维度：请求成功，返回空记录；0 条/);
  assert.match(lines, /不据此推断零曝光/);
  assert.doesNotMatch(lines, /API 已连通但暂无曝光|等 Google 收录|sitemap 格式正常/);
  assert.match(lines, /匿名查询隐藏及 API 内部行数限制/);
  assert.match(lines, /未执行 URL 检查/);
  assert.match(gscReportLines(gscFixture(), 99).join('\n'), /机会数量：0/);
});

test('GSC distinguishes a successful empty dataset, failed/missing data, and numeric zero', () => {
  assert.equal(summarizeGsc([], []).status, 'empty');
  assert.equal(summarizeGsc([], []).impressions, null);
  assert.equal(summarizeGsc([{ impressions: 0, clicks: 0 }], []).impressions, 0);
  assert.equal(summarizeGsc([{ clicks: 0 }], []).impressions, null);
  assert.equal(summarizeGscCsv('status,message\nfetch_failed,redacted\n', []).status, 'fetch_failed');
  assert.equal(summarizeGscCsv(undefined, []).status, 'unavailable');
  assert.equal(summarizeGscCsv('garbage', []).status, 'unavailable');
  const report = gscFixture();
  report.datasets.pageQuery = unavailableGsc(['page', 'query'], 'fetch_failed');
  assert.match(gscReportLines(report, 100).join('\n'), /机会数量：未知/);
});

test('CSV handles commas, escaped quotes, CRLF and embedded query newlines as one record', () => {
  const query = 'comma, "quoted"\r\nnext line';
  const csv = gscCsv([{ keys: ['https://example.com/x?a=1,b=2', query], clicks: 1, impressions: 20, ctr: 0.05, position: 10 }], ['page', 'query']);
  const parsed = parseCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1][1], query);
  assert.equal(summarizeGscCsv(csv, ['page', 'query']).rowCount, 1);
  assert.equal(summarizeGscCsv(csv, ['page', 'query']).impressions, 20);
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"a""b",c\r\n'), [['a', 'b'], ['a"b', 'c']]);
  assert.deepEqual(parseCsv(toCsv([['', 'x,y', 'a\nb']])), [['', 'x,y', 'a\nb']]);
  assert.throws(() => parseCsv('a,b\n"unfinished'));
});

test('Bing chooses newest parsed Date, not API array order; missing latest fields stay unknown', () => {
  const latest = latestBingCrawl([
    { Date: wcf('2026-09-29'), InIndex: 2, CrawledPages: 0 },
    { Date: wcf('2026-09-20'), InIndex: 999, CrawledPages: 100 },
    { Date: 'invalid', InIndex: 1000 },
  ]);
  assert.equal(latest.date, '2026-09-29');
  assert.equal(latest.inIndex, 2);
  assert.equal(latest.crawledPages, 0);
  assert.equal(latest.crawlErrors, null);
  assert.equal(latest.invalidDateRecords, 1);
  assert.equal(latestBingCrawl([]).inIndex, null);
  assert.equal(latestBingCrawl([{ Date: wcf('2026-09-29') }]).inIndex, null);
  assert.equal(latestBingCrawl([{ Date: 'invalid', InIndex: 0 }]).status, 'unavailable');
});

test('Bing sparse, unordered records use seven calendar days and disclose partial coverage', () => {
  const traffic = summarizeBingTraffic([
    { Date: wcf('2026-09-30'), Impressions: 10, Clicks: 1 },
    { Date: wcf('2026-09-23'), Impressions: 999, Clicks: 99 },
    { Date: wcf('2026-09-24'), Impressions: 5, Clicks: 0 },
    { Date: wcf('2026-09-26'), Impressions: 2, Clicks: 0 },
  ]);
  assert.equal(traffic.startDate, '2026-09-24');
  assert.equal(traffic.endDate, '2026-09-30');
  assert.equal(traffic.coverage.observedDays, 3);
  assert.equal(traffic.coverage.windowRecords, 3);
  assert.equal(traffic.observedImpressions, 17);
  assert.equal(traffic.impressions, null);
  assert.equal(traffic.status, 'partial');
  assert.deepEqual(traffic.coverage.missingDates, ['2026-09-25', '2026-09-27', '2026-09-28', '2026-09-29']);
});

test('Bing complete seven-day window may be zero; absent or missing data cannot', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ Date: wcf(`2026-09-${24 + i}`), Impressions: 0, Clicks: 0 }));
  assert.equal(summarizeBingTraffic(rows).impressions, 0);
  assert.equal(summarizeBingTraffic(rows).status, 'ok');
  assert.equal(summarizeBingTraffic([]).impressions, null);
  assert.equal(summarizeBingTraffic([]).status, 'empty');
  const missing = summarizeBingTraffic([...rows.slice(1), { Date: rows[0].Date, Clicks: 0 }]);
  assert.equal(missing.impressions, null);
  assert.equal(missing.clicks, 0);
  assert.equal(missing.coverage.missingImpressionValues, 1);
  const duplicate = summarizeBingTraffic([...rows, rows[0]]);
  assert.equal(duplicate.impressions, null);
  assert.equal(duplicate.observedImpressions, null);
});

test('Bing dates preserve API calendar offset and reject invalid dates safely', () => {
  assert.equal(parseBingDate('/Date(1316156400000-0700)/')?.date, '2011-09-16');
  assert.equal(parseBingDate(`/Date(${Date.parse('2026-09-30T01:00:00Z')}-0700)/`)?.date, '2026-09-29');
  assert.equal(parseBingDate('2026-09-30T00:00:00+08:00')?.date, '2026-09-30');
  assert.equal(parseBingDate('2026-02-30'), null);
  assert.equal(parseBingDate('/Date(999999999999999999999)/'), null);
  assert.equal(parseBingDate('/Date(1316156400000+9999)/'), null);
});

test('Bing feed counts remain raw and never produce discovered-page/indexing recommendations', () => {
  const sitemaps = summarizeBingFeeds([{ Url: 'https://example.com/sitemap-index.xml', UrlCount: 1 }, { Url: 'https://example.com/feed' }]);
  assert.equal(sitemaps[0].rawUrlCount, 1);
  assert.equal(sitemaps[1].rawUrlCount, null);
  const report = bingReportLines({ schemaVersion: 2, status: 'ok', sitemaps, index: latestBingCrawl([{ Date: wcf('2026-09-29'), InIndex: 0 }]), traffic7d: summarizeBingTraffic([]) }).join('\n');
  assert.match(report, /原始 UrlCount 1/);
  assert.match(report, /页面 URL 发现量及子地图内容：未知/);
  assert.doesNotMatch(report, /Sitemap 发现 URL：|子地图\/收录几乎为空|补交|近 7 天抓取页数/);
  assert.match(report, /索引页数（该快照 InIndex）：0/);
  assert.match(report, /CrawledPages，非 7 天合计）：未知/);
});

test('error reporting allowlists codes and never echoes secrets from errors or old Bing messages', () => {
  const secret = 'credential-secret-do-not-log';
  assert.equal(safeErrorCode(new Error(`https://api?apikey=${secret}`)), 'request_failed');
  assert.equal(safeErrorCode({ code: secret, message: secret, config: { headers: { Authorization: secret } } }), 'request_failed');
  assert.equal(safeErrorCode({ response: { status: 403 }, message: secret }), 'http_403');
  assert.equal(safeErrorCode({ code: 'ECONNRESET', message: secret }), 'ECONNRESET');
  assert.doesNotMatch(bingReportLines({ status: 'fetch_failed', message: secret }).join('\n'), /credential-secret/);
  assert.equal(metric(null), null);
  assert.equal(metric(''), null);
  assert.equal(metric(Number.NaN), null);
});

test('daily report reads CSV fallback without fabricating date or no-impression conclusions', () => {
  const run = runScript('daily-report.ts', (cwd) => {
    const dir = path.join(cwd, 'reports/daily');
    fs.writeFileSync(path.join(dir, 'gsc-pages.csv'), gscCsv([{ keys: ['https://example.com/'], impressions: 12, clicks: 1 }], ['page']));
    fs.writeFileSync(path.join(dir, 'gsc-page-query.csv'), gscCsv([], ['page', 'query']));
    fs.writeFileSync(path.join(dir, 'opportunities.json'), JSON.stringify([{ query: 'stale-opportunity', page: '/', impressions: 999, position: 12, score: 100 }]));
  });
  try {
    const report = run.read('latest-report.md');
    assert.match(report, /返回行曝光合计 12/);
    assert.match(report, /旧导出未记录日期/);
    assert.match(report, /机会数量：0/);
    assert.doesNotMatch(report, /stale-opportunity/);
    assert.doesNotMatch(report, /API 已连通但暂无曝光|等 Google 收录/);
  } finally { run.cleanup(); }
});

test('analyzer preserves quoted, multiline queries when scoring CSV', () => {
  const query = 'query, "quoted"\nsecond line';
  const run = runScript('analyze-gsc.ts', (cwd) => {
    fs.writeFileSync(path.join(cwd, 'reports/daily/gsc-page-query.csv'), gscCsv([
      { keys: ['https://example.com/', query], impressions: 600, clicks: 0, ctr: 0, position: 12 },
    ], ['page', 'query']));
  });
  try {
    const opportunities = JSON.parse(run.read('opportunities.json'));
    assert.equal(opportunities.length, 1);
    assert.equal(opportunities[0].query, query);
    assert.equal(opportunities[0].impressions, 600);
  } finally { run.cleanup(); }
});

test('credential-free GSC run overwrites stale latest files with unavailable status', () => {
  const run = runScript('fetch-gsc.ts', (cwd) => {
    fs.writeFileSync(path.join(cwd, 'reports/daily/latest-gsc-pages.csv'), 'stale');
  });
  try {
    assert.match(run.read('latest-gsc-pages.csv'), /skipped,no_credentials/);
    assert.equal(JSON.parse(run.read('gsc-summary.json')).datasets.totals.status, 'skipped');
    assert.equal(JSON.parse(run.read('gsc-summary.json')).days, 28);
  } finally { run.cleanup(); }
});

test('Bing fetch reports unordered data and sparse coverage end-to-end without live API requests', () => {
  const run = runScript('fetch-bing.ts', (cwd) => {
    const responses = {
      GetFeeds: [{ Url: 'https://example.com/sitemap-index.xml', UrlCount: 1 }],
      GetCrawlStats: [{ Date: wcf('2026-09-30'), InIndex: 0 }, { Date: wcf('2026-09-01'), InIndex: 500 }],
      GetRankAndTrafficStats: [{ Date: wcf('2026-09-30'), Impressions: 20, Clicks: 0 }, { Date: wcf('2026-09-01'), Impressions: 500, Clicks: 10 }],
      GetQueryStats: [], GetPageStats: [],
    };
    fs.writeFileSync(path.join(cwd, 'mock-fetch.mjs'), `const data = ${JSON.stringify(responses)}; globalThis.fetch = async url => new Response(JSON.stringify({ d: data[new URL(url).pathname.split('/').at(-1)] }));`);
  }, { BING_WEBMASTER_API_KEY: 'test-key-only' });
  try {
    const data = JSON.parse(run.read('bing-stats.json'));
    assert.equal(data.index.date, '2026-09-30');
    assert.equal(data.index.inIndex, 0);
    assert.equal(data.index.crawledPages, null);
    assert.equal(data.traffic7d.observedImpressions, 20);
    assert.equal(data.traffic7d.impressions, null);
    assert.equal(data.sitemaps[0].rawUrlCount, 1);
  } finally { run.cleanup(); }
});

test('Bing API error and malformed GSC credential errors never persist secret contents', () => {
  const secret = 'private-test-secret-do-not-log';
  const bing = runScript('fetch-bing.ts', (cwd) => {
    fs.writeFileSync(path.join(cwd, 'mock-fetch.mjs'), `globalThis.fetch = async () => new Response(JSON.stringify({ ErrorCode: 1, Message: 'https://example.com/?apikey=${secret}' }));`);
  }, { BING_WEBMASTER_API_KEY: secret });
  try {
    assert.equal(JSON.parse(bing.read('bing-stats.json')).status, 'fetch_failed');
    assert.ok(!(bing.read('bing-stats.json') + bing.result.stdout + bing.result.stderr).includes(secret));
  } finally { bing.cleanup(); }
  const gsc = runScript('fetch-gsc.ts', () => {}, { GOOGLE_APPLICATION_CREDENTIALS_JSON: `{"private_key": "${secret}" invalid` });
  try {
    assert.equal(JSON.parse(gsc.read('gsc-summary.json')).datasets.pages.status, 'fetch_failed');
    assert.ok(!(gsc.read('gsc-summary.json') + gsc.read('gsc-pages.csv') + gsc.result.stdout + gsc.result.stderr).includes(secret));
  } finally { gsc.cleanup(); }
});
