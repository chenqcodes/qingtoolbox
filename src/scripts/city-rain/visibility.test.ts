import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the real controller with deterministic observer deliveries and frames.
// No DOM layout or renderer is replaced in the browser regression suite.
test('rain controller consumes the newest visibility event and keeps one playback loop', async t => {
  type Listener = (event: Record<string, unknown>) => void;
  class Element {
    dataset: Record<string, string> = {};
    textContent = ''; innerHTML = ''; value = '0'; checked = true; width = 0; height = 0;
    attrs = new Map<string, string>(); listeners = new Map<string, Listener[]>();
    addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
    setAttribute(name: string, value: string) { this.attrs.set(name, value); }
    emit(type: string) { for (const listener of this.listeners.get(type) ?? []) listener({ currentTarget: this, target: this }); }
    getBoundingClientRect() { return { x: 0, y: 100, top: 100, bottom: 635, left: 0, right: 700, width: 700, height: 535 }; }
  }
  const elements = new Map<string, Element>();
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  const root = Object.assign(element('city-rain-lab'), { querySelector: (selector: string) => element(selector.slice(1)), querySelectorAll: () => [] });
  const drawing = new Proxy<Record<string, unknown>>({}, { get(target, key: string) { return target[key] ?? (() => {}); } });
  const canvas = Object.assign(element('cr-canvas'), { getContext: () => drawing });
  element('cr-rain').value = '60'; element('cr-drain').value = '35'; element('cr-brush-size').value = '1';
  const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 1;
  let notify: IntersectionObserverCallback = () => {};
  class Observer {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {} disconnect() {} takeRecords() { return []; }
  }
  const documentStub = Object.assign(new Element(), { hidden: false, querySelector: () => root });
  const replacements: Record<string, unknown> = {
    document: documentStub, window: new Element(), devicePixelRatio: 1,
    matchMedia: () => Object.assign(new Element(), { matches: true }),
    requestAnimationFrame: (fn: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, fn); return id; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    ResizeObserver: class { constructor(readonly callback: () => void) {} observe() { this.callback(); } disconnect() {} },
    IntersectionObserver: Observer,
  };
  const original = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(() => { for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  await import('./main');
  let observationTime = 0;
  const deliver = (...visible: boolean[]) => notify(visible.map(isIntersecting => ({ target: canvas, time: ++observationTime, isIntersecting } as unknown as IntersectionObserverEntry)), {} as IntersectionObserver);
  const tick = (now: number) => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
  const play = element('cr-play'), status = element('cr-status');
  deliver(true); play.emit('click'); tick(100); tick(200);
  assert.ok(Number(root.dataset.time) > 0); assert.equal(frames.size, 1);
  const before = root.dataset.time;
  // Multiple observations for the same target can be delivered in one batch.
  deliver(false, true);
  assert.equal(frames.size, 1, 'the latest visible entry must not freeze playback');
  tick(300); tick(400); assert.ok(Number(root.dataset.time) > Number(before));
  deliver(false); assert.equal(frames.size, 0);
  const beforeResume = root.dataset.time; tick(5000); assert.equal(root.dataset.time, beforeResume);
  deliver(true); assert.equal(frames.size, 1, 'returning onscreen resumes an active simulation');
  tick(10000); assert.equal(root.dataset.time, beforeResume, 'hidden wall-clock time must not be simulated');
  tick(10200); assert.ok(Number(root.dataset.time) > Number(beforeResume));
  assert.ok(Number(root.dataset.time) - Number(beforeResume) <= .101);
  deliver(true, false); assert.equal(frames.size, 0); assert.match(status.textContent, /画布在屏幕外/);
  const hiddenTime = root.dataset.time; tick(1000); assert.equal(root.dataset.time, hiddenTime);
  play.emit('click'); assert.equal(play.attrs.get('aria-pressed'), 'false');
  deliver(false, true); assert.equal(frames.size, 0, 'visibility must not override a manual pause');
  element('cr-rain').value = '0'; element('cr-rain').emit('input'); play.emit('click');
  assert.match(status.textContent, /雨已停/); assert.equal(frames.size, 1);
  deliver(true, true); assert.equal(frames.size, 1, 'repeated visible entries cannot duplicate the loop');
});
