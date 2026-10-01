import { test, expect } from '@playwright/test';

test('orbit exploration: scrubbing pauses, equal radius coasts and one burn returns', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/orbit-lab/');
  await expect(page.locator('#orbit-play')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#orbit-mode').selectOption('one');
  await expect(page.locator('#orbit-progress')).toHaveAttribute('max', '200');
  await page.locator('#orbit-progress').evaluate(node => {
    (node as HTMLInputElement).value = '150'; node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#orbit-phase')).toContainText('返回');
  await expect(page.locator('#orbit-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#orbit-dv2')).toContainText('未执行');
  await page.locator('[data-r1="2"][data-r2="2"]').click();
  await expect(page.locator('#orbit-dvt')).toHaveText('0.00000');
  await expect(page.locator('#orbit-phase')).toContainText('无需点火');
  await page.screenshot({ path: 'test-results/science-orbit-experience-desktop.png', fullPage: true });
});
