import fs from 'fs';
import path from 'path';
import { gscReportLines, summarizeGscCsv, type GscReport } from './gsc-reporting';
import { bingReportLines } from './bing-reporting';

const today = new Date().toISOString().slice(0, 10);
const REPORT_DIR = 'reports/daily';
const WEEKLY_DIR = 'reports/weekly';

function toolCount() {
  const f = 'src/data/tools.json';
  if (!fs.existsSync(f)) return 0;
  return JSON.parse(fs.readFileSync(f, 'utf-8')).length;
}

function keywordHintsLines() {
  const f = path.join(REPORT_DIR, 'keyword-hints.json');
  if (!fs.existsSync(f)) return [];
  const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
  const lines = [
    '',
    '## 关键词灵感',
    '',
    `> 来源：Google / Bing / 百度搜索联想 · 更新：${String(data.generatedAt || '').slice(0, 10) || '未知'}`,
    '',
    '### 高频联想词',
    '',
  ];
  if ((data.topSuggestions || []).length) {
    for (const s of data.topSuggestions.slice(0, 12)) {
      lines.push(`- **${s.query}**（${s.hits} 个引擎出现）`);
    }
  } else {
    lines.push('- 暂无数据');
  }
  lines.push('');
  lines.push('### 按工具');
  lines.push('');
  for (const h of (data.hints || []).slice(0, 8)) {
    const merged = [...new Set([...(h.baidu || []), ...(h.google || []), ...(h.bing || [])])].slice(0, 4);
    lines.push(`- **${h.name}**（种子：${h.seed}）→ ${merged.join('、') || '无'}`);
  }
  return lines;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(WEEKLY_DIR, { recursive: true });

  const oppFile = path.join(REPORT_DIR, 'opportunities.json');
  let opportunities: any[] = [];
  if (fs.existsSync(oppFile)) {
    opportunities = JSON.parse(fs.readFileSync(oppFile, 'utf-8'));
  }

  const lines = [
    `# SEO 日报 ${today}`,
    '',
    `> 站点：tools.cqzzz.top（轻工具箱）`,
    `> 生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '## 数据状态',
    '',
  ];

  const readText = (file: string) => {
    const filePath = path.join(REPORT_DIR, file);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : undefined;
  };
  const readJson = (file: string) => {
    try {
      const content = readText(file);
      return content ? JSON.parse(content) : null;
    } catch { return null; }
  };
  const savedGsc = readJson('gsc-summary.json');
  const gsc: Pick<GscReport, 'datasets' | 'startDate' | 'endDate' | 'days' | 'timeZone'> =
    savedGsc?.schemaVersion === 1 && savedGsc.datasets ? savedGsc : {
      startDate: null, endDate: null, days: null, timeZone: 'America/Los_Angeles',
      datasets: {
        totals: summarizeGscCsv(readText('gsc-totals.csv'), []),
        pages: summarizeGscCsv(readText('gsc-pages.csv'), ['page']),
        queries: summarizeGscCsv(readText('gsc-queries.csv'), ['query']),
        pageQuery: summarizeGscCsv(readText('gsc-page-query.csv'), ['page', 'query']),
      },
    };
  lines.push(...gscReportLines(gsc, opportunities.length));
  if (gsc.datasets.pageQuery.status !== 'ok') opportunities = [];
  lines.push('', '## Top 10 机会', '');
  if (gsc.datasets.pageQuery.status === 'ok' && opportunities.length) {
    for (const o of opportunities.slice(0, 10)) {
      lines.push(`- **${o.query || o.page}** | 曝光 ${o.impressions} | 排名 ${o.position?.toFixed(1)} | 分数 ${o.score}`);
    }
  } else {
    lines.push('- 本次可用明细中没有可展示的机会；不代表站点没有曝光或未收录。');
  }

  lines.push('', '## Bing 数据', '');
  lines.push(...bingReportLines(readJson('bing-stats.json')));

  lines.push(...keywordHintsLines());

  lines.push('');
  lines.push('## 站点健康');
  lines.push('');
  lines.push(`- 工具页：${toolCount()} 个已上线`);
  lines.push('- 构建状态：见 GitHub Actions CI');

  const reportPath = path.join(REPORT_DIR, `${today}-report.md`);
  fs.writeFileSync(reportPath, lines.join('\n'));
  fs.writeFileSync(path.join(REPORT_DIR, 'latest-report.md'), lines.join('\n'));

  // 周一额外生成周报
  if (new Date().getDay() == 1) {
    const weeklyPath = path.join(WEEKLY_DIR, `${today}-growth-plan.md`);
    const weekly = [
      `# 增长周报 ${today}`,
      '',
      '## 本周自动建议',
      '',
      ...(opportunities.length
        ? opportunities.slice(0, 5).map((o, i) =>
          `${i + 1}. 优化 \`${o.page}\` 针对关键词「${o.query || '未知'}」`,
        )
        : ['1. 暂无 GSC 机会数据，优先参考下方关键词灵感优化 title / meta']),
      '',
      ...keywordHintsLines().slice(1),
      '',
      '## 待执行（Agent 自动）',
      '',
      '- [ ] 优化 Top 3 页面的 title / meta',
      '- [ ] 补充内链',
      '- [ ] 技术 SEO 巡检',
      '',
    ].join('\n');
    fs.writeFileSync(weeklyPath, weekly);
  }

  console.log(`日报已生成：${reportPath}`);
}

main();
