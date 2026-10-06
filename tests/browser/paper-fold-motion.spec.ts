import { test, expect } from '@playwright/test';

test.use({video:'on'});
const route='/tools/paper-fold/';
async function setFolds(page: import('@playwright/test').Page, n: number) {
  await page.locator('#pf-folds').evaluate((input: HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},n);
}

// Record genuine consecutive fold→turn cycles with NO screenshots or clock
// mocking. Still captures have their own non-recording suite because Chromium
// screenshots can interrupt the video recorder even when the app keeps moving.
for(const width of [1440,390,320]) test(`integrated fold rotate cycles stay continuous at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await page.locator('.pf-scene').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
  await page.locator('#pf-speed').selectOption('1000');
  await page.locator('#pf-play').evaluate((button:HTMLButtonElement)=>button.click());
  const samples=await page.evaluate(async()=>{
    const lab=document.querySelector<HTMLElement>('#paper-fold-lab')!;
    const rows:{time:number;fold:number;yaw:number;angle:number;mode:string;axis:string;reference:string}[]=[];
    await new Promise<void>(resolve=>{
      function sample(t:number){rows.push({time:t,fold:Number(lab.dataset.visualFold),yaw:Number(lab.dataset.foldYaw),angle:Number(lab.dataset.foldAngle),mode:lab.dataset.foldMode!,axis:lab.dataset.foldAxis!,reference:lab.dataset.referenceVisible!});if(Number(lab.dataset.visualFold)>=6)resolve();else requestAnimationFrame(sample);}
      requestAnimationFrame(sample);
    });
    (document.querySelector('#pf-play') as HTMLButtonElement).click();return rows;
  });
  await testInfo.attach('consecutive-cycle-telemetry',{body:JSON.stringify(samples),contentType:'application/json'});
  expect(samples.length).toBeGreaterThan(100);
  expect(samples.every(s=>s.reference.length>0)).toBeTruthy();
  for(let fold=0;fold<6;fold++){
    const cycle=samples.filter(s=>Math.floor(s.fold)===fold);
    expect(cycle.some(s=>s.mode==='whole-stack'&&s.angle>.5&&s.angle<2.7)).toBeTruthy();
    expect(cycle.some(s=>s.mode==='rotate'&&s.yaw-fold*Math.PI/2>.2&&s.yaw-fold*Math.PI/2<1.4)).toBeTruthy();
    expect(cycle.every(s=>s.axis===(fold%2?'y':'x'))).toBeTruthy();
  }
  for(let i=1;i<samples.length;i++){
    expect(samples[i].fold).toBeGreaterThanOrEqual(samples[i-1].fold);
    expect(samples[i].yaw+1e-5).toBeGreaterThanOrEqual(samples[i-1].yaw);
    // A rebased cycle cannot jump the whole quarter turn in a frame.
    if(samples[i].time-samples[i-1].time<45)expect(samples[i].yaw-samples[i-1].yaw).toBeLessThan(.45);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await expect(page.locator('#pf-stage canvas')).toHaveCount(1);
  await page.emulateMedia({reducedMotion:'reduce'});await setFolds(page,100);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#pf-play').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(lab).toHaveAttribute('data-playing','false');await expect(lab).toHaveAttribute('data-folds','103');
  await expect(page.locator('#pf-fold-detail-title')).toContainText('旅程抵达终点');
  await setFolds(page,102);await expect(lab).toHaveAttribute('data-fold-mode','rotate');
  await expect(lab).toHaveAttribute('data-fold-mode','whole-stack');await expect(lab).toHaveAttribute('data-motion','false');
  await page.locator('#pf-reset').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-folds','0');
});

test('pause in a bend or turn, rapid interruption, resize and reduced motion retain a coherent scene',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(route);
  const lab=page.locator('#paper-fold-lab');
  await page.locator('#pf-speed').selectOption('1600');
  for(const mode of ['whole-stack','rotate']){
    await page.locator('#pf-play').click();await expect(lab).toHaveAttribute('data-fold-mode',mode);
    await page.waitForTimeout(100);await page.locator('#pf-play').click();
    const paused=await lab.evaluate(node=>[node.getAttribute('data-visual-fold'),node.getAttribute('data-fold-angle'),node.getAttribute('data-fold-rotation')]);
    await page.waitForTimeout(240);
    expect(await lab.evaluate(node=>[node.getAttribute('data-visual-fold'),node.getAttribute('data-fold-angle'),node.getAttribute('data-fold-rotation')])).toEqual(paused);
  }
  await page.setViewportSize({width:320,height:800});
  await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>{button.click();button.click();button.click();});
  await page.waitForTimeout(120);
  await page.locator('[data-milestone="sun"]').evaluate((button:HTMLButtonElement)=>button.click());await expect(lab).toHaveAttribute('data-fold-mode','journey');
  await page.waitForTimeout(120);await page.locator('#pf-reset').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-fold-angle','0.000000');
  await page.emulateMedia({reducedMotion:'reduce'});await setFolds(page,6);
  await expect(lab).toHaveAttribute('data-motion','false');await expect(lab).toHaveAttribute('data-fold-rotation','0.000000');
  await page.locator('#pf-step').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(lab).toHaveAttribute('data-folds','7');await expect(lab).toHaveAttribute('data-fold-mode','rest');
});
