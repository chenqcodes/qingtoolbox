import { test, expect } from '@playwright/test';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

test('chaos lab playback, branching, presets and bounded ensemble', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/double-pendulum/');
  const lab = page.locator('#double-pendulum-lab');
  await expect(page.locator('#dp-status')).toContainText('准备就绪');
  await expect(lab).toHaveAttribute('data-time', '0.000');
  await page.getByRole('button', { name: '开始实验' }).click();
  await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(0.5);
  await page.getByRole('button', { name: '暂停实验' }).click();
  const oldTime = Number(await lab.getAttribute('data-time'));
  await page.locator('#dp-rewind').evaluate((input: HTMLInputElement) => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(Number(await lab.getAttribute('data-time'))).toBeLessThan(oldTime);
  await page.getByRole('button', { name: '继续实验' }).click();
  await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(0.3);
  await page.getByRole('button', { name: '暂停实验' }).click();
  await page.getByRole('button', { name: '小幅摇摆' }).click();
  await expect(page.locator('#dp-angle1')).toHaveValue('18');
  await expect(page.locator('#dp-angle2')).toHaveValue('24');
  await expect(lab).toHaveAttribute('data-time', '0.000');
  await page.getByLabel('16 条微扰轨迹').check();
  await expect(lab).toHaveAttribute('data-count', '18');
  await page.getByLabel('B 的下摆多偏一点').selectOption('1');
  await expect(page.locator('#dp-distance')).toContainText('0.0175');
  await page.getByRole('button', { name: '混沌起点' }).click();
  await page.getByLabel('时间速度').selectOption('2');
  await page.getByRole('button', { name: '开始实验' }).click();
  await expect.poll(async () => Number(await lab.getAttribute('data-time')), { timeout: 20000 }).toBeGreaterThan(16);
  await page.getByRole('button', { name: '暂停实验' }).click();
  await page.screenshot({ path: testInfo.outputPath('double-pendulum-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('mobile controls fit and angle sliders work with keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/double-pendulum/');
  await page.locator('#dp-angle1').focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#dp-angle1-value')).toHaveText('124°');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('#double-pendulum-lab')).toHaveAttribute('data-time', '0.000');
  await page.screenshot({ path: testInfo.outputPath('double-pendulum-mobile.png'), fullPage: true });
});

test('dragging a bob sets a fresh paused initial condition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/double-pendulum/');
  const canvas = page.locator('#dp-canvas'), box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width: w, height: h } = box!;
  const scale = Math.min((w - 78) / 4, (h - 120) / 4), ox = x + w / 2, oy = y + h / 2 + 5;
  const a = 125 * Math.PI / 180;
  await page.mouse.move(ox + Math.sin(a) * scale, oy + Math.cos(a) * scale);
  await page.mouse.down(); await page.mouse.move(ox + scale, oy, { steps: 6 }); await page.mouse.up();
  await expect(page.locator('#dp-angle1')).toHaveValue('90');
  await expect(page.locator('#double-pendulum-lab')).toHaveAttribute('data-time', '0.000');
  await expect(page.locator('#dp-play')).toHaveAttribute('aria-pressed', 'false');
});

test('offscreen clock suspends and manually paused state remains paused', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 650 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/double-pendulum/');
  await page.locator('#dp-canvas').scrollIntoViewIfNeeded();
  await page.locator('#dp-play').click();
  await expect.poll(async () => Number(await page.locator('#double-pendulum-lab').getAttribute('data-time'))).toBeGreaterThan(.3);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#dp-status')).toContainText('屏幕外');
  const stopped = await page.locator('#double-pendulum-lab').getAttribute('data-time');
  await page.waitForTimeout(350);
  await expect(page.locator('#double-pendulum-lab')).toHaveAttribute('data-time', stopped!);
  await page.locator('#dp-canvas').scrollIntoViewIfNeeded();
  await page.locator('#dp-play').click();
  const paused = await page.locator('#double-pendulum-lab').getAttribute('data-time');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('#dp-canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await expect(page.locator('#double-pendulum-lab')).toHaveAttribute('data-time', paused!);
});
