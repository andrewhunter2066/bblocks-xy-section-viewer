import { test } from 'node:test';
import assert from 'node:assert/strict';
import XYSectionPlugin from './xy-section-plugin.js';
import { XYSectionPlugin as Exported } from './index.js';
import { box, topoDocument } from './test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from './test-support/fixtures.js';

const candidate = (data, type = 'application/json') => ({
  type, content: typeof data === 'string' ? data : JSON.stringify(data), url: 'x.json', label: 'x',
});
const matches = (...candidates) => new XYSectionPlugin(candidates).matches();
const oneFloor = () => topoDocument([box({ id: 'a', min: [0, 0, 0], max: [1, 1, 3], properties: { floors: [1] } })]);

// Just enough DOM for render(): createElement/append/textContent.
function fakeElement() {
  const node = { children: [], textContent: '' };
  node.append = (...kids) => node.children.push(...kids);
  node.ownerDocument = { createElement: () => fakeElement() };
  Object.defineProperty(node, 'textContent', {
    get: () => node._text ?? '',
    set: value => { node._text = value; node.children.length = 0; },
  });
  return node;
}

test('index.js exports the plugin as XYSectionPlugin', () => {
  assert.equal(Exported, XYSectionPlugin);
  assert.equal(XYSectionPlugin.viewName, 'XY Section');
});

test('matches both real fixtures', () => {
  assert.equal(matches(candidate(loadFixture(BUILT_STRATA))), true);
  assert.equal(matches(candidate(loadFixture(FOUR_UNIT), 'application/geo+json')), true);
});

test('matches a hand-made one-floor document, including as application/ld+json', () => {
  assert.equal(matches(candidate(oneFloor(), 'application/ld+json')), true);
});

test('does not match a document whose points have only WGS84 geometry', () => {
  const doc = oneFloor();
  doc.points[0].features.forEach(p => { delete p.place; });
  assert.equal(matches(candidate(doc)), false);
});

test('does not match a document with only 2D place coordinates', () => {
  const doc = oneFloor();
  doc.points[0].features.forEach(p => { p.place.coordinates.length = 2; });
  assert.equal(matches(candidate(doc)), false);
});

test('does not match a document with no floor levels', () => {
  const doc = oneFloor();
  delete doc.solids[0].features[0].properties.floors;
  assert.equal(matches(candidate(doc)), false);
});

test('does not match when every solid is an occupation feature', () => {
  const doc = oneFloor();
  doc.occupationFeatures = [{ features: [{ id: 'o', properties: { geometryRef: 'a' } }] }];
  assert.equal(matches(candidate(doc)), false);
});

test('does not match unsupported types, invalid JSON, non-topo documents or no candidates', () => {
  assert.equal(matches(candidate(oneFloor(), 'text/turtle')), false);
  assert.equal(matches(candidate('{not json')), false);
  assert.equal(matches(candidate({ type: 'FeatureCollection', features: [] })), false);
  assert.equal(matches({ type: 'application/json' }), false);
  assert.equal(new XYSectionPlugin(undefined).matches(), false);
});

test('picks the first matching candidate among several', () => {
  const plugin = new XYSectionPlugin([candidate('{bad'), candidate(loadFixture(FOUR_UNIT))]);
  assert.equal(plugin.matches(), true);
  assert.equal(plugin._data.name, 'DP 12347');
});

test('render lists each level with its section height (Stage 2 placeholder)', () => {
  const el = fakeElement();
  new XYSectionPlugin([candidate(loadFixture(FOUR_UNIT))]).render(el);
  const [list] = el.children;
  assert.deepEqual(list.children.map(li => li.textContent), [
    'Level 1: Z = 21.500 m, 3 solid(s)',
    'Level 2: Z = 24.500 m, 3 solid(s)',
  ]);
});

test('render leaves the element empty when nothing matches, and destroy clears it', () => {
  const el = fakeElement();
  new XYSectionPlugin([candidate('{bad')]).render(el);
  assert.equal(el.children.length, 0);
  const plugin = new XYSectionPlugin([candidate(loadFixture(FOUR_UNIT))]);
  plugin.render(el);
  plugin.destroy(el);
  assert.equal(el.children.length, 0);
});
