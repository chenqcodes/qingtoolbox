import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`Sun bearing is visible offscreen and clears onscreen at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/space/');
    await page.waitForFunction(() => !!(window as any).__space || !document.getElementById('sp-fallback')?.hidden);
    test.skip(await page.locator('#sp-fallback').isVisible(), 'WebGL unavailable');
    await page.evaluate(() => {
      const { cam, state } = (window as any).__space;
      state.timeMult = 0;
      cam.setReducedMotion(true);
      cam.navigateToBody('earth');
      // Hold a controlled camera pose, independent of orbit settling.
      cam.update = () => {};
      const sun = cam.bodies.getWorldPos('sun');
      const away = cam.camera.position.clone().multiplyScalar(2).sub(sun);
      cam.camera.lookAt(away);
    });
    const marker = page.locator('#sp-sun-direction');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('role', 'img');
    await expect.poll(async () => page.evaluate(() => {
      const marker = document.getElementById('sp-sun-direction')!.getBoundingClientRect();
      const panels = [...document.querySelectorAll<HTMLElement>('.sp-top, .sp-explorer, .sp-quick-nav, .sp-minimap-wrap, .sp-drawer, .sp-readout, .sp-speed')];
      return panels.filter(el => !el.hidden && getComputedStyle(el).display !== 'none').every(el => {
        const r = el.getBoundingClientRect();
        return !r.width || !r.height || marker.right <= r.left || marker.left >= r.right || marker.bottom <= r.top || marker.top >= r.bottom;
      });
    })).toBe(true);
    const box = await marker.boundingBox();
    expect(box!.width).toBe(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `test-results/space-sun-bearing-${viewport.width}-solar.png` });
    await page.evaluate(() => {
      const { cam } = (window as any).__space;
      cam.camera.lookAt(cam.bodies.getWorldPos('sun'));
    });
    await expect(marker).toBeHidden();
    await page.evaluate(() => {
      const { cam } = (window as any).__space;
      cam.navigateToStar('sirius');
      const sun = cam.stars.getWorldPos('sol');
      cam.camera.lookAt(cam.camera.position.clone().multiplyScalar(2).sub(sun));
    });
    await expect(marker).toBeVisible();
    await page.screenshot({ path: `test-results/space-sun-bearing-${viewport.width}-stellar.png` });
    const stellarLines = await page.evaluate(() => {
      const { stars } = (window as any).__space;
      let count = 0;
      stars.root.traverse((object: any) => { if (object.isLine && !object.isLineLoop) count++; });
      return count;
    });
    expect(stellarLines).toBe(0);
  });
}
