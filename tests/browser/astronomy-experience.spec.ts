import { test, expect } from '@playwright/test';
const tle = { name: 'ISS (ZARYA)', norad: 25544, fetchedAt: '2026-10-01T11:29:40Z', source: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', line1: '1 25544U 98067A   26273.85230731  .00003748  00000+0  76931-4 0  9990', line2: '2 25544  51.6316 137.1559 0007005 207.6272 152.4345 15.48699564588139' };

test('selected lunar date, timezone and tonight target stay explicit on mobile', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2024-03-25T07:00:00Z'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/astro-today/');
  await expect(page.locator('#astro-phase-name')).toContainText('满月');
  await expect(page.locator('#astro-illum')).toContainText('100.0%');
  await expect(page.locator('#astro-night-range')).toContainText('Asia/Shanghai');
  await page.locator('#astro-target').selectOption('Jupiter');
  await expect(page.locator('#astro-night-summary')).toContainText('木星');
  await page.locator('.lab-details summary').click();
  await page.locator('#astro-zone').fill('America/New_York');
  await page.locator('#astro-date').fill('2024-04-08T14:21');
  await page.locator('#astro-apply').click();
  await expect(page.locator('#astro-phase-name')).toContainText('新月');
  await expect(page.locator('#astro-now')).toContainText('America/New_York');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('ISS cards distinguish visibility, allow keyboard selection and disclose freshness', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T11:00:00Z'));
  await page.route('**/data/iss-tle.json?*', route => route.fulfill({ json: tle }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/sat-pass/');
  await expect(page.locator('#sat-freshness')).toContainText('轨道数据可用');
  await expect(page.locator('#sat-countdown')).toContainText('距离开始');
  await expect(page.locator('#sat-pass-cards')).toContainText('可能肉眼可见');
  await page.locator('#sat-filter').selectOption('geometric');
  await expect(page.locator('#sat-pass-cards')).toContainText('仅几何过境');
  const second = page.locator('#sat-pass-cards [data-pass="1"]');
  await second.focus(); await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sat-pause').click();
  await expect(page.locator('#sat-pause')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.lab-details summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('stale orbit blocks recommendations even if fetch timestamp claims to be recent', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2099-11-01T11:00:00Z'));
  await page.route('**/data/iss-tle.json?*', route => route.fulfill({ json: { ...tle, fetchedAt: '2099-11-01T10:00:00Z' } }));
  await page.goto('/tools/sat-pass/');
  await expect(page.locator('#sat-next')).toContainText('预测已暂停');
  await expect(page.locator('#sat-pass-cards button')).toHaveCount(0);
  await expect(page.locator('#sat-freshness')).toContainText('不可用');
});

test('live tonight recommendation advances with the clock while the whole-night chart stays fixed', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T10:00:00Z') }); // Beijing 18:00
  await page.goto('/tools/astro-today/');
  await expect(page.locator('#astro-night-summary')).toContainText('月亮建议');
  const moonRange = await page.locator('#astro-night-range').textContent();
  await page.clock.fastForward(5 * 3600000);
  await expect(page.locator('#astro-night-summary')).toContainText('窗口已全部结束');
  await expect(page.locator('#astro-night-range')).toHaveText(moonRange!);

  await page.clock.setSystemTime(new Date('2026-11-01T13:00:00Z')); // Beijing 21:00
  await page.locator('#astro-target').selectOption('Saturn');
  await expect(page.locator('#astro-night-summary')).toContainText('土星建议');
  const saturnRange = await page.locator('#astro-night-range').textContent();
  await page.clock.fastForward(2 * 3600000);
  await expect(page.locator('#astro-night-summary')).toContainText('从此刻起');
  await expect(page.locator('#astro-night-summary')).toContainText('23:00');
  await expect(page.locator('#astro-night-summary')).not.toContainText('21:38');
  await expect(page.locator('#astro-night-range')).toHaveText(saturnRange!);
});
