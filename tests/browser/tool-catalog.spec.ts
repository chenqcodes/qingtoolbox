import { test, expect } from '@playwright/test';

test('new experiences are discoverable in home search and tool navigation', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('searchbox');
  const routes = ['planet-builder', 'black-hole', 'cosmic-scale', 'double-pendulum', 'city-rain'];
  for (const slug of routes) {
    await input.fill(slug);
    await expect(page.locator('.tool-card:visible')).toHaveCount(1);
    await expect(page.locator('.tool-card:visible')).toHaveAttribute('href', `/tools/${slug}/`);
  }
  await input.fill('不存在的工具 xyz');
  await expect(page.locator('.tool-card:visible')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('没有找到');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await page.locator('.tool-card[href="/tools/planet-builder/"]').click();
  await page.locator('.tool-switcher-menu summary').click();
  await expect(page.locator('.tool-switcher-list a[aria-current="page"]')).toHaveAttribute('href', '/tools/planet-builder/');
  for (const slug of routes) await expect(page.locator(`.tool-switcher-list a[href="/tools/${slug}/"]`)).toBeVisible();
});

test('catalog search remains usable on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('searchbox').fill('混沌');
  await expect(page.locator('.tool-card:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
