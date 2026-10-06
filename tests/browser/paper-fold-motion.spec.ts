import { test, expect } from '@playwright/test';

test.use({video:'on'});
const route='/tools/paper-fold/';
async function setFolds(page: import('@playwright/test').Page, n: number) {
  await page.locator('#pf-folds').evaluate((input: HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},n);
}

// Record actual consecutive folds, not just before/after screenshots. These
// uninterrupted videos are retained in the existing CI browser artifact.
// Mid-turn screenshots live in the non-recording suite: screenshot capture can
// temporarily blank Chromium screencast frames and must not interrupt this film.
test.describe('whole-stack motion evidence',()=>{
  for(const width of [1440,390,320]) test(`the complete layered bundle folds repeatedly at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(route);
    const lab=page.locator('#paper-fold-lab');
    await page.locator('.pf-fold-detail').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    for(let fold=1;fold<=5;fold++){
      await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>button.click());
      await expect(lab).toHaveAttribute('data-folds',String(fold));
      await page.waitForTimeout(320);
      const angle=Number(await lab.getAttribute('data-fold-angle'));
      expect(angle).toBeGreaterThan(.1);expect(angle).toBeLessThan(Math.PI);
      await expect(lab).toHaveAttribute('data-fold-mode','whole-stack');
      await expect(lab).toHaveAttribute('data-motion','false');
      await expect(lab).toHaveAttribute('data-fold-angle','0.000000');
      await expect(page.locator('#pf-layers')).toHaveText(String(2**fold));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      expect(await page.locator('#pf-fold-detail-title').evaluate(node=>node.getBoundingClientRect().height<=parseFloat(getComputedStyle(node).lineHeight)*1.1)).toBeTruthy();
    }
    await page.locator('.pf-fold-detail').screenshot({path:testInfo.outputPath(`whole-stack-${width}-five-folds.png`)});
    await setFolds(page,4);await page.waitForTimeout(350);
    await expect(lab).toHaveAttribute('data-fold-mode','whole-stack');
    expect(Number(await lab.getAttribute('data-fold-angle'))).toBeGreaterThan(0);
    await expect(lab).toHaveAttribute('data-motion','false');
    await expect(page.locator('#pf-layers')).toHaveText('16');
    await page.locator('#pf-reset').evaluate((button:HTMLButtonElement)=>button.click());
    await expect(lab).toHaveAttribute('data-motion','false');
    await expect(lab).toHaveAttribute('data-folds','0');
  });

  test('pause, resumed folds, interrupted jumps and reduced motion keep one coherent bundle',async({page})=>{
    await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(route);
    const lab=page.locator('#paper-fold-lab');
    await page.locator('#pf-speed').selectOption('1600');await page.locator('#pf-play').click();
    await page.waitForTimeout(320);await page.locator('#pf-play').click();
    const paused=await lab.getAttribute('data-fold-angle');
    await page.waitForTimeout(250);await expect(lab).toHaveAttribute('data-fold-angle',paused!);
    await page.locator('#pf-play').click();await page.waitForTimeout(180);
    await page.locator('[data-milestone="sun"]').evaluate((button:HTMLButtonElement)=>button.click());
    await expect(lab).toHaveAttribute('data-fold-mode','journey');await page.waitForTimeout(120);
    await page.locator('#pf-reset').evaluate((button:HTMLButtonElement)=>button.click());
    await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-fold-angle','0.000000');
    await page.emulateMedia({reducedMotion:'reduce'});await setFolds(page,102);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('.pf-fold-detail').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>button.click());await page.waitForTimeout(350);
    await expect(lab).toHaveAttribute('data-fold-mode','whole-stack');
    await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-folds','103');
    await expect(page.locator('#pf-fold-detail-title')).toContainText('旅程抵达终点');
    await page.emulateMedia({reducedMotion:'reduce'});await setFolds(page,6);
    await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-fold-angle','0.000000');
    await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>button.click());
    await expect(lab).toHaveAttribute('data-folds','7');await expect(lab).toHaveAttribute('data-fold-mode','rest');
  });
});
