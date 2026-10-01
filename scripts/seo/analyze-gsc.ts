import fs from 'fs';
import path from 'path';
import { scoreOpportunity, type GscRow } from './score-opportunities';
import { parseCsv as parseCsvRecords } from './reporting-utils';

const REPORT_DIR = 'reports/daily';

function parseCsv(file: string): GscRow[] {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf-8');
  let records: string[][];
  try { records = parseCsvRecords(text); }
  catch { return []; }
  const [header, ...lines] = records;
  if (!header || header[0] === 'status') return [];
  const pageIndex = header.indexOf('page');
  const queryIndex = header.indexOf('query');
  const metricNames = ['clicks', 'impressions', 'ctr', 'position'] as const;
  if (pageIndex < 0 || metricNames.some((key) => !header.includes(key))) return [];
  return lines.map((parts): GscRow | null => {
    if (parts.length !== header.length) return null;
    const values = metricNames.map((key) => parts[header.indexOf(key)]);
    if (values.some((value) => !value?.trim() || !Number.isFinite(Number(value)))) return null;
    return {
      page: parts[pageIndex],
      query: queryIndex >= 0 ? parts[queryIndex] : undefined,
      clicks: Number(values[0]), impressions: Number(values[1]),
      ctr: Number(values[2]), position: Number(values[3]),
    };
  }).filter((row): row is GscRow => row !== null);
}

async function main() {
  const pqFile = path.join(REPORT_DIR, 'gsc-page-query.csv');
  const rows = parseCsv(pqFile);

  const scored = rows
    .map((r) => ({ ...r, score: scoreOpportunity(r) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, 'opportunities.json'),
    JSON.stringify(scored, null, 2),
  );

  console.log(`分析完成，发现 ${scored.length} 个机会`);
}

main();
