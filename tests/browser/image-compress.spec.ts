import { test, expect, type Page } from '@playwright/test';

async function syntheticPhoto(page: Page, name = 'photo.png') {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const ctx = c.getContext('2d')!; const img = ctx.createImageData(800, 400);
    let seed = 42;
    for (let i = 0; i < img.data.length; i += 4) {
      for (let j = 0; j < 3; j++) { seed = (1664525 * seed + 1013904223) >>> 0; img.data[i + j] = seed >>> 24; }
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1];
  });
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

async function compress(page: Page) {
  await page.locator('#btn-compress').click();
  await expect(page.locator('#compress-out-grid .compression-detail').first()).toBeVisible();
}

test('200 KB JPEG preset reports actual bytes, MIME and dimensions; safe aspect-fit and download', async ({ page }, testInfo) => {
  await page.goto('/tools/image-compress/');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#compress-preset').click();
  await page.locator('#compress-file').setInputFiles(await syntheticPhoto(page));
  await compress(page);
  const detail = page.locator('#compress-out-grid .compression-detail').first();
  await expect(detail).toContainText('达标');
  await expect(detail).toContainText('image/jpeg');
  const output = await page.locator('#compress-out-grid img').first().evaluate(async (el: HTMLImageElement) => {
    await el.decode(); const blob = await fetch(el.src).then(r => r.blob());
    return { bytes: blob.size, type: blob.type, width: el.naturalWidth, height: el.naturalHeight };
  });
  expect(output.bytes).toBeLessThanOrEqual(204800); expect(output.type).toBe('image/jpeg');
  expect(output.width / output.height).toBeCloseTo(2, 1);
  await page.locator('#size-w').fill('300'); await page.locator('#size-h').fill('300');
  await page.locator('#compress-auto-resize').uncheck(); await compress(page);
  await expect(detail).toContainText('300'); await expect(detail).toContainText('150');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#btn-compress-dl').click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/\.(jpg|zip)$/);
  await page.screenshot({ path: testInfo.outputPath('compression-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('PNG fixed-size failure is honest; invalid settings and clear remove stale output', async ({ page }) => {
  await page.goto('/tools/image-compress/');
  await page.locator('#compress-file').setInputFiles(await syntheticPhoto(page, '<img src=x onerror=alert(1)>.png'));
  await page.locator('#compress-format').selectOption('image/png');
  await page.locator('#compress-target').fill('0.1'); await page.locator('#compress-auto-resize').uncheck();
  await compress(page);
  await expect(page.locator('#compress-out-grid .compression-detail').first()).toContainText('未达标');
  const output = await page.locator('#compress-out-grid img').first().evaluate(async (el: HTMLImageElement) => {
    await el.decode(); const blob = await fetch(el.src).then(r => r.blob()); return { bytes: blob.size, type: blob.type, width: el.naturalWidth, height: el.naturalHeight };
  });
  expect(output.type).toBe('image/png'); expect(output.bytes).toBeGreaterThan(102); expect(output.width).toBe(800); expect(output.height).toBe(400);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  await page.locator('#compress-target').fill('-1'); await expect(page.locator('#btn-compress-dl')).toBeHidden();
  await page.locator('#btn-compress').click(); await expect(page.locator('#compress-msg')).not.toBeEmpty();
  await page.locator('#compress-target').fill('200'); await page.locator('#compress-format').selectOption('image/jpeg');
  await page.locator('#btn-compress').click(); await page.locator('#btn-compress-clear').click();
  await expect(page.locator('#compress-src-grid img')).toHaveCount(0); await expect(page.locator('#compress-out-grid img')).toHaveCount(0);
  await expect(page.locator('#btn-compress-dl')).toBeHidden();
});

test('mobile batch compression stays within viewport and downloads all results', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/tools/image-compress/');
  const photo = await syntheticPhoto(page); await page.locator('#compress-file').setInputFiles([photo, { ...photo, name: 'second.png' }]);
  await compress(page); await expect(page.locator('#compress-out-grid .compression-detail')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const promise = page.waitForEvent('download'); await page.locator('#btn-compress-dl').click();
  expect((await promise).suggestedFilename()).toMatch(/\.zip$/);
  await page.screenshot({ path: testInfo.outputPath('compression-mobile.png'), fullPage: true });
});
