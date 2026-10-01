import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CELLS_PER_ROW, MAX_CHARACTERS, MAX_INPUT_LENGTH, ROWS_PER_PAGE, buildPages,
  escapeHtml, normalizeOptions, normalizeReading, parseCharacters,
  renderPages, type WorksheetOptions,
} from './model';
import { readSharedText, worksheetHref } from './navigation';

const defaults: WorksheetOptions = {
  title: '本周生字练习', mode: 'tracing', traceCells: 5, rowsPerCharacter: 1, showPinyin: true,
};

// The generation model is independent of browser APIs, so print content is reproducible.
test('retains order and repeats, skipping non-Hanzi without splitting Unicode characters', () => {
  const result = parseCharacters('春，春 𠮷\n夏😀A1');
  assert.equal(result.error, '');
  assert.deepEqual(result.entries.map((entry) => entry.character), ['春', '春', '𠮷', '夏']);
  assert.deepEqual(result.entries.map((entry) => entry.key), ['春:1', '春:2', '𠮷:1', '夏:1']);
  assert.equal(result.entries[2].reading, '');
  assert.equal(result.ignored, 4);
});

test('uses phrase context for polyphonic characters', () => {
  const result = parseCharacters('银行，行走，重庆，快乐，音乐');
  assert.deepEqual(result.entries.filter((entry) => entry.character === '行').map((entry) => entry.reading), ['háng', 'xíng']);
  assert.deepEqual(result.entries.filter((entry) => entry.character === '乐').map((entry) => entry.reading), ['lè', 'yuè']);
  assert.equal(result.entries.find((entry) => entry.character === '重')?.reading, 'chóng');
});

test('empty and non-Hanzi text have no printable rows', () => {
  for (const text of ['', '  \n\t', 'ABC 123 😀 !']) {
    const result = parseCharacters(text);
    assert.equal(result.error, '');
    assert.equal(result.entries.length, 0);
    assert.equal(renderPages(result.entries, defaults), '');
  }
});

test('rejects over-limit input instead of silently omitting practice characters', () => {
  assert.equal(parseCharacters('春'.repeat(MAX_CHARACTERS)).entries.length, MAX_CHARACTERS);
  assert.match(parseCharacters('春'.repeat(MAX_CHARACTERS + 1)).error, /最多/);
  assert.deepEqual(parseCharacters('春'.repeat(MAX_CHARACTERS + 1)).entries, []);
  assert.match(parseCharacters('a'.repeat(MAX_INPUT_LENGTH + 1)).error, /输入过长/);
  assert.equal(parseCharacters('𠮷'.repeat(MAX_CHARACTERS)).entries.length, MAX_CHARACTERS);
});

test('pages have eight complete rows and ten fixed cells', () => {
  for (const length of [1, 8, 9, 16, MAX_CHARACTERS]) {
    const entries = parseCharacters('春'.repeat(length)).entries;
    const pages = buildPages(entries, defaults);
    assert.equal(pages.length, Math.ceil(length / ROWS_PER_PAGE));
    assert.equal(pages.flat().length, length);
    assert.ok(pages.every((page) => page.length <= ROWS_PER_PAGE));
    assert.ok(pages.flat().every((row) => row.cells.length === CELLS_PER_ROW));
  }
});

test('all supported tracing ratios have exact tracing and blank counts', () => {
  const entries = parseCharacters('春夏').entries;
  for (const traceCells of [0, 2, 5, 8, 10]) {
    for (const row of buildPages(entries, { ...defaults, traceCells }).flat()) {
      assert.equal(row.cells.filter(Boolean).length, traceCells);
      assert.deepEqual(row.cells.slice(0, traceCells), Array(traceCells).fill(row.entry.character));
      assert.equal(row.cells.filter((character) => character === '').length, 10 - traceCells);
    }
  }
});

test('repeats each character consecutively and paginates maximum workload', () => {
  const rows = buildPages(parseCharacters('春夏').entries, { ...defaults, rowsPerCharacter: 3 }).flat();
  assert.deepEqual(rows.map((row) => row.number), [1, 1, 1, 2, 2, 2]);
  const pages = buildPages(parseCharacters('春'.repeat(60)).entries, { ...defaults, rowsPerCharacter: 3 });
  assert.equal(pages.length, 23);
  assert.equal(pages.flat().length, 180);
  assert.equal(pages.at(-1)?.length, 4);
});

test('dictation always removes answers, regardless of selected tracing proportion', () => {
  const entries = parseCharacters('春夏秋冬').entries;
  for (const showPinyin of [true, false]) {
    const options: WorksheetOptions = { ...defaults, mode: 'dictation', traceCells: 10, showPinyin };
    const html = renderPages(entries, options);
    assert.ok(buildPages(entries, options).flat().every((row) => row.cells.every((cell) => cell === '')));
    for (const entry of entries) assert.ok(!html.includes(entry.character));
    assert.equal(html.includes('chūn'), showPinyin);
  }
});

test('custom per-occurrence readings and blank readings are preserved', () => {
  const entries = parseCharacters('行行行').entries;
  entries[0].reading = 'háng';
  entries[1].reading = 'xíng';
  entries[2].reading = '';
  assert.deepEqual(buildPages(entries, defaults).flat().map((row) => row.reading), ['háng', 'xíng', '']);
  assert.deepEqual(buildPages(entries, { ...defaults, showPinyin: false }).flat().map((row) => row.reading), ['', '', '']);
  assert.equal(normalizeReading('  hang2 \n  '), 'hang2');
  assert.equal(Array.from(normalizeReading('ā'.repeat(30))).length, 24);
});

test('user-entered title and reading are text, never executable markup', () => {
  const entries = parseCharacters('春').entries;
  entries[0].reading = '<img src=x onerror=x>';
  const html = renderPages(entries, { ...defaults, title: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
});

test('normalizes potentially invalid controls and long titles to bounded output', () => {
  const options = normalizeOptions({ ...defaults, traceCells: NaN, rowsPerCharacter: Infinity, title: '  ' });
  assert.equal(options.traceCells, 5);
  assert.equal(options.rowsPerCharacter, 1);
  assert.equal(options.title, defaults.title);
  assert.equal(normalizeOptions({ ...defaults, traceCells: 99, rowsPerCharacter: 99 }).rowsPerCharacter, 3);
  assert.equal(normalizeOptions({ ...defaults, traceCells: -99 }).traceCells, 0);
  assert.equal(Array.from(normalizeOptions({ ...defaults, title: '字'.repeat(40) }).title).length, 30);
});

test('paper HTML contains correct page numbers and no empty trailing page', () => {
  const entries = parseCharacters('春'.repeat(16)).entries;
  const html = renderPages(entries, defaults);
  assert.equal((html.match(/class="worksheet-sheet"/g) ?? []).length, 2);
  assert.equal((html.match(/class="worksheet-practice-row"/g) ?? []).length, 16);
  assert.equal((html.match(/class="worksheet-cell"/g) ?? []).length, 160);
  assert.ok(html.includes('第 1 / 2 页'));
  assert.ok(html.includes('第 2 / 2 页'));
});

test('text transfers privately in a fragment, preserving punctuation and supplementary Hanzi', () => {
  const original = '银行𠮷 春\n夏 + & = #';
  const url = new URL(worksheetHref(original), 'https://example.test');
  assert.equal(url.pathname, '/tools/hanzi-worksheet/');
  assert.equal(url.search, '');
  assert.equal(readSharedText(url.hash), original);
  assert.equal(readSharedText('#text='), '');
  assert.equal(readSharedText(''), null);
  assert.equal(readSharedText('#unrelated=value'), null);
});

test('oversized source transfer preserves the validation failure rather than truncating silently', () => {
  const shared = readSharedText(new URL(worksheetHref('a'.repeat(3000)), 'https://example.test').hash)!;
  assert.equal(Array.from(shared).length, MAX_INPUT_LENGTH + 1);
  assert.match(parseCharacters(shared).error, /输入过长/);
});

test('print stylesheet defines A4 physical dimensions and isolated non-background grid lines', () => {
  const css = readFileSync(new URL('../../styles/hanzi-worksheet.css', import.meta.url), 'utf8');
  assert.match(css, /@page\s*\{\s*size: A4 portrait; margin: 0;/);
  assert.match(css, /width: 210mm; height: 297mm;/);
  assert.match(css, /grid-template-columns: repeat\(10, 18mm\)/);
  assert.match(css, /\.worksheet-sheet:last-child\s*\{ break-after: auto; page-break-after: auto;/);
  assert.match(css, /\.worksheet-cell::before\s*\{[^}]*border-top:/);
  assert.match(css, /\.worksheet-cell::after\s*\{[^}]*border-left:/);
});
