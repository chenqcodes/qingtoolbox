import JSZip from 'jszip';
import { canvasToBlob, downloadBlob, fmtSize, gridColsClass, loadImageFromFile, revokeItemUrls, type BatchItem } from '../image-batch';
import { compressToTarget, fitDimensions, parseOptionalDimension, safeOutputName, targetFromKB, uniqueOutputNames, type CompressionResult, type OutputMime } from './core';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id);
const wrap = el('compress-wrap');
const fileInput = input('compress-file');
const drop = el('compress-drop');
const srcGrid = el('compress-src-grid');
const outGrid = el('compress-out-grid');
const meta = el('compress-meta');
const outMeta = el('compress-out-meta');
const quality = input('compress-quality');
const scale = input('compress-scale');
const sizeW = input('size-w');
const sizeH = input('size-h');
const format = el<HTMLSelectElement>('compress-format');
const useTarget = input('compress-use-target');
const target = input('compress-target');
const autoResize = input('compress-auto-resize');
const summary = el('compress-summary');
const btnDl = el<HTMLButtonElement>('btn-compress-dl');
const btnClear = el<HTMLButtonElement>('btn-compress-clear');
const msg = el('compress-msg');
type Item = BatchItem & { result?: CompressionResult; sourceMeta?: string; detail?: string };
type Settings = ReturnType<typeof readSettings>;
let items: Item[] = [];
let activeId = '';
let revision = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let queued = false;
let workingId = '';
let downloading = false;

function showMsg(text: string, type: 'error' | 'success') {
  msg.className = `msg ${type}`;
  msg.textContent = text;
}

function readSettings() {
  return {
    width: parseOptionalDimension(sizeW.value),
    height: parseOptionalDimension(sizeH.value),
    scale: Number(scale.value) / 100,
    mime: format.value as OutputMime,
    maxQuality: Number(quality.value) / 100,
    targetBytes: useTarget.checked ? targetFromKB(target.value) : undefined,
    allowResize: autoResize.checked,
  };
}

function syncControls() {
  target.disabled = !useTarget.checked;
  autoResize.disabled = !useTarget.checked;
  quality.disabled = format.value === 'image/png';
  el('quality-label').textContent = useTarget.checked ? '最高质量' : '质量';
  el('quality-val').textContent = quality.value + '%';
  el('scale-val').textContent = scale.value + '%';
}

function makeThumb(it: Item, output: boolean) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.id = it.id;
  const failed = it.status === 'error' || (output && it.result?.targetMet === false);
  button.className = `batch-thumb${activeId === it.id ? ' is-active' : ''}${failed ? ' is-error' : it.status === 'done' ? ' is-done' : ''}`;
  button.setAttribute('aria-pressed', String(activeId === it.id));
  const url = output ? it.previewUrl : it.srcUrl;
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = output ? '压缩结果预览' : '原图预览';
    button.append(image);
  }
  const status = document.createElement('span');
  status.className = 'batch-thumb-st';
  status.textContent = it.status === 'error' ? '失败' : it.status === 'done' ? (it.result?.targetMet === false ? '未达标' : it.result?.targetMet ? '达标' : '完成') : workingId === it.id ? '处理中' : '待处理';
  const caption = document.createElement('span');
  caption.className = 'batch-thumb-cap';
  caption.textContent = output ? it.outName || it.file.name : it.file.name;
  button.append(status, caption);
  if (output && (it.detail || it.error)) {
    const detail = document.createElement('span');
    detail.className = 'compression-detail';
    detail.textContent = it.error || it.detail || '';
    button.append(detail);
  }
  return button;
}

function renderGrids() {
  wrap.classList.toggle('has-files', items.length > 0);
  srcGrid.className = `batch-grid ${gridColsClass(items.length)}`;
  outGrid.className = `batch-grid ${gridColsClass(items.length || 1)}`;
  srcGrid.replaceChildren(...items.map((it) => makeThumb(it, false)));
  outGrid.replaceChildren(...items.map((it) => makeThumb(it, true)));
  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'img-meta';
    empty.style.gridColumn = '1/-1';
    empty.textContent = '等待压缩';
    outGrid.append(empty);
  }
  const done = items.filter((it) => it.status === 'done' && it.blob);
  const active = items.find((it) => it.id === activeId);
  meta.textContent = items.length ? `共 ${items.length} 张${active ? ` · ${active.file.name} · ${active.file.size} 字节${active.sourceMeta ? ` · ${active.sourceMeta}` : ''}` : ''}` : '—';
  outMeta.textContent = active?.detail || active?.error || (done.length ? `已完成 ${done.length}/${items.length}` : '—');
  btnClear.hidden = items.length === 0;
  btnDl.hidden = done.length === 0;
  btnDl.disabled = downloading || items.some((it) => it.status === 'pending');
  btnDl.textContent = downloading ? '打包中…' : done.some((it) => it.result?.targetMet === false) ? '下载结果（含未达标）' : done.length === 1 ? '下载图片' : '批量下载';
}

function invalidate() {
  revision++;
  clearTimeout(debounceTimer);
  queued = false;
  workingId = '';
  summary.style.display = 'none';
  for (const it of items) {
    if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    it.previewUrl = undefined;
    it.blob = undefined;
    it.outName = undefined;
    it.result = undefined;
    it.detail = undefined;
    it.error = undefined;
    it.status = 'pending';
  }
  renderGrids();
}

async function compressOne(it: Item, settings: Settings, token: number, name: string) {
  const cancelled = () => revision !== token;
  const img = await loadImageFromFile(it.file);
  if (cancelled()) return;
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  const dimensions = fitDimensions(sourceWidth, sourceHeight, settings.width, settings.height, settings.scale);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器无法创建画布');
  let lastWidth = 0;
  let lastHeight = 0;
  try {
    const result = await compressToTarget(async (width, height, q) => {
      if (width !== lastWidth || height !== lastHeight) {
        canvas.width = width;
        canvas.height = height;
        lastWidth = width;
        lastHeight = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (settings.mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
      }
      return canvasToBlob(canvas, settings.mime, q);
    }, { ...settings, ...dimensions }, cancelled);
    if (cancelled()) return;
    it.sourceMeta = `${sourceWidth}×${sourceHeight} px`;
    it.result = result;
    it.blob = result.blob;
    it.outName = name;
    it.previewUrl = URL.createObjectURL(result.blob);
    it.status = 'done';
    const saved = Math.round((1 - result.blob.size / it.file.size) * 100);
    const outcome = result.targetMet === undefined ? '手动压缩' : result.targetMet ? `达标（≤ ${settings.targetBytes} 字节）` : settings.allowResize ? '未达标：已搜索质量及尺寸，仍超出目标' : settings.mime === 'image/png' ? '未达标：固定尺寸 PNG 无法通过质量降低大小' : '未达标：固定尺寸下最低质量仍超出目标';
    it.detail = `${outcome} · ${result.blob.size} 字节（${fmtSize(result.blob.size)}） · ${result.blob.type} · ${result.width}×${result.height} px${result.quality === undefined ? '' : ` · 质量 ${Math.round(result.quality * 100)}%`}${result.resized ? ' · 已自动缩小' : ''} · ${saved < 0 ? `比原图大 ${-saved}%` : `节省 ${saved}%`}`;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function processBatch(token: number) {
  if (!items.length) return;
  let settings: Settings;
  try { settings = readSettings(); } catch (error) {
    showMsg(error instanceof Error ? error.message : '设置无效', 'error');
    return;
  }
  const batch = [...items];
  const names = uniqueOutputNames(batch.map((it) => safeOutputName(it.file.name, settings.mime)));
  for (let index = 0; index < batch.length; index++) {
    if (token !== revision) return;
    const it = batch[index];
    workingId = it.id;
    showMsg(`正在处理 ${index + 1}/${batch.length}，请稍候…`, 'success');
    renderGrids();
    try { await compressOne(it, settings, token, names[index]); } catch (error) {
      if (token !== revision) return;
      it.status = 'error';
      it.error = error instanceof Error ? error.message : '图片处理失败，请尝试其他格式或较小尺寸';
    }
    if (token !== revision) return;
    renderGrids();
    // Give clear, input and other interaction events a turn between files.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (token !== revision) return;
  workingId = '';
  const done = batch.filter((it) => it.status === 'done' && it.blob);
  const failed = batch.filter((it) => it.status === 'error').length;
  const missed = done.filter((it) => it.result?.targetMet === false).length;
  const totalIn = done.reduce((sum, it) => sum + it.file.size, 0);
  const totalOut = done.reduce((sum, it) => sum + it.blob!.size, 0);
  summary.style.display = done.length ? 'flex' : 'none';
  summary.textContent = `已导出 ${done.length}/${batch.length} 张${settings.targetBytes === undefined ? '' : ` · 达标 ${done.length - missed} · 未达标 ${missed}`} · 原合计 ${totalIn} 字节 · 导出合计 ${totalOut} 字节（${fmtSize(totalOut)}）`;
  showMsg(`处理完成：${done.length}/${batch.length} 张${missed ? `，${missed} 张未达标，可增大目标或允许缩小尺寸` : ''}${failed ? `，${failed} 张失败，点击结果查看原因` : ''}`, missed || failed ? 'error' : 'success');
  renderGrids();
}

async function processQueue() {
  if (running) { queued = true; return; }
  running = true;
  try {
    do {
      queued = false;
      await processBatch(revision);
    } while (queued);
  } finally {
    running = false;
  }
}

function requestCompress(delay = 280) {
  syncControls();
  invalidate();
  if (!items.length) { msg.textContent = ''; msg.className = ''; return; }
  showMsg('设置已更新，准备压缩…', 'success');
  debounceTimer = setTimeout(() => { void processQueue(); }, delay);
}

function addFiles(files: FileList | File[]) {
  const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'));
  if (!accepted.length) { showMsg('请选择浏览器支持的图片文件', 'error'); return; }
  for (const file of accepted) {
    items.push({ id: crypto.randomUUID(), file, status: 'pending', srcUrl: URL.createObjectURL(file) });
  }
  if (!activeId) activeId = items[0].id;
  requestCompress(0);
}

function onGridClick(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
  if (!button?.dataset.id) return;
  activeId = button.dataset.id;
  renderGrids();
}
srcGrid.addEventListener('click', onGridClick);
outGrid.addEventListener('click', onGridClick);
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) addFiles(fileInput.files);
  fileInput.value = '';
});
drop.addEventListener('dragover', (event) => event.preventDefault());
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
});
quality.addEventListener('input', () => requestCompress());
scale.addEventListener('input', () => {
  sizeW.value = '';
  sizeH.value = '';
  requestCompress();
});
for (const control of [sizeW, sizeH, target]) control.addEventListener('input', () => requestCompress());
for (const control of [format, useTarget, autoResize]) control.addEventListener('change', () => requestCompress(0));
el('compress-preset').addEventListener('click', () => {
  useTarget.checked = true;
  target.value = '200';
  format.value = 'image/jpeg';
  autoResize.checked = true;
  quality.value = '92';
  requestCompress(0);
});
el('btn-compress').addEventListener('click', () => {
  if (!items.length) { showMsg('请先上传图片', 'error'); return; }
  requestCompress(0);
});
btnDl.addEventListener('click', async () => {
  if (downloading || items.some((it) => it.status === 'pending')) return;
  const done = items.filter((it) => it.status === 'done' && it.blob && it.outName);
  if (!done.length) return;
  const token = revision;
  downloading = true;
  renderGrids();
  try {
    if (done.length === 1) downloadBlob(done[0].blob!, done[0].outName!);
    else {
      const zip = new JSZip();
      for (const it of done) zip.file(it.outName!, it.blob!);
      const blob = await zip.generateAsync({ type: 'blob' });
      if (token === revision) downloadBlob(blob, 'compressed-images.zip');
    }
  } catch { if (token === revision) showMsg('下载打包失败，请重试或减少图片数量', 'error'); }
  finally { downloading = false; renderGrids(); }
});
btnClear.addEventListener('click', () => {
  invalidate();
  items.forEach(revokeItemUrls);
  items = [];
  activeId = '';
  fileInput.value = '';
  msg.textContent = '';
  msg.className = '';
  renderGrids();
});
window.addEventListener('pagehide', () => {
  revision++;
  clearTimeout(debounceTimer);
  queued = false;
  items.forEach(revokeItemUrls);
});
// Rebuild object URLs if the browser restores this document from its back/forward cache.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || !items.length) return;
  for (const it of items) it.srcUrl = URL.createObjectURL(it.file);
  requestCompress(0);
});
syncControls();
