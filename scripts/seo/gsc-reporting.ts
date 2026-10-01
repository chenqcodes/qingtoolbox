import { dataStatusText, metric, metricText, parseCsv, toCsv, type DataStatus } from './reporting-utils';

export type GscApiRow = {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
};

export type GscDataset = {
  status: DataStatus;
  dimensions: string[];
  rowCount: number | null;
  clicks: number | null;
  impressions: number | null;
  aggregationType?: string | null;
  paginationComplete?: boolean;
  dimensionLimited: boolean;
  errorCode?: string;
};

export type GscReport = {
  schemaVersion: 1;
  fetchedAt: string;
  siteUrl: string;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  timeZone: string;
  searchType: 'web';
  dataState: 'final';
  datasets: Record<'totals' | 'pages' | 'queries' | 'pageQuery', GscDataset>;
};

export function summarizeGsc(rows: GscApiRow[], dimensions: string[], aggregationType?: string | null): GscDataset {
  const sum = (key: 'clicks' | 'impressions') => {
    const values = rows.map((row) => metric(row[key]));
    return values.length && values.every((value) => value !== null)
      ? (values as number[]).reduce((total, value) => total + value, 0) : null;
  };
  return {
    status: rows.length ? 'ok' : 'empty', dimensions, rowCount: rows.length,
    clicks: sum('clicks'), impressions: sum('impressions'), aggregationType,
    paginationComplete: true, dimensionLimited: dimensions.length > 0,
  };
}

export function unavailableGsc(dimensions: string[], status: DataStatus = 'unavailable', errorCode?: string): GscDataset {
  return { status, dimensions, rowCount: null, clicks: null, impressions: null, dimensionLimited: dimensions.length > 0, errorCode };
}

export function gscCsv(rows: GscApiRow[], dimensions: string[]): string {
  return toCsv([
    [...dimensions, 'clicks', 'impressions', 'ctr', 'position'],
    ...rows.map((row) => [
      ...dimensions.map((_, i) => row.keys?.[i] ?? ''),
      row.clicks, row.impressions, row.ctr, row.position,
    ]),
  ]);
}

// Allows old CSV-only exports to remain readable, without inventing their dates.
export function summarizeGscCsv(text: string | undefined, dimensions: string[]): GscDataset {
  if (!text) return unavailableGsc(dimensions);
  try {
    const [header, ...records] = parseCsv(text);
    if (!header) return unavailableGsc(dimensions);
    if (header[0] === 'status') {
      const status = records[0]?.[0];
      return unavailableGsc(dimensions, status === 'skipped' || status === 'fetch_failed' ? status : 'unavailable');
    }
    const expected = [...dimensions, 'clicks', 'impressions', 'ctr', 'position'];
    if (header.join(',') !== expected.join(',') || records.some((row) => row.length !== header.length)) {
      return unavailableGsc(dimensions);
    }
    const number = (value: string | undefined) => value?.trim() ? metric(Number(value)) : null;
    const rows = records.map((row) => ({
      clicks: number(row[dimensions.length]), impressions: number(row[dimensions.length + 1]),
    }));
    return { ...summarizeGsc(rows, dimensions), paginationComplete: undefined };
  } catch {
    return unavailableGsc(dimensions);
  }
}

export function gscReportLines(report: Pick<GscReport, 'datasets' | 'startDate' | 'endDate' | 'days' | 'timeZone'>, opportunityCount: number): string[] {
  const { totals, pages, queries, pageQuery } = report.datasets;
  const lines = [
    `- GSC 日期：${report.startDate && report.endDate ? `${report.startDate} ~ ${report.endDate}（首尾包含，共 ${report.days} 天；${report.timeZone}）` : '未知（旧导出未记录日期）'}`,
    '- GSC 范围：web 搜索；final 已定稿数据（最新日期仍可能有延迟）',
    `- 站点未分组总量（byProperty）：${dataStatusText[totals.status]}；曝光 ${metricText(totals.impressions)} / 点击 ${metricText(totals.clicks)}`,
    `- 页面维度：${dataStatusText[pages.status]}；${pages.rowCount ?? '未知'} 条；返回行曝光合计 ${metricText(pages.impressions)} / 点击合计 ${metricText(pages.clicks)}`,
    `- 查询维度：${dataStatusText[queries.status]}；${queries.rowCount ?? '未知'} 条`,
    `- 页面-查询维度：${dataStatusText[pageQuery.status]}；${pageQuery.rowCount ?? '未知'} 条`,
    '- 口径：页面合计与站点总量聚合方式不同，不应直接相加或视为同一总量。维度明细受匿名查询隐藏及 API 内部行数限制影响；分页结束也不保证全量。',
    '- 收录状态：本报表未执行 URL 检查；搜索表现或空明细不能证明页面未收录，也不能验证 sitemap。',
  ];
  if (pageQuery.status === 'empty') {
    lines.push('- 页面-查询本期无返回记录；请以页面维度及未分组总量判断已报告的曝光，不据此推断零曝光。');
  }
  if ([totals, pages, queries, pageQuery].some((dataset) => dataset.status === 'fetch_failed')) {
    lines.push('- 部分 GSC 请求失败，原因尚未确定；失败数据未按零值处理。');
  }
  const hasOpportunityInput = pageQuery.status === 'ok' || pageQuery.status === 'empty';
  lines.push(`- 机会数量：${hasOpportunityInput ? `${pageQuery.status === 'empty' ? 0 : opportunityCount}（仅基于本次返回的页面-查询明细及评分阈值）` : '未知（页面-查询数据不可用）'}`);
  return lines;
}
