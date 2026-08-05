import { PDFDocument } from 'pdf-lib';
import { downloadBlob, stemName, zipAndDownload } from './image-batch';

const MAX_BYTES = 50 * 1024 * 1024;

/** 友好错误 */
export function pdfErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/password|encrypted|Encrypt/i.test(msg)) return '该 PDF 已加密，暂不支持处理';
  if (/Invalid PDF|Failed to parse/i.test(msg)) return '无法解析 PDF，请确认文件未损坏';
  return msg || '处理失败';
}

export function assertFileSize(file: File) {
  if (file.size > MAX_BYTES) {
    throw new Error(`「${file.name}」超过 50MB，请压缩后再试`);
  }
}

/** File → ArrayBuffer */
export async function fileToBytes(file: File) {
  assertFileSize(file);
  return new Uint8Array(await file.arrayBuffer());
}

/** 加载 PDF，失败抛中文错误 */
export async function loadPdf(file: File) {
  try {
    return await PDFDocument.load(await fileToBytes(file), { ignoreEncryption: false });
  } catch (e) {
    throw new Error(pdfErrorMessage(e));
  }
}

/** 每个文件连续重复 times 次（1=不重复）。顺序：A×n, B×n */
export function expandFilesByRepeat(files: File[], times: number) {
  const n = Math.max(1, Math.min(99, Math.floor(Number(times)) || 1));
  const out: File[] = [];
  for (const f of files) {
    for (let i = 0; i < n; i++) out.push(f);
  }
  return out;
}

/** 多 PDF 按顺序合并；copiesPerFile>1 时每个文件连续插入多份 */
export async function mergePdfs(files: File[], copiesPerFile = 1) {
  const list = expandFilesByRepeat(files, copiesPerFile);
  if (!list.length) throw new Error('请先选择 PDF 文件');
  const out = await PDFDocument.create();
  // 同一 File 重复出现时只 load 一次，避免重复解码
  const cache = new Map<File, Awaited<ReturnType<typeof loadPdf>>>();
  for (const file of list) {
    let src = cache.get(file);
    if (!src) {
      src = await loadPdf(file);
      cache.set(file, src);
    }
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/** 拆成「每页一个 PDF」 */
export async function splitPdfPerPage(file: File) {
  const src = await loadPdf(file);
  const total = src.getPageCount();
  if (total < 1) throw new Error('PDF 没有页面');
  const stem = stemName(file.name);
  const parts: Array<{ name: string; blob: Blob }> = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    const bytes = await doc.save();
    parts.push({
      name: `${stem}-p${i + 1}.pdf`,
      blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    });
  }
  return parts;
}

/** 按 1-based 页码范围导出单个 PDF（含起止） */
export async function extractPdfRange(file: File, from: number, to: number) {
  const src = await loadPdf(file);
  const total = src.getPageCount();
  const start = Math.max(1, Math.min(from, to));
  const end = Math.min(total, Math.max(from, to));
  if (start > total) throw new Error(`起始页超出范围（共 ${total} 页）`);
  const indices: number[] = [];
  for (let i = start - 1; i < end; i++) indices.push(i);
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(src, indices);
  pages.forEach((p) => doc.addPage(p));
  const bytes = await doc.save();
  const stem = stemName(file.name);
  return {
    name: `${stem}-p${start}-${end}.pdf`,
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
  };
}

/** 图片 File → PNG/JPG bytes（WebP 等走 canvas） */
async function imageFileToEmbedBytes(file: File): Promise<{ kind: 'jpg' | 'png'; bytes: Uint8Array }> {
  assertFileSize(file);
  const type = file.type || '';
  if (type == 'image/jpeg' || type == 'image/jpg') {
    return { kind: 'jpg', bytes: await fileToBytes(file) };
  }
  if (type == 'image/png') {
    return { kind: 'png', bytes: await fileToBytes(file) };
  }
  // WebP / 其他：转 PNG
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`无法读取图片「${file.name}」`));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 不可用');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片转换失败'))), 'image/png');
    });
    return { kind: 'png', bytes: new Uint8Array(await blob.arrayBuffer()) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 多图 → 单 PDF，每图一页，页面尺寸=图片像素点 */
export async function imagesToPdf(files: File[]) {
  if (!files.length) throw new Error('请先选择图片');
  const doc = await PDFDocument.create();
  for (const file of files) {
    const { kind, bytes } = await imageFileToEmbedBytes(file);
    const embedded = kind == 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    const w = embedded.width;
    const h = embedded.height;
    const page = doc.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
  }
  const out = await doc.save();
  return new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export { downloadBlob, zipAndDownload, stemName };
