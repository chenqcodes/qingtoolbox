import fs from 'fs';
import path from 'path';
import { gscCsv, summarizeGsc, unavailableGsc, type GscApiRow, type GscReport } from './gsc-reporting';
import { gscDateRange, safeErrorCode, toCsv } from './reporting-utils';

const REPORT_DIR = 'reports/daily';
const SITE_URL = process.env.GSC_SITE_URL || 'https://tools.cqzzz.top/';
const CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const DATASETS = [
  { key: 'totals', file: 'gsc-totals.csv', dimensions: [] },
  { key: 'pages', file: 'gsc-pages.csv', dimensions: ['page'] },
  { key: 'queries', file: 'gsc-queries.csv', dimensions: ['query'] },
  { key: 'pageQuery', file: 'gsc-page-query.csv', dimensions: ['page', 'query'] },
] as const;

function writeCsv(file: string, content: string) {
  fs.writeFileSync(path.join(REPORT_DIR, file), content);
  // Keep latest copies current even on skipped/failed runs, rather than showing stale success.
  fs.writeFileSync(path.join(REPORT_DIR, `latest-${file}`), content);
}

async function withRetry<T>(fn: () => Promise<T>, label: string, max = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (error) {
      const code = safeErrorCode(error);
      const retryable = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ERR_STREAM_PREMATURE_CLOSE', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504'].includes(code);
      if (!retryable || i === max - 1) throw error;
      const delay = 2000 * 2 ** i;
      console.warn(`[retry ${i + 1}/${max - 1}] ${label}: ${code}; ${delay}ms 后重试`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report: GscReport = {
    schemaVersion: 1, siteUrl: SITE_URL, fetchedAt: new Date().toISOString(),
    startDate: null, endDate: null, days: null, timeZone: 'America/Los_Angeles',
    searchType: 'web', dataState: 'final',
    datasets: {
      totals: unavailableGsc([]), pages: unavailableGsc(['page']),
      queries: unavailableGsc(['query']), pageQuery: unavailableGsc(['page', 'query']),
    },
  };
  const writeUnavailable = (status: 'skipped' | 'fetch_failed', code: string) => {
    for (const dataset of DATASETS) {
      report.datasets[dataset.key] = unavailableGsc([...dataset.dimensions], status, code);
      writeCsv(dataset.file, toCsv([['status', 'message'], [status, code]]));
    }
  };
  try {
    Object.assign(report, gscDateRange(new Date(), process.env.START_DATE, process.env.END_DATE));
    if (!CREDENTIALS_JSON) {
      writeUnavailable('skipped', 'no_credentials');
      console.log('[skip] 未配置 GOOGLE_APPLICATION_CREDENTIALS_JSON');
    } else {
      const { google } = await import('googleapis');
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(CREDENTIALS_JSON.replace(/^\uFEFF/, '').trim()),
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
      const searchconsole = google.searchconsole({ version: 'v1', auth });
      for (const dataset of DATASETS) {
        const dimensions = [...dataset.dimensions];
        try {
          const result = await withRetry(async () => {
            const rows: GscApiRow[] = [];
            let aggregationType: string | null | undefined;
            const rowLimit = 25000;
            for (let startRow = 0; ; startRow += rowLimit) {
              const response = await searchconsole.searchanalytics.query({
                siteUrl: SITE_URL,
                requestBody: {
                  startDate: report.startDate!, endDate: report.endDate!, dimensions,
                  type: 'web', dataState: 'final',
                  aggregationType: dimensions.length ? 'auto' : 'byProperty',
                  rowLimit, startRow,
                },
              });
              const batch = response.data.rows || [];
              rows.push(...batch);
              aggregationType = response.data.responseAggregationType;
              // Exhaust the exposed rows; Google still only guarantees its top rows.
              if (batch.length < rowLimit) break;
            }
            return { rows, aggregationType };
          }, dataset.key);
          report.datasets[dataset.key] = summarizeGsc(result.rows, dimensions, result.aggregationType);
          writeCsv(dataset.file, gscCsv(result.rows, dimensions));
        } catch (error) {
          const code = safeErrorCode(error);
          report.datasets[dataset.key] = unavailableGsc(dimensions, 'fetch_failed', code);
          writeCsv(dataset.file, toCsv([['status', 'message'], ['fetch_failed', code]]));
          console.warn(`[warn] GSC ${dataset.key} 拉取失败: ${code}`);
        }
      }
      console.log(`GSC 导出完成（${report.startDate} ~ ${report.endDate}，${report.days} 天；状态见 gsc-summary.json）`);
    }
  } catch (error) {
    const code = safeErrorCode(error);
    writeUnavailable('fetch_failed', code);
    console.warn(`[warn] GSC 初始化失败: ${code}`);
  }
  const content = JSON.stringify(report, null, 2);
  fs.writeFileSync(path.join(REPORT_DIR, 'gsc-summary.json'), content);
  fs.writeFileSync(path.join(REPORT_DIR, 'latest-gsc-summary.json'), content);
}

main().catch((error) => {
  console.error(`[warn] GSC 导出文件写入失败: ${safeErrorCode(error)}`);
  process.exitCode = 1;
});
