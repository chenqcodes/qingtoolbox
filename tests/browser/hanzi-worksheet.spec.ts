import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('A4 sheets paginate complete rows, preserve editable readings and print exactly two pages', async ({ page }, testInfo) => {
  await page.goto('/tools/hanzi-worksheet/');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#worksheet-text').fill('春夏秋冬山川日月星');
  await expect(page.locator('.worksheet-sheet')).toHaveCount(2);
  await expect(page.locator('.worksheet-practice-row')).toHaveCount(9);
  await expect(page.locator('.worksheet-trace').filter({ hasText: /\S/ })).toHaveCount(45);
  await page.locator('#worksheet-text').fill('行行重重山川日月星');
  await page.locator('#worksheet-readings-panel').evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await page.locator('#worksheet-reading-editor input[data-index="0"]').fill('háng');
  await page.locator('#worksheet-reading-editor input[data-index="1"]').fill('xíng');
  await expect(page.locator('.worksheet-reading').nth(0)).toHaveText('háng');
  await expect(page.locator('.worksheet-reading').nth(1)).toHaveText('xíng');
  await page.locator('#worksheet-trace').selectOption('2');
  await expect(page.locator('.worksheet-trace').filter({ hasText: /\S/ })).toHaveCount(18);
  await expect(page.locator('.worksheet-reading').nth(0)).toHaveText('háng');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#worksheet-print')).toBeHidden();
  const layout = await page.locator('.worksheet-sheet').evaluateAll(sheets => sheets.map(sheet => {
    const rect = sheet.getBoundingClientRect();
    return { width: rect.width, height: rect.height, overflow: sheet.scrollWidth > sheet.clientWidth || sheet.scrollHeight > sheet.clientHeight,
      rowsFit: [...sheet.querySelectorAll('.worksheet-practice-row')].every(row => row.getBoundingClientRect().bottom <= rect.bottom) };
  }));
  for (const sheet of layout) { expect(sheet.width).toBeCloseTo(210 * 96 / 25.4, 0); expect(sheet.height).toBeCloseTo(297 * 96 / 25.4, 0); expect(sheet.overflow).toBe(false); expect(sheet.rowsFit).toBe(true); }
  const bytes = await page.pdf({ path: testInfo.outputPath('worksheet-a4.pdf'), preferCSSPageSize: true, printBackground: false });
  const pdf = await PDFDocument.load(bytes); expect(pdf.getPageCount()).toBe(2);
  for (const paper of pdf.getPages()) { expect(paper.getWidth()).toBeCloseTo(595.28, 0); expect(paper.getHeight()).toBeCloseTo(841.89, 0); }
  await page.screenshot({ path: testInfo.outputPath('worksheet-print.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('dictation hides answers and optionally pinyin; empty and maximum input disable unsafe printing', async ({ page }) => {
  await page.goto('/tools/hanzi-worksheet/');
  await page.locator('#worksheet-text').fill('春夏秋冬');
  await page.locator('#worksheet-mode').selectOption('dictation');
  await expect(page.locator('.worksheet-trace').filter({ hasText: /\S/ })).toHaveCount(0);
  await expect(page.locator('#worksheet-pages')).not.toContainText('春');
  await page.locator('#worksheet-pinyin').uncheck();
  await expect(page.locator('.worksheet-reading').filter({ hasText: /\S/ })).toHaveCount(0);
  await page.locator('#worksheet-repeat').selectOption('3');
  await expect(page.locator('.worksheet-practice-row')).toHaveCount(12);
  await expect(page.locator('.worksheet-sheet')).toHaveCount(2);
  await page.locator('#worksheet-clear').click();
  await expect(page.locator('#worksheet-print')).toBeDisabled();
  await expect(page.locator('.worksheet-sheet')).toHaveCount(0);
  await page.locator('#worksheet-text').fill('abc <img src=x> 123');
  await expect(page.locator('#worksheet-print')).toBeDisabled();
  await page.locator('#worksheet-text').fill('春'.repeat(201));
  await expect(page.locator('#worksheet-print')).toBeDisabled();
  await expect(page.locator('#worksheet-status')).not.toBeEmpty();
});

test('mobile preview fits viewport, transfers Chinese text locally and print control invokes browser print', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/hanzi-worksheet/#text=%E6%98%A5%E5%A4%8F%E7%A7%8B%E5%86%AC');
  await expect(page.locator('#worksheet-text')).toHaveValue('春夏秋冬');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('worksheet-mobile.png'), fullPage: true });
  await page.evaluate(() => { (window as any).__printCalls = 0; window.print = () => { (window as any).__printCalls += 1; }; });
  await page.locator('#worksheet-print').click();
  expect(await page.evaluate(() => (window as any).__printCalls)).toBe(1);
  await page.goto('/tools/pinyin/');
  await expect(page.locator('#py-worksheet-link')).toBeVisible();
  await page.goto('/tools/hanzi-write/');
  await expect(page.locator('#hanzi-worksheet-link')).toBeVisible();
});
