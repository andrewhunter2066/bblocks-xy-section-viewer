import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitViewBox, niceStep, panViewBox, pixelToView, viewBoxAttribute, zoomViewBox } from './view-box.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('niceStep picks a 1/2/5 × 10ⁿ spacing near extent / 8', () => {
  assert.equal(niceStep(57.5), 10);
  assert.equal(niceStep(12), 2);
  assert.equal(niceStep(3.5), 0.5);
  assert.equal(niceStep(800), 100);
  assert.equal(niceStep(0), 1);
});

test('fitViewBox adds padding on every side', () => {
  assert.deepEqual(fitViewBox({ minX: 0, minY: 0, maxX: 10, maxY: 4 }, 2), { x: -2, y: -2, w: 14, h: 8 });
});

test('pixelToView accounts for letterboxing under xMidYMid meet', () => {
  const vb = { x: 0, y: 0, w: 100, h: 50 };
  // 400 × 400 px: scale 0.25 m/px, the drawing is 200 px tall, centred (100 px bars above and below).
  assert.deepEqual(pixelToView(vb, 0, 100, 400, 400), [0, 0]);
  assert.deepEqual(pixelToView(vb, 400, 300, 400, 400), [100, 50]);
  assert.deepEqual(pixelToView(vb, 200, 200, 400, 400), [50, 25]);
});

test('zoomViewBox keeps the focus point fixed and scales the size', () => {
  const vb = { x: 0, y: 0, w: 100, h: 50 };
  const zoomed = zoomViewBox(vb, 2, [80, 10]);
  assert.deepEqual([zoomed.w, zoomed.h], [50, 25]);
  // The focus keeps its relative position within the view: 80% across, 20% down.
  close((80 - zoomed.x) / zoomed.w, 0.8);
  close((10 - zoomed.y) / zoomed.h, 0.2);
  const centred = zoomViewBox(vb, 0.5);
  assert.deepEqual(centred, { x: -50, y: -25, w: 200, h: 100 });
});

test('zoomViewBox clamps the width', () => {
  const vb = { x: 0, y: 0, w: 100, h: 50 };
  assert.equal(zoomViewBox(vb, 1000, undefined, { minW: 1 }).w, 1);
  assert.equal(zoomViewBox(vb, 0.001, undefined, { maxW: 400 }).w, 400);
  assert.equal(zoomViewBox(vb, 1000, undefined, { minW: 1 }).h, 0.5);
});

test('panViewBox moves the drawing with the pointer', () => {
  const vb = { x: 0, y: 0, w: 100, h: 50 };
  // 0.25 m/px at 400 × 400: dragging 40 px right shows 10 m further left.
  assert.deepEqual(panViewBox(vb, 40, -20, 400, 400), { x: -10, y: 5, w: 100, h: 50 });
});

test('viewBoxAttribute rounds to 4 decimals', () => {
  assert.equal(viewBoxAttribute({ x: 1 / 3, y: -2, w: 10, h: 5.123456 }), '0.3333 -2 10 5.1235');
});
