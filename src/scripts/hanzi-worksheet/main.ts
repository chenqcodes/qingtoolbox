import {
  DEFAULT_TEXT, MAX_CHARACTERS, buildPages, escapeHtml, normalizeReading,
  parseCharacters, renderPages,
  type CharacterEntry, type WorksheetOptions,
} from './model';
import { readSharedText } from './navigation';

const textInput = document.querySelector<HTMLTextAreaElement>('#worksheet-text')!;
const titleInput = document.querySelector<HTMLInputElement>('#worksheet-title')!;
const modeInput = document.querySelector<HTMLSelectElement>('#worksheet-mode')!;
const traceInput = document.querySelector<HTMLSelectElement>('#worksheet-trace')!;
const repeatInput = document.querySelector<HTMLSelectElement>('#worksheet-repeat')!;
const pinyinInput = document.querySelector<HTMLInputElement>('#worksheet-pinyin')!;
const status = document.querySelector<HTMLElement>('#worksheet-status')!;
const count = document.querySelector<HTMLElement>('#worksheet-count')!;
const summary = document.querySelector<HTMLElement>('#worksheet-summary')!;
const pages = document.querySelector<HTMLElement>('#worksheet-pages')!;
const viewport = document.querySelector<HTMLElement>('#worksheet-preview-viewport')!;
const scale = document.querySelector<HTMLElement>('#worksheet-preview-scale')!;
const empty = document.querySelector<HTMLElement>('#worksheet-empty')!;
const readingEditor = document.querySelector<HTMLElement>('#worksheet-reading-editor')!;
const printButton = document.querySelector<HTMLButtonElement>('#worksheet-print')!;
const readingsPanel = document.querySelector<HTMLDetailsElement>('#worksheet-readings-panel')!;
let entries: CharacterEntry[] = [];
const overrides = new Map<string, string>();
let composing = false;

function options(): WorksheetOptions {
  return {
    title: titleInput.value,
    mode: modeInput.value === 'dictation' ? 'dictation' : 'tracing',
    traceCells: Number(traceInput.value),
    rowsPerCharacter: Number(repeatInput.value),
    showPinyin: pinyinInput.checked,
  };
}

function setStatus(message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

// Scale the complete paper for narrow screens, preserving its physical print size.
function fitPreview() {
  const ratio = Math.min(1, viewport.clientWidth / (scale.offsetWidth || 1));
  scale.style.transform = `scale(${ratio})`;
  viewport.style.height = `${Math.ceil(scale.scrollHeight * ratio)}px`;
}

function renderPaper() {
  const currentOptions = options();
  traceInput.disabled = currentOptions.mode === 'dictation';
  document.querySelector('#worksheet-mode-hint')!.textContent = currentOptions.mode === 'dictation'
    ? '听写纸不印汉字答案，描红比例暂不生效。保留拼音可看拼音写汉字；关闭拼音可由家长报读。'
    : '每行 10 个田字格，字格边长 18 毫米；每页最多 8 行。';
  pages.innerHTML = renderPages(entries, currentOptions);
  const pageCount = buildPages(entries, currentOptions).length;
  summary.textContent = entries.length ? `${entries.length} 个字 · ${entries.length * currentOptions.rowsPerCharacter} 行 · ${pageCount} 页 A4` : '';
  printButton.disabled = entries.length === 0;
  empty.hidden = entries.length > 0;
  viewport.hidden = entries.length === 0;
  requestAnimationFrame(fitPreview);
}

function renderReadingEditor() {
  readingEditor.innerHTML = entries.map((entry, index) => `<label>${index + 1}. ${escapeHtml(entry.character)}
    <input type="text" data-index="${index}" value="${escapeHtml(entry.reading)}" maxlength="24" aria-label="第 ${index + 1} 个字 ${escapeHtml(entry.character)} 的拼音" placeholder="手动填写读音" autocomplete="off" spellcheck="false" />
  </label>`).join('');
  document.querySelector<HTMLButtonElement>('#worksheet-reset-readings')!.disabled = !entries.length;
}

function updateText(message?: string) {
  // Do not retain user-entered text in the visible URL after the initial import.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const parsed = parseCharacters(textInput.value);
  entries = parsed.entries.map((entry) => ({ ...entry, reading: overrides.get(entry.key) ?? entry.reading }));
  count.textContent = `${entries.length} / ${MAX_CHARACTERS} 个汉字`;
  if (parsed.error) {
    setStatus(parsed.error, true);
    count.textContent = '超出输入上限';
  } else if (!entries.length) {
    setStatus(textInput.value.trim() ? '没有找到汉字，请输入要练习的汉字。' : '输入生字即可生成；也可以填入示例。');
  } else {
    const unknown = entries.filter((entry) => !entry.reading).length;
    setStatus(message ?? [parsed.ignored ? `已跳过 ${parsed.ignored} 个标点、字母等非汉字。` : '', unknown ? `${unknown} 个字暂无读音，可展开下方拼音校对手动填写。` : '请核对多音字读音后打印。'].filter(Boolean).join(' '));
  }
  renderReadingEditor();
  renderPaper();
}

textInput.addEventListener('compositionstart', () => { composing = true; });
textInput.addEventListener('compositionend', () => { composing = false; overrides.clear(); updateText(); });
textInput.addEventListener('input', () => {
  if (composing) return;
  overrides.clear();
  updateText();
});
[modeInput, traceInput, repeatInput, pinyinInput].forEach((input) => input.addEventListener('change', renderPaper));
titleInput.addEventListener('input', renderPaper);
readingEditor.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const entry = entries[Number(input.dataset.index)];
  if (!entry) return;
  entry.reading = normalizeReading(input.value);
  overrides.set(entry.key, entry.reading);
  renderPaper();
});
document.querySelector('#worksheet-reset-readings')!.addEventListener('click', () => {
  overrides.clear();
  updateText('已恢复自动读音，请再次核对多音字。');
});
document.querySelector('#worksheet-clear')!.addEventListener('click', () => {
  textInput.value = '';
  overrides.clear();
  updateText();
  textInput.focus();
});
document.querySelector('#worksheet-example')!.addEventListener('click', () => {
  textInput.value = DEFAULT_TEXT;
  overrides.clear();
  updateText('已填入示例，可替换为本周生字。');
});
document.querySelector('#worksheet-import')!.addEventListener('click', () => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('hanzi-learn-chars') ?? '[]');
    if (!Array.isArray(saved) || !saved.every((item) => typeof item === 'string')) {
      setStatus('生字本数据格式不正确，请手动输入汉字。', true);
      return;
    }
    if (!saved.length) {
      setStatus('本机生字本还没有汉字。可先去「汉字笔顺」添加，或直接在上方输入。');
      return;
    }
    textInput.value = saved.join('');
    overrides.clear();
    updateText('已导入本机生字本，请核对拼音。');
  } catch {
    setStatus('无法读取本机生字本。浏览器可能禁用了本地存储，请直接输入汉字。', true);
  }
});
printButton.addEventListener('click', () => {
  if (!entries.length) return;
  // Synchronous invocation keeps the user activation needed by mobile browsers.
  renderPaper();
  try {
    window.print();
  } catch {
    setStatus('此浏览器无法打开打印，请使用浏览器菜单中的「打印」或「共享 → 打印」。', true);
  }
});
window.addEventListener('beforeprint', () => { pages.innerHTML = renderPages(entries, options()); });
window.addEventListener('afterprint', fitPreview);
window.addEventListener('resize', fitPreview);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitPreview).observe(viewport);

const shared = readSharedText(location.hash);
textInput.value = shared ?? DEFAULT_TEXT;
updateText(shared === null ? '已填入示例，可替换为本周生字。' : '已带入汉字，请核对拼音后打印。');
if (shared !== null && entries.some((entry) => !entry.reading)) readingsPanel.open = true;
