export type DataStatus = 'ok' | 'empty' | 'skipped' | 'fetch_failed' | 'unavailable';

export function metric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function metricText(value: unknown): string {
  return metric(value)?.toString() ?? '未知';
}

// Never persist arbitrary exception messages: HTTP errors can contain request URLs,
// API keys, service-account JSON, or authorization headers.
export function safeErrorCode(error: unknown): string {
  const e = error as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const status = e?.response?.status ?? e?.status ?? e?.code;
  if ((typeof status === 'number' || typeof status === 'string') && /^[45]\d{2}$/.test(String(status))) {
    return `http_${status}`;
  }
  const allowed = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ERR_STREAM_PREMATURE_CLOSE'];
  return typeof e?.code === 'string' && allowed.includes(e.code) ? e.code : 'request_failed';
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function offsetDate(value: string, days: number): string {
  if (!validDate(value)) throw new Error('invalid_date');
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function gscDateRange(now = new Date(), startOverride?: string, endOverride?: string) {
  // Search Console dates are inclusive and interpreted in Pacific time.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const endDate = endOverride || offsetDate(today, -2);
  const startDate = startOverride || offsetDate(endDate, -27);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error('invalid_date_range');
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
  return { startDate, endDate, days, timeZone: 'America/Los_Angeles' as const };
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n') + '\n';
}

// RFC 4180-style records, including commas, escaped quotes and embedded newlines.
// Split-on-newline counting is incorrect for query text containing a newline.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  const finishField = () => { row.push(field); field = ''; closedQuote = false; };
  const finishRow = () => { finishField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (char === ',') finishField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (char === '"' && field === '' && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error('invalid_csv');
      field += char;
    }
  }
  if (quoted) throw new Error('invalid_csv');
  if (field !== '' || row.length || closedQuote) finishRow();
  return rows;
}

export const dataStatusText: Record<DataStatus, string> = {
  ok: '已返回数据', empty: '请求成功，返回空记录', skipped: '未配置凭证，已跳过',
  fetch_failed: '拉取失败（数据不可用）', unavailable: '数据不可用',
};
