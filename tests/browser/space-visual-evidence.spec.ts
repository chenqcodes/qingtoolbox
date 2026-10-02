import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /WebGL|Shader|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text()); });
  (page as any).__graphicsErrors = errors;
});
test.afterEach(async ({ page }) => { expect((page as any).__graphicsErrors).toEqual([]); });

async function open(page: Page) {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/space/');
  await page.waitForFunction(() => !!(window as any).__space || !document.getElementById('sp-fallback')?.hidden);
  // CI is our rendering evidence. An unavailable renderer must not masquerade as a pass.
  expect(await page.locator('#sp-fallback').isVisible(), 'This visual suite requires real WebGL rendering').toBe(false);
  await page.locator('#sp-quality').selectOption('light');
  await page.evaluate(() => {
    const { state, cam, bodies, comets } = (window as any).__space;
    state.simDate = new Date('2026-10-02T00:00:00Z'); state.timeMult = 0;
    bodies.updatePositions(state.simDate, true); comets.updatePositions(state.simDate);
    cam.stopEntryOrbit();
  });
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: `test-results/space-visual-${name}.png` });
}

test('rendered evidence: Sun surface and corona at two framing scales', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as any).__space.cam.travelTo('sun'));
  await shot(page, 'sun-wide');
  await page.locator('#sp-zoom-in').click();
  await page.locator('#sp-zoom-in').click();
  await shot(page, 'sun-close');
});

test('rendered evidence: asteroid belt and comet structure', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const { cam, bodies } = (window as any).__space;
    cam.setMode('fly');
    cam.camera.position.set(2.7, .10, .30).sub(bodies.floatingOrigin);
    cam.camera.lookAt(cam.camera.position.clone().add({ x: 0, y: -.06, z: -.30 }));
  });
  await shot(page, 'belt-detail');
  await page.evaluate(() => (window as any).__space.cam.travelToComet('encke'));
  await shot(page, 'comet-encke');
  await page.evaluate(() => (window as any).__space.cam.travelToComet('67p'));
  await shot(page, 'comet-67p');
});

test('rendered evidence: continuous Earth to Mars intermediate flight frames', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as any).__space.cam.travelTo('earth'));
  await shot(page, 'flight-00-earth');
  await page.locator('#sp-reduced-motion').uncheck();
  await page.evaluate(() => (window as any).__space.cam.travelTo('mars'));
  for (let i = 1; i <= 6; i++) {
    await page.evaluate(() => { const cam = (window as any).__space.cam; for (let j = 0; j < 12; j++) cam.update(.05); });
    await shot(page, `flight-0${i}`);
  }
  await page.evaluate(() => { const cam = (window as any).__space.cam; for (let i = 0; i < 200; i++) cam.update(.05); });
  await shot(page, 'flight-07-mars');
  expect(await page.evaluate(() => (window as any).__space.cam.focus)).toBe('mars');
});
