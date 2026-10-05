import { test, expect } from '@playwright/test';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

// Transparent diagnostic: retain native observer timing and payloads without
// changing the callback or weakening any assertion. Retain with failing traces.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeObserver = window.IntersectionObserver;
    const diagnostics: unknown[] = [];
    (window as unknown as { rainVisibilityDiagnostics: unknown[] }).rainVisibilityDiagnostics = diagnostics;
    const rect = (r: DOMRectReadOnly | null) => r && ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const state = () => ({ now: performance.now(), scrollX, scrollY, innerWidth, innerHeight, hidden: document.hidden,
      canvas: rect(document.querySelector('#cr-canvas')?.getBoundingClientRect() ?? null),
      status: document.querySelector('#cr-status')?.textContent,
      modelTime: (document.querySelector('#city-rain-lab') as HTMLElement | null)?.dataset.time });
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          if (entries.some(entry => entry.target.id === 'cr-canvas')) diagnostics.push({ kind: 'observer', ...state(), entries: entries.map(entry => ({ target: entry.target.id, time: entry.time, isIntersecting: entry.isIntersecting, ratio: entry.intersectionRatio, rootBounds: rect(entry.rootBounds), bounds: rect(entry.boundingClientRect), intersection: rect(entry.intersectionRect) })) });
          callback(entries, observer);
        }, options);
      }
    };
    document.addEventListener('click', event => {
      const id = (event.target as Element)?.closest('button')?.id;
      if (id === 'cr-play') diagnostics.push({ kind: 'play-click', ...state() });
    }, true);
  });
});
test.afterEach(async ({ page }, testInfo) => {
  const events = await page.evaluate(() => (window as unknown as { rainVisibilityDiagnostics?: unknown[] }).rainVisibilityDiagnostics ?? []);
  await testInfo.attach('rain-visibility-events', { body: JSON.stringify(events, null, 2), contentType: 'application/json' });
  if (testInfo.status !== testInfo.expectedStatus) console.log('RAIN_VISIBILITY_DIAGNOSTICS', JSON.stringify(events));
});

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
