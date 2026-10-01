import test from 'node:test';
import assert from 'node:assert/strict';
import { Hud, type HudState } from './hud';

test('desktop-to-phone breakpoint collapses overlapping drawers only once', () => {
  const classes = () => {
    const values = new Set<string>();
    return { add: (value: string) => values.add(value), remove: (value: string) => values.delete(value), contains: (value: string) => values.has(value) };
  };
  const left = { classList: classes() };
  const bottom = { classList: classes() };
  const nodes: Record<string, unknown> = { '#sp-drawer-left': left, '#sp-drawer-bottom': bottom };
  const root = { dataset: {}, querySelector: (selector: string) => nodes[selector] || null, querySelectorAll: () => [] };
  let phone = false;
  const state: HudState = { simDate: new Date('2026-10-01T11:00:00Z'), timeMult: 0, mode: 'observe', focus: 'earth', starFocus: 'sol', scaleMode: 'solar', speedMult: 1, orbits: true, info: '', speedText: '', touring: false };
  const hud = Object.assign(Object.create(Hud.prototype), { root, getState: () => state, isPhone: () => phone, lastScale: 'solar' }) as Hud;
  hud.render();
  assert.equal(left.classList.contains('is-collapsed'), false);
  assert.equal(bottom.classList.contains('is-collapsed'), false);
  phone = true;
  hud.render();
  assert.equal(left.classList.contains('is-collapsed'), true);
  assert.equal(bottom.classList.contains('is-collapsed'), true);
  bottom.classList.remove('is-collapsed');
  hud.render();
  assert.equal(bottom.classList.contains('is-collapsed'), false, 'user-opened console must remain open');
  phone = false;
  hud.render();
  phone = true;
  hud.render();
  assert.equal(bottom.classList.contains('is-collapsed'), true, 'a new phone breakpoint entry resets layout');
});
