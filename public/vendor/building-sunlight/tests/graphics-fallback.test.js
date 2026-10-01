'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('renderer failure presents fallback without entering analysis or changing project storage', () => {
  const fallback = { hidden: true };
  const controls = { hidden: false };
  const empty = { style: {} };
  const noop = function () {};
  const context = {
    THREE: { Scene: noop, Color: noop, Fog: noop, PerspectiveCamera: function () { this.position = { set: noop }; }, WebGLRenderer: function () { throw Error('WebGL unavailable'); } },
    CONFIG: { SCENE: {} },
    window: { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: true }) },
    document: { getElementById: id => ({ graphicsFallback: fallback, controls, 'empty-state': empty })[id] },
    console: { warn: noop },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/viewer.js'), 'utf8'), context);
  assert.equal(fallback.hidden, false);
  assert.equal(controls.hidden, true);
  assert.equal(empty.style.display, 'none');
});
