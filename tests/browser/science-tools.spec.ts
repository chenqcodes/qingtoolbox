import { test, expect, type Page } from '@playwright/test';

async function setRange(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((node, value) => {
    (node as HTMLInputElement).value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return (original as Function).call(this, type, ...args);
    } as typeof original;
  });
}

test('orbit: equal-radius and descending states are honest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/orbit-lab/');
  await setRange(page, '#orbit-r1', '2');
  await setRange(page, '#orbit-r2', '2');
  await expect(page.locator('#orbit-dvt')).toHaveText('0.00000');
  await expect(page.locator('#orbit-phase')).toContainText('无需点火');
  await setRange(page, '#orbit-r1', '3');
  await setRange(page, '#orbit-r2', '1');
  await expect(page.locator('#orbit-dv1')).toContainText('-');
  await expect(page.locator('#orbit-dv2')).toContainText('-');
});

test('molecule: graceful WebGL fallback keeps manual explanations available', async ({ page }) => {
  await disableWebGL(page);
  await page.goto('/tools/molecule/');
  await expect(page.locator('#mol-view-status')).toContainText('WebGL');
  await page.locator('#mol-select').selectOption('water');
  await expect(page.locator('#mol-name')).toContainText('水');
  await expect(page.locator('#mol-tour-note')).toContainText('暂停');
  await expect(page.locator('#mol-model-note')).not.toBeEmpty();
});

test('audio: loading and stopping never opens an audio source', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__audioStarts = 0;
    (window as any).AudioContext = class { constructor() { (window as any).__audioStarts++; throw Error('No source should be initialized on page load'); } };
  });
  await page.goto('/tools/audio-viz/');
  await page.locator('#audio-stop').click();
  await expect(page.locator('#audio-status')).toContainText('停止');
  expect(await page.evaluate(() => (window as any).__audioStarts)).toBe(0);
});

test('space and sunlight: unavailable WebGL exposes recovery', async ({ page }) => {
  await disableWebGL(page);
  await page.goto('/space/');
  await expect(page.locator('#sp-fallback')).toBeVisible();
  await page.goto('/building-sunlight/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#graphicsFallback')).toBeVisible();
});

for (const route of ['/tools/astro-today/', '/tools/sat-pass/', '/tools/orbit-lab/', '/tools/molecule/', '/tools/audio-viz/']) {
  test(`mobile science layout ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await disableWebGL(page);
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const details = page.locator('.lab-details');
    if (await details.count()) await details.evaluate(node => (node as HTMLDetailsElement).open = true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/science-${route.split('/').filter(Boolean).pop()}-mobile.png`, fullPage: true });
  });
}

test('moon: full and new dates use the selected observer timezone', async ({ page }) => {
  await page.goto('/tools/astro-today/');
  await page.locator('#astro-zone').fill('UTC');
  await page.locator('#astro-apply').click();
  await page.locator('#astro-date').fill('2024-06-22T01:08');
  await expect(page.locator('#astro-phase-name')).toContainText('满月');
  await expect(page.locator('#astro-now')).toContainText('UTC');
  await page.locator('#astro-date').fill('2024-04-08T18:21');
  await expect(page.locator('#astro-phase-name')).toContainText('新月');
  await expect(page.locator('#astro-illum')).toHaveText('0.0%');
});

test('satellite: stale ephemeris fails closed rather than promising passes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:00Z'));
  await page.goto('/tools/sat-pass/');
  await expect(page.locator('#sat-next')).toContainText('过期');
  await expect(page.locator('#sat-rows tr')).toHaveCount(0);
  await expect(page.locator('#sat-status')).toContainText('7 天');
});


test('satellite expiry clears predictions even with an invalid unfinished observer edit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-01T11:00:00Z') });
  await page.route('**/data/iss-tle.json?*', route => route.abort());
  await page.goto('/tools/sat-pass/');
  await page.locator('#sat-filter').selectOption('geometric');
  await expect(page.locator('#sat-rows tr').first()).toBeVisible();
  await page.locator('#sat-zone').fill('Invalid/Zone');
  await page.clock.setSystemTime(new Date('2026-10-09T00:00:00Z'));
  await page.clock.runFor(60_100);
  await expect(page.locator('#sat-next')).toContainText('预测已暂停');
  await expect(page.locator('#sat-rows tr')).toHaveCount(0);
  await expect(page.locator('#sat-range')).toHaveText('—');
});
