import { pinyin } from 'pinyin-pro';

import { MAX_CHARACTERS, MAX_INPUT_LENGTH } from './constants';
export { MAX_CHARACTERS, MAX_INPUT_LENGTH } from './constants';
export const CELLS_PER_ROW = 10;
export const ROWS_PER_PAGE = 8;
export const DEFAULT_TEXT = '春夏秋冬山川日月';
export type WorksheetMode = 'tracing' | 'dictation';
export interface CharacterEntry {
  key: string;
  character: string;
  reading: string;
}
export interface WorksheetOptions {
  mode: WorksheetMode;
  traceCells: number;
  rowsPerCharacter: number;
  showPinyin: boolean;
  title: string;
}
export interface PracticeRow {
  number: number;
  entry: CharacterEntry;
  cells: string[];
  reading: string;
}

const isHanzi = (character: string) => /\p{Script=Han}/u.test(character);

/** Keep occurrences and their phrase context: 银行 and 行走 need different readings. */
export function parseCharacters(text: string): { entries: CharacterEntry[]; error: string; ignored: number } {
  const codePoints = Array.from(text);
  const characters = codePoints.filter(isHanzi);
  const ignored = codePoints.filter((char) => !isHanzi(char) && !/\s/u.test(char)).length;
  if (codePoints.length > MAX_INPUT_LENGTH) {
    return { entries: [], error: `输入过长，请缩短至 ${MAX_INPUT_LENGTH} 个字符以内。`, ignored };
  }
  if (characters.length > MAX_CHARACTERS) {
    return { entries: [], error: `一次最多排版 ${MAX_CHARACTERS} 个汉字（重复字也计数），请分批制作。`, ignored };
  }
  if (!characters.length) return { entries: [], error: '', ignored };

  const readings = pinyin(text, { type: 'all', toneType: 'symbol', nonZh: 'consecutive' });
  const seen = new Map<string, number>();
  const entries: CharacterEntry[] = [];
  for (const item of readings) {
    for (const character of Array.from(item.origin)) {
      if (!isHanzi(character)) continue;
      const occurrence = (seen.get(character) ?? 0) + 1;
      seen.set(character, occurrence);
      entries.push({
        key: `${character}:${occurrence}`,
        character,
        reading: item.isZh && Array.from(item.origin).length === 1 && item.result !== character ? item.result : '',
      });
    }
  }
  return { entries, error: '', ignored };
}

export function normalizeReading(reading: string) {
  return Array.from(reading.replace(/\s+/gu, ' ').trim()).slice(0, 24).join('');
}

export function normalizeOptions(options: WorksheetOptions): WorksheetOptions {
  const boundedInteger = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  return {
    mode: options.mode === 'dictation' ? 'dictation' : 'tracing',
    traceCells: boundedInteger(options.traceCells, 0, CELLS_PER_ROW, 5),
    rowsPerCharacter: boundedInteger(options.rowsPerCharacter, 1, 3, 1),
    showPinyin: Boolean(options.showPinyin),
    title: Array.from(options.title.replace(/\s+/gu, ' ').trim()).slice(0, 30).join('') || '本周生字练习',
  };
}

export function buildPages(entries: CharacterEntry[], rawOptions: WorksheetOptions): PracticeRow[][] {
  const options = normalizeOptions(rawOptions);
  const rows = entries.slice(0, MAX_CHARACTERS).flatMap((entry, index) =>
    Array.from({ length: options.rowsPerCharacter }, () => ({
      number: index + 1,
      entry,
      reading: options.showPinyin ? normalizeReading(entry.reading) : '',
      cells: Array.from({ length: CELLS_PER_ROW }, (_, cell) =>
        options.mode === 'tracing' && cell < options.traceCells ? entry.character : ''),
    })),
  );
  return Array.from({ length: Math.ceil(rows.length / ROWS_PER_PAGE) }, (_, page) =>
    rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE));
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/** Render only the paper; the editor and its answers never enter the print markup. */
export function renderPages(entries: CharacterEntry[], rawOptions: WorksheetOptions): string {
  const options = normalizeOptions(rawOptions);
  const pages = buildPages(entries, options);
  return pages.map((rows, pageIndex) => `<section class="worksheet-sheet" aria-label="第 ${pageIndex + 1} 页练习纸">
    <header class="worksheet-paper-header">
      <h2>${escapeHtml(options.title)}</h2>
      <div class="worksheet-paper-info"><span>姓名：____________</span><span>日期：____________</span><span>${options.mode === 'dictation' ? '听写练习' : '描红练习'}</span></div>
    </header>
    <div class="worksheet-paper-rows">${rows.map((row) => `<div class="worksheet-practice-row">
      <div class="worksheet-row-meta"><span>${row.number}.</span><span class="worksheet-reading">${escapeHtml(row.reading)}</span></div>
      <div class="worksheet-cells">${row.cells.map((character) => `<div class="worksheet-cell"><span class="worksheet-trace">${escapeHtml(character)}</span></div>`).join('')}</div>
    </div>`).join('')}</div>
    <footer class="worksheet-paper-footer"><span>轻工具箱 · 汉字练习纸</span><span>第 ${pageIndex + 1} / ${pages.length} 页</span></footer>
  </section>`).join('');
}

