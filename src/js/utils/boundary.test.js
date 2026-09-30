import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureOutline, resolveBoundary } from './boundary.js';
import { buildMaps, getFeatures } from './topology.js';
import { DEFAULT_BOUNDARY, resolveXYOptions } from './xy-options.js';
import { BUILT_STRATA, FOUR_UNIT, loadDemoConfig, loadFixture } from '../test-support/fixtures.js';

const FORMER_TENURE_LOT = 'uuid:5090f295-249f-4d10-83d1-0068646e484a';
const waBoundary = () => resolveXYOptions(loadDemoConfig('builtStrata').xySection).options.boundary;
const resolve = (doc, entries) => resolveBoundary(doc, entries, buildMaps(doc));

test('built-strata, WA order: the strata scheme\'s containing primary parcel wins (entry 0)', () => {
  const doc = loadFixture(BUILT_STRATA);
  const result = resolve(doc, waBoundary());
  assert.equal(result.entryIndex, 0);
  assert.equal(result.feature.id, FORMER_TENURE_LOT);
  assert.equal(result.polygon.outer.length, 4);
});

test('built-strata, WA order without the scheme parcel: the former-tenure parcel wins (entry 1)', () => {
  const doc = loadFixture(BUILT_STRATA);
  doc.parcels[0].features = doc.parcels[0].features.filter(p => p.topology.type !== 'ParcelAggregate');
  const result = resolve(doc, waBoundary());
  assert.equal(result.entryIndex, 1);
  assert.equal(result.feature.id, FORMER_TENURE_LOT);
});

test('4-unit, WA order: neither scheme nor former tenure, so the lot Polygon wins (entry 2)', () => {
  const doc = loadFixture(FOUR_UNIT);
  const result = resolve(doc, waBoundary());
  assert.equal(result.entryIndex, 2);
  assert.equal(result.feature.topology.type, 'Polygon');
  assert.equal(result.polygon.outer.length, 19);
});

test('built-in default: the first parcel with an outline, skipping ones without', () => {
  assert.equal(resolve(loadFixture(BUILT_STRATA), DEFAULT_BOUNDARY).feature.id, FORMER_TENURE_LOT);
  const doc = loadFixture(BUILT_STRATA);
  const parcels = doc.parcels[0].features;
  parcels.push(parcels.shift()); // the Ring parcel is now last, behind the aggregates
  assert.equal(resolve(doc, DEFAULT_BOUNDARY).feature.id, FORMER_TENURE_LOT);
  assert.equal(resolve(loadFixture(FOUR_UNIT), DEFAULT_BOUNDARY).feature.topology.type, 'Polygon');
});

test('no boundary: an empty entry list, no parcels, or only outline-less parcels', () => {
  assert.equal(resolve(loadFixture(BUILT_STRATA), []), null);
  const doc = loadFixture(FOUR_UNIT);
  delete doc.parcels;
  assert.equal(resolve(doc, DEFAULT_BOUNDARY), null);
  const aggregates = loadFixture(BUILT_STRATA);
  aggregates.parcels[0].features = aggregates.parcels[0].features.filter(p => p.topology.type.startsWith('Aggregate'));
  assert.equal(resolve(aggregates, DEFAULT_BOUNDARY), null);
});

test('match values are compared after CURIE expansion against the document\'s @context', () => {
  const doc = loadFixture(BUILT_STRATA);
  doc['@context'] = { ...doc['@context'], 'wa-parcel-state': 'https://example.org/state/' };
  const entries = [{ source: 'parcels', match: { property: 'properties.parcelState', values: ['https://example.org/state/former-tenure'] } }];
  assert.equal(resolve(doc, entries).feature.id, FORMER_TENURE_LOT);
});

test('follow with a role no relationship has yields nothing from that entry', () => {
  const doc = loadFixture(BUILT_STRATA);
  const entries = [{ source: 'parcels', match: { property: 'properties.parcelPurpose', values: ['wa-parcel-purpose:strata-scheme'] }, follow: { role: 'nope', source: 'parcels' } }];
  assert.equal(resolve(doc, entries), null);
});

test('featureOutline: Polygon, Ring and Face have outlines; aggregates do not', () => {
  const doc = loadFixture(BUILT_STRATA);
  const maps = buildMaps(doc);
  const byType = type => getFeatures(doc.parcels).find(p => p.topology.type === type);
  assert.ok(featureOutline(byType('Ring'), maps));
  assert.equal(featureOutline(byType('ParcelAggregate'), maps), null);
  assert.equal(featureOutline(byType('AggregateSolid'), maps), null);
  assert.ok(featureOutline(getFeatures(doc.faces)[0], maps));
  assert.equal(featureOutline(null, maps), null);
});
