import { test, expect } from '@playwright/test';

const route='/tools/paper-fold/';
// Emulation changes matchMedia immediately, but its change event is queued.
// Wait for the app's own acknowledgement before sending the next control input.
async function setMotion(page: import('@playwright/test').Page, value: 'reduce' | 'no-preference') {
  await page.emulateMedia({reducedMotion:value});
  if(page.url().endsWith(route)){
    if(value==='reduce')await expect(page.locator('#pf-motion-note')).toBeVisible();
    else await expect(page.locator('#pf-motion-note')).toBeHidden();
  }
}
async function setFolds(page: import('@playwright/test').Page, n: number) {
  await page.locator('#pf-folds').evaluate((input: HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},n);
}

test('initial sheet, doubling, exact layer count and scientific units', async ({page},testInfo)=>{
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await setMotion(page,'reduce');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-thickness','0.0001');
  await expect(page.locator('#pf-layers')).toHaveText('1');
  await page.getByRole('button',{name:'再折一次',exact:true}).click();
  await expect(lab).toHaveAttribute('data-folds','1');await expect(lab).toHaveAttribute('data-thickness','0.0002');await expect(page.locator('#pf-layers')).toHaveText('2');
  await setFolds(page,80);await expect(page.locator('#pf-layers')).toHaveText('1,208,925,819,614,629,174,706,176');
  await expect(page.locator('#pf-thickness')).toContainText('光年');await expect(page.locator('#pf-scientific')).toContainText('10²⁰');
  await expect(page.locator('#pf-step')).toBeEnabled();
  await setFolds(page,103);await expect(page.locator('#pf-step')).toBeDisabled();
  await page.getByRole('button',{name:'重置',exact:true}).click();
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-playing','false');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('paper-fold-start-desktop.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('play, pause and manual navigation never leave an old playback loop', async ({page})=>{
  await setMotion(page,'reduce');await page.goto(route);
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
  await setMotion(page,'reduce');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  for(const [id,folds] of [['person',15],['house',17],['earth',37],['sun',44],['solar',57]] as const){
    await page.locator(`[data-milestone="${id}"]`).click();
    await expect(lab).toHaveAttribute('data-folds',String(folds));
    await expect(page.locator(`[data-milestone="${id}"]`)).toHaveAttribute('aria-current','true');
    if(id==='earth'||id==='solar'){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath(`paper-fold-${id}-desktop.png`),fullPage:true});}
  }
  await page.getByText('尺度口径与数据来源',{exact:true}).click();
  await expect(page.locator('.pf-sources')).toContainText('约 60 AU');await expect(page.locator('.pf-sources')).toContainText('不是太阳系的真实边界');
  await expect(page.locator('.pf-sources a[href="https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf"]')).toBeVisible();
});

test('changing thickness while playing pauses and recalculates all milestones', async ({page})=>{
  await setMotion(page,'reduce');await page.goto(route);
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
  await setMotion(page,'no-preference');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');const starting=Number(await lab.getAttribute('data-view'));
  await page.locator('[data-milestone="earth"]').click();await expect(lab).toHaveAttribute('data-motion','true');
  await expect.poll(async()=>Number(await lab.getAttribute('data-view'))).toBeGreaterThan(starting);
  const during=Number(await lab.getAttribute('data-view'));expect(during).toBeLessThan(25);
  await page.locator('[data-milestone="sun"]').click();await page.waitForTimeout(70);await page.locator('#pf-reset').click();
  await expect(lab).toHaveAttribute('data-folds','0');await expect(lab).toHaveAttribute('data-motion','false',{timeout:5000});
  expect(Number(await lab.getAttribute('data-view'))).toBeCloseTo(starting,6);await expect(lab).toHaveAttribute('data-playing','false');
});

test('reduced-motion mode is immediate, retains manual play, and stops at the bound', async ({page})=>{
  await setMotion(page,'reduce');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');await expect(page.locator('#pf-motion-note')).toBeVisible();
  await setFolds(page,102);await expect(lab).toHaveAttribute('data-motion','false');
  await page.locator('#pf-speed').selectOption('500');await page.locator('#pf-play').click();
  await expect(lab).toHaveAttribute('data-folds','103');await expect(lab).toHaveAttribute('data-playing','false');
  await expect(page.locator('#pf-status')).toContainText('旅程完成');await page.waitForTimeout(600);await expect(lab).toHaveAttribute('data-folds','103');
  await page.getByRole('button',{name:'重新旅行'}).click();await expect.poll(async()=>Number(await lab.getAttribute('data-folds'))).toBeLessThan(5);
  await page.locator('#pf-play').click();
});

test('mobile layout and keyboard controls remain usable', async ({page},testInfo)=>{
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});await setMotion(page,'reduce');await page.goto(route);
  await page.locator('#pf-folds').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#pf-count')).toHaveText('1');
  await page.keyboard.press('End');await expect(page.locator('#pf-count')).toHaveText('103');await page.keyboard.press('Home');await expect(page.locator('#pf-count')).toHaveText('0');
  await page.locator('[data-milestone="earth"]').click();await expect(page.locator('#pf-count')).toHaveText('37');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:testInfo.outputPath('paper-fold-earth-mobile.png'),fullPage:true});
  await page.setViewportSize({width:320,height:780});await setFolds(page,80);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('all folds and paper extremes keep visible shapes plus nearest comparison cards', async ({page}) => {
  await setMotion(page,'reduce'); await page.goto(route);
  const failures = await page.evaluate(() => {
    const lab = document.querySelector<HTMLElement>('#paper-fold-lab')!;
    const input = document.querySelector<HTMLInputElement>('#pf-initial')!;
    const range = document.querySelector<HTMLInputElement>('#pf-folds')!;
    const failures: string[] = [];
    for (const mm of [.01,.1,1]) {
      input.value = String(mm); input.dispatchEvent(new Event('change', {bubbles:true}));
      for (let fold=0;fold<=Number(range.max);fold++) {
        range.value=String(fold);range.dispatchEvent(new Event('input',{bubbles:true}));
        if (!lab.dataset.referenceVisible) failures.push(`No physical reference: ${mm} mm / ${fold}`);
        for (const side of ['previous','next']) {
          for (const part of ['name','dimension','ratio','placement']) {
            const text = document.querySelector(`#pf-${side}-${part}`)?.textContent?.trim();
            if (!text || /NaN|Infinity|undefined/.test(text)) failures.push(`${side}/${part}: ${mm}/${fold}`);
          }
        }
      }
    }
    return failures;
  });
  expect(failures).toEqual([]);
  await expect(page.locator('#pf-reference-next')).toBeDisabled();
  await expect(page.locator('#pf-previous-name')).toHaveText('可观测宇宙');
  await expect(page.locator('#pf-next-name')).toHaveText('更远的宇宙');
  await expect(page.locator('#pf-next-placement')).toHaveText('大小未知');
  await expect(page.locator('#pf-reference-next')).toHaveAccessibleDescription(/可观测范围之外，没有已知的总直径 大小未知/);
});

test('smooth playback through former long gap never loses a reference', async ({page}) => {
  await setMotion(page,'no-preference'); await page.goto(route);
  await setFolds(page, 18); await expect(page.locator('#paper-fold-lab')).toHaveAttribute('data-motion','false');
  await page.locator('#pf-speed').selectOption('500'); await page.locator('#pf-play').click();
  const sampled = await page.evaluate(async () => {
    const lab = document.querySelector<HTMLElement>('#paper-fold-lab')!;
    const failures: string[]=[];const seen=new Set<string>();let frames=0;
    await new Promise<void>(resolve => {
      function sample() {
        frames++;const current=lab.dataset.referenceVisible??'';
        if (!current) failures.push(`blank at ${lab.dataset.visualFold}`);
        current.split(',').forEach(id=>seen.add(id));
        if (Number(lab.dataset.visualFold)>=36 || frames>1800) resolve(); else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    return {failures,seen:[...seen],frames,fold:Number(lab.dataset.visualFold)};
  });
  await page.locator('#pf-play').click();
  expect(sampled.failures).toEqual([]);expect(sampled.fold).toBeGreaterThanOrEqual(36);expect(sampled.seen).toEqual(expect.arrayContaining(['building','tower','everest','karman','iss','moon']));
});

test('reference navigation and interrupted thickness changes use current visible state', async ({page}) => {
  await setMotion(page,'reduce'); await page.goto(route);
  await page.locator('#pf-reference-next').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#pf-count')).toHaveText('3');
  await expect(page.locator('#pf-previous-name')).toHaveText('一张卡片');
  await expect(page.locator('#pf-reference-previous')).toHaveAccessibleDescription(/当前约为它的 1 倍 同尺可见/);
  await setMotion(page,'no-preference');
  const failures=await page.evaluate(async()=>{
    const lab=document.querySelector<HTMLElement>('#paper-fold-lab')!;
    const range=document.querySelector<HTMLInputElement>('#pf-folds')!;
    const initial=document.querySelector<HTMLInputElement>('#pf-initial')!;
    const failures:string[]=[];
    const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
    let observing=true;
    const sample=()=>{if(!lab.dataset.referenceVisible)failures.push(lab.dataset.visualFold??'');if(observing)requestAnimationFrame(sample);};requestAnimationFrame(sample);
    for(const [n,mm] of [[65,.01],[12,1],[103,.1],[31,.25]]) {
      range.value=String(n);range.dispatchEvent(new Event('input',{bubbles:true}));await delay(70);
      initial.value=String(mm);initial.dispatchEvent(new Event('change',{bubbles:true}));await delay(70);
    }
    await delay(900);observing=false;return failures;
  });
  expect(failures).toEqual([]);await expect(page.locator('#paper-fold-lab')).toHaveAttribute('data-folds','31');
  await expect(page.locator('#paper-fold-lab')).toHaveAttribute('data-motion','false');
  await expect(page.locator('#paper-fold-lab')).toHaveAttribute('data-playing','false');
});

for(const width of [1440,390,320]) test(`reference scenes and rail fit at ${width}px`, async ({page},testInfo)=>{
  await page.setViewportSize({width,height:1000});await setMotion(page,'reduce');await page.goto(route);
  for(const fold of [3,10,24,29,34,41,45,49,54,55,57,68,80,83,88,96,103]) {
    await setFolds(page,fold);
    await expect(page.locator('#paper-fold-lab')).not.toHaveAttribute('data-reference-visible','');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    for(const side of ['previous','next']) {
      const card=page.locator(`#pf-reference-${side}`);
      expect(await card.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBeTruthy();
    }
    expect(await page.locator('#pf-thickness').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBeTruthy();
    expect(await page.locator('.pf-count>span').evaluate(node=>node.getBoundingClientRect().height<=parseFloat(getComputedStyle(node).lineHeight)*2+2)).toBeTruthy();
    const diagram=await page.locator('#pf-canvas').boundingBox();
    const legend=await page.locator('.pf-scale-key').boundingBox();
    expect(legend!.y).toBeGreaterThanOrEqual(diagram!.y+diagram!.height);
    expect((await page.locator('#pf-stage').boundingBox())!.height).toBeLessThan(1040);
    const caption=await page.locator('.pf-fold-caption').boundingBox();
    expect(caption!.y).toBeGreaterThan(diagram!.y);
    expect(caption!.y+caption!.height).toBeLessThan(diagram!.y+diagram!.height);
    await expect(page.locator('.pf-fold-detail')).toHaveCount(0);
    await expect(page.locator('#pf-stage canvas')).toHaveCount(1);
    if([10,41,45,49,54,55,57,68,83,88,96,103].includes(fold)) { await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.locator('#pf-stage').screenshot({path:testInfo.outputPath(`references-${width}-${fold}.png`)}); }
  }
});


for(const width of [1440,390,320]) test(`cosmic endpoint recalculates safely at ${width}px`, async ({page},testInfo) => {
  await page.setViewportSize({width,height:1000});await setMotion(page,'reduce');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  for(const [mm,limit] of [[.01,107],[.1,103],[1,100]]) {
    await page.locator('#pf-initial').fill(String(mm));await page.locator('#pf-initial').press('Enter');
    await expect(page.locator('#pf-folds')).toHaveAttribute('max',String(limit));
    await page.locator('[data-milestone="observable-universe"]').click();
    await expect(lab).toHaveAttribute('data-folds',String(limit));
    await expect(lab).toHaveAttribute('data-reference-previous','observable-universe');
    await expect(lab).toHaveAttribute('data-reference-next','end');
    await expect(page.locator('#pf-step')).toBeDisabled();
    await expect(page.locator('#pf-reference-next')).toBeDisabled();
    await expect(page.locator('#pf-next-dimension')).toContainText('整个宇宙有多大，目前还不知道');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    const boxes=await page.locator('.pf-count,.pf-thickness').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));
    expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.locator('#pf-stage').screenshot({path:testInfo.outputPath(`cosmic-end-${width}-${mm}.png`)});
  }
  await page.locator('#pf-initial').fill('.01');await page.locator('#pf-initial').press('Enter');await setFolds(page,107);
  await page.locator('#pf-initial').fill('1');await page.locator('#pf-initial').press('Enter');await expect(lab).toHaveAttribute('data-folds','100');
  await page.locator('#pf-reset').click();await expect(page.locator('#pf-folds')).toHaveAttribute('max','103');
  await expect(lab).toHaveAttribute('data-folds','0');
});

test('stellar and cosmic jumps preserve a fully visible reference throughout animation', async ({page}) => {
  await setMotion(page,'no-preference');await page.goto(route);
  const result=await page.evaluate(async()=>{
    const lab=document.querySelector<HTMLElement>('#paper-fold-lab')!;
    const failures:string[]=[];const seen=new Set<string>();
    for(const id of ['sun','betelgeuse','solar','milky-way','andromeda','laniakea','observable-universe']) {
      (document.querySelector(`[data-milestone="${id}"]`) as HTMLButtonElement).click();
      await new Promise<void>(resolve=>{function sample(){const visible=lab.dataset.referenceVisible??'';if(!visible)failures.push(lab.dataset.visualFold??'');visible.split(',').forEach(x=>seen.add(x));if(lab.dataset.motion==='false')resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
    }
    return {failures,seen:[...seen]};
  });
  expect(result.failures).toEqual([]);expect(result.seen).toEqual(expect.arrayContaining(['sirius','arcturus','aldebaran','antares','vy-cma','solar','orion-nebula','omega-centauri','n44','small-magellanic','milky-way','andromeda','m87-distance','laniakea','observable-universe']));
  await expect(page.locator('#paper-fold-lab')).toHaveAttribute('data-folds','103');
});

test('close red-supergiant references remain identifiable during ordinary playback', async ({page}) => {
  await setMotion(page,'reduce');await page.goto(route);await setFolds(page,52);
  await setMotion(page,'no-preference');await page.locator('#pf-speed').selectOption('1000');await page.locator('#pf-play').click();
  const seen=await page.evaluate(async()=>{const lab=document.querySelector<HTMLElement>('#paper-fold-lab')!;const seen=new Set<string>();await new Promise<void>(resolve=>{function sample(){(lab.dataset.referenceVisible??'').split(',').forEach(x=>seen.add(x));if(Number(lab.dataset.visualFold)>=56)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});return [...seen];});
  await page.locator('#pf-play').click();expect(seen).toEqual(expect.arrayContaining(['antares','betelgeuse','vy-cma','jupiter-orbit']));
});


for(const width of [1440,390,320]) test(`integrated fold and turn poses stay readable at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:1000});await setMotion(page,'reduce');await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  for(const base of [2,4,102]){
    await setMotion(page,'reduce');await setFolds(page,base);await setMotion(page,'no-preference');
    await page.locator('.pf-scene').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>button.click());await page.waitForTimeout(320);
    await expect(lab).toHaveAttribute('data-fold-mode','whole-stack');
    expect(await page.locator('#pf-fold-detail-title').evaluate(node=>node.getBoundingClientRect().height<=parseFloat(getComputedStyle(node).lineHeight)*2.1)).toBeTruthy();
    await page.locator('.pf-scene').screenshot({path:testInfo.outputPath(`whole-stack-${width}-fold-${base+1}-bend.png`)});
    await page.waitForFunction(()=>document.querySelector<HTMLElement>('#paper-fold-lab')?.dataset.foldMode==='rotate');
    await page.waitForFunction(()=>Number(document.querySelector<HTMLElement>('#paper-fold-lab')?.dataset.foldRotation)>.35);
    await page.locator('#pf-play').evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
    await page.locator('.pf-scene').screenshot({path:testInfo.outputPath(`whole-stack-${width}-fold-${base+1}-rotate.png`)});
    await setFolds(page,base+1);
    await expect(lab).toHaveAttribute('data-motion','false');
  }
});
