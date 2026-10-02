import { expect, test, type Page } from '@playwright/test';
import { HOME_EXP, MAX_EXP, MIN_EXP, STOPS, stopExponent } from '../../src/scripts/cosmic-scale/model';

// Record actual browser motion for visual review alongside the still images.
test.use({ video: { mode: 'on', size: { width: 1000, height: 700 } } });

const exponent = (page: Page) => page.locator('#cosmic-app').getAttribute('data-exponent').then(Number);
async function setScale(page: Page, value: number) {
  await page.locator('#cosmic-range').evaluate((input, n) => { (input as HTMLInputElement).value = String(n); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}

test('cosmic scale has readable stops, real dimensions and desktop/mobile visual evidence', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tools/cosmic-scale/');
  await expect(page.locator('#cosmic-name')).toHaveText('你手边的杯子');
  await expect(page.locator('#cosmic-field-size')).toHaveText('36 厘米');
  await expect(page.locator('#cosmic-play')).toBeDisabled();
  await expect(page.locator('#cosmic-status')).toContainText('已减少动态效果');
  await page.locator('#cosmic-app').screenshot({ path: testInfo.outputPath('cosmic-cup-desktop.png') });
  for (const id of ['dna', 'cell', 'earth', 'solar', 'galaxy']) {
    const stop = STOPS.find(s => s.id === id)!;
    await page.locator(`[data-stop="${id}"]`).click();
    await expect(page.locator('#cosmic-name')).toHaveText(stop.name);
    expect(Math.abs(await exponent(page) - stopExponent(stop))).toBeLessThan(.001);
    await expect(page.locator('#cosmic-source')).toHaveAttribute('href', stop.source!.url);
    await expect(page.locator('#cosmic-dimension')).toHaveText(stop.dimension);
    await page.locator('#cosmic-app').screenshot({ path: testInfo.outputPath(`cosmic-${id}-desktop.png`) });
  }
  await expect(page.locator('#cosmic-next')).toBeDisabled();
  await page.locator('#cosmic-home').click();
  await page.locator('#cosmic-stage').focus();
  await page.keyboard.press('ArrowRight');
  expect(Math.abs(await exponent(page) - HOME_EXP - .2)).toBeLessThan(.001);
  await page.keyboard.press('Home');
  expect(Math.abs(await exponent(page) - HOME_EXP)).toBeLessThan(.001);
  await page.keyboard.press('PageDown');
  await expect(page.locator('#cosmic-name')).toHaveText('一个人的身高');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#cosmic-home').click();
  await page.locator('#cosmic-app').screenshot({ path: testInfo.outputPath('cosmic-cup-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('#cosmic-fact').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  expect((await page.locator('#cosmic-play').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('cosmic travel is continuous, manually interruptible and latest navigation wins', async ({ page }) => {
  await page.goto('/tools/cosmic-scale/');
  await page.locator('#cosmic-play').click();
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => exponent(page)).toBeGreaterThan(HOME_EXP + .03);
  await setScale(page, 5.25);
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'false');
  const paused = await exponent(page); await page.waitForTimeout(300);
  expect(await exponent(page)).toBe(paused);
  await page.locator('[data-stop="galaxy"]').click();
  await expect(page.locator('#cosmic-app')).toHaveAttribute('data-motion', 'true');
  await page.locator('#cosmic-home').click();
  await expect.poll(() => exponent(page)).toBeCloseTo(HOME_EXP, 3);
  await expect(page.locator('#cosmic-name')).toHaveText('你手边的杯子');
  await page.locator('#cosmic-play').click();
  await page.locator('#cosmic-select').selectOption('earth');
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cosmic-name')).toHaveText('地球');
  await setScale(page, MAX_EXP - .01);
  await page.locator('#cosmic-play').click();
  await expect(page.locator('#cosmic-status')).toContainText('已抵达银河系');
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'false');
});

test('cosmic wheel is opt-in, endpoints clamp, and hidden-page event pauses without auto-resume', async ({ page }) => {
  await page.goto('/tools/cosmic-scale/');
  const canvas = page.locator('#cosmic-stage');
  const initial = await exponent(page);
  await canvas.dispatchEvent('wheel', { deltaY: 100 });
  expect(await exponent(page)).toBe(initial);
  await page.locator('#cosmic-wheel').check();
  await canvas.dispatchEvent('wheel', { deltaY: 100 });
  expect(await exponent(page)).toBeGreaterThan(initial);
  await setScale(page, MIN_EXP);
  await expect(page.locator('#cosmic-in')).toBeDisabled();
  await canvas.dispatchEvent('wheel', { deltaY: -99999 });
  expect(Math.abs(await exponent(page) - MIN_EXP)).toBeLessThan(.001);
  await page.locator('#cosmic-play').click();
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'true');
  // Exercise the exact browser lifecycle handler deterministically, rather than relying on headless tab scheduling.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#cosmic-status')).toContainText('页面已隐藏');
  const paused = await exponent(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200);
  expect(await exponent(page)).toBe(paused);
  await expect(page.locator('#cosmic-play')).toHaveAttribute('aria-pressed', 'false');
});

test('cosmic canvas fallback still exposes all measured data and sources', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      return this.id === 'cosmic-canvas' ? null : original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/tools/cosmic-scale/');
  await expect(page.locator('#cosmic-status')).toContainText('画布暂不可用');
  await expect(page.locator('#cosmic-play')).toBeDisabled();
  await setScale(page, stopExponent(STOPS.find(s => s.id === 'earth')!));
  await expect(page.locator('#cosmic-dimension')).toHaveText('赤道直径约 12,756 千米');
  await page.getByText('查看全部尺寸、建模约定与科学来源').click();
  await expect(page.locator('.cosmic-data-grid article')).toHaveCount(STOPS.length);
});

// Browser Back/Forward may or may not use BFCache in CI; these real lifecycle event
// objects exercise the persisted branch deterministically without claiming a cache hit.
test('persisted pagehide/pageshow retains selected scale and usable listeners', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/cosmic-scale/');
  await page.locator('[data-stop="earth"]').click();
  const before = await exponent(page);
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  expect(await exponent(page)).toBe(before);
  await expect(page.locator('#cosmic-name')).toHaveText('地球');
  await expect(page.locator('#cosmic-status')).toContainText('离开时的尺度');
  await page.locator('[data-stop="dna"]').click();
  await expect(page.locator('#cosmic-name')).toHaveText('DNA 双螺旋');
  await page.locator('#cosmic-home').click();
  await expect(page.locator('#cosmic-name')).toHaveText('你手边的杯子');
});

test('scale slider ticks correspond to actual logarithmic field widths', async ({ page }) => {
  await page.goto('/tools/cosmic-scale/');
  const ticks = await page.locator('.cosmic-scale-labels span').evaluateAll(elements => {
    const range = document.querySelector<HTMLInputElement>('#cosmic-range')!;
    return elements.map(el => ({ actual: Number.parseFloat((el as HTMLElement).style.left), expected: (Math.log10(Number((el as HTMLElement).dataset.metres)) - Number(range.min)) / (Number(range.max) - Number(range.min)) * 100 }));
  });
  expect(ticks).toHaveLength(4);
  for (const tick of ticks) expect(tick.actual).toBeCloseTo(tick.expected, 5);
});
