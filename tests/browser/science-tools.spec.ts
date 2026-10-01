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
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/science-${route.split('/').filter(Boolean).pop()}-mobile.png`, fullPage: true });
  });
}
