// Keeps the dev harness's fixture/config lists (harness/js/catalog.js) honest: every listed file
// exists, every fixture matches (or not) as its entry says, and every sample config parses with no
// warnings and actually changes the view of the fixtures it is offered with.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIXTURES, SAMPLE_CONFIGS } from '../../harness/js/catalog.js';
import XYSectionPlugin from './xy-section-plugin.js';
import { loadConfig, XY_VIEWER_CONFIG_ROLE } from './utils/load-config.js';
import { buildXYDefaultConfig } from './utils/xy-default-config.js';
import { buildSectionModel } from './xy-scene.js';

const read = file => readFileSync(new URL(`../../harness/${file}`, import.meta.url), 'utf8');

// Loads a harness config through the real loader, served by a stand-in fetch.
async function loaded(file) {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => read(file) });
  const context = file ? { bblock: { resources: [{ role: XY_VIEWER_CONFIG_ROLE, ref: file }] } } : {};
  return loadConfig(context, buildXYDefaultConfig(), fetchImpl);
}

test('every harness fixture exists and matches exactly as its entry says', () => {
  assert.ok(FIXTURES.length >= 3);
  for (const { file, matches, label } of FIXTURES) {
    const plugin = new XYSectionPlugin([{ type: 'application/json', content: read(file), url: null, label }]);
    assert.equal(plugin.matches(), matches, label);
  }
  assert.ok(FIXTURES.some(f => !f.matches), 'at least one no-match case');
});

test('every sample config, and every fixture\'s own config, loads with no warnings', async () => {
  const files = new Set([...SAMPLE_CONFIGS.map(c => c.file), ...FIXTURES.map(f => f.config).filter(Boolean)]);
  for (const file of files) {
    assert.ok(SAMPLE_CONFIGS.some(c => c.file === file), `${file} is offered in the sample list too`);
    const { warnings, ref } = await loaded(file);
    assert.deepEqual(warnings, [], file);
    assert.equal(ref, file);
  }
});

test('the WA config gives the built-strata fixture named floors and the former-tenure boundary', async () => {
  const fixture = FIXTURES.find(f => f.file.endsWith('built-strata-example-1.json'));
  const model = buildSectionModel(JSON.parse(read(fixture.file)), await loaded(fixture.config));
  assert.deepEqual(model.levels.map(l => l.label), ['Ground floor', 'First floor']);
  assert.equal(model.boundary.label, 'Lot 1 on Plan DP 413673');
});

test('the styled-rules config reshapes the 4-unit view: kinds, hidden lot outline, no boundary', async () => {
  const fixture = FIXTURES.find(f => f.file.endsWith('4-unit-up-down-with-parcel.json'));
  const config = SAMPLE_CONFIGS.find(c => c.file.endsWith('styled-rules-config.json')).file;
  const result = await loaded(config);
  const model = buildSectionModel(JSON.parse(read(fixture.file)), result);
  assert.deepEqual(model.levels.map(l => l.label), ['Lower', 'Upper']);
  assert.equal(model.boundary, null);
  const stair = model.records.find(r => r.label === 'Stairwell');
  assert.equal(stair.kind, 'multi-storey');
  assert.equal(stair.color, '#4a3aa7');
  const lot = model.records.find(r => r.kind === 'lot');
  assert.equal(lot.mode, 'outline');
  assert.equal(lot.visible, false);
  assert.equal(result.xySection.showContext, true);
  assert.equal(result.xySection.grid, 5);
});
