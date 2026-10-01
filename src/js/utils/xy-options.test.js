import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_XY_OPTIONS, levelLabel, resolveXYOptions } from './xy-options.js';
import { loadDemoConfig, loadFixture } from '../test-support/fixtures.js';

test('no xySection gives the defaults with no warnings', () => {
  const { options, warnings } = resolveXYOptions(undefined);
  assert.deepEqual(options, { ...DEFAULT_XY_OPTIONS, levelLabels: {}, sectionZ: {} });
  assert.deepEqual(warnings, []);
  assert.equal(options.showContext, false);
  assert.deepEqual(options.boundary, [{ source: 'parcels' }]);
  assert.deepEqual(options.exclude, [{ source: 'occupationFeatures', property: 'properties.geometryRef' }]);
});

test('a fully specified xySection is taken as given', () => {
  const { options, warnings } = resolveXYOptions({
    levelProperty: 'properties.storey',
    levelLabels: { 0: 'Ground', 1: 'First' },
    sectionZ: { 1: 24.5 },
    showContext: true,
    padding: 0,
    grid: 5,
    boundary: [{ source: 'lots', match: { property: 'properties.state', values: ['current'] }, follow: { role: 'parent', source: 'parcels' } }],
    exclude: [],
  });
  assert.deepEqual(warnings, []);
  assert.deepEqual(options, {
    levelProperty: 'properties.storey',
    levelLabels: { 0: 'Ground', 1: 'First' },
    sectionZ: { 1: 24.5 },
    showContext: true,
    padding: 0,
    grid: 5,
    boundary: [{ source: 'lots', match: { property: 'properties.state', values: ['current'] }, follow: { role: 'parent', source: 'parcels' } }],
    exclude: [],
  });
});

test('the built-strata demo block\'s WA config parses without warnings', () => {
  const { options, warnings } = resolveXYOptions(loadDemoConfig('builtStrata').xySection);
  assert.deepEqual(warnings, []);
  assert.equal(options.boundary.length, 3);
  assert.deepEqual(options.boundary[0].follow, { role: 'containingPrimaryParcel', source: 'parcels' });
});

test('a non-object xySection falls back to the defaults with one warning', () => {
  for (const raw of [null, 'yes', 3, []]) {
    const { options, warnings } = resolveXYOptions(raw);
    assert.equal(options.levelProperty, 'properties.floors');
    assert.equal(warnings.length, 1, JSON.stringify(raw));
  }
});

test('each invalid scalar option falls back to its default with a warning', () => {
  const { options, warnings } = resolveXYOptions({
    levelProperty: '', showContext: 'yes', padding: -1, grid: 0,
  });
  assert.equal(options.levelProperty, 'properties.floors');
  assert.equal(options.showContext, false);
  assert.equal(options.padding, 2);
  assert.equal(options.grid, true);
  assert.equal(warnings.length, 4);
});

test('level maps keep their valid entries and drop the rest individually', () => {
  const { options, warnings } = resolveXYOptions({
    levelLabels: { 1: 'Ground', two: 'First', 3: '' },
    sectionZ: { 1: 21.5, 2: '24', ' ': 3, '02': 25 },
  });
  assert.deepEqual(options.levelLabels, { 1: 'Ground' });
  assert.deepEqual(options.sectionZ, { 1: 21.5, 2: 25 });
  assert.equal(warnings.length, 4);
  assert.equal(resolveXYOptions({ sectionZ: [21.5] }).warnings.length, 1);
});

test('boundary entries: invalid ones are dropped, an empty list means no boundary', () => {
  const { options, warnings } = resolveXYOptions({
    boundary: [
      'parcels',
      { source: '' },
      { match: { property: 'properties.x' } },
      { follow: { source: 'parcels' } },
      { match: { property: 'properties.x', values: ['a'] } },
    ],
  });
  assert.deepEqual(options.boundary, [{ source: 'parcels', match: { property: 'properties.x', values: ['a'] } }]);
  assert.equal(warnings.length, 4);
  assert.deepEqual(resolveXYOptions({ boundary: [] }).options.boundary, []);
  assert.deepEqual(resolveXYOptions({ boundary: {} }).options.boundary, [{ source: 'parcels' }]);
});

test('exclude entries: invalid ones are dropped, an empty list excludes nothing', () => {
  const { options, warnings } = resolveXYOptions({
    exclude: [{ source: 'occupationFeatures' }, { source: 'walls', property: 'properties.ref', extra: 1 }],
  });
  assert.deepEqual(options.exclude, [{ source: 'walls', property: 'properties.ref' }]);
  assert.equal(warnings.length, 1);
  assert.deepEqual(resolveXYOptions({ exclude: [] }).options.exclude, []);
  assert.deepEqual(resolveXYOptions({ exclude: 'none' }).options.exclude, DEFAULT_XY_OPTIONS.exclude);
});

test('a boundary or exclude list with only invalid entries falls back to the default, not to "none"', () => {
  const { options, warnings } = resolveXYOptions({ boundary: ['parcels'], exclude: [{ source: 'occupationFeatures' }] });
  assert.deepEqual(options.boundary, DEFAULT_XY_OPTIONS.boundary);
  assert.deepEqual(options.exclude, DEFAULT_XY_OPTIONS.exclude);
  assert.equal(warnings.length, 4);
});

test('unknown keys are reported but do not affect the rest', () => {
  const { options, warnings } = resolveXYOptions({ basemap: 'osm', padding: 5 });
  assert.equal(options.padding, 5);
  assert.deepEqual(warnings, ['xySection.basemap is not a known option; ignoring it']);
});

test('levelLabel uses a configured label, else "Level <n>"', () => {
  const { options } = resolveXYOptions({ levelLabels: { 1: 'Ground floor' } });
  assert.equal(levelLabel(1, options), 'Ground floor');
  assert.equal(levelLabel(2, options), 'Level 2');
  assert.equal(levelLabel(0), 'Level 0');
});
