import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, buildSectionModel, labelAnchor, safeColor } from './xy-scene.js';
import { buildXYDefaultConfig } from './utils/xy-default-config.js';
import { resolveXYOptions } from './utils/xy-options.js';
import { loopArea } from './utils/section.js';
import { box, topoDocument } from './test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from './test-support/fixtures.js';

const options = raw => resolveXYOptions(raw).options;
const waOptions = () => options(loadFixture('wa-strata-config.json').xySection);
const model = (doc, { config = buildXYDefaultConfig(), xySection = options() } = {}) => buildSectionModel(doc, { config, xySection });
const byLabel = (m, label) => m.records.find(r => r.label === label);

test('built-strata: 9 section records (occupation solids excluded; uncut surfaces dropped), WA labels', () => {
  const m = model(loadFixture(BUILT_STRATA), { xySection: waOptions() });
  assert.deepEqual(m.levels.map(l => [l.level, l.label]), [[1, 'Ground floor'], [2, 'First floor']]);
  assert.equal(m.records.length, 9);
  assert.ok(m.records.every(r => r.mode === 'section' && r.kind === 'solid'));
  assert.equal(byLabel(m, 'Central Wall - Ground'), undefined);
  assert.deepEqual(byLabel(m, 'Principal Unit 1 - upper').levels, [2]);
});

test('built-strata: without exclusions the walls and slabs come back', () => {
  const m = model(loadFixture(BUILT_STRATA), { xySection: options({ exclude: [] }) });
  assert.ok(byLabel(m, 'Central Wall - Ground'));
  assert.ok(m.records.length > 9);
});

test('built-strata: the boundary is the former-tenure lot, in local coordinates', () => {
  const m = model(loadFixture(BUILT_STRATA), { xySection: waOptions() });
  assert.equal(m.boundary.label, 'Lot 1 on Plan DP 413673');
  assert.equal(m.boundary.loops[0].length, 4);
  m.boundary.loops[0].forEach(([x, y]) => {
    assert.ok(x >= -1e-9 && x <= m.bounds.maxX + 1e-9);
    assert.ok(y >= -1e-9 && y <= m.bounds.maxY + 1e-9);
  });
});

test('local frame: x is easting − minE, y is maxN − northing, and toWorld inverts it', () => {
  const doc = topoDocument([box({ id: 'a', min: [400000, 6400000, 0], max: [400010, 6400004, 3], properties: { floors: [1] } })]);
  const m = model(doc);
  assert.deepEqual(m.origin, [400000, 6400004]);
  assert.deepEqual(m.toLocal([400010, 6400000]), [10, 4]);
  assert.deepEqual(m.toWorld([10, 4]), [400010, 6400000]);
  const [shape] = m.shapesAt(1).values();
  assert.equal(Math.abs(loopArea(shape.loops[0])), 40);
});

test('colours: one per feature, never shared on a floor, reused only across floors', () => {
  const m = model(loadFixture(BUILT_STRATA), { xySection: waOptions() });
  for (const level of m.levels) {
    const colours = m.records.filter(r => r.levels.includes(level.level)).map(r => r.color);
    assert.equal(new Set(colours).size, colours.length, `level ${level.level}`);
  }
  assert.ok(m.records.every(r => PALETTE.includes(r.color)));
});

test('colours: the 4-unit stairwell, on both floors, differs from every unit on either floor', () => {
  const m = model(loadFixture(FOUR_UNIT));
  const stair = byLabel(m, 'Stairwell');
  assert.deepEqual(stair.levels, [1, 2]);
  m.records.filter(r => r !== stair).forEach(r => assert.notEqual(r.color, stair.color, r.label));
});

test('colours: a rule\'s own style.color wins; an unsafe one is ignored', () => {
  const config = { rules: [
    { source: 'solids', kind: 'unit', geometry: 'solid', match: { property: 'properties.name', values: ['Upper East'] }, style: { color: '#123456' } },
    { source: 'solids', kind: 'other', geometry: 'solid', style: { color: 'red" onload="x' } },
  ] };
  const m = model(loadFixture(FOUR_UNIT), { config });
  assert.equal(byLabel(m, 'Upper East').color, '#123456');
  assert.ok(PALETTE.includes(byLabel(m, 'Upper West').color));
});

test('a block rule without its own label config still labels features by name, not id', () => {
  const config = { rules: [{ source: 'solids', kind: 'unit', geometry: 'solid' }] };
  const labels = model(loadFixture(FOUR_UNIT), { config }).records.map(r => r.label).sort();
  assert.deepEqual(labels, ['Lower East', 'Lower West', 'Stairwell', 'Upper East', 'Upper West']);
  const byId = { rules: [{ source: 'solids', kind: 'unit', geometry: 'solid', label: { properties: [], fallback: 'id' } }] };
  assert.ok(model(loadFixture(FOUR_UNIT), { config: byId }).records.every(r => r.label.startsWith('uuid:')));
});

test('safeColor accepts hex, names and rgb()/hsl(); rejects anything else', () => {
  ['#abc', '#a1b2c3', '#a1b2c3d4', 'teal', 'rgb(1, 2, 3)', 'hsl(200 50% 40% / .5)'].forEach(c => assert.equal(safeColor(c), c));
  ['', 'url(#x)', 'red;', '"red"', 'rgb(1,2,3) x', 42, null].forEach(c => assert.equal(safeColor(c), null, String(c)));
});

test('sections are computed per level on first request and cached', () => {
  const m = model(loadFixture(FOUR_UNIT));
  const first = m.shapesAt(1);
  assert.equal(m.shapesAt(1), first);
  const labels = [...first.keys()].map(k => m.records.find(r => r.key === k).label).sort();
  assert.deepEqual(labels, ['Lower East', 'Lower West', 'Stairwell']);
  assert.equal(m.shapesAt(99).size, 0);
});

test('a polygon rule draws parcels as flat outlines on every level', () => {
  const config = { rules: [
    ...buildXYDefaultConfig().rules,
    { source: 'parcels', kind: 'lot', geometry: 'polygon' },
  ] };
  const m = model(loadFixture(FOUR_UNIT), { config });
  const lot = m.records.find(r => r.kind === 'lot');
  assert.equal(lot.mode, 'outline');
  assert.deepEqual(lot.levels, [1, 2]);
  assert.ok(m.shapesAt(1).has(lot.key) && m.shapesAt(2).has(lot.key));
  assert.equal(m.shapesAt(1).get(lot.key).loops[0].length, 19);
});

test('a face rule is sectioned into open lines; unknown geometries and outline-less parcels are skipped', () => {
  const doc = topoDocument([box({ id: 'a', min: [0, 0, 0], max: [10, 4, 3], properties: { floors: [1] } })]);
  const config = { rules: [
    { source: 'solids', kind: 'solid', geometry: 'solid' },
    { source: 'faces', kind: 'face', geometry: 'face' },
    { source: 'rings', kind: 'ring', geometry: 'mesh' },
  ] };
  const m = model(doc, { config });
  const faces = m.records.filter(r => r.kind === 'face');
  assert.equal(faces.length, 4, 'the four walls; floor and roof are never cut');
  const shape = m.shapesAt(1).get(faces[0].key);
  assert.equal(shape.loops.length, 0);
  assert.equal(shape.polylines.length, 1);
  assert.equal(m.records.filter(r => r.kind === 'ring').length, 0);

  const aggregates = { rules: [{ source: 'parcels', kind: 'lot', geometry: 'polygon' }] };
  const strata = model(loadFixture(BUILT_STRATA), { config: aggregates });
  assert.equal(strata.records.length, 1, 'only the Ring lot has an outline');
});

test('initiallyVisible: false carries through to the record', () => {
  const config = { rules: [{ source: 'solids', kind: 'solid', geometry: 'solid', initiallyVisible: false }] };
  assert.ok(model(loadFixture(FOUR_UNIT), { config }).records.every(r => r.visible === false));
});

test('meta carries the document name, CRS and bearing rotation', () => {
  const m = model(loadFixture(BUILT_STRATA));
  assert.deepEqual(m.meta, { name: 'SP83687', horizontalCRS: 'epsg:7850', verticalCRS: 'epsg:5711', bearingRotation: -0.54 });
});

test('contextLevels lists every lower level', () => {
  const m = model(loadFixture(FOUR_UNIT));
  assert.deepEqual(m.contextLevels(2).map(l => l.level), [1]);
  assert.deepEqual(m.contextLevels(1), []);
});

test('labelAnchor is the centroid of the largest loop', () => {
  assert.deepEqual(labelAnchor([[[0, 0], [2, 0], [2, 2], [0, 2]], [[10, 10], [16, 10], [16, 16], [10, 16]]]), [13, 13]);
  assert.equal(labelAnchor([]), null);
});
