import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMaps, containerPolygons, containerZValues, facePolygon, flattenToFaces, getFeatures, getOpenShells,
  polygonFeaturePolygon, ringCoords, ringFeaturePolygon,
} from './topology.js';
import { box, topoDocument } from '../test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

const unitBox = () => topoDocument([box({ id: 'b', min: [0, 0, 0], max: [10, 4, 3] })]);

test('geometry assembly from place coordinates: box points resolve to place, never geometry', () => {
  const maps = buildMaps(unitBox());
  assert.deepEqual(maps.pointMap.get('b-p111'), [10, 4, 3]);
  assert.equal(maps.pointMap.size, 8);
});

test('geometry assembly from place coordinates: a geometry-only point is not in the point map', () => {
  const doc = { points: [{ features: [{ id: 'g', geometry: { type: 'Point', coordinates: [115, -32, 1] } }] }] };
  assert.equal(buildMaps(doc).pointMap.size, 0);
});

test('geometry assembly from place coordinates: a solid resolves to its six face polygons', () => {
  const doc = unitBox();
  const maps = buildMaps(doc);
  const polygons = containerPolygons(getFeatures(doc.solids)[0], maps);
  assert.equal(polygons.length, 6);
  polygons.forEach(p => assert.equal(p.outer.length, 4));
  assert.deepEqual(polygons[0].outer, [[0, 0, 0], [0, 4, 0], [10, 4, 0], [10, 0, 0]]);
});

test('ringCoords takes each edge\'s end point for a "-" orientation', () => {
  const maps = {
    pointMap: new Map([['a', [0, 0, 0]], ['b', [1, 0, 0]], ['c', [1, 1, 0]]]),
    edgeMap: new Map([['ab', ['a', 'b']], ['cb', ['c', 'b']], ['ca', ['c', 'a']]]),
  };
  const ring = { topology: { directed_references: [
    { ref: 'ab', orientation: '+' }, { ref: 'cb', orientation: '-' }, { ref: 'ca', orientation: '+' },
  ] } };
  assert.deepEqual(ringCoords(ring, maps), [[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
});

test('ringCoords is null when an edge or point is missing', () => {
  const maps = { pointMap: new Map([['a', [0, 0, 0]]]), edgeMap: new Map([['ab', ['a', 'b']]]) };
  assert.equal(ringCoords({ topology: { directed_references: [{ ref: 'ab', orientation: '+' }] } }, maps), null);
});

test('facePolygon treats rings after the first as holes', () => {
  const doc = loadFixture(BUILT_STRATA);
  const maps = buildMaps(doc);
  const withHole = getFeatures(doc.faces).find(f => f.topology.directed_references.length === 2);
  const polygon = facePolygon(withHole, maps);
  assert.ok(polygon.outer.length >= 3);
  assert.equal(polygon.holes.length, 1);
});

test('flattenToFaces descends through a nested shell', () => {
  const doc = unitBox();
  const [shell] = getFeatures(doc.shells);
  const outer = { id: 'outer', type: 'Feature', topology: { type: 'Shell', directed_references: [{ ref: shell.id, orientation: '+' }] } };
  doc.shells[0].features.push(outer);
  const solid = { id: 's2', topology: { type: 'Solid', directed_references: [{ ref: 'outer', orientation: '+' }] } };
  assert.equal(flattenToFaces(solid, buildMaps(doc)).length, 6);
});

test('getOpenShells lists only shells no solid uses', () => {
  const doc = unitBox();
  doc.shells[0].features.push({ id: 'loose', type: 'Feature', topology: { type: 'Shell', directed_references: [] } });
  assert.deepEqual(getOpenShells(doc, buildMaps(doc)).map(s => s.id), ['loose']);
});

test('ringFeaturePolygon resolves a Ring parcel that references a ring (built-strata former-tenure lot)', () => {
  const doc = loadFixture(BUILT_STRATA);
  const parcel = getFeatures(doc.parcels).find(p => p.id === 'uuid:5090f295-249f-4d10-83d1-0068646e484a');
  const polygon = ringFeaturePolygon(parcel, buildMaps(doc));
  assert.equal(polygon.outer.length, 4);
  assert.deepEqual(polygon.outer[0], [399512.310226, 6462661.065246, 0.000161]);
  assert.deepEqual(polygon.holes, []);
});

test('ringFeaturePolygon resolves an ordinary edge ring', () => {
  const doc = unitBox();
  const ring = getFeatures(doc.rings)[0];
  assert.equal(ringFeaturePolygon(ring, buildMaps(doc)).outer.length, 4);
});

test('polygonFeaturePolygon orders the 4-unit parcel\'s unordered edges into a 2D ring', () => {
  const doc = loadFixture(FOUR_UNIT);
  const [parcel] = getFeatures(doc.parcels);
  const polygon = polygonFeaturePolygon(parcel, buildMaps(doc));
  assert.equal(polygon.outer.length, 19);
  assert.equal(new Set(polygon.outer.map(c => c.join())).size, 19);
  polygon.outer.forEach(([x, y, z]) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.equal(z, null);
  });
});

test('polygonFeaturePolygon is null for a parcel with no edge references (e.g. AggregateSolid)', () => {
  const doc = loadFixture(BUILT_STRATA);
  const aggregate = getFeatures(doc.parcels).find(p => p.topology.type === 'AggregateSolid');
  assert.equal(polygonFeaturePolygon(aggregate, buildMaps(doc)), null);
});

test('containerZValues collects a solid\'s vertex heights', () => {
  const doc = unitBox();
  const zs = containerZValues(getFeatures(doc.solids)[0], buildMaps(doc));
  assert.deepEqual([...new Set(zs)].sort(), [0, 3]);
});
