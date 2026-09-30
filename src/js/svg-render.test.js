import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, gridStep, renderSectionSvg } from './svg-render.js';
import { buildSectionModel } from './xy-scene.js';
import { buildXYDefaultConfig } from './utils/xy-default-config.js';
import { resolveXYOptions } from './utils/xy-options.js';
import { box, topoDocument } from './test-support/topo-builder.js';
import { FOUR_UNIT, loadFixture } from './test-support/fixtures.js';

const fourUnit = (raw = {}) => buildSectionModel(loadFixture(FOUR_UNIT), { config: buildXYDefaultConfig(), xySection: resolveXYOptions(raw).options });
const count = (svg, pattern) => (svg.match(pattern) ?? []).length;
const recordKeys = svg => [...svg.matchAll(/class="xys-record" data-key="(r\d+)"/g)].map(m => m[1]);
const titled = (m, label) => m.records.find(r => r.label === label).key;

test('draws one record group per feature on the level, each with its label as a tooltip', () => {
  const m = fourUnit();
  const svg = renderSectionSvg(m, 1);
  assert.deepEqual(recordKeys(svg).sort(), [titled(m, 'Lower East'), titled(m, 'Lower West'), titled(m, 'Stairwell')].sort());
  assert.match(svg, /<title>Lower East<\/title>/);
  assert.match(svg, /fill-rule="evenodd"/);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" class="xys-svg"/);
  assert.match(svg, /aria-label="Level 1: section at Z = 21.500 m"/);
});

test('a hidden record is left out of the drawing and its label', () => {
  const m = fourUnit();
  const hidden = titled(m, 'Stairwell');
  const svg = renderSectionSvg(m, 1, { isVisible: key => key !== hidden });
  assert.ok(!recordKeys(svg).includes(hidden));
  assert.ok(!svg.includes('>Stairwell</text>'));
});

test('lower floors are drawn faded only when context is on, and never under the lowest floor', () => {
  const m = fourUnit();
  assert.equal(count(renderSectionSvg(m, 2), /data-level=/g), 0);
  const withContext = renderSectionSvg(m, 2, { showContext: true });
  assert.equal(count(withContext, /data-level="1"/g), 3);
  assert.match(withContext, /stroke-opacity="0.4"/);
  assert.equal(count(renderSectionSvg(m, 1, { showContext: true }), /data-level=/g), 0);
});

test('the boundary is drawn dashed with its label, unless turned off', () => {
  const m = fourUnit();
  assert.match(renderSectionSvg(m, 1), /class="xys-boundary"><title>Boundary: Lot 1<\/title>.*stroke-dasharray="8 4"/);
  assert.ok(!renderSectionSvg(m, 1, { showBoundary: false }).includes('xys-boundary'));
});

test('labels can be turned off', () => {
  const m = fourUnit();
  assert.equal(count(renderSectionSvg(m, 1), /<text /g), 3);
  assert.equal(count(renderSectionSvg(m, 1, { showLabels: false }), /<text /g), 0);
});

test('grid: automatic spacing, a fixed spacing, or none', () => {
  const m = fourUnit();
  assert.equal(gridStep(m, true), 10);
  assert.equal(gridStep(m, 2.5), 2.5);
  assert.equal(gridStep(m, false), null);
  assert.match(renderSectionSvg(m, 1), /class="xys-grid"/);
  assert.ok(!renderSectionSvg(m, 1, { grid: false }).includes('xys-grid'));
});

test('grid lines fall on whole multiples of the spacing in world coordinates', () => {
  // Neither edge on a multiple of 5, so a mirrored grid would not land on multiples either.
  const doc = topoDocument([box({ id: 'a', min: [400003, 6400001, 0], max: [400013, 6400004, 3], properties: { floors: [1] } })]);
  const m = buildSectionModel(doc, { config: buildXYDefaultConfig(), xySection: resolveXYOptions({ boundary: [] }).options });
  const d = /class="xys-grid" d="([^"]+)"/.exec(renderSectionSvg(m, 1, { grid: 5 }))[1];
  const xs = [...d.matchAll(/M(-?[\d.]+) -?[\d.]+V/g)].map(match => Number(match[1]) + m.origin[0]);
  const ys = [...d.matchAll(/M-?[\d.]+ (-?[\d.]+)H/g)].map(match => m.origin[1] - Number(match[1]));
  assert.ok(xs.includes(400005) && xs.includes(400010));
  assert.ok(ys.includes(6400000) && ys.includes(6400005));
  [...xs, ...ys].forEach(v => assert.ok(Math.abs(v / 5 - Math.round(v / 5)) < 1e-6, String(v)));
});

test('northing runs up the drawing: the north side has the smaller SVG y', () => {
  const doc = topoDocument([box({ id: 'a', min: [0, 0, 0], max: [10, 4, 3], properties: { floors: [1] } })]);
  const m = buildSectionModel(doc, { config: buildXYDefaultConfig(), xySection: resolveXYOptions({}).options });
  const [shape] = m.shapesAt(1).values();
  const ys = shape.loops[0].map(p => p[1]);
  // World northings 0 and 4 → local y 4 and 0.
  assert.deepEqual([...new Set(ys)].sort(), [0, 4]);
});

test('document text is escaped: a hostile label cannot inject markup', () => {
  const doc = topoDocument([box({ id: 'a', min: [0, 0, 0], max: [10, 4, 3], properties: { floors: [1], name: '<script>alert(1)</script>&"' } })]);
  const m = buildSectionModel(doc, { config: buildXYDefaultConfig(), xySection: resolveXYOptions({}).options });
  const svg = renderSectionSvg(m, 1);
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;&amp;&quot;/);
  assert.equal(escapeXml(`a'b`), 'a&#39;b');
});

test('rule style: fill opacity, line colour and dashed lines', () => {
  const config = { rules: [{ source: 'solids', kind: 'solid', geometry: 'solid', style: { opacity: 0.2, lineColor: '#000000', lineStyle: 'dashed' } }] };
  const m = buildSectionModel(loadFixture(FOUR_UNIT), { config, xySection: resolveXYOptions({ boundary: [] }).options });
  const svg = renderSectionSvg(m, 1);
  assert.match(svg, /fill-opacity="0.2" stroke="#000000" stroke-width="1.5" stroke-dasharray="6 4"/);
});

test('an explicit viewBox is used as given', () => {
  assert.match(renderSectionSvg(fourUnit(), 1, { viewBox: { x: 1, y: 2, w: 3, h: 4 } }), /viewBox="1 2 3 4"/);
});

test('standalone: sized, with a background and a description of the coordinates', () => {
  const m = fourUnit({ levelLabels: { 1: 'Ground floor' } });
  const svg = renderSectionSvg(m, 1, { standalone: true });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="[\d.]+" height="[\d.]+"/);
  assert.ok(!svg.includes('class="xys-svg"'));
  assert.match(svg, /<rect [^>]*fill="#fcfcfb"\/>/);
  assert.match(svg, /<desc>Document: DP 12347\nGround floor: horizontal section at Z = 21.500 m \(epsg:5711\)\nHorizontal CRS: epsg:7850\n/);
  assert.match(svg, /Bearing rotation 0° \(not applied\)/);
});
