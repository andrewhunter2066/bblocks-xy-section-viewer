import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionFeatures, hasProjected3DPoints, isTopoFeatureMultiCollection, placeCoords } from './detect-topo.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

test('placeCoords reads a 3D place as [x, y, z]', () => {
  assert.deepEqual(placeCoords({ type: 'Point', coordinates: [399488.7, 6462636.1, 21.45] }), [399488.7, 6462636.1, 21.45]);
});

test('placeCoords gives a 2D place a null z', () => {
  assert.deepEqual(placeCoords({ type: 'Point', coordinates: [406164.4, 6471656.2] }), [406164.4, 6471656.2, null]);
});

test('placeCoords rejects a missing place or non-finite x/y', () => {
  assert.equal(placeCoords(undefined), null);
  assert.equal(placeCoords({ type: 'Point' }), null);
  assert.equal(placeCoords({ coordinates: ['1', 2, 3] }), null);
  assert.equal(placeCoords({ coordinates: [1, NaN, 3] }), null);
});

test('isTopoFeatureMultiCollection accepts wrapped and bare-Feature entries only', () => {
  assert.equal(isTopoFeatureMultiCollection({ points: [{ features: [] }] }), true);
  assert.equal(isTopoFeatureMultiCollection({ solids: [{ type: 'Feature', id: 's' }] }), true);
  assert.equal(isTopoFeatureMultiCollection({ type: 'FeatureCollection', features: [] }), false);
  assert.equal(isTopoFeatureMultiCollection([]), false);
  assert.equal(isTopoFeatureMultiCollection(null), false);
});

test('collectionFeatures normalizes a wrapper or a bare Feature', () => {
  const feature = { type: 'Feature', id: 'a' };
  assert.deepEqual(collectionFeatures({ features: [feature] }), [feature]);
  assert.deepEqual(collectionFeatures(feature), [feature]);
});

test('hasProjected3DPoints is true for both real fixtures', () => {
  assert.equal(hasProjected3DPoints(loadFixture(BUILT_STRATA)), true);
  assert.equal(hasProjected3DPoints(loadFixture(FOUR_UNIT)), true);
});

test('hasProjected3DPoints ignores WGS84 geometry entirely', () => {
  const geometryOnly = { points: [{ features: [{ id: 'p', geometry: { type: 'Point', coordinates: [115.9, -31.9, 20] } }] }] };
  assert.equal(hasProjected3DPoints(geometryOnly), false);
});

test('hasProjected3DPoints is false when every place is 2D', () => {
  const flat = { points: [{ type: 'Feature', id: 'p', place: { type: 'Point', coordinates: [1, 2] } }] };
  assert.equal(hasProjected3DPoints(flat), false);
});
