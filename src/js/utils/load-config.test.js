import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPO_VIEWER_CONFIG_ROLE, XY_VIEWER_CONFIG_ROLE, findConfigResource, loadConfig } from './load-config.js';
import { buildXYDefaultConfig } from './xy-default-config.js';
import { DEFAULT_XY_OPTIONS } from './xy-options.js';

const DEFAULTS = buildXYDefaultConfig();
const context = (...resources) => ({ bblock: { resources } });
const xyResource = ref => ({ role: XY_VIEWER_CONFIG_ROLE, ref });
const topoResource = ref => ({ role: TOPO_VIEWER_CONFIG_ROLE, ref });

// A fetch stand-in serving fixed bodies by URL; records each URL requested.
function fakeFetch(bodies) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (!(url in bodies)) return { ok: false, status: 404, text: async () => '' };
    const body = bodies[url];
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return { fetchImpl, calls };
}

test('the XY role is this plugin\'s own', () => {
  assert.equal(XY_VIEWER_CONFIG_ROLE, 'https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config');
});

test('findConfigResource prefers the XY role over the Three.js role, in any order', () => {
  const found = findConfigResource(context(topoResource('topo.json'), xyResource('xy.json')).bblock);
  assert.equal(found.ref, 'xy.json');
});

test('findConfigResource falls back to a Three.js viewer config', () => {
  assert.equal(findConfigResource(context(topoResource('topo.json')).bblock).ref, 'topo.json');
});

test('findConfigResource ignores other roles, resources without a ref, and malformed bblocks', () => {
  assert.equal(findConfigResource(context({ role: 'https://example.org/other', ref: 'x.json' }, { role: XY_VIEWER_CONFIG_ROLE }).bblock), null);
  assert.equal(findConfigResource(undefined), null);
  assert.equal(findConfigResource({ resources: 'nope' }), null);
});

test('with no bblock or resource: the defaults, no fetch, no warnings', async () => {
  const { fetchImpl, calls } = fakeFetch({});
  for (const ctx of [undefined, {}, context()]) {
    const result = await loadConfig(ctx, DEFAULTS, fetchImpl);
    assert.deepEqual(result.config.rules, DEFAULTS.rules);
    assert.equal(result.xySection.levelProperty, DEFAULT_XY_OPTIONS.levelProperty);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.ref, null);
  }
  assert.deepEqual(calls, []);
});

test('a block config\'s rules replace the defaults and its xySection is parsed', async () => {
  const block = {
    rules: [{ source: 'solids', kind: 'unit', geometry: 'solid', style: { color: '#336699' } }],
    xySection: { showContext: true, levelLabels: { 1: 'Ground' } },
  };
  const { fetchImpl, calls } = fakeFetch({ 'https://r.example/xy.json': block });
  const result = await loadConfig(context(xyResource('https://r.example/xy.json')), DEFAULTS, fetchImpl);
  assert.deepEqual(calls, ['https://r.example/xy.json']);
  assert.deepEqual(result.config.rules, block.rules);
  assert.equal(result.xySection.showContext, true);
  assert.deepEqual(result.xySection.levelLabels, { 1: 'Ground' });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.ref, 'https://r.example/xy.json');
});

test('an xySection-only config keeps the default rules', async () => {
  const { fetchImpl } = fakeFetch({ 'xy.json': { xySection: { padding: 5 } } });
  const result = await loadConfig(context(xyResource('xy.json')), DEFAULTS, fetchImpl);
  assert.deepEqual(result.config.rules, DEFAULTS.rules);
  assert.equal(result.xySection.padding, 5);
});

test('a Three.js viewer config supplies the rules, with default XY options', async () => {
  const topo = { rules: [{ source: 'parcels', kind: 'lot', geometry: 'polygon', elevation: 'flatten' }] };
  const { fetchImpl } = fakeFetch({ 'topo.json': topo });
  const result = await loadConfig(context(topoResource('topo.json')), DEFAULTS, fetchImpl);
  assert.deepEqual(result.config.rules, topo.rules);
  assert.equal(result.xySection.showContext, false);
  assert.deepEqual(result.warnings, []);
});

test('an HTTP error, a network error or invalid JSON falls back to the defaults with a warning', async () => {
  const { fetchImpl } = fakeFetch({ 'down.json': new Error('offline'), 'bad.json': '{nope' });
  for (const ref of ['missing.json', 'down.json', 'bad.json']) {
    const result = await loadConfig(context(xyResource(ref)), DEFAULTS, fetchImpl);
    assert.deepEqual(result.config.rules, DEFAULTS.rules, ref);
    assert.equal(result.xySection.padding, DEFAULT_XY_OPTIONS.padding, ref);
    assert.equal(result.warnings.length, 1, ref);
    assert.match(result.warnings[0], new RegExp(ref.replace('.', '\\.')));
    assert.equal(result.ref, ref);
  }
});

test('a JSON value that is not an object falls back to the defaults with a warning', async () => {
  const { fetchImpl } = fakeFetch({ 'list.json': [1, 2] });
  const result = await loadConfig(context(xyResource('list.json')), DEFAULTS, fetchImpl);
  assert.deepEqual(result.config.rules, DEFAULTS.rules);
  assert.deepEqual(result.warnings, ['config list.json is not a JSON object; using the defaults']);
});

test('bad xySection options are warned about while valid rules still apply', async () => {
  const block = { rules: [{ source: 'solids', kind: 'unit', geometry: 'solid' }], xySection: { padding: 'wide' } };
  const { fetchImpl } = fakeFetch({ 'xy.json': block });
  const result = await loadConfig(context(xyResource('xy.json')), DEFAULTS, fetchImpl);
  assert.deepEqual(result.config.rules, block.rules);
  assert.equal(result.xySection.padding, DEFAULT_XY_OPTIONS.padding);
  assert.equal(result.warnings.length, 1);
});
