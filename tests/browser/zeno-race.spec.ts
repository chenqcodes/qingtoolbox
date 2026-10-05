import { test, expect, type Page } from '@playwright/test';
const setRange = async (page: Page, id: string, value: number) => page.locator(id).evaluate((node: HTMLInputElement, number) => { node.value = String(number); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);

test('chosen endpoints remain before meeting; continuous time passes it', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tools/zeno-race/');
  const lab = page.locator('#zeno-race-lab');
  await expect(lab).toHaveAttribute('data-stage', '0');
  for (const [stage, duration, total, gap] of [[1, '1 s', '1 s', '1 m'], [2, '0.1 s', '1.1 s', '0.1 m'], [3, '0.01 s', '1.11 s', '0.01 m']] as const) {
    await page.locator('#zr-next').click();
    await expect(lab).toHaveAttribute('data-stage', String(stage));
    await expect(page.locator('#zr-segment')).toHaveText(duration); await expect(page.locator('#zr-time')).toHaveText(total); await expect(page.locator('#zr-gap')).toHaveText(gap);
    await expect(page.locator('#zr-observation')).toContainText('相遇之前');
    expect(Number(await lab.getAttribute('data-time'))).toBeLessThan(10 / 9);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('zeno-snapshots-desktop.png'), fullPage: true });
  await page.locator('#zr-meet').click();
  await expect(lab).toHaveAttribute('data-mode', 'continuous'); await expect(page.locator('#zr-gap')).toHaveText('0 m');
  await expect(page.locator('#zr-observation')).toContainText('相遇时刻');
  await page.locator('#zr-compare').click();
  await expect(page.locator('#zr-time')).toHaveText('1.2 s'); await expect(page.locator('#zr-rabbit-position')).toHaveText('12 m'); await expect(page.locator('#zr-turtle-position')).toHaveText('11.2 m');
  await expect(page.locator('#zr-gap')).toHaveText('0.8 m'); await expect(page.locator('#zr-gap-label')).toHaveText('兔子已领先');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('zeno-passing-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('playback pauses, resets, parameter edits and mode switches cancel old frames', async ({ page }) => {
  await page.goto('/tools/zeno-race/'); const lab = page.locator('#zeno-race-lab');
  await page.locator('#zr-mode-continuous').click(); await page.locator('#zr-play').click();
  await expect.poll(async () => Number(await lab.getAttribute('data-time'))).toBeGreaterThan(.08);
  await page.locator('#zr-play').click(); const paused = await lab.getAttribute('data-time');
  await page.waitForTimeout(250); await expect(lab).toHaveAttribute('data-time', paused!);
  await page.locator('#zr-play').click(); await setRange(page, '#zr-lead', 20);
  await expect(lab).toHaveAttribute('data-running', 'false'); await expect(lab).toHaveAttribute('data-time', '0');
  await page.waitForTimeout(250); await expect(lab).toHaveAttribute('data-time', '0');
  await page.locator('#zr-replay').click(); await expect(lab).toHaveAttribute('data-running', 'true');
  await page.locator('#zr-mode-steps').click(); await expect(lab).toHaveAttribute('data-time', '0');
  await page.locator('#zr-next').click(); await expect(page.locator('#zr-time')).toHaveText('2 s');
  await page.locator('#zr-replay').click(); await page.locator('#zr-reset').click();
  await page.waitForTimeout(950); await expect(lab).toHaveAttribute('data-stage', '0'); await expect(lab).toHaveAttribute('data-running', 'false');
  await page.locator('#zr-compare').click(); await expect(page.locator('#zr-lead')).toHaveValue('10');
  await page.locator('#zr-mode-steps').click(); await expect(lab).toHaveAttribute('data-stage', '3');
  await page.locator('#zr-reset').click(); await expect(lab).toHaveAttribute('data-time', '0');
});

test('zero speeds, already met, equal and slower cases are honest and finite', async ({ page }) => {
  await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-turtle-speed', 0); await page.locator('#zr-next').click();
  await expect(page.locator('#zr-gap')).toHaveText('0 m'); await expect(page.locator('#zr-next')).toBeDisabled(); await expect(page.locator('#zr-observation')).toContainText('第一段');
  await setRange(page, '#zr-rabbit-speed', 0); await expect(page.locator('#zr-next')).toBeDisabled(); await expect(page.locator('#zr-limit-time')).toHaveText('无法追上');
  await setRange(page, '#zr-turtle-speed', 1); await expect(page.locator('#zr-observation')).toContainText('兔子不动');
  await setRange(page, '#zr-rabbit-speed', 1); await page.locator('#zr-next').click(); await expect(page.locator('#zr-gap')).toHaveText('10 m');
  await expect(page.locator('#zr-limit-time')).toHaveText('无法追上'); await expect(page.locator('#zr-meet')).toBeDisabled();
  await setRange(page, '#zr-turtle-speed', 2); await page.locator('#zr-next').click(); await expect(page.locator('#zr-gap')).toHaveText('20 m');
  await setRange(page, '#zr-lead', 0); await expect(page.locator('#zr-limit-time')).toHaveText('0 s'); await expect(page.locator('#zr-next')).toBeDisabled();
  await page.locator('#zr-mode-continuous').click(); await setRange(page, '#zr-scrub', 400); await expect(page.locator('#zr-time')).toHaveText('2 s');
  await setRange(page, '#zr-lead', 17); await setRange(page, '#zr-rabbit-speed', 3.7); await setRange(page, '#zr-turtle-speed', 2.9);
  await page.locator('#zr-meet').click(); await expect(page.locator('#zr-gap')).toHaveText('0 m'); await expect(page.locator('#zr-stage-label')).toContainText('此刻相遇');
  await expect(page.locator('#zeno-race-lab')).not.toContainText('NaN'); await expect(page.locator('#zeno-race-lab')).not.toContainText('Infinity');
});

test('precision stop retains positive gap and tail without claiming infinite completion', async ({ page }) => {
  await page.goto('/tools/zeno-race/');
  for (let i = 0; i < 30 && await page.locator('#zr-next').isEnabled(); i++) await page.locator('#zr-next').click();
  await expect(page.locator('#zr-next')).toBeDisabled();
  await expect(page.locator('#zr-resolution')).toContainText('没有完成');
  expect(Number(await page.locator('#zeno-race-lab').getAttribute('data-gap'))).toBeGreaterThan(0);
  expect(Number(await page.locator('#zeno-race-lab').getAttribute('data-time'))).toBeLessThan(10 / 9);
  await expect(page.locator('#zr-tail')).not.toHaveText('0 s');
  await page.locator('#zr-meet').click(); await expect(page.locator('#zr-gap')).toHaveText('0 m');
});

for (const width of [390, 320]) test(`mobile ${width}px keyboard and reduced-motion controls remain usable`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/zeno-race/');
  await page.waitForTimeout(200); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'false');
  await page.locator('#zr-lead').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#zr-lead-value')).toHaveText('11 m');
  await page.locator('#zr-next').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#zr-time')).toHaveText('1.1 s');
  await page.locator('#zr-mode-continuous').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#zr-mode-continuous')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#zr-scrub').focus(); await page.keyboard.press('End'); await expect(page.locator('#zr-gap-label')).toHaveText('兔子已领先');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: testInfo.outputPath('zeno-mobile.png'), fullPage: true });
});
