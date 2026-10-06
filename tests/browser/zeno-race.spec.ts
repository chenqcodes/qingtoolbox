import { test, expect, type Page } from '@playwright/test';
test.use({ video: 'on' });
const setRange = async (page: Page, id: string, value: number) => page.locator(id).evaluate((node: HTMLInputElement, number) => { node.value = String(number); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
const openExplanation = async (page: Page) => { if (!await page.locator('#zr-explanation').evaluate((node: HTMLDetailsElement) => node.open)) await page.locator('#zr-explanation>summary').click(); };
const steps = async (page: Page, count: number) => page.locator('#zr-next').evaluate((node: HTMLButtonElement, total) => { for (let i = 0; i < total; i++) node.click(); }, count);

test('the primary experience shrinks through metre, centimetre and microscopic gaps', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  const lab = page.locator('#zeno-race-lab');
  await expect(page.locator('#zr-explanation')).not.toHaveAttribute('open');
  await expect(page.locator('#zr-mode-continuous')).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('zeno-gap-start-desktop.png'), fullPage: true });
  let previousGap = 561, previousGlyph = 1;
  for (const [stage, gap] of [[1, '1 m'], [2, '10 cm'], [3, '1 cm'], [4, '1 mm'], [5, '100 μm'], [7, '1 μm'], [10, '1 nm'], [17, '1e-16 m'], [20, '1e-19 m']] as const) {
    const current = Number(await lab.getAttribute('data-stage')); await steps(page, stage - current);
    await expect(lab).toHaveAttribute('data-stage', String(stage)); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', gap);
    const scaleNames: Record<number, string> = { 1: '米的尺度', 2: '厘米的尺度', 3: '厘米的尺度', 4: '毫米的尺度', 5: '微米的尺度', 7: '微米的尺度', 10: '纳米的尺度', 17: '继续细分 · 数学尺度', 20: '继续细分 · 数学尺度' };
    await expect(page.locator('#zr-scale-label')).toHaveText(scaleNames[stage]);
    const screenGap = Number(await lab.getAttribute('data-screen-gap')), glyph = Number(await lab.getAttribute('data-glyph-scale'));
    expect(screenGap).toBeLessThan(previousGap); expect(screenGap).toBeGreaterThan(8); expect(glyph).toBeLessThanOrEqual(previousGlyph);
    previousGap = screenGap; previousGlyph = glyph;
    if ([1, 3, 5, 10, 17, 20].includes(stage)) await page.screenshot({ path: testInfo.outputPath(`zeno-gap-stage-${stage}-desktop.png`), fullPage: true });
  }
  await expect(page.locator('#zr-observation')).toContainText('还差');
  await expect(page.locator('#zr-turtle .zr-point')).toHaveAttribute('opacity', '1');
  expect(errors).toEqual([]);
});

test('one step moves continuously; pause, resume and rapid interruptions do not create stale frames', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.goto('/tools/zeno-race/'); const lab = page.locator('#zeno-race-lab');
  await page.locator('#zr-next').click();
  await page.clock.runFor(350); expect(Number(await lab.getAttribute('data-progress'))).toBeGreaterThan(.1);
  const during = Number(await lab.getAttribute('data-screen-gap')); expect(during).toBeLessThan(528); expect(during).toBeGreaterThan(52);
  await page.screenshot({ path: testInfo.outputPath('zeno-gap-in-motion.png') });
  await page.locator('#zr-play').click(); const frozen = await lab.getAttribute('data-progress');
  await page.clock.runFor(250); await expect(lab).toHaveAttribute('data-progress', frozen!);
  await page.locator('#zr-play').click(); await page.clock.runFor(2800); await expect.poll(async () => Number(await lab.getAttribute('data-stage'))).toBeGreaterThanOrEqual(1);
  await page.locator('#zr-reset').click(); await expect(lab).toHaveAttribute('data-stage', '0');
  await page.locator('#zr-play').click(); await setRange(page, '#zr-lead', 20);
  await page.clock.runFor(250); await expect(lab).toHaveAttribute('data-running', 'false'); await expect(lab).toHaveAttribute('data-stage', '0');
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '20 m');
  await page.locator('#zr-next').evaluate((node: HTMLButtonElement) => { node.click(); node.click(); node.click(); });
  await page.locator('#zr-reset').click(); await page.clock.runFor(1800);
  await expect(lab).toHaveAttribute('data-stage', '0'); await expect(lab).toHaveAttribute('data-running', 'false');
  await setRange(page, '#zr-turtle-speed', 0); await page.locator('#zr-next').click(); await expect(page.locator('#zr-observation')).toContainText('乌龟留在原地'); await page.locator('#zr-reset').click();
});

test('complete time stays secondary and preserves a separate finite meeting demonstration', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await steps(page, 3); await openExplanation(page);
  await expect(page.locator('#zr-segment')).toHaveText('0.01 s'); await expect(page.locator('#zr-time')).toHaveText('1.11 s');
  await page.locator('#zr-meet').click(); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-mode', 'continuous');
  await expect(page.locator('#zr-full-gap')).toContainText('此刻相遇'); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '1 cm');
  await page.locator('#zr-compare').click(); await expect(page.locator('#zr-time')).toHaveText('1.2 s');
  await expect(page.locator('#zr-rabbit-position')).toHaveText('12 m'); await expect(page.locator('#zr-turtle-position')).toHaveText('11.2 m');
  await expect(page.locator('#zr-full-gap')).toContainText('兔子已领先 0.8 m');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('zeno-explanation-desktop.png'), fullPage: true });
  await page.locator('#zr-continuous-play').click(); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'true');
  await page.locator('#zr-explanation>summary').click(); await page.waitForTimeout(250);
  await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'false'); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-mode', 'steps');
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '1 cm');
});

test('zero lead, stationary animals, equal and slower speeds remain truthful', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-turtle-speed', 0); await steps(page, 1);
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '0 m'); await expect(page.locator('#zr-next')).toBeDisabled(); await expect(page.locator('#zr-observation')).toContainText('第一段'); await expect(page.locator('#zr-stage-label')).toContainText('已追上');
  await setRange(page, '#zr-rabbit-speed', 0); await expect(page.locator('#zr-next')).toBeDisabled();
  await setRange(page, '#zr-turtle-speed', 1); await expect(page.locator('#zr-observation')).toContainText('兔子不动');
  await setRange(page, '#zr-rabbit-speed', 1); await steps(page, 1); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '10 m');
  await setRange(page, '#zr-turtle-speed', 2); await steps(page, 1); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '20 m');
  await openExplanation(page); await expect(page.locator('#zr-meet')).toBeDisabled();
  await setRange(page, '#zr-lead', 0); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '0 m'); await expect(page.locator('#zr-next')).toBeDisabled();
  await page.locator('#zr-mode-continuous').click(); await setRange(page, '#zr-scrub', 400); await expect(page.locator('#zr-time')).toHaveText('2 s');
  await setRange(page, '#zr-lead', 17); await setRange(page, '#zr-rabbit-speed', 3.7); await setRange(page, '#zr-turtle-speed', 2.9);
  await page.locator('#zr-meet').click(); await expect(page.locator('#zr-full-gap')).toContainText('此刻相遇');
  await expect(page.locator('#zeno-race-lab')).not.toContainText('NaN'); await expect(page.locator('#zeno-race-lab')).not.toContainText('Infinity');
});

test('200-stage cap retains logarithmic positive separation beyond floating-point underflow', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-rabbit-speed', 20); await setRange(page, '#zr-turtle-speed', .1);
  await steps(page, 200); const lab = page.locator('#zeno-race-lab');
  await expect(lab).toHaveAttribute('data-stage', '200'); await expect(page.locator('#zr-next')).toBeDisabled();
  await expect(page.locator('#zr-resolution')).toContainText('没有完成'); await expect(page.locator('#zr-gap')).not.toHaveAttribute('data-value', '0 m');
  expect(Number(await lab.getAttribute('data-log-gap'))).toBeLessThan(-1000); expect(Number(await lab.getAttribute('data-screen-gap'))).toBeGreaterThan(0);
  await openExplanation(page); await expect(page.locator('#zr-tail')).not.toHaveText('0 s');
  await page.locator('#zr-explanation>summary').click(); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: testInfo.outputPath('zeno-gap-stage-200-desktop.png'), fullPage: true });
});

for (const width of [390, 320]) test(`mobile ${width}px keyboard, reduced motion and deep gap stay usable`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await page.locator('#zr-lead').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#zr-lead-value')).toHaveText('11 m');
  await page.locator('#zr-next').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '1.1 m');
  await steps(page, 9); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath(`zeno-gap-micro-${width}.png`), fullPage: true });
  await steps(page, 190); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '200');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath(`zeno-gap-last-${width}.png`), fullPage: true });
  expect(await page.locator('#zr-turtle .zr-point').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(4);
  expect(await page.locator('#zr-ruler-value').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(9);
  await page.locator('#zr-explanation>summary').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#zr-explanation')).toHaveAttribute('open', '');
  await page.locator('#zr-mode-continuous').focus(); await page.keyboard.press('Enter'); await page.locator('#zr-scrub').focus(); await page.keyboard.press('End');
  await expect(page.locator('#zr-full-gap')).toContainText('兔子已领先');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  for (const id of ['#zr-gap', '#zr-limit-time', '#zr-tail']) expect(await page.locator(id).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy();
});

test('rounded microscopic stage never becomes an exact meeting merely by opening continuous time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await steps(page, 30); await openExplanation(page); await page.locator('#zr-mode-continuous').click();
  await expect(page.locator('#zr-time')).toHaveText('0 s'); await expect(page.locator('#zr-full-gap')).toHaveText('仍差 10 m');
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '1e-29 m');
  await page.locator('#zr-meet').click(); await expect(page.locator('#zr-full-gap')).toContainText('此刻相遇');
});

test('changing motion preference completes the current step without reversing the gap', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.goto('/tools/zeno-race/'); const lab = page.locator('#zeno-race-lab'); await page.locator('#zr-next').click();
  await page.clock.runFor(350); expect(Number(await lab.getAttribute('data-progress'))).toBeGreaterThan(.1);
  const gap = Number(await lab.getAttribute('data-screen-gap')); await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(lab).toHaveAttribute('data-stage', '1'); expect(Number(await lab.getAttribute('data-screen-gap'))).toBeLessThan(gap);
  await expect(lab).toHaveAttribute('data-running', 'false'); await expect(page.locator('#zr-next')).toBeEnabled();
});

test('large growing gaps keep the secondary horizon and SVG coordinates finite', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-lead', 30); await setRange(page, '#zr-rabbit-speed', .1); await setRange(page, '#zr-turtle-speed', 13.5); await steps(page, 144);
  await openExplanation(page); await page.locator('#zr-mode-continuous').click(); await setRange(page, '#zr-scrub', 1000);
  for (const id of ['#zr-full-rabbit', '#zr-full-turtle']) expect(await page.locator(id).getAttribute('transform')).not.toMatch(/NaN|Infinity/);
  await expect(page.locator('#zeno-race-lab')).not.toContainText('NaN'); await expect(page.locator('#zeno-race-lab')).not.toContainText('Infinity'); expect(errors).toEqual([]);
});


test('returning from browser history keeps animation paused and controls synchronized', async ({ page }) => {
  await page.goto('/tools/zeno-race/'); await page.locator('#zr-play').click();
  await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'true');
  // Explicitly cover the persisted-DOM path even when this browser chooses reload.
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'false');
  await expect(page.locator('#zr-play')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#zr-play')).not.toHaveText('暂停');
  await page.locator('#zr-play').click(); await page.goto('/tools/paper-fold/'); await page.goBack();
  await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'false');
  await expect(page.locator('#zr-play')).toHaveAttribute('aria-pressed', 'false');
});


const motion = async (page: Page) => page.locator('#zeno-race-lab').evaluate(node => {
  const d = (node as HTMLElement).dataset;
  return { rabbit: Number(d.rabbitX), turtle: Number(d.turtleX), gap: Number(d.screenGap),
    target: Number(d.targetX), camera: Number(d.cameraScale), physical: Number(d.motionTime),
    logGap: Number(d.logGap), progress: Number(d.progress), phase: d.phase,
    world: node.querySelector('#zr-world')!.getAttribute('transform') };
});

for (const width of [320, 390, 1440]) test(`continuous lens and pursuit stay smooth across stage handovers at ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: width < 720 ? 844 : 1000 });
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.goto('/tools/zeno-race/'); const lab = page.locator('#zeno-race-lab');
  await page.locator('#zr-play').click();
  let previous = await motion(page);
  for (let sample = 0; sample < 90; sample++) {
    await page.clock.runFor(100); const current = await motion(page);
    expect(current.phase).toBe('chase'); expect(current.physical).toBeGreaterThan(previous.physical);
    expect(current.rabbit).toBeGreaterThan(previous.rabbit); expect(current.turtle).toBeGreaterThan(previous.turtle);
    expect(current.gap).toBeLessThan(previous.gap); expect(current.camera).toBeGreaterThan(previous.camera);
    expect(current.logGap).toBeLessThan(previous.logGap);
    expect(current.rabbit - previous.rabbit).toBeLessThan(20);
    expect(current.turtle - previous.turtle).toBeLessThan(3);
    expect(current.rabbit).toBeGreaterThanOrEqual(140); expect(current.turtle).toBeLessThan(790);
    if ([1, 27, 28, 55, 56, 83, 84].includes(sample)) await page.locator('#zr-track').screenshot({ path: testInfo.outputPath(`continuous-${width}-${sample}.png`) });
    previous = current;
  }
  await expect(lab).toHaveAttribute('data-stage', '3');
  await expect(page.locator('#zr-camera-label')).toContainText('连续放大');
  const art = () => page.locator('#zr-turtle .zr-whole').getAttribute('transform');
  await page.locator('#zr-play').click(); const frozen = await motion(page), frozenArt = await art();
  await page.clock.runFor(1000); expect(await motion(page)).toEqual(frozen); expect(await art()).toBe(frozenArt);
  await page.locator('#zr-play').click(); await page.clock.runFor(400); expect((await motion(page)).logGap).toBeLessThan(frozen.logGap);
  await page.locator('#zr-reset').click(); await page.clock.runFor(5000); await expect(lab).toHaveAttribute('data-stage', '0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#zr-play').click(); await page.clock.runFor(350);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(lab).toHaveAttribute('data-running', 'false');
  const hidden = await motion(page); await page.clock.runFor(1000); expect(await motion(page)).toEqual(hidden);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
  await page.locator('#zr-reset').click(); await expect(lab).toHaveAttribute('data-stage', '0');
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 1440]) test(`record uninterrupted pursuit and shrinking icons into retained dots at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width < 720 ? 844 : 1000 });
  await page.goto('/tools/zeno-race/'); await page.locator('#zr-track').scrollIntoViewIfNeeded();
  await page.locator('#zr-play').click();
  await page.evaluate(() => {
    const samples: { stage: number; progress: number; rabbit: number; turtle: number; gap: number; logGap: number; camera: number; glyph: number; nose: number; phase: string | undefined }[] = [];
    (window as unknown as { zenoMotion: typeof samples }).zenoMotion = samples;
    const sample = () => {
      const lab = document.querySelector<HTMLElement>('#zeno-race-lab')!, d = lab.dataset;
      samples.push({ stage: Number(d.stage), progress: Number(d.progress), rabbit: Number(d.rabbitX), turtle: Number(d.turtleX), gap: Number(d.screenGap), logGap: Number(d.logGap), camera: Number(d.cameraScale), glyph: Number(d.glyphScale), nose: Number(d.turtleX) + 88 * Number(d.glyphScale), phase: d.phase });
      if (d.running === 'true') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await expect.poll(async () => Number(await page.locator('#zeno-race-lab').getAttribute('data-stage')), { timeout: 45_000 }).toBeGreaterThanOrEqual(10);
  await page.locator('#zr-play').click();
  const samples = await page.evaluate(() => (window as unknown as { zenoMotion: { stage: number; progress: number; rabbit: number; turtle: number; gap: number; logGap: number; camera: number; glyph: number; nose: number; phase: string }[] }).zenoMotion);
  expect(samples.length).toBeGreaterThan(100);
  let handovers = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    expect(b.phase).toBe('chase'); expect(b.logGap).toBeLessThanOrEqual(a.logGap); expect(b.camera).toBeGreaterThanOrEqual(a.camera);
    expect(b.rabbit).toBeGreaterThanOrEqual(a.rabbit); expect(b.turtle).toBeGreaterThanOrEqual(a.turtle); expect(b.nose).toBeGreaterThanOrEqual(a.nose - 1e-8);
    expect(b.gap).toBeLessThanOrEqual(a.gap); expect(b.glyph).toBeLessThanOrEqual(a.glyph);
    if (b.stage > a.stage) { handovers++; expect(b.rabbit - a.rabbit).toBeLessThan(12); expect(b.logGap).toBeLessThan(a.logGap); }
  }
  expect(handovers).toBeGreaterThanOrEqual(9);
  await expect(page.locator('#zr-turtle .zr-point')).toHaveAttribute('opacity', '1');
  await expect(page.locator('#zr-rabbit .zr-point')).toHaveAttribute('opacity', '1');
  await page.locator('#zr-track').screenshot({ path: testInfo.outputPath(`continuous-dots-${width}.png`) });
  await testInfo.attach('continuous-motion-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
  const bounds = await page.locator('#zr-track').evaluate(svg => {
    const box = svg.getBoundingClientRect();
    return ['#zr-rabbit .zr-point', '#zr-turtle .zr-point'].map(id => { const r = svg.querySelector(id)!.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom; });
  });
  expect(bounds).toEqual([true, true]);
});

for (const stage of [1, 20, 199]) test(`deep-stage handover at ${stage} retains positive log-tail and a smooth visible gap`, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/'); await steps(page, stage);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); const lab = page.locator('#zeno-race-lab');
  const before = await motion(page); await page.locator('#zr-next').click();
  await page.clock.runFor(1400); const middle = await motion(page);
  expect(middle.rabbit).toBeGreaterThan(before.rabbit); expect(middle.turtle).toBeGreaterThan(before.turtle); expect(middle.gap).toBeLessThan(before.gap);
  expect(middle.logGap).toBeLessThan(before.logGap); expect(middle.camera).toBeGreaterThan(before.camera);
  await page.clock.runFor(1450); await expect(lab).toHaveAttribute('data-stage', String(stage + 1));
  await expect(lab).toHaveAttribute('data-running', 'false'); await expect(page.locator('#zr-gap')).not.toHaveAttribute('data-value', '0 m');
});

for (const width of [320, 390, 1440]) test(`live segment and accumulated metrics stay distinct at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width < 720 ? 844 : 1000 });
  await page.clock.install({ time: new Date('2026-10-06T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-06T00:00:01Z'));
  await page.goto('/tools/zeno-race/'); const lab = page.locator('#zeno-race-lab');
  await expect(page.locator('#zr-total-time')).toHaveAttribute('data-value', '0 s');
  await expect(page.locator('#zr-total-distance')).toHaveAttribute('data-value', '0 m');
  await expect(page.locator('#zr-segment-duration')).toHaveText('1 s');
  await page.locator('#zr-play').click();
  let previousTotal = 0, previousDistance = -Infinity;
  for (let i = 0; i < 24; i++) {
    await page.clock.runFor(400);
    const m = await lab.evaluate(node => ({ ...node.dataset }));
    const t = Number(m.totalTime), d = Number(m.logTotalDistance), elapsed = Number(m.logSegmentElapsed), duration = Number(m.logSegmentDuration);
    expect(t).toBeGreaterThan(previousTotal); expect(d).toBeGreaterThan(previousDistance); expect(elapsed).toBeLessThan(duration);
    expect(Number(m.segment)).toBe(Number(m.stage) + 1);
    expect(Math.exp(d)).toBeCloseTo(t * 10, 8);
    expect(Math.exp(elapsed - duration)).toBeCloseTo(Number(m.segmentFraction), 10);
    await expect(page.locator('#zr-segment-label')).toHaveText(`第 ${m.segment} 段已用`);
    previousTotal = t; previousDistance = d;
  }
  await page.locator('#zr-play').click();
  const readout = () => page.locator('.zr-live-metrics,.zr-total-metrics').allTextContents();
  const paused = await readout(); await page.clock.runFor(1000); expect(await readout()).toEqual(paused);
  expect(await page.locator('.zr-rolling-number').evaluateAll(nodes => nodes.flatMap(n => n.getAnimations({ subtree: true })).length)).toBe(0);
  await page.locator('.zr-live-metrics').screenshot({ path: testInfo.outputPath(`live-metrics-${width}-paused.png`) });
  for (const id of ['zr-gap', 'zr-segment-elapsed', 'zr-total-time', 'zr-total-distance']) {
    const bounds = await page.locator(`#${id}`).evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth, label: node.querySelector('.zr-number-accessible')?.textContent, value: (node as HTMLElement).dataset.value }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1); expect(bounds.label).toBe(bounds.value);
  }
  await page.locator('#zr-reset').click(); await page.clock.runFor(500);
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '10 m'); await expect(page.locator('#zr-segment-elapsed')).toHaveAttribute('data-value', '0 s');
  await expect(page.locator('#zr-total-time')).toHaveAttribute('data-value', '0 s'); await expect(page.locator('#zr-total-distance')).toHaveAttribute('data-value', '0 m');
  await page.locator('#zr-play').click(); await page.clock.runFor(450); await setRange(page, '#zr-lead', 20);
  await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '20 m'); await expect(page.locator('#zr-segment-duration')).toHaveText('2 s');
  await expect(lab).toHaveAttribute('data-running', 'false'); await expect(page.locator('#zr-total-time')).toHaveAttribute('data-value', '0 s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('completed and microscopic metric snapshots never confuse rounded totals with reaching the turtle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/'); await steps(page, 1);
  await expect(page.locator('#zr-segment-label')).toHaveText('第 1 段已用');
  await expect(page.locator('#zr-segment-elapsed')).toHaveAttribute('data-value', '1 s'); await expect(page.locator('#zr-segment-duration')).toHaveText('1 s');
  await expect(page.locator('#zr-total-time')).toHaveAttribute('data-value', '1 s'); await expect(page.locator('#zr-total-distance')).toHaveAttribute('data-value', '10 m');
  await expect(page.locator('#zr-segment-state')).toContainText('完成');
  await steps(page, 29); await expect(page.locator('#zr-segment-elapsed')).not.toHaveAttribute('data-value', '0 s');
  await expect(page.locator('#zr-metric-note')).toContainText('四舍五入');
  expect(await page.locator('.zr-rolling-number').evaluateAll(nodes => nodes.flatMap(n => n.getAnimations({ subtree: true })).length)).toBe(0);
  await setRange(page, '#zr-rabbit-speed', 20); await setRange(page, '#zr-turtle-speed', .1); await steps(page, 200);
  await expect(page.locator('#zr-segment-label')).toHaveText('第 200 段已用'); await expect(page.locator('#zr-segment-elapsed')).not.toHaveAttribute('data-value', '0 s');
  await expect(page.locator('#zr-gap')).not.toHaveAttribute('data-value', '0 m');
  await openExplanation(page); await page.locator('#zr-meet').click(); await expect(page.locator('#zr-full-gap')).toContainText('此刻相遇');
  await expect(page.locator('#zr-metric-note')).toContainText('保留逐段');
  await page.locator('#zr-compare').click(); await expect(page.locator('#zr-full-gap')).toContainText('兔子已领先');
  await setRange(page, '#zr-turtle-speed', 0); await page.locator('#zr-mode-steps').click(); await steps(page, 1);
  await expect(page.locator('#zr-segment-elapsed')).toHaveAttribute('data-value', '1 s'); await expect(page.locator('#zr-gap')).toHaveAttribute('data-value', '0 m');
  await setRange(page, '#zr-rabbit-speed', 0); await expect(page.locator('#zr-segment-duration')).toHaveText('无法到达');
  await setRange(page, '#zr-lead', 0); await expect(page.locator('#zr-segment-state')).toHaveText('无需追赶');
  await expect(page.locator('#zr-segment-progress')).toHaveAttribute('aria-valuetext', '起点已相遇，无需追赶');
  await expect(page.locator('#zr-total-time')).toHaveAttribute('data-value', '0 s');
});

for (const width of [320, 390, 1440]) test(`record rolling metrics with three live line crossings at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width < 720 ? 844 : 1000 }); await page.goto('/tools/zeno-race/');
  await page.locator('#zr-play').click();
  await page.locator('.zr-scene-top').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => {
    type Sample = { stage: number; elapsed: string; total: string; gap: string; animated: number; top: number; height: number };
    const samples: Sample[] = []; (window as unknown as { metricSamples: Sample[] }).metricSamples = samples;
    const sample = () => {
      const lab = document.querySelector<HTMLElement>('#zeno-race-lab')!, grid = document.querySelector('.zr-live-metrics')!.getBoundingClientRect();
      const value = (id: string) => document.querySelector<HTMLElement>(id)!.dataset.value!;
      samples.push({ stage: Number(lab.dataset.stage), elapsed: value('#zr-segment-elapsed'), total: value('#zr-total-time'), gap: value('#zr-gap'), animated: document.querySelector('.zr-live-metrics')!.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length, top: grid.top, height: grid.height });
      if (lab.dataset.running === 'true') requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await expect.poll(async () => Number(await page.locator('#zeno-race-lab').getAttribute('data-stage')), { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  await page.locator('#zr-play').click();
  const samples = await page.evaluate(() => (window as unknown as { metricSamples: { stage: number; elapsed: string; total: string; gap: string; animated: number; top: number; height: number }[] }).metricSamples);
  expect(samples.length).toBeGreaterThan(100); expect(samples.some(s => s.animated > 0)).toBe(true);
  expect(new Set(samples.map(s => s.elapsed)).size).toBeGreaterThan(30);
  expect(Math.max(...samples.map(s => s.height)) - Math.min(...samples.map(s => s.height))).toBeLessThan(2);
  await testInfo.attach('rolling-metric-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
  await page.locator('.zr-scene').screenshot({ path: testInfo.outputPath(`rolling-metrics-${width}-three-segments.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('visible rolling ink resets with its segment and fits deep scientific readings at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.clock.install({ time: new Date('2026-10-06T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-06T00:00:01Z'));
  await page.goto('/tools/zeno-race/'); await page.locator('#zr-play').click();
  const read = () => page.locator('#zr-segment-elapsed').evaluate(node => {
    const copy = node.querySelector('.zr-number-ink')!.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.zr-number-outgoing').forEach(n => n.remove());
    return copy.textContent!;
  });
  const seconds = (value: string) => {
    const [number, unit] = value.split(' '), factor: Record<string, number> = { s: 1, ms: 1e-3, 'μs': 1e-6, ns: 1e-9, ps: 1e-12 };
    return Number(number) * factor[unit];
  };
  for (let i = 0; i < 190; i++) {
    await page.clock.runFor(32);
    const duration = Number(await page.locator('#zeno-race-lab').getAttribute('data-log-segment-duration'));
    expect(seconds(await read())).toBeLessThanOrEqual(Math.exp(duration) * 1.005);
  }
  await page.locator('#zr-reset').click(); await page.emulateMedia({ reducedMotion: 'reduce' }); await steps(page, 16);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.locator('#zr-play').click();
  for (let i = 0; i < 10; i++) {
    await page.clock.runFor(300);
    for (const id of ['#zr-gap', '#zr-segment-elapsed']) {
      const fits = await page.locator(id).evaluate(node => {
        const cell = node.getBoundingClientRect(), ink = node.querySelector('.zr-number-ink')!.getBoundingClientRect();
        return ink.left >= cell.left - 1 && ink.right <= cell.right + 1;
      }); expect(fits).toBe(true);
    }
  }
});
