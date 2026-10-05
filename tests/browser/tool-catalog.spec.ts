import { test, expect } from '@playwright/test';

test('new experiences are discoverable in home search and tool navigation', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('searchbox');
  const routes = ['planet-builder', 'black-hole', 'cosmic-scale', 'double-pendulum', 'city-rain', 'paper-fold', 'zeno-race'];
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

test('refreshed collection keeps category shortcuts, accessible shell and regular tools', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '让小事，轻一点。' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '按分类浏览' }).getByRole('link')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('tools-home-desktop.png') });
  await page.getByRole('searchbox').fill('PDF');
  await page.getByRole('navigation', { name: '按分类浏览' }).getByRole('link', { name: /可视化与模拟/ }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('#category-visual')).toBeVisible();
  await expect(page.locator('.tool-card[href="/tools/paper-fold/"]')).toBeVisible();
  await page.goto('/tools/base64/');
  await page.getByLabel('原文', { exact: true }).fill('你好世界');
  await page.getByRole('button', { name: '编码 →', exact: true }).click();
  await expect(page.getByLabel('Base64 结果', { exact: true })).toHaveValue('5L2g5aW95LiW55WM');
  await page.screenshot({ path: testInfo.outputPath('tools-base64-desktop.png') });
  await page.locator('.tool-switcher-menu summary').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tool-switcher-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.tool-switcher-menu summary')).toBeFocused();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`tools-home-${width}px.png`) });
    await page.getByRole('searchbox').fill('追龟');
    await expect(page.locator('.tool-card:visible')).toHaveCount(1);
    await page.getByRole('searchbox').press('Escape');
    await expect(page.getByRole('searchbox')).toHaveValue('');
  }
});
