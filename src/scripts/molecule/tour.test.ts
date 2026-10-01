import assert from 'node:assert/strict';
import test from 'node:test';
import { createTour } from './tour';

test('manual selection pauses timer and resume advances from selected model', () => {
  let callback = () => {};
  let starts = 0;
  let stops = 0;
  const tour = createTour('dna', ['dna', 'water', 'caffeine'], () => {}, {
    set: (fn) => { callback = fn; starts++; return 1 as unknown as ReturnType<typeof setInterval>; },
    clear: () => { stops++; },
  });
  tour.start(); tour.start();
  assert.equal(starts, 1);
  callback();
  assert.equal(tour.current, 'water');
  tour.select('caffeine');
  assert.equal(tour.running, false);
  assert.equal(stops, 1);
  assert.equal(tour.current, 'caffeine');
  tour.start(); callback();
  assert.equal(tour.current, 'dna');
  tour.pause(); tour.pause();
  assert.equal(stops, 2);
});

test('unrecognized model does not corrupt selection or timer state', () => {
  const tour = createTour('water', ['water'], () => {});
  tour.select('missing');
  assert.equal(tour.current, 'water');
  assert.equal(tour.running, false);
});
