import { test, expect } from '@playwright/test';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

test('rain budget, wet editing, rainfall stop and reset', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/city-rain/');
  const lab = page.locator('#city-rain-lab');
  await expect(lab).toHaveAttribute('data-time', '0.00');
  await page.getByRole('button', { name: '开始降雨', exact: true }).click();
  // Controls may scroll the canvas offscreen; visibility intentionally gates model time.
  await page.locator('#cr-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('#cr-canvas')).toBeInViewport();
  await expect.poll(async () => Number(await lab.getAttribute('data-time')), { timeout: 20000 }).toBeGreaterThan(10);
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click();
  const stored = Number(await lab.getAttribute('data-water')); expect(stored).toBeGreaterThan(1);
  expect(Math.abs(Number(await lab.getAttribute('data-balance')))).toBeLessThan(1e-6);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('city-rain-desktop.png'), fullPage: true });
  await page.locator('[data-brush="2"]').click();
  await page.locator('#cr-canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
  await expect(lab).toHaveAttribute('data-edits', '1');
  expect(Math.abs(Number(await lab.getAttribute('data-balance')))).toBeLessThan(1e-6);
  await page.locator('#cr-rain').evaluate((input: HTMLInputElement) => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const afterEdit = Number(await lab.getAttribute('data-water'));
  await page.getByRole('button', { name: '继续模拟' }).click();
  await page.locator('#cr-canvas').scrollIntoViewIfNeeded();
  await expect(page.locator('#cr-canvas')).toBeInViewport();
  await expect(page.locator('#cr-status')).toContainText('雨已停');
  await expect.poll(async () => Number(await lab.getAttribute('data-water'))).toBeLessThan(afterEdit);
  await page.getByRole('button', { name: '清空雨水' }).click();
  await expect(lab).toHaveAttribute('data-water', '0.00000');
  await expect(lab).toHaveAttribute('data-time', '0.00');
  await page.getByRole('button', { name: '海绵改造', exact: true }).click();
  await expect(page.locator('#cr-status')).toContainText('海绵改造');
  await page.getByRole('button', { name: '空白地形', exact: true }).click();
  await expect(page.locator('#cr-status')).toContainText('空白地形');
  expect(errors).toEqual([]);
});

test('mobile city keyboard controls and narrow layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/city-rain/');
  await page.getByRole('button', { name: '海绵改造', exact: true }).click();
  await page.locator('[data-brush="4"]').click();
  await page.locator('#cr-canvas').focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.locator('#cr-edit-help')).toContainText('排水口');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('city-rain-mobile.png'), fullPage: true });
});

test('roof erasing targets its footprint and secondary mouse buttons do not paint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/city-rain/');
  await page.locator('[data-brush="0"]').click();
  await page.locator('#cr-brush-size').selectOption('0');
  const canvas = page.locator('#cr-canvas'), box = (await canvas.boundingBox())!;
  const tw = Math.min((box.width - 40) / 28, (box.height - 140) / 14), th = tw / 2;
  const ox = (box.width - 28 * tw) / 2 + 12 * tw, oy = (box.height - 28 * th) / 2 + 25;
  // First preset roof: footprint (3,3)..(7,7), height 1.1. Click a visible roof interior.
  const x = box.x + ox + (5.2 - 5.2) * tw / 2, y = box.y + oy + (5.2 + 5.2) * th / 2 - 1.1 * tw;
  await page.mouse.click(x, y, { button: 'right' });
  await expect(page.locator('#city-rain-lab')).toHaveAttribute('data-edits', '0');
  await page.mouse.click(x, y);
  await expect(page.locator('#cr-edit-help')).toContainText('第 6 列，第 6 行');
  await expect(page.locator('#city-rain-lab')).toHaveAttribute('data-edits', '1');
});


test('keyboard editing announces existing terrain and model water depth', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/city-rain/');
  await expect(page.locator('#cr-canvas')).toHaveAttribute('aria-describedby', 'cr-edit-help');
  await page.locator('#cr-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#cr-edit-help')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#cr-edit-help')).toContainText('当前是');
  await expect(page.locator('#cr-edit-help')).toContainText('模型水深 0.000');
});

test('native visibility transitions suspend and resume without overriding manual pause', async ({ page }, testInfo) => {
  // A shorter real viewport makes the canvas fully scrollable offscreen.
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/city-rain/');
  const canvas = page.locator('#cr-canvas'), lab = page.locator('#city-rain-lab'), status = page.locator('#cr-status');
  await page.locator('#cr-play').click();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(.2);
  for (let round = 0; round < 3; round++) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect(canvas).not.toBeInViewport();
    await expect(status).toContainText('画布在屏幕外');
    const stopped = await lab.getAttribute('data-time');
    await page.waitForTimeout(200);
    await expect(lab).toHaveAttribute('data-time', stopped!);
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeInViewport();
    await expect(status).toContainText('正在降雨');
    await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(Number(stopped));
  }
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click();
  const paused = await lab.getAttribute('data-time');
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(canvas).not.toBeInViewport();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('city-rain-paused-visibility-regression.png'), fullPage: true });
  await expect(page.locator('#cr-play')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(200);
  await expect(lab).toHaveAttribute('data-time', paused!);
  await page.locator('#cr-rain').evaluate((input: HTMLInputElement) => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.getByRole('button', { name: '继续模拟' }).click();
  await canvas.scrollIntoViewIfNeeded();
  await expect(status).toContainText('雨已停');
  await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(Number(paused));
});
