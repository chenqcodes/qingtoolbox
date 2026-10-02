import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

async function openBuilder(page: Page) {
  await page.goto('/tools/planet-builder/');
  await expect(page.locator('#planet-builder')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#pb-loading')).toBeHidden();
}
async function changeSlider(page: Page, id: string, value: number) {
  await page.locator(id).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function canvasSignature(page: Page): Promise<string> {
  return page.locator('#pb-canvas').evaluate((element) => (element as HTMLCanvasElement).toDataURL());
}

test.describe('planet atelier: local Canvas 2D procedural worlds', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

  test('renders a detailed sphere without WebGL and responds to creative controls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // The planet should work on devices where WebGL is unavailable.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function (kind: string, ...args: unknown[]) {
        if (kind.startsWith('webgl') || kind === 'experimental-webgl') return null;
        return (original as any).call(this, kind, ...args);
      };
    });
    await openBuilder(page);
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-playing', 'false');
    const variation = await page.locator('#pb-canvas').evaluate(element => {
      const canvas = element as HTMLCanvasElement, context = canvas.getContext('2d')!;
      const pixels = context.getImageData(canvas.width * .25, canvas.height * .25, canvas.width * .5, canvas.height * .5).data;
      const colors = new Set<number>();
      for (let i = 0; i < pixels.length; i += 32) colors.add(pixels[i] << 16 | pixels[i + 1] << 8 | pixels[i + 2]);
      return colors.size;
    });
    expect(variation).toBeGreaterThan(1500);
    await page.screenshot({ path: 'test-results/planet-builder-desktop.png', fullPage: true });
    const initial = await canvasSignature(page);
    await changeSlider(page, '#pb-sea', 90);
    await expect(page.locator('#pb-sea-value')).toHaveText('90');
    await expect.poll(async () => (await canvasSignature(page)) !== initial).toBe(true);
    await changeSlider(page, '#pb-phase', 110);
    await expect(page.locator('#pb-light-stat')).toHaveText('33%');
    await page.locator('#pb-aurora').check();
    await page.locator('#pb-storm').check();
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-aurora', 'true');
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-storm', 'true');
    await expect(page.locator('#pb-canvas')).toHaveAttribute('aria-label', /开启极光/);
    expect(errors).toEqual([]);
  });

  test('presets, keyboard and pointer rotation, regeneration and pause are repeatable', async ({ page }) => {
    await openBuilder(page);
    await page.locator('[data-preset="frost"]').click();
    await expect(page.locator('#pb-world-name')).toHaveText('极夜冰原');
    await expect(page.locator('#pb-aurora')).toBeChecked();
    await expect(page.locator('#pb-warmth')).toHaveValue('13');
    await expect(page.locator('#pb-loading')).toBeHidden();
    const frost = await canvasSignature(page);
    await page.locator('#pb-canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await canvasSignature(page)) !== frost).toBe(true);
    const beforeDrag = await page.locator('#planet-builder').getAttribute('data-rotation');
    const box = (await page.locator('#pb-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .62, box.y + box.height * .46, { steps: 6 }); await page.mouse.up();
    await expect(page.locator('#planet-builder')).not.toHaveAttribute('data-rotation', beforeDrag!);
    await page.locator('#pb-home').click();
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-rotation', '1.1000');
    await page.locator('#pb-play').click();
    await expect(page.locator('#pb-play')).toHaveAttribute('aria-pressed', 'true');
    const start = await page.locator('#planet-builder').getAttribute('data-frame');
    await expect(page.locator('#planet-builder')).not.toHaveAttribute('data-frame', start!);
    await page.locator('#pb-play').click();
    await expect(page.locator('#pb-play')).toHaveAttribute('aria-pressed', 'false');
    const stopped = await page.locator('#planet-builder').getAttribute('data-frame');
    await page.waitForTimeout(350);
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-frame', stopped!);
    const seed = await page.locator('#pb-seed-value').textContent();
    await page.locator('#pb-regenerate').click();
    await expect(page.locator('#pb-seed-value')).not.toHaveText(seed!);
    await expect(page.locator('#pb-warmth')).toHaveValue('13');
    await page.locator('[data-preset="ember"]').click();
    await expect(page.locator('#pb-storm')).toBeChecked();
    await expect(page.locator('#pb-loading')).toBeHidden();
    await page.screenshot({ path: 'test-results/planet-builder-ember.png', fullPage: true });
    await page.locator('[data-preset="oasis"]').click();
    await expect(page.locator('#pb-seed-value')).toHaveText('2718');
    await expect(page.locator('#pb-aurora')).not.toBeChecked();
  });

  test('exports a real 1600 by 1400 PNG and keeps the editor usable', async ({ page }) => {
    await openBuilder(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#pb-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('planet-oasis-2718.png');
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(1600);
    expect(bytes.readUInt32BE(20)).toBe(1400);
    expect(bytes.length).toBeGreaterThan(100_000);
    await expect(page.locator('#pb-export')).toBeEnabled();
    await expect(page.locator('#pb-status')).toContainText('PNG 已生成');
    await page.locator('[data-preset="frost"]').click();
    await expect(page.locator('#pb-world-name')).toHaveText('极夜冰原');
  });

  test('rapid world changes cancel stale generation and a pending export keeps its clicked world', async ({ page }) => {
    await openBuilder(page);
    await page.locator('[data-preset="ember"]').click();
    await page.locator('[data-preset="frost"]').click();
    await page.locator('#pb-regenerate').click();
    await page.locator('[data-preset="oasis"]').click();
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-texture-seed', '2718');
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-generating', 'false');
    await expect(page.locator('#pb-world-name')).toHaveText('潮汐花园');
    const downloadPromise = page.waitForEvent('download');
    // Dispatch together to intentionally export while the new texture is pending,
    // then supersede the live world before the export has completed.
    await page.evaluate(() => {
      (document.querySelector('[data-preset="ember"]') as HTMLButtonElement).click();
      (document.querySelector('#pb-export') as HTMLButtonElement).click();
      (document.querySelector('[data-preset="frost"]') as HTMLButtonElement).click();
    });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('planet-ember-1618.png');
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-texture-seed', '3141');
    await expect(page.locator('#pb-world-name')).toHaveText('极夜冰原');
    await expect(page.locator('#pb-export')).toBeEnabled();
  });

  test('mobile layout has no horizontal overflow and all parameter controls remain reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBuilder(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/planet-builder-mobile.png', fullPage: true });
    await page.locator('[data-preset="frost"]').click();
    await expect(page.locator('[data-preset="frost"]')).toHaveAttribute('aria-pressed', 'true');
    await changeSlider(page, '#pb-phase', 135);
    await expect(page.locator('#pb-phase-value')).toHaveText('135°');
    await page.locator('#pb-storm').check();
    await page.locator('#pb-export').scrollIntoViewIfNeeded();
    await expect(page.locator('#pb-export')).toBeInViewport();
    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#pb-canvas').scrollIntoViewIfNeeded();
    await expect(page.locator('#pb-loading')).toBeHidden();
    await page.screenshot({ path: 'test-results/planet-builder-small-mobile.png', fullPage: true });
  });

  test('navigation and unavailable Canvas are recoverable, clear states', async ({ page }) => {
    await openBuilder(page);
    await page.goto('/');
    await page.goBack();
    await expect(page.locator('#planet-builder')).toHaveAttribute('data-ready', 'true');
    await page.locator('#pb-play').click();
    await expect(page.locator('#pb-play')).toHaveAttribute('aria-pressed', 'true');
    await page.addInitScript(() => {
      (HTMLCanvasElement.prototype as any).getContext = () => null;
    });
    await page.reload();
    await expect(page.locator('#pb-unavailable')).toBeVisible();
    await expect(page.locator('#pb-loading')).toBeHidden();
    await expect(page.locator('#pb-export')).toBeDisabled();
  });
});
