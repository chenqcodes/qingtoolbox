import JSZip from 'jszip';

/** 格式化字节大小 */
export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 去掉扩展名 */
export function stemName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base || 'image';
}

/** 基于原名换后缀 */
export function outputName(original: string, ext: string, suffix = '') {
  const stem = stemName(original);
  const cleanExt = ext.replace(/^\./, '');
  return suffix ? `${stem}${suffix}.${cleanExt}` : `${stem}.${cleanExt}`;
}

/** mime → 扩展名 */
export function extFromMime(mime: string) {
  if (mime == 'image/jpeg') return 'jpg';
  if (mime == 'image/x-icon') return 'ico';
  return mime.split('/')[1] || 'bin';
}

/** 触发单文件下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 多文件打 zip 下载 */
export async function zipAndDownload(
  files: Array<{ name: string; blob: Blob }>,
  zipName: string,
) {
  if (files.length == 0) return;
  if (files.length == 1) {
    downloadBlob(files[0].blob, files[0].name);
    return;
  }
  const zip = new JSZip();
  // 同名冲突时加序号
  const used = new Map<string, number>();
  for (const f of files) {
    let name = f.name;
    const n = used.get(name) || 0;
    if (n > 0) {
      const stem = stemName(name);
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
      name = ext ? `${stem}-${n}.${ext}` : `${stem}-${n}`;
    }
    used.set(f.name, n + 1);
    zip.file(name, f.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, zipName);
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, q: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), mime, q);
  });
}

export function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

export type BatchItem = {
  id: string;
  file: File;
  status: 'pending' | 'done' | 'error';
  error?: string;
  blob?: Blob;
  outName?: string;
  /** 原图预览 */
  srcUrl?: string;
  /** 结果预览 */
  previewUrl?: string;
  meta?: string;
};

/** 按数量决定网格列数 class */
export function gridColsClass(n: number) {
  if (n <= 1) return 'cols-1';
  if (n == 2) return 'cols-2';
  if (n <= 4) return 'cols-2';
  if (n <= 9) return 'cols-3';
  return 'cols-4';
}

export function revokeItemUrls(it: BatchItem) {
  if (it.srcUrl) URL.revokeObjectURL(it.srcUrl);
  if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
  it.srcUrl = undefined;
  it.previewUrl = undefined;
}

