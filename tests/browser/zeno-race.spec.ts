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
  let previousGap = 561, previousGlyph = 1.01;
  for (const [stage, gap] of [[1, '1 m'], [2, '10 cm'], [3, '1 cm'], [4, '1 mm'], [5, '100 μm'], [7, '1 μm'], [10, '1 nm'], [17, '1e-16 m'], [20, '1e-19 m']] as const) {
    const current = Number(await lab.getAttribute('data-stage')); await steps(page, stage - current);
    await expect(lab).toHaveAttribute('data-stage', String(stage)); await expect(page.locator('#zr-gap')).toHaveText(gap);
    const scaleNames: Record<number, string> = { 1: '米的尺度', 2: '厘米的尺度', 3: '厘米的尺度', 4: '毫米的尺度', 5: '微米的尺度', 7: '微米的尺度', 10: '纳米的尺度', 17: '继续细分 · 数学尺度', 20: '继续细分 · 数学尺度' };
    await expect(page.locator('#zr-scale-label')).toHaveText(scaleNames[stage]);
    const screenGap = Number(await lab.getAttribute('data-screen-gap')), glyph = Number(await lab.getAttribute('data-glyph-scale'));
    expect(screenGap).toBeLessThan(previousGap); expect(screenGap).toBeGreaterThan(8); expect(glyph).toBeLessThan(previousGlyph);
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
  await expect(page.locator('#zr-gap')).toHaveText('20 m');
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
  await expect(page.locator('#zr-full-gap')).toContainText('此刻相遇'); await expect(page.locator('#zr-gap')).toHaveText('1 cm');
  await page.locator('#zr-compare').click(); await expect(page.locator('#zr-time')).toHaveText('1.2 s');
  await expect(page.locator('#zr-rabbit-position')).toHaveText('12 m'); await expect(page.locator('#zr-turtle-position')).toHaveText('11.2 m');
  await expect(page.locator('#zr-full-gap')).toContainText('兔子已领先 0.8 m');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('zeno-explanation-desktop.png'), fullPage: true });
  await page.locator('#zr-continuous-play').click(); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'true');
  await page.locator('#zr-explanation>summary').click(); await page.waitForTimeout(250);
  await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-running', 'false'); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-mode', 'steps');
  await expect(page.locator('#zr-gap')).toHaveText('1 cm');
});

test('zero lead, stationary animals, equal and slower speeds remain truthful', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-turtle-speed', 0); await steps(page, 1);
  await expect(page.locator('#zr-gap')).toHaveText('0 m'); await expect(page.locator('#zr-next')).toBeDisabled(); await expect(page.locator('#zr-observation')).toContainText('第一段'); await expect(page.locator('#zr-stage-label')).toContainText('已追上');
  await setRange(page, '#zr-rabbit-speed', 0); await expect(page.locator('#zr-next')).toBeDisabled();
  await setRange(page, '#zr-turtle-speed', 1); await expect(page.locator('#zr-observation')).toContainText('兔子不动');
  await setRange(page, '#zr-rabbit-speed', 1); await steps(page, 1); await expect(page.locator('#zr-gap')).toHaveText('10 m');
  await setRange(page, '#zr-turtle-speed', 2); await steps(page, 1); await expect(page.locator('#zr-gap')).toHaveText('20 m');
  await openExplanation(page); await expect(page.locator('#zr-meet')).toBeDisabled();
  await setRange(page, '#zr-lead', 0); await expect(page.locator('#zr-gap')).toHaveText('0 m'); await expect(page.locator('#zr-next')).toBeDisabled();
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
  await expect(page.locator('#zr-resolution')).toContainText('没有完成'); await expect(page.locator('#zr-gap')).not.toHaveText('0 m');
  expect(Number(await lab.getAttribute('data-log-gap'))).toBeLessThan(-1000); expect(Number(await lab.getAttribute('data-screen-gap'))).toBeGreaterThan(0);
  await openExplanation(page); await expect(page.locator('#zr-tail')).not.toHaveText('0 s');
  await page.locator('#zr-explanation>summary').click(); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: testInfo.outputPath('zeno-gap-stage-200-desktop.png'), fullPage: true });
});

for (const width of [390, 320]) test(`mobile ${width}px keyboard, reduced motion and deep gap stay usable`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await page.locator('#zr-lead').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#zr-lead-value')).toHaveText('11 m');
  await page.locator('#zr-next').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#zr-gap')).toHaveText('1.1 m');
  await steps(page, 9); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath(`zeno-gap-micro-${width}.png`), fullPage: true });
  await steps(page, 190); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '200');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath(`zeno-gap-last-${width}.png`), fullPage: true });
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
  await expect(page.locator('#zr-gap')).toHaveText('1e-29 m');
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

test('fixed-camera pursuit visibly closes the gap before a separate frozen-time zoom', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z')); await page.goto('/tools/zeno-race/');
  const track = page.locator('#zr-track');
  await track.screenshot({ path: testInfo.outputPath('pursuit-01-before.png') });
  await page.locator('#zr-next').click();
  const start = await motion(page); let previous = start;
  for (let sample = 0; sample < 5; sample++) {
    await page.clock.runFor(350); const current = await motion(page);
    expect(current.phase).toBe('chase'); expect(current.rabbit).toBeGreaterThan(previous.rabbit);
    expect(current.turtle).toBeGreaterThan(previous.turtle); expect(current.gap).toBeLessThan(previous.gap);
    expect(current.target).toBe(start.target); expect(current.camera).toBe(start.camera); expect(current.world).toBe(start.world);
    const rabbitTravel = current.rabbit - start.rabbit, turtleTravel = current.turtle - start.turtle;
    expect(rabbitTravel / turtleTravel).toBeCloseTo(10, 5); previous = current;
  }
  await page.clock.runFor(350); const near = await motion(page);
  expect(near.phase).toBe('hold'); expect(near.rabbit).toBeCloseTo(start.target, 8);
  expect(near.gap).toBeLessThan(start.gap * .101); expect(near.gap).toBeGreaterThan(0);
  await track.screenshot({ path: testInfo.outputPath('pursuit-02-near-miss.png') });
  await page.clock.runFor(800); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '1');
  const held = await motion(page); expect(held.rabbit).toBe(near.rabbit); expect(held.turtle).toBe(near.turtle);
  await page.locator('#zr-next').click(); await page.clock.runFor(400); const zoom = await motion(page);
  expect(zoom.phase).toBe('zoom'); expect(zoom.logGap).toBeCloseTo(near.logGap, 10); expect(zoom.physical).toBe(near.physical);
  expect(zoom.gap).toBeGreaterThan(near.gap); await expect(page.locator('#zr-camera-label')).toContainText('时间暂停');
  await track.screenshot({ path: testInfo.outputPath('pursuit-03-lens-only.png') });
  await page.locator('#zr-play').click(); const frozen = await motion(page); await page.clock.runFor(500); expect(await motion(page)).toEqual(frozen);
  await page.locator('#zr-play').click(); await page.clock.runFor(650); expect((await motion(page)).phase).toBe('chase');
  await page.locator('#zr-reset').click(); await page.clock.runFor(5000); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '0');
});

for (const ratio of [0.1, .9]) test(`repeated fixed-camera pursuit at deep stages, ratio ${ratio}`, async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z')); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/');
  await setRange(page, '#zr-turtle-speed', ratio * 10);
  for (const stage of [0, 1, 5, 20, 199]) {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('#zr-reset').click(); await steps(page, stage);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.locator('#zr-next').click();
    if (stage) await page.clock.runFor(1050);
    const start = await motion(page); await page.clock.runFor(650); const mid = await motion(page);
    expect(mid.phase).toBe('chase'); expect(mid.rabbit).toBeGreaterThan(start.rabbit); expect(mid.turtle).toBeGreaterThan(start.turtle);
    expect(mid.gap).toBeLessThan(start.gap); expect(mid.camera).toBe(start.camera); expect(mid.target).toBe(start.target);
    await page.clock.runFor(1400); const end = await motion(page); expect(end.phase).toBe('hold'); expect(end.gap).toBeGreaterThan(0);
    expect(end.rabbit).toBeCloseTo(start.target, 7);
    if (ratio === .1) await page.locator('#zr-track').screenshot({ path: testInfo.outputPath(`pursuit-stage-${stage + 1}-near.png`) });
    const bounds = await page.locator('#zr-track').evaluate(svg => {
      const rect = (id: string) => {
        const group = svg.querySelector(id)!;
        const active = Array.from(group.children).filter(n => Number(n.getAttribute('opacity') ?? 1) > .01);
        return { left: Math.min(...active.map(n => n.getBoundingClientRect().left)), right: Math.max(...active.map(n => n.getBoundingClientRect().right)) };
      };
      return { rabbit: rect('#zr-rabbit'), turtle: rect('#zr-turtle') };
    });
    expect(bounds.rabbit.right).toBeLessThan(bounds.turtle.left);
    await page.clock.runFor(900); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', String(stage + 1));
  }
});

test('reduced-motion autoplay holds each completed near-gap rather than reopening the next chase', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-05T00:00:01Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tools/zeno-race/'); await page.locator('#zr-play').click();
  await page.clock.runFor(2150); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '1');
  const first = await motion(page); expect(first.gap).toBeLessThan(53);
  await page.clock.runFor(800); const held = await motion(page);
  expect(held.gap).toBe(first.gap); expect(held.rabbit).toBe(first.rabbit); expect(held.turtle).toBe(first.turtle); expect(held.logGap).toBe(first.logGap);
  await page.clock.runFor(1250); await expect(page.locator('#zeno-race-lab')).toHaveAttribute('data-stage', '2');
  const second = await motion(page); expect(second.gap).toBeLessThan(first.gap);
  await page.locator('#zr-play').click(); await page.clock.runFor(4000); expect((await motion(page)).gap).toBe(second.gap);
});
