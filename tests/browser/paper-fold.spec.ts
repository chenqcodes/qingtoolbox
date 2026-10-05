import { test, expect } from '@playwright/test';

const route='/tools/paper-fold/';
async function setFolds(page: import('@playwright/test').Page, n: number) {
  await page.locator('#pf-folds').evaluate((input: HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},n);
}

test('initial sheet, doubling, exact layer count and scientific units', async ({page},testInfo)=>{
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-thickness','0.0001');
  await expect(page.locator('#pf-layers')).toHaveText('1');
  await page.getByRole('button',{name:'再折一次',exact:true}).click();
  await expect(lab).toHaveAttribute('data-folds','1');await expect(lab).toHaveAttribute('data-thickness','0.0002');await expect(page.locator('#pf-layers')).toHaveText('2');
  await setFolds(page,80);await expect(page.locator('#pf-layers')).toHaveText('1,208,925,819,614,629,174,706,176');
  await expect(page.locator('#pf-thickness')).toContainText('光年');await expect(page.locator('#pf-scientific')).toContainText('10²⁰');
  await expect(page.locator('#pf-step')).toBeDisabled();
  await page.getByRole('button',{name:'重置',exact:true}).click();
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-playing','false');
  await page.screenshot({path:testInfo.outputPath('paper-fold-start-desktop.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('play, pause and manual navigation never leave an old playback loop', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await page.locator('#pf-speed').selectOption('500');await page.locator('#pf-play').click();
  await expect.poll(async()=>Number(await lab.getAttribute('data-folds'))).toBeGreaterThan(1);
  await page.getByRole('button',{name:'暂停折叠'}).click();
  const paused=await lab.getAttribute('data-folds');await page.waitForTimeout(700);
  await expect(lab).toHaveAttribute('data-folds',paused!);await expect(lab).toHaveAttribute('data-playing','false');
  await page.locator('#pf-play').click();await page.locator('[data-milestone="earth"]').click();
  await expect(lab).toHaveAttribute('data-folds','37');await expect(lab).toHaveAttribute('data-playing','false');
  await page.waitForTimeout(700);await expect(lab).toHaveAttribute('data-folds','37');
  await page.locator('#pf-play').click();await page.locator('#pf-reset').click();
  await expect(lab).toHaveAttribute('data-folds','0');await page.waitForTimeout(700);await expect(lab).toHaveAttribute('data-folds','0');
});

test('reference milestones are first crossings and solar-system extent is explicit', async ({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  for(const [id,folds] of [['person',15],['house',17],['earth',37],['sun',44],['solar',57]] as const){
    await page.locator(`[data-milestone="${id}"]`).click();
    await expect(lab).toHaveAttribute('data-folds',String(folds));
    await expect(page.locator(`[data-milestone="${id}"]`)).toHaveAttribute('aria-current','true');
    if(id==='earth'||id==='solar')await page.locator('#paper-fold-lab').screenshot({path:testInfo.outputPath(`paper-fold-${id}-desktop.png`)});
  }
  await page.getByText('尺度口径与数据来源',{exact:true}).click();
  await expect(page.locator('.pf-sources')).toContainText('约 60 AU');await expect(page.locator('.pf-sources')).toContainText('不是太阳系的真实边界');
  await expect(page.locator('.pf-sources a[href="https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf"]')).toBeVisible();
});

test('changing thickness while playing pauses and recalculates all milestones', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await page.locator('#pf-play').click();await expect(lab).toHaveAttribute('data-playing','true');
  await page.locator('#pf-initial').fill('0.2');await page.locator('#pf-initial').press('Enter');
  await expect(lab).toHaveAttribute('data-playing','false');await expect(page.locator('[data-milestone-fold="earth"]')).toHaveText('36 次');
  const current=Number(await lab.getAttribute('data-folds'));
  expect(Number(await lab.getAttribute('data-thickness'))).toBeCloseTo(.0002*2**current,10);
  await page.waitForTimeout(1100);await expect(lab).toHaveAttribute('data-folds',String(current));
  await page.locator('#pf-initial').fill('2');await page.locator('#pf-initial').press('Enter');await expect(page.locator('#pf-initial')).toHaveValue('1');
  await page.locator('#pf-initial').fill('');await page.locator('#pf-initial').press('Enter');await expect(page.locator('#pf-initial')).toHaveValue('1');
  await page.locator('#pf-reset').click();await expect(page.locator('#pf-initial')).toHaveValue('0.1');
});

test('smooth logarithmic zoom survives interrupted jumps and reset', async ({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');const starting=Number(await lab.getAttribute('data-view'));
  await page.locator('[data-milestone="earth"]').click();await expect(lab).toHaveAttribute('data-motion','true');
  await expect.poll(async()=>Number(await lab.getAttribute('data-view'))).toBeGreaterThan(starting);
  const during=Number(await lab.getAttribute('data-view'));expect(during).toBeLessThan(25);
  await page.locator('[data-milestone="sun"]').click();await page.waitForTimeout(70);await page.locator('#pf-reset').click();
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-motion','false',{timeout:5000});
  expect(Number(await lab.getAttribute('data-view'))).toBeCloseTo(starting,6);await expect(lab).toHaveAttribute('data-playing','false');
});

test('reduced-motion mode is immediate, retains manual play, and stops at the bound', async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');await expect(page.locator('#pf-motion-note')).toBeVisible();
  await setFolds(page,79);await expect(lab).toHaveAttribute('data-motion','false');
  await page.locator('#pf-speed').selectOption('500');await page.locator('#pf-play').click();
  await expect(lab).toHaveAttribute('data-folds','80');await expect(lab).toHaveAttribute('data-playing','false');
  await expect(page.locator('#pf-status')).toContainText('旅程完成');await page.waitForTimeout(600);await expect(lab).toHaveAttribute('data-folds','80');
  await page.getByRole('button',{name:'重新旅行'}).click();await expect.poll(async()=>Number(await lab.getAttribute('data-folds'))).toBeLessThan(5);
  await page.locator('#pf-play').click();
});

test('mobile layout and keyboard controls remain usable', async ({page},testInfo)=>{
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);
  await page.locator('#pf-folds').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#pf-count')).toHaveText('1');
  await page.keyboard.press('End');await expect(page.locator('#pf-count')).toHaveText('80');await page.keyboard.press('Home');await expect(page.locator('#pf-count')).toHaveText('0');
  await page.locator('[data-milestone="earth"]').click();await expect(page.locator('#pf-count')).toHaveText('37');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('paper-fold-earth-mobile.png'),fullPage:true});
  await page.setViewportSize({width:320,height:780});await setFolds(page,80);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
