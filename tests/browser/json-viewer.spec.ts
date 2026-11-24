import { expect, test } from '@playwright/test';

test('preserves numeric tokens in preview, filtered copy, format, minify and repair', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/tools/json-viewer/');
  const input = page.locator('#json-input');
  const copy = page.locator('#btn-copy-output');
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const fixture = '{"items":[{"id":9007199254740993,"remove":9007199254740992}],"text":"9007199254740993","huge":1e400,"tiny":1e-400,"fraction":0.123456789123456789,"zero":-0}';

  await input.fill(fixture);
  await expect(page.locator('#json-editor-host')).toContainText('1e400');
  await page.locator('#btn-toggle-tree').click();
  const numbers = page.locator('#json-editor-host .jse-value.jse-number');
  await expect(numbers).toHaveText(['9007199254740993', '9007199254740992', '1e400', '1e-400', '0.123456789123456789', '-0']);
  await expect(page.locator('#json-editor-host .jse-value.jse-string')).toHaveText('9007199254740993');
  await copy.click();
  expect((await clipboard()).replace(/\s/g, '')).toBe(fixture);

  await page.locator('#field-filter-rules').fill('id');
  await expect(numbers).toHaveText(['9007199254740993']);
  await copy.click();
  expect((await clipboard()).replace(/\s/g, '')).toBe('{"items":[{"id":9007199254740993}]}');
  await page.locator('#btn-clear-field-filter').click();

  await page.locator('#btn-format').click();
  expect((await input.inputValue()).replace(/\s/g, '')).toBe(fixture);
  await page.locator('#btn-minify').click();
  await expect(input).toHaveValue(fixture);

  await input.fill('{id:9007199254740993, huge:1e400,}');
  await page.locator('#btn-format').click();
  expect((await input.inputValue()).replace(/\s/g, '')).toBe('{"id":9007199254740993,"huge":1e400}');

  await input.fill('null');
  await page.locator('#btn-format').click();
  await copy.click();
  expect(await clipboard()).toBe('null');
});

test('stroke-order copy distinguishes local list and per-character CDN lookup', async ({ page }) => {
  await page.goto('/tools/hanzi-write/');
  await expect(page.locator('main')).toContainText('生字本仅保存在本机浏览器，不会整本上传');
  await expect(page.locator('main')).toContainText('请求地址包含该字');
});
