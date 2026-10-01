import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCAL_URL, isThisPlugin, useLocalPlugin } from '../../scripts/lib/local-register.mjs';

const PUBLISHED = 'https://cdn.jsdelivr.net/gh/andrewhunter2066/bblocks-xy-section-viewer@dist/index.js';
const CESIUM = { url: 'https://cdn.jsdelivr.net/gh/andrewhunter2066/bblocks-cesium-viewer@dist/index.js', export: 'TopoFeatureCesiumPlugin' };

test('redirects this plugin\'s published entry to the local build, leaving other plugins alone', () => {
  const register = { viewer: { viewPlugins: [CESIUM, { url: PUBLISHED, export: 'XYSectionPlugin' }] } };
  const { register: updated, action } = useLocalPlugin(register);
  assert.equal(action, 'redirected');
  assert.deepEqual(updated.viewer.viewPlugins, [CESIUM, { url: DEFAULT_LOCAL_URL, export: 'XYSectionPlugin' }]);
  assert.equal(register.viewer.viewPlugins[1].url, PUBLISHED, 'the input is not modified');
});

test('recognises the entry by export name or by a published URL of this repository', () => {
  assert.ok(isThisPlugin({ url: 'https://example.org/x.js', export: 'XYSectionPlugin' }));
  assert.ok(isThisPlugin({ url: 'https://example.org/x.js', export: ['Other', 'XYSectionPlugin'] }));
  assert.ok(isThisPlugin({ url: 'https://cdn.jsdelivr.net/gh/ogcincubator/bblocks-xy-section-viewer@v1.0.0/index.js' }));
  assert.ok(!isThisPlugin(CESIUM));
  assert.ok(!isThisPlugin(null));
});

test('adds an entry when the register declares none, creating the viewer section if needed', () => {
  for (const register of [{}, { viewer: {} }, { viewer: { viewPlugins: [CESIUM] } }, undefined]) {
    const { register: updated, action } = useLocalPlugin(register, 'http://localhost:9999/index.js');
    assert.equal(action, 'added');
    assert.deepEqual(updated.viewer.viewPlugins.at(-1), { url: 'http://localhost:9999/index.js', export: 'XYSectionPlugin' });
  }
});

test('keeps the rest of the register untouched', () => {
  const register = { name: 'r', bblocks: [{ itemIdentifier: 'a' }], viewer: { showImportedDepth: 0, viewPlugins: [{ url: PUBLISHED, export: 'XYSectionPlugin' }] } };
  const { register: updated } = useLocalPlugin(register);
  assert.deepEqual({ ...updated, viewer: { ...updated.viewer, viewPlugins: [] } }, { ...register, viewer: { ...register.viewer, viewPlugins: [] } });
});
