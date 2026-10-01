import fs from 'fs';
import path from 'path';
import { latestBingCrawl, summarizeBingFeeds, summarizeBingTraffic, type BingCrawl, type BingFeed, type BingTraffic } from './bing-reporting';
import { metric, safeErrorCode } from './reporting-utils';

const REPORT_DIR = 'reports/daily';
const API_KEY = process.env.BING_WEBMASTER_API_KEY;
const SITE_URL = process.env.BING_SITE_URL || 'https://tools.cqzzz.top/';
const API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

async function bingGet<T>(method: string): Promise<T[]> {
  const query = new URLSearchParams({ apikey: API_KEY!, siteUrl: SITE_URL });
  const response = await fetch(`${API_BASE}/${method}?${query}`);
  if (!response.ok) throw Object.assign(new Error('bing_http_error'), { status: response.status });
  const json = await response.json();
  // Do not reuse Bing's Message field: it may contain the API key/request URL.
  if (json.ErrorCode || !Array.isArray(json.d)) throw new Error('bing_invalid_response');
  return json.d as T[];
}

function writeStats(stats: object) {
  fs.writeFileSync(path.join(REPORT_DIR, 'bing-stats.json'), JSON.stringify({
    schemaVersion: 2, siteUrl: SITE_URL, fetchedAt: new Date().toISOString(), ...stats,
  }, null, 2));
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  if (!API_KEY) {
    writeStats({ status: 'skipped', errorCode: 'no_api_key' });
    console.log('[skip] 未配置 BING_WEBMASTER_API_KEY');
    return;
  }
  try {
    const [feeds, crawlStats, trafficStats, queryStats, pageStats] = await Promise.all([
      bingGet<BingFeed>('GetFeeds'), bingGet<BingCrawl>('GetCrawlStats'),
      bingGet<BingTraffic>('GetRankAndTrafficStats'),
      bingGet<{ Query?: string; Impressions?: number; Clicks?: number }>('GetQueryStats'),
      bingGet<{ Url?: string; Impressions?: number; Clicks?: number }>('GetPageStats'),
    ]);
    writeStats({
      status: 'ok',
      sitemaps: summarizeBingFeeds(feeds),
      index: latestBingCrawl(crawlStats),
      traffic7d: summarizeBingTraffic(trafficStats),
      topQueries: queryStats.slice(0, 5).map((query) => ({
        query: query.Query, impressions: metric(query.Impressions), clicks: metric(query.Clicks),
      })),
      topPages: pageStats.slice(0, 5).map((page) => ({
        url: page.Url, impressions: metric(page.Impressions), clicks: metric(page.Clicks),
      })),
    });
    console.log('Bing 数据已导出；日期、覆盖情况及未知指标见 bing-stats.json');
  } catch (error) {
    const errorCode = safeErrorCode(error);
    console.warn(`[warn] Bing 拉取失败: ${errorCode}`);
    writeStats({ status: 'fetch_failed', errorCode });
  }
}

main().catch((error) => {
  console.error(`[warn] Bing 导出文件写入失败: ${safeErrorCode(error)}`);
  process.exitCode = 1;
});
