import { expect, test } from '@playwright/test';

test.describe('spatial exploration with real graphics when available', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('guided routes, mobile controls and context-loss recovery preserve a way home', async ({ page }) => {
    await page.goto('/space/');
    await page.waitForFunction(() => !!(window as any).__space || !document.getElementById('sp-fallback')?.hidden);
    test.skip(await page.locator('#sp-fallback').isVisible(), 'WebGL2 unavailable; fallback tested separately, no GPU flags enabled');
    await page.locator('[data-explore="jupiter"]').click();
    await expect.poll(() => page.evaluate(() => (window as any).__space.cam.focus)).toBe('jupiter');
    await page.locator('#sp-guide-next').click();
    await expect.poll(() => page.evaluate(() => (window as any).__space.cam.focus)).toBe('io');
    await page.locator('[data-explore="nearby"]').click();
    await page.locator('#sp-guide-next').click();
    await expect.poll(() => page.evaluate(() => (window as any).__space.cam.scaleMode)).toBe('stellar');
    await expect(page.locator('#sp-scale-note')).toContainText('光年');
    await page.locator('#sp-home-earth').click();
    await expect.poll(() => page.evaluate(() => (window as any).__space.cam.focus)).toBe('earth');
    await expect.poll(() => page.evaluate(() => (window as any).__space.cam.mode)).toBe('observe');
    await expect(page.locator('#sp-tour')).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#sp-explorer > summary').click();
    await page.locator('#sp-zoom-in').click();
    await page.locator('#sp-reset-view').click();
    await expect(page.locator('#sp-home-earth')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#space-canvas').dispatchEvent('webglcontextlost');
    await expect(page.locator('#sp-fallback')).toBeVisible();
    await expect(page.locator('#space-hud')).toBeHidden();
  });

  test('household selection opens timeline, isolation comparison and sampled shadow preview', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__locationRequests = 0;
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition = () => { (window as any).__locationRequests++; };
    });
    await page.goto('/vendor/building-sunlight/index.html');
    test.skip(await page.locator('#graphicsFallback').isVisible(), 'WebGL unavailable; no graphics workaround attempted');
    await page.locator('#jsonInput').setInputFiles({
      name: 'synthetic-daylight-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
        version: '3.0.0', latitude: 36.65, longitude: 117.12, timeZone: 'Asia/Shanghai', northAngle: 0, scaleRatio: 1, origin: { x: 0, y: 0 },
        buildings: [{ name: 'Synthetic home', floors: 1, floorHeight: 3, units: 1, isThisCommunity: true, shape: [{ x: -5, y: -4 }, { x: 5, y: -4 }, { x: 5, y: 4 }, { x: -5, y: 4 }] }],
      })),
    });
    await expect(page.locator('#loadingOverlay')).not.toHaveClass(/is-active/);
    await page.locator('#calcSunlightBtn').click();
    await expect(page.locator('#timelinePicker')).toBeVisible();
    await page.locator('#timelineOpen').click();
    await expect(page.locator('.timeline-segment').first()).toBeVisible();
    await expect(page.locator('.timeline-meta').first()).toContainText('Asia/Shanghai');
    await page.locator('.timeline-comparison summary').click();
    await expect(page.locator('.timeline-comparison')).toContainText('仅保留本栋');
    await page.locator('.timeline-segment').first().click();
    await expect(page.locator('.timeline-segment').first()).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__locationRequests)).toBe(0);
    await page.locator('#seasonSelect').selectOption('june-solstice');
    await expect(page.locator('#timelinePicker')).toBeHidden();
  });
});
