import { expect, test, type Page } from '@playwright/test';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

async function range(page: Page, id: string, value: string) {
  await page.locator(id).evaluate((el, next) => { const input = el as HTMLInputElement; input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}

test('black hole renders textured emission, meaningful physical values and accessible controls', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/black-hole/');
  const root = page.locator('#bh-observatory');
  await expect(root).toHaveAttribute('data-frame', /[1-9]/);
  await expect(page.locator('#bh-pause')).toContainText('继续流动');
  await expect(page.locator('#bh-status')).toContainText('减少动态效果');
  const colors = await page.locator('#bh-canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement, context = canvas.getContext('2d')!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0; const tones = new Set<string>();
    for (let i = 0; i < data.length; i += 16) { if (data[i] > 80 && data[i] > data[i + 2] * 1.5) bright++; tones.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); }
    return { bright, tones: tones.size };
  });
  expect(colors.bright).toBeGreaterThan(1000); expect(colors.tones).toBeGreaterThan(100);
  const radiusBefore = await page.locator('#bh-radius').textContent(), angleBefore = await page.locator('#bh-angle').textContent();
  await range(page, '#bh-mass', '8');
  await expect(page.locator('#bh-radius')).not.toHaveText(radiusBefore!);
  await expect(page.locator('#bh-angle')).toHaveText(angleBefore!);
  await range(page, '#bh-distance', '96');
  await expect(page.locator('#bh-angle')).toHaveText('3.10°');
  await expect(root).toHaveAttribute('data-rendered-distance', '96.00');
  await page.locator('#bh-mass').focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#bh-mass')).toHaveAttribute('aria-valuetext', /太阳质量/);
  await page.locator('#bh-reset').click();
  await expect(page.locator('#bh-distance-value')).toHaveText('48 Rₛ');
  await expect(page.locator('#bh-observatory')).toHaveAttribute('data-paused', 'true');
  await page.screenshot({ path: testInfo.outputPath('black-hole-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('black-hole-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('lensing and viewing angle visibly change scene while pause remains stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/black-hole/');
  const root = page.locator('#bh-observatory');
  await expect(root).toHaveAttribute('data-frame', /[1-9]/);
  const checksum = () => page.locator('#bh-canvas').evaluate(el => (el as HTMLCanvasElement).toDataURL());
  const original = await checksum();
  await page.locator('#bh-lensing').uncheck();
  await expect.poll(checksum).not.toBe(original);
  await page.locator('#bh-lensing').check();
  await range(page, '#bh-inclination', '0');
  await expect(root).toHaveAttribute('data-rendered-inclination', '0.00');
  const faceOn = await checksum(); expect(faceOn).not.toBe(original);
  const frame = await root.getAttribute('data-frame');
  await page.waitForTimeout(200); await expect(root).toHaveAttribute('data-frame', frame!);
  await page.locator('#bh-pause').click();
  await expect.poll(async () => Number(await root.getAttribute('data-frame'))).toBeGreaterThan(Number(frame) + 2);
  await page.locator('#bh-pause').click();
  await expect(root).toHaveAttribute('data-paused', 'true');
});

test('new input interrupts smooth camera changes, repeated preset and reset remain coherent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.goto('/tools/black-hole/');
  const root = page.locator('#bh-observatory'); await expect(root).toHaveAttribute('data-frame', /[1-9]/);
  await range(page, '#bh-distance', '110'); await range(page, '#bh-distance', '25'); await range(page, '#bh-distance', '70');
  await expect.poll(async () => Number(await root.getAttribute('data-rendered-distance'))).toBeCloseTo(70, 1);
  await page.getByRole('button', { name: 'M87 尺度', exact: true }).click();
  await page.getByRole('button', { name: '恒星级', exact: true }).click();
  await expect(page.locator('#bh-mass-value')).toHaveText('10 M☉');
  await expect(page.locator('#bh-radius')).toHaveText('29.53 km');
  await page.locator('#bh-reset').click();
  await expect(page.locator('#bh-mass-value')).toHaveText('430 万 M☉');
  await expect.poll(async () => Number(await root.getAttribute('data-rendered-distance'))).toBeCloseTo(48, 1);
  // Offscreen suspension must not accumulate time or restart a manually paused scene.
  await page.locator('#bh-pause').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(root).toHaveAttribute('data-paused', 'true');
  await page.goto('/'); await page.goBack();
  await expect(page.locator('#bh-observatory')).toHaveAttribute('data-booted', 'true');
});

test('Canvas failure retains a useful SVG explanation and physical calculator', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (this.id === 'bh-canvas') return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/tools/black-hole/');
  await expect(page.locator('#bh-fallback')).toBeVisible();
  await expect(page.locator('#bh-fallback svg')).toHaveAttribute('aria-label', /黑洞阴影/);
  await expect(page.locator('#bh-pause')).toBeDisabled();
  await page.getByRole('button', { name: '恒星级', exact: true }).click();
  await expect(page.locator('#bh-radius')).toHaveText('29.53 km');
  await range(page, '#bh-distance', '96');
  await expect(page.locator('#bh-angle')).toHaveText('3.10°');
  await page.screenshot({ path: testInfo.outputPath('black-hole-fallback.png'), fullPage: true });
});
