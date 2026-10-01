import { metric, metricText, offsetDate, validDate } from './reporting-utils';

export type BingCrawl = { Date?: string; InIndex?: number; CrawledPages?: number; CrawlErrors?: number };
export type BingTraffic = { Date?: string; Impressions?: number; Clicks?: number };
export type BingFeed = { Url?: string; Type?: string; Status?: string; UrlCount?: number; LastCrawled?: string };

// WCF timestamps are UTC milliseconds, with an optional original UTC offset.
// Preserve the API's calendar date for day windows; sort snapshots by the instant.
export function parseBingDate(raw: unknown): { timestamp: number; date: string } | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^\/Date\((-?\d+)([+-]\d{4})?\)\/$/);
  if (match) {
    const timestamp = Number(match[1]);
    let offset = 0;
    if (match[2]) {
      const hours = Number(match[2].slice(1, 3));
      const minutes = Number(match[2].slice(3, 5));
      if (hours > 23 || minutes > 59) return null;
      offset = (hours * 60 + minutes) * (match[2][0] === '-' ? -1 : 1);
    }
    const date = new Date(timestamp + offset * 60_000);
    return Number.isFinite(timestamp) && Number.isFinite(date.getTime())
      ? { timestamp, date: date.toISOString().slice(0, 10) } : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw) || !validDate(raw.slice(0, 10))) return null;
  const timestamp = Date.parse(raw.includes('T') && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? `${raw}Z` : raw);
  return Number.isFinite(timestamp) ? { timestamp, date: raw.slice(0, 10) } : null;
}

function datedRows<T extends { Date?: string }>(rows: T[]) {
  return rows.flatMap((row) => {
    const date = parseBingDate(row.Date);
    return date ? [{ row, ...date }] : [];
  }).sort((a, b) => a.timestamp - b.timestamp);
}

export function latestBingCrawl(rows: BingCrawl[]) {
  const sorted = datedRows(rows);
  const latest = sorted.at(-1);
  return {
    status: latest ? 'ok' : rows.length ? 'unavailable' : 'empty',
    date: latest?.date ?? null,
    inIndex: metric(latest?.row.InIndex),
    crawledPages: metric(latest?.row.CrawledPages),
    crawlErrors: metric(latest?.row.CrawlErrors),
    returnedRecords: rows.length,
    invalidDateRecords: rows.length - sorted.length,
  };
}

export function summarizeBingTraffic(rows: BingTraffic[], days = 7) {
  const sorted = datedRows(rows);
  const endDate = sorted.at(-1)?.date ?? null;
  const startDate = endDate ? offsetDate(endDate, -(days - 1)) : null;
  const selected = sorted.filter(({ date }) => startDate && endDate && date >= startDate && date <= endDate);
  const observedDates = [...new Set(selected.map(({ date }) => date))].sort();
  const missingDates = startDate
    ? Array.from({ length: days }, (_, i) => offsetDate(startDate, i)).filter((date) => !observedDates.includes(date))
    : [];
  const duplicates = observedDates.filter((date) => selected.filter((entry) => entry.date === date).length > 1);
  const values = (key: 'Impressions' | 'Clicks') => selected.map(({ row }) => metric(row[key]));
  const summarize = (key: 'Impressions' | 'Clicks') => {
    const raw = values(key);
    const known = raw.filter((value): value is number => value !== null);
    const observed = known.length && !duplicates.length ? known.reduce((sum, value) => sum + value, 0) : null;
    return {
      total: selected.length && !missingDates.length && !duplicates.length && known.length === selected.length ? observed : null,
      observed, missingValues: raw.length - known.length,
    };
  };
  const impressions = summarize('Impressions');
  const clicks = summarize('Clicks');
  return {
    status: !selected.length ? rows.length ? 'unavailable' : 'empty'
      : missingDates.length || duplicates.length || impressions.missingValues || clicks.missingValues ? 'partial' : 'ok',
    startDate, endDate, days,
    anchor: 'latest_returned_date', calendar: 'API date (original offset when supplied; otherwise UTC)',
    impressions: impressions.total, clicks: clicks.total,
    observedImpressions: impressions.observed, observedClicks: clicks.observed,
    coverage: {
      expectedDays: days, observedDays: observedDates.length, observedDates, missingDates,
      returnedRecords: rows.length, windowRecords: selected.length,
      invalidDateRecords: rows.length - sorted.length, duplicateDates: duplicates,
      missingImpressionValues: impressions.missingValues, missingClickValues: clicks.missingValues,
    },
  };
}

export function summarizeBingFeeds(feeds: BingFeed[]) {
  // GetFeeds lists top-level feeds. UrlCount is not proof of discovered page URLs,
  // child-feed contents, sitemap validity, or indexed pages.
  return feeds.map((feed) => ({
    url: feed.Url ?? null, type: feed.Type ?? null, status: feed.Status ?? null,
    rawUrlCount: metric(feed.UrlCount), lastCrawled: parseBingDate(feed.LastCrawled)?.date ?? null,
  }));
}

export function bingReportLines(bing: any): string[] {
  if (!bing) return ['- 未拉取（数据不可用）'];
  if (bing.status === 'fetch_failed') return ['- 拉取失败（数据不可用；未将缺失值记为 0）'];
  if (bing.status === 'skipped') return ['- 未配置（待添加 `BING_WEBMASTER_API_KEY`）'];
  if (bing.status !== 'ok') return ['- 数据不可用'];
  // Older exports used implicit zero defaults and unbounded last-N-row sums.
  if (bing.schemaVersion !== 2) return ['- 旧版 Bing 导出缺少可靠的日期/覆盖信息，请重新拉取；本报表不采用旧版零值及近 7 天推断。'];
  const index = bing.index;
  const traffic = bing.traffic7d;
  const lines = [
    `- 最新抓取快照日期：${index?.date ?? '未知'}；返回记录 ${index?.returnedRecords ?? '未知'} 条`,
    `- 索引页数（该快照 InIndex）：${metricText(index?.inIndex)}`,
    `- 抓取页数（该快照 CrawledPages，非 7 天合计）：${metricText(index?.crawledPages)}`,
    `- 抓取错误（该快照 CrawlErrors）：${metricText(index?.crawlErrors)}`,
  ];
  if (!index?.date) lines.push('- 抓取快照无有效日期记录，索引/抓取指标未知。');
  if (traffic?.startDate && traffic?.endDate) {
    lines.push(`- 流量窗口：${traffic.startDate} ~ ${traffic.endDate}（首尾包含，7 个日历日；以 API 最新返回日期为终点，并非报告日前 7 天）`);
    lines.push(`- 日历口径：API 日期（存在原始时区偏移时保留，否则按 UTC）；覆盖 ${traffic.coverage?.observedDays ?? '未知'} / 7 天，窗口记录 ${traffic.coverage?.windowRecords ?? '未知'} 条`);
    lines.push(`- 完整窗口展示/点击：${metricText(traffic.impressions)} / ${metricText(traffic.clicks)}`);
    lines.push(`- 已返回且数值有效的记录展示/点击小计：${metricText(traffic.observedImpressions)} / ${metricText(traffic.observedClicks)}（缺失日期或字段不补零）`);
    if (traffic.coverage?.missingDates?.length) lines.push(`- 未返回日期：${traffic.coverage.missingDates.join('、')}`);
    if (traffic.coverage?.missingImpressionValues || traffic.coverage?.missingClickValues) {
      lines.push(`- 缺失数值字段：展示 ${traffic.coverage.missingImpressionValues} 条 / 点击 ${traffic.coverage.missingClickValues} 条`);
    }
    if (traffic.coverage?.duplicateDates?.length) lines.push('- 存在重复日期记录，未计算可能重复的流量总量。');
  } else lines.push('- 流量：无有效日期记录，7 日窗口及展示/点击未知。');
  const invalidDates = (index?.invalidDateRecords || 0) + (traffic?.coverage?.invalidDateRecords || 0);
  if (invalidDates) lines.push(`- 已排除日期无效的记录：${invalidDates} 条（抓取与流量合计）`);
  lines.push(`- GetFeeds 顶层 sitemap/feed 记录：${bing.sitemaps?.length ?? '未知'} 条`);
  for (const sitemap of bing.sitemaps || []) {
    lines.push(`  - ${sitemap.url ?? '未知 URL'} | 类型 ${sitemap.type ?? '未知'} | 状态 ${sitemap.status ?? '未知'} | 原始 UrlCount ${metricText(sitemap.rawUrlCount)} | 最后抓取 ${sitemap.lastCrawled ?? '未知'}`);
  }
  lines.push('- Sitemap 页面 URL 发现量及子地图内容：未知。GetFeeds 原始 UrlCount 不作为页面 URL 发现量或收录结论。');
  if (bing.topQueries?.length) {
    lines.push('', '### Bing 返回查询（最多 5 项；未验证排名及时间范围）', '');
    for (const query of bing.topQueries) lines.push(`- **${query.query ?? '未知查询'}** | 展示 ${metricText(query.impressions)} | 点击 ${metricText(query.clicks)}`);
  }
  return lines;
}
