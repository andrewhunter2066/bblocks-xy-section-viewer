import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLevels, excludedIds, sectionSolids, solidLevels } from './levels.js';
import { box, topoDocument } from '../test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

// Expected heights were computed independently (Python, straight from the fixture JSON): the
// mid-point of the Z range of the non-excluded solids listed on that level alone.
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const names = solids => solids.map(s => s.properties.name).sort();

test('built-strata: the 9 occupation-feature solids are excluded by default', () => {
  const doc = loadFixture(BUILT_STRATA);
  assert.equal(excludedIds(doc).size, 9);
  const solids = sectionSolids(doc);
  assert.equal(solids.length, 9);
  assert.ok(!names(solids).includes('Central Wall - Ground'));
  assert.ok(!names(solids).includes('Ground Floor'));
});

test('built-strata: levels 1 and 2, cut at the mid-height of their non-excluded solids', () => {
  const levels = buildLevels(loadFixture(BUILT_STRATA));
  assert.deepEqual(levels.map(l => l.level), [1, 2]);
  close(levels[0].z, 22.3838795);
  close(levels[1].z, 26.08983);
  assert.deepEqual(names(levels[0].solids), [
    'Principal Unit 1 - lower', 'Principal Unit 2 - lower', 'Unit 1 Courtyard - lower',
    'Unit 2 Courtyard a - lower', 'Unit 2 Courtyard b - lower',
  ]);
  assert.deepEqual(names(levels[1].solids), [
    'Principal Unit 1 - upper', 'Principal Unit 2 - upper', 'Unit 1 Courtyard -upper', 'Unit 2 Courtyard - upper',
  ]);
});

test('built-strata: with no exclusions every solid takes part and level 2 moves', () => {
  const levels = buildLevels(loadFixture(BUILT_STRATA), { exclude: [] });
  assert.equal(levels.reduce((n, l) => n + l.solids.length, 0), 18);
  close(levels[0].z, 22.3838795);
  close(levels[1].z, 26.014824);
});

test('4-unit: levels 1 and 2 at 21.5 m and 24.5 m; the two-floor stairwell is on both', () => {
  const levels = buildLevels(loadFixture(FOUR_UNIT));
  assert.deepEqual(levels.map(l => [l.level, l.z]), [[1, 21.5], [2, 24.5]]);
  assert.deepEqual(names(levels[0].solids), ['Lower East', 'Lower West', 'Stairwell']);
  assert.deepEqual(names(levels[1].solids), ['Stairwell', 'Upper East', 'Upper West']);
});

test('solidLevels accepts an array or a single number and drops non-numbers', () => {
  assert.deepEqual(solidLevels({ properties: { floors: [2, 1, 2] } }), [2, 1]);
  assert.deepEqual(solidLevels({ properties: { floors: 3 } }), [3]);
  assert.deepEqual(solidLevels({ properties: { floors: ['1', null] } }), []);
  assert.deepEqual(solidLevels({ properties: {} }), []);
  assert.deepEqual(solidLevels({ properties: { storey: [0] } }, 'properties.storey'), [0]);
});

test('a configured section height overrides the computed one', () => {
  const levels = buildLevels(loadFixture(FOUR_UNIT), { sectionZ: { 2: 25 } });
  assert.deepEqual(levels.map(l => l.z), [21.5, 25]);
});

test('a level whose solids all span several levels has no height and is left out', () => {
  const doc = topoDocument([
    box({ id: 'a', min: [0, 0, 0], max: [1, 1, 3], properties: { floors: [1] } }),
    box({ id: 'b', min: [2, 0, 0], max: [3, 1, 6], properties: { floors: [1, 2] } }),
  ]);
  assert.deepEqual(buildLevels(doc).map(l => [l.level, l.z]), [[1, 1.5]]);
  assert.deepEqual(buildLevels(doc, { sectionZ: { 2: 4.5 } }).map(l => [l.level, l.z]), [[1, 1.5], [2, 4.5]]);
});

test('a custom level property is honoured', () => {
  const doc = topoDocument([box({ id: 'a', min: [0, 0, 10], max: [1, 1, 12], properties: { storey: 0 } })]);
  assert.deepEqual(buildLevels(doc), []);
  assert.deepEqual(buildLevels(doc, { levelProperty: 'properties.storey' }).map(l => [l.level, l.z]), [[0, 11]]);
});

test('a level made only of excluded solids gets no entry', () => {
  const doc = topoDocument(
    [
      box({ id: 'unit', min: [0, 0, 0], max: [1, 1, 3], properties: { floors: [1] } }),
      box({ id: 'slab', min: [0, 0, 3], max: [1, 1, 3.3], properties: { floors: [2] } }),
    ],
    { occupationFeatures: [{ features: [{ id: 'o', type: 'Feature', properties: { geometryRef: 'slab' } }] }] },
  );
  assert.deepEqual(buildLevels(doc).map(l => l.level), [1]);
});

test('exclude entries accept an array of ids and ignore malformed entries', () => {
  const doc = { occupationFeatures: [{ features: [{ properties: { geometryRef: ['a', 'b', 7] } }] }] };
  assert.deepEqual([...excludedIds(doc)].sort(), ['a', 'b']);
  assert.equal(excludedIds(doc, [{ source: 'occupationFeatures' }, null, 'x']).size, 0);
  assert.equal(excludedIds(doc, 'not-an-array').size, 0);
});
