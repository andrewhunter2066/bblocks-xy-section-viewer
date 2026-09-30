import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildXYDefaultConfig } from './xy-default-config.js';
import { classifyFeatures } from './rules.js';
import { buildMaps, getOpenShells } from './topology.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

test('the default rules section solids and open shells, and draw no parcels', () => {
  const { rules } = buildXYDefaultConfig();
  assert.deepEqual(rules.map(r => [r.source, r.kind, r.geometry]), [
    ['solids', 'solid', 'solid'],
    ['surfaces', 'surface', 'open-shell'],
  ]);
  assert.ok(rules.every(r => r.style.color === undefined), 'no fixed colour: each feature gets a palette colour');
});

test('each call returns a fresh config (callers may not share mutations)', () => {
  const a = buildXYDefaultConfig();
  a.rules.push({ source: 'parcels' });
  assert.equal(buildXYDefaultConfig().rules.length, 2);
});

test('through the copied rule engine, every solid of both fixtures is classified and labelled by name', () => {
  for (const name of [BUILT_STRATA, FOUR_UNIT]) {
    const doc = loadFixture(name);
    const withSurfaces = { ...doc, surfaces: getOpenShells(doc, buildMaps(doc)) };
    const descriptors = classifyFeatures(withSurfaces, buildXYDefaultConfig());
    const solids = descriptors.filter(d => d.kind === 'solid');
    assert.equal(solids.length, doc.solids.flatMap(c => c.features).length, name);
    assert.ok(solids.every(d => d.label === d.feature.properties.name), name);
    assert.ok(descriptors.every(d => d.source !== 'parcels'), name);
  }
});
