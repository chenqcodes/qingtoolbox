import { expect, test, type Page } from '@playwright/test';

async function openSpace(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/space/');
  await page.waitForFunction(() => !!(window as any).__space || !document.getElementById('sp-fallback')?.hidden);
  test.skip(await page.locator('#sp-fallback').isVisible(), 'WebGL2 unavailable; fallback has separate coverage, no GPU override used');
  await page.locator('#sp-quality').selectOption('light');
  await page.evaluate(() => {
    const { cam, state } = (window as any).__space;
    state.timeMult = 0;
    cam.stopEntryOrbit();
  });
  await expect(page.locator('#sp-reduced-motion')).not.toBeChecked();
}

/** Read in the same browser event as the click: a normal locator click followed
 * by another protocol read could hide a one-frame teleport between them. */
async function clickWithoutTeleport(page: Page, selector: string) {
  const result = await page.evaluate(selector => {
    const { cam } = (window as any).__space;
    const read = () => ({ position: cam.camera.position.toArray(), quaternion: cam.camera.quaternion.toArray(), fov: cam.camera.fov });
    const before = read();
    (document.querySelector(selector) as HTMLButtonElement).click();
    return { before, after: read(), mode: cam.mode };
  }, selector);
  expect(result.after).toEqual(result.before);
  expect(result.mode).toBe('travel');
}

async function waitForIntermediateFrame(page: Page) {
  await page.waitForFunction(() => {
    const cam = (window as any).__space.cam;
    return cam.mode === 'travel' && cam.travelTrail?.progress > .02 && cam.travelTrail.progress < .98;
  }, undefined, { timeout: 20_000 });
}

async function waitForArrival(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).__space.cam.mode), { timeout: 25_000 }).toBe('observe');
}

test('normal-motion guide, next stop and home preserve each current frame', async ({ page }) => {
  await openSpace(page);
  await clickWithoutTeleport(page, '[data-explore="jupiter"]');
  await waitForIntermediateFrame(page);
  await page.screenshot({ path: 'test-results/space-guide-midflight.png' });
  await clickWithoutTeleport(page, '#sp-guide-next');
  await waitForIntermediateFrame(page);
  await waitForArrival(page);
  expect(await page.evaluate(() => (window as any).__space.cam.focus)).toBe('io');
  await clickWithoutTeleport(page, '#sp-home-earth');
  await waitForIntermediateFrame(page);
  await waitForArrival(page);
  expect(await page.evaluate(() => (window as any).__space.cam.focus)).toBe('earth');
  expect(await page.evaluate(() => (window as any).__space.cam.travelTrail)).toBeNull();
});

test('normal-motion zoom, reset and wheel inputs animate without a click-time snap', async ({ page }) => {
  await openSpace(page);
  await clickWithoutTeleport(page, '#sp-zoom-out');
  await waitForIntermediateFrame(page);
  await clickWithoutTeleport(page, '#sp-zoom-out');
  await waitForArrival(page);
  await clickWithoutTeleport(page, '#sp-reset-view');
  await waitForIntermediateFrame(page);
  await waitForArrival(page);
  const wheel = await page.evaluate(() => {
    const { cam } = (window as any).__space;
    const before = cam.camera.position.toArray();
    document.querySelector('#space-canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaY: -80, bubbles: true, cancelable: true }));
    return { before, after: cam.camera.position.toArray(), mode: cam.mode };
  });
  expect(wheel.after).toEqual(wheel.before);
  expect(wheel.mode).toBe('travel');
  await waitForIntermediateFrame(page);
  await waitForArrival(page);
});

test('cross-scale navigation captures a real image and replaces interrupted dissolves', async ({ page }) => {
  await openSpace(page);
  await page.locator('[data-explore="nearby"]').click();
  await waitForArrival(page);
  const capture = await page.evaluate(() => {
    (document.querySelector('#sp-guide-next') as HTMLButtonElement).click();
    const layer = document.querySelector<HTMLCanvasElement>('canvas[data-space-transition]')!;
    const pixels = layer.getContext('2d')!.getImageData(0, 0, layer.width, layer.height).data;
    let opaque = 0, colored = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i + 3] > 0) opaque++;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 16) colored++;
    }
    return { opaque, colored, opacity: layer.style.opacity, scale: (window as any).__space.cam.scaleMode };
  });
  expect(capture.opaque).toBeGreaterThan(100);
  expect(capture.colored).toBeGreaterThan(10);
  expect(capture.opacity).toBe('1');
  expect(capture.scale).toBe('stellar');
  const interrupted = await page.evaluate(() => {
    (document.querySelector('#sp-home-earth') as HTMLButtonElement).click();
    return { layers: document.querySelectorAll('canvas[data-space-transition]').length, scale: (window as any).__space.cam.scaleMode };
  });
  expect(interrupted).toEqual({ layers: 1, scale: 'solar' });
  await expect(page.locator('canvas[data-space-transition]')).toHaveCount(0, { timeout: 25_000 });
  await waitForArrival(page);
  expect(await page.evaluate(() => (window as any).__space.cam.focus)).toBe('earth');
  await page.screenshot({ path: 'test-results/space-cross-scale-return.png' });
});

test('reduced-motion toggle clears an active dissolve and keeps later guide steps immediate', async ({ page }) => {
  await openSpace(page);
  await page.locator('[data-explore="nearby"]').click();
  const result = await page.evaluate(() => {
    (document.querySelector('#sp-guide-next') as HTMLButtonElement).click();
    const before = document.querySelectorAll('canvas[data-space-transition]').length;
    const checkbox = document.querySelector<HTMLInputElement>('#sp-reduced-motion')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    const { cam } = (window as any).__space;
    return { before, after: document.querySelectorAll('canvas[data-space-transition]').length, mode: cam.mode, star: cam.starFocus };
  });
  expect(result).toEqual({ before: 1, after: 0, mode: 'observe', star: 'proxima' });
  await page.locator('#sp-guide-next').click();
  expect(await page.evaluate(() => ({ mode: (window as any).__space.cam.mode, star: (window as any).__space.cam.starFocus })))
    .toEqual({ mode: 'observe', star: 'alpha_cen_a' });
  await expect(page.locator('canvas[data-space-transition]')).toHaveCount(0);
});
