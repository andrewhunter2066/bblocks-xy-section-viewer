import { test } from 'node:test';
import assert from 'node:assert/strict';
import XYSectionPlugin from './xy-section-plugin.js';
import { XYSectionPlugin as Exported } from './index.js';
import { box, topoDocument } from './test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from './test-support/fixtures.js';
import { FakeDocument } from './test-support/fake-dom.js';
import { resolveXYOptions } from './utils/xy-options.js';
import { buildXYDefaultConfig } from './utils/xy-default-config.js';

const candidate = (data, type = 'application/json') => ({
  type, content: typeof data === 'string' ? data : JSON.stringify(data), url: 'x.json', label: 'x',
});
const matches = (...candidates) => new XYSectionPlugin(candidates).matches();
const oneFloor = () => topoDocument([box({ id: 'a', min: [0, 0, 0], max: [1, 1, 3], properties: { floors: [1] } })]);

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

// ─── render() / destroy() ───────────────────────────────────────────────────────

// A plugin over `data` whose config load is replaced by `loaded` (or a promise/function giving
// it), rendering into a fresh fake document. Returns the pieces tests inspect.
function mount(data = loadFixture(FOUR_UNIT), loaded = {}) {
  const doc = new FakeDocument();
  const el = doc.createElement('div');
  el.clientHeight = 300;
  doc.body.appendChild(el);
  const plugin = new XYSectionPlugin([candidate(data)]);
  const defaults = { config: buildXYDefaultConfig(), xySection: resolveXYOptions(undefined).options, warnings: [], ref: null };
  plugin._loadConfig = typeof loaded === 'function' ? loaded : async () => ({ ...defaults, ...loaded });
  return { doc, el, plugin, rendered: plugin.render(el) };
}

// Captures console.warn/error during `fn`.
async function withConsole(fn) {
  const logged = { warn: [], error: [] };
  const original = { warn: console.warn, error: console.error };
  console.warn = (...args) => logged.warn.push(args.join(' '));
  console.error = (...args) => logged.error.push(args.join(' '));
  try {
    await fn();
  } finally {
    Object.assign(console, original);
  }
  return logged;
}

test('render mounts the section view: one tab per level, the first floor drawn', async () => {
  const { el, doc, rendered } = mount();
  await rendered;
  const root = el.children[0];
  assert.equal(root.className.split(' ')[0], 'xys-root');
  assert.equal(el.style.position, 'relative');
  assert.deepEqual(root.byClass('xys-tab').map(t => t.textContent), ['Level 1', 'Level 2']);
  assert.match(root.byClass('xys-panel')[0].innerHTML, /^<svg /);
  assert.ok(doc.getElementById('bblocks-xy-section-viewer-css'), 'stylesheet injected');
});

test('the stylesheet is injected once per document', async () => {
  const { el, doc, plugin, rendered } = mount();
  await rendered;
  await plugin.render(el);
  assert.equal(doc.head.children.filter(c => c.id === 'bblocks-xy-section-viewer-css').length, 1);
  assert.match(doc.head.children[0].textContent, /\.xys-root/);
});

test('a block config shapes the view (labels, levels) and its warnings are logged', async () => {
  const xySection = resolveXYOptions({ levelLabels: { 1: 'Ground floor', 2: 'First floor' } }).options;
  let el;
  const logged = await withConsole(async () => {
    const mounted = mount(loadFixture(BUILT_STRATA), { xySection, warnings: ['config x.json: something odd'] });
    el = mounted.el;
    await mounted.rendered;
  });
  assert.deepEqual(el.children[0].byClass('xys-tab').map(t => t.textContent), ['Ground floor', 'First floor']);
  assert.deepEqual(logged.warn, ['XYSectionPlugin: config x.json: something odd']);
});

test('a config that leaves no levels shows a message instead of tabs', async () => {
  const xySection = resolveXYOptions({ levelProperty: 'properties.storey' }).options;
  const { el, rendered } = mount(loadFixture(FOUR_UNIT), { xySection });
  await rendered;
  assert.equal(el.children[0].byClass('xys-tab').length, 0);
  assert.match(el.children[0].allText, /No floor levels/);
});

test('a failure while loading is shown in the tab and logged, not thrown', async () => {
  let el;
  const logged = await withConsole(async () => {
    const mounted = mount(loadFixture(FOUR_UNIT), async () => { throw new Error('boom'); });
    el = mounted.el;
    await mounted.rendered;
  });
  const banner = el.children[0];
  assert.equal(banner.className, 'xys-error');
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.match(banner.allText, /Failed to render the XY section view \(boom\)/);
  assert.equal(logged.error.length, 1);
});

test('destroy while the config is still loading: nothing is mounted afterwards', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { el, plugin, rendered } = mount(loadFixture(FOUR_UNIT), async () => {
    await gate;
    return { config: buildXYDefaultConfig(), xySection: resolveXYOptions(undefined).options, warnings: [], ref: null };
  });
  plugin.destroy(el);
  release();
  await rendered;
  assert.equal(el.children.length, 0);
});

test('render on a non-matching candidate leaves the element empty', async () => {
  const doc = new FakeDocument();
  const el = doc.createElement('div');
  await new XYSectionPlugin([candidate('{bad')]).render(el);
  assert.equal(el.children.length, 0);
});

test('fullscreen: the button toggles the plugin root, and destroy leaves fullscreen', async () => {
  const { el, doc, plugin, rendered } = mount();
  await rendered;
  const root = el.children[0];
  plugin._view.buttons.fullscreen.click();
  assert.equal(doc.fullscreenElement, root);
  assert.equal(plugin._view.buttons.fullscreen.getAttribute('aria-pressed'), 'true');
  plugin._view.buttons.fullscreen.click();
  assert.equal(doc.fullscreenElement, null);
  plugin._view.buttons.fullscreen.click();
  plugin.destroy(el);
  assert.equal(doc.fullscreenElement, null);
  assert.equal(doc.listenerCount('fullscreenchange'), 0);
  assert.equal(el.children.length, 0);
});

test('download saves the SVG through a temporary object-URL link', async () => {
  const { el, doc, plugin, rendered } = mount();
  await rendered;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const created = [];
  URL.createObjectURL = blob => { created.push(blob); return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  const appended = [];
  const originalAppend = doc.body.appendChild.bind(doc.body);
  doc.body.appendChild = child => { appended.push(child); return originalAppend(child); };
  try {
    plugin._view.buttons.download.click();
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'image/svg+xml');
  assert.match(await created[0].text(), /^<svg xmlns=/);
  const link = appended.find(c => c.tagName === 'A');
  assert.equal(link.download, 'DP-12347-Level-1.svg');
  assert.equal(link.href, 'blob:test');
  assert.equal(link.clicks, 1);
  assert.equal(link.parent, null, 'the link is removed again');
  plugin.destroy(el);
});

test('destroy is safe before render, twice, and after a failure', async () => {
  const doc = new FakeDocument();
  const el = doc.createElement('div');
  const plugin = new XYSectionPlugin([candidate(loadFixture(FOUR_UNIT))]);
  plugin.destroy(el);
  plugin.destroy(undefined);
  const { el: el2, plugin: p2, rendered } = mount();
  await rendered;
  p2.destroy(el2);
  p2.destroy(el2);
  assert.equal(el2.children.length, 0);
});
