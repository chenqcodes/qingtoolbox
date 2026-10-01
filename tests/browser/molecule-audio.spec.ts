import { expect, test } from '@playwright/test';

test('molecule fallback retains truthful counts, manual pause and keyboard inspection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (this.id === 'mol-canvas' && kind.includes('webgl')) return null;
      return getContext.call(this, kind as '2d', ...args);
    } as typeof getContext;
  });
  await page.goto('/tools/molecule/');
  await expect(page.locator('#mol-view-status')).toContainText('无法启用 WebGL');
  await expect(page.locator('#mol-tour-note')).toContainText('已暂停');
  await page.locator('#mol-select').selectOption('caffeine');
  await expect(page.locator('#mol-count')).toHaveText('显示 24 / 总计 24 原子 · 省略 0 个 H');
  await page.locator('#mol-hydrogen').uncheck();
  await expect(page.locator('#mol-count')).toHaveText('显示 14 / 总计 24 原子 · 省略 10 个 H');
  await page.locator('#mol-atom').selectOption('0');
  await expect(page.locator('#mol-inspect')).toContainText('羰基');
  await page.getByRole('button', { name: '多巴胺：2 个羟基' }).click();
  await expect(page.locator('#mol-inspect')).toContainText('高亮 2 个原子');
  await expect(page.locator('#mol-source')).toHaveAttribute('href', 'https://pubchem.ncbi.nlm.nih.gov/compound/681');
  await page.locator('#mol-tour').click();
  await expect(page.locator('#mol-tour-note')).toContainText('自动巡游中');
  await page.locator('#mol-select').selectOption('water');
  await expect(page.locator('#mol-tour-note')).toContainText('已暂停');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('audio starts only on explicit action and offers independent sound/visual controls', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const root = window as unknown as { audioCreated: number; audioStarted: number; AudioContext: unknown };
    root.audioCreated = 0; root.audioStarted = 0;
    class Node {
      gain = { value: 0.2 }; frequencyBinCount = 1024; fftSize = 2048; smoothingTimeConstant = 0.75;
      loop = false; buffer: unknown = null; onended: (() => void) | null = null;
      connect() {} disconnect() {} stop() {} start() { root.audioStarted++; }
      getByteFrequencyData(data: Uint8Array) { data.fill(0); data[4] = 200; data[23] = 180; data[137] = 220; }
    }
    class Context {
      state = 'running'; destination = new Node(); currentTime = 0; sampleRate = 48000;
      constructor() { root.audioCreated++; }
      createAnalyser() { return new Node(); } createGain() { return new Node(); } createBufferSource() { return new Node(); }
      createBuffer(_channels: number, length: number, sampleRate: number) { return { duration: length / sampleRate, getChannelData: () => new Float32Array(length) }; }
      async close() { this.state = 'closed'; } async resume() { this.state = 'running'; }
    }
    root.AudioContext = Context;
  });
  await page.goto('/tools/audio-viz/');
  expect(await page.evaluate(() => (window as unknown as { audioCreated: number }).audioCreated)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { audioStarted: number }).audioStarted)).toBe(0);
  await expect(page.locator('#audio-pause')).toHaveText('继续画面');
  await expect(page.locator('#audio-playback')).toBeDisabled();
  await page.locator('#audio-demo').click();
  await expect(page.locator('#audio-status')).toContainText('本地合成');
  await expect(page.locator('#audio-time')).toHaveText('0:00 / 0:12');
  await page.locator('#audio-playback').click();
  await expect(page.locator('#audio-status')).toContainText('已暂停');
  await expect(page.locator('#audio-playback')).toHaveText('播放音频');
  await page.locator('#audio-preset').selectOption('rain');
  await page.locator('#audio-pause').click();
  await expect(page.locator('#audio-playback')).toHaveText('播放音频');
  await page.locator('#audio-playback').click();
  await expect(page.locator('#audio-status')).toContainText('播放中');
  await page.screenshot({ path: testInfo.outputPath('audio-desktop.png'), fullPage: true });
  await page.locator('#audio-stop').click();
  await expect(page.locator('#audio-status')).toContainText('已停止');
  await expect(page.locator('#audio-playback')).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath('audio-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('real molecule WebGL render at desktop and mobile when supported', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/tools/molecule/');
  await expect(page.locator('#mol-name')).toContainText('DNA');
  const status = await page.locator('#mol-view-status').innerText();
  test.skip(status.includes('无法启用 WebGL'), 'The browser does not provide normal WebGL; fallback is tested separately.');
  await expect(page.locator('#mol-canvas')).toBeVisible();
  const buffer = await page.locator('#mol-canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    return { width: gl?.drawingBufferWidth ?? 0, height: gl?.drawingBufferHeight ?? 0 };
  });
  expect(buffer.width).toBeGreaterThan(100); expect(buffer.height).toBeGreaterThan(100);
  await page.locator('#mol-select').selectOption('caffeine');
  await page.locator('#mol-style').selectOption('ball-stick');
  await page.locator('#mol-atom').selectOption('0');
  await expect(page.locator('#mol-inspect')).toContainText('羰基');
  await page.screenshot({ path: testInfo.outputPath('molecule-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#mol-style').selectOption('space-fill');
  await page.locator('#mol-reset').click();
  await page.screenshot({ path: testInfo.outputPath('molecule-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});
