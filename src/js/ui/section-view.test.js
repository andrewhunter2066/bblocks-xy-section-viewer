import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPANDED_VIEW_MIN_HEIGHT, SectionView, fileSlug, humanizeSlug } from './section-view.js';
import { buildSectionModel } from '../xy-scene.js';
import { buildXYDefaultConfig } from '../utils/xy-default-config.js';
import { resolveXYOptions } from '../utils/xy-options.js';
import { FakeDocument } from '../test-support/fake-dom.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

// Builds a view over a fixture inside a fake root of the given height; returns what tests poke at.
function setup({ fixture = FOUR_UNIT, raw = {}, height = 300, config = buildXYDefaultConfig() } = {}) {
  const doc = new FakeDocument();
  const root = doc.createElement('div');
  root.clientHeight = height;
  doc.body.appendChild(root);
  const xySection = resolveXYOptions(raw).options;
  const model = buildSectionModel(loadFixture(fixture), { config, xySection });
  const calls = { download: [], fullscreen: 0 };
  let fullscreen = false;
  const view = new SectionView(root, {
    model,
    xySection,
    actions: {
      toggleFullscreen: () => { calls.fullscreen += 1; fullscreen = !fullscreen; },
      isFullscreen: () => fullscreen,
      download: (name, svg) => calls.download.push({ name, svg }),
    },
  });
  const tabs = root.byClass('xys-tab');
  const panels = root.byClass('xys-panel');
  const keyOf = label => model.records.find(r => r.label === label).key;
  const itemInput = label => view.layerInputs.items.get(keyOf(label));
  return { doc, root, view, model, tabs, panels, calls, keyOf, itemInput };
}

const drawnKeys = panel => [...panel.innerHTML.matchAll(/class="xys-record" data-key="(r\d+)"/g)].map(m => m[1]);

test('one tab per level, with the WAI-ARIA tabs roles and relationships', () => {
  const { root, tabs, panels } = setup({ raw: { levelLabels: { 1: 'Ground floor' } } });
  const tablist = root.byClass('xys-tabs')[0];
  assert.equal(tablist.getAttribute('role'), 'tablist');
  assert.equal(tablist.getAttribute('aria-label'), 'Floor levels');
  assert.deepEqual(tabs.map(t => t.textContent), ['Ground floor', 'Level 2']);
  tabs.forEach((tab, i) => {
    assert.equal(tab.getAttribute('role'), 'tab');
    assert.equal(tab.getAttribute('aria-controls'), panels[i].id);
    assert.equal(panels[i].getAttribute('role'), 'tabpanel');
    assert.equal(panels[i].getAttribute('aria-labelledby'), tab.id);
  });
  assert.equal(tabs[0].title, 'Ground floor: section at Z = 21.500 m');
});

test('the first floor is selected and built; other floors are built only when opened', () => {
  const { tabs, panels } = setup();
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'false');
  assert.equal(tabs[1].tabIndex, -1);
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.match(panels[0].innerHTML, /^<svg /);
  assert.equal(panels[1].innerHTML, '');

  tabs[1].click();
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
  assert.match(panels[1].innerHTML, /Level 2: section at Z = 24.500 m/);
});

test('arrow keys, Home and End move between tabs, wrapping, and focus the new tab', () => {
  const { doc, root, view, tabs } = setup({ fixture: BUILT_STRATA });
  const tablist = root.byClass('xys-tabs')[0];
  const press = key => tablist.dispatch('keydown', { key });
  assert.equal(press('ArrowRight').defaultPrevented, true);
  assert.equal(view.active, 1);
  assert.equal(doc.activeElement, tabs[1]);
  press('ArrowRight');
  assert.equal(view.active, 0, 'wraps to the first');
  press('ArrowLeft');
  assert.equal(view.active, 1, 'wraps to the last');
  press('Home');
  assert.equal(view.active, 0);
  press('End');
  assert.equal(view.active, 1);
  assert.equal(press('a').defaultPrevented, false);
});

test('unticking a feature removes it from the drawing; the group box turns indeterminate', () => {
  const { view, panels, keyOf, itemInput } = setup();
  const stair = keyOf('Stairwell');
  assert.ok(drawnKeys(panels[0]).includes(stair));
  const input = itemInput('Stairwell');
  input.checked = false;
  input.dispatch('change');
  assert.ok(!drawnKeys(panels[0]).includes(stair));
  const group = view.layerInputs.groups[0].input;
  assert.equal(group.checked, false);
  assert.equal(group.indeterminate, true);
  group.checked = true;
  group.dispatch('change');
  assert.ok(drawnKeys(panels[0]).includes(stair));
  assert.equal(itemInput('Stairwell').checked, true);
  assert.equal(group.indeterminate, false);
});

test('a hidden feature stays hidden on a floor opened later', () => {
  const { tabs, panels, keyOf, itemInput } = setup();
  const input = itemInput('Upper East');
  input.checked = false;
  input.dispatch('change');
  tabs[1].click();
  assert.ok(!drawnKeys(panels[1]).includes(keyOf('Upper East')));
  assert.ok(drawnKeys(panels[1]).includes(keyOf('Upper West')));
});

test('legend rows for features not on the current floor are dimmed', () => {
  const { view, tabs, keyOf } = setup();
  const upperEast = view.layerRows.get(keyOf('Upper East'));
  const stair = view.layerRows.get(keyOf('Stairwell'));
  assert.ok(upperEast.classList.contains('xys-absent'));
  assert.equal(upperEast.title, 'Not on this floor');
  assert.ok(!stair.classList.contains('xys-absent'));
  tabs[1].click();
  assert.ok(!upperEast.classList.contains('xys-absent'));
  assert.ok(view.layerRows.get(keyOf('Lower East')).classList.contains('xys-absent'));
});

test('lower floors: off by default, toggled by the context button; showContext starts it on', () => {
  const { view, tabs, panels } = setup();
  tabs[1].click();
  assert.equal(view.buttons.context.getAttribute('aria-pressed'), 'false');
  assert.ok(!panels[1].innerHTML.includes('data-level="1"'));
  view.buttons.context.click();
  assert.equal(view.buttons.context.getAttribute('aria-pressed'), 'true');
  assert.match(panels[1].innerHTML, /data-level="1"/);

  const started = setup({ raw: { showContext: true } });
  started.tabs[1].click();
  assert.match(started.panels[1].innerHTML, /data-level="1"/);
});

test('the labels button and the boundary checkbox toggle their layers', () => {
  const { view, panels } = setup();
  assert.match(panels[0].innerHTML, /<text /);
  view.buttons.labels.click();
  assert.equal(view.buttons.labels.getAttribute('aria-pressed'), 'false');
  assert.ok(!panels[0].innerHTML.includes('<text '));
  assert.match(panels[0].innerHTML, /xys-boundary/);
  view.boundaryInput.checked = false;
  view.boundaryInput.dispatch('change');
  assert.ok(!panels[0].innerHTML.includes('xys-boundary'));
});

test('zoom buttons, fit and double-click change the shared view', () => {
  const { view, root } = setup();
  const fitted = { ...view.viewBox };
  view.buttons.zoomIn.click();
  assert.ok(Math.abs(view.viewBox.w - fitted.w / 1.5) < 1e-9);
  view.buttons.zoomOut.click();
  view.buttons.zoomOut.click();
  assert.ok(view.viewBox.w > fitted.w);
  view.buttons.fit.click();
  assert.deepEqual(view.viewBox, fitted);
  view.buttons.zoomIn.click();
  root.byClass('xys-stage')[0].dispatch('dblclick');
  assert.deepEqual(view.viewBox, fitted);
});

test('zoom is limited to 0.5 m wide and 4× the fitted drawing', () => {
  const { view } = setup();
  for (let i = 0; i < 40; i++) view.buttons.zoomIn.click();
  assert.equal(view.viewBox.w, 0.5);
  for (let i = 0; i < 80; i++) view.buttons.zoomOut.click();
  assert.ok(Math.abs(view.viewBox.w - view.fitted.w * 4) < 1e-9);
});

test('the wheel zooms about the pointer; dragging pans; the readout shows easting/northing', () => {
  const { view, root, model } = setup();
  const stage = root.byClass('xys-stage')[0];
  stage.clientWidth = 600;
  stage.clientHeight = 400;
  const before = { ...view.viewBox };
  const wheel = stage.dispatch('wheel', { deltaY: -200, clientX: 300, clientY: 200 });
  assert.equal(wheel.defaultPrevented, true);
  assert.ok(view.viewBox.w < before.w);

  const start = { ...view.viewBox };
  stage.dispatch('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
  assert.ok(stage.classList.contains('xys-dragging'));
  stage.dispatch('pointermove', { clientX: 160, clientY: 100, pointerId: 1 });
  assert.ok(view.viewBox.x < start.x, 'dragging right shows what was to the left');
  assert.equal(view.viewBox.y, start.y);
  stage.dispatch('pointerup', { pointerId: 1 });
  assert.ok(!stage.classList.contains('xys-dragging'));
  const afterDrag = { ...view.viewBox };
  stage.dispatch('pointermove', { clientX: 10, clientY: 10 });
  assert.deepEqual(view.viewBox, afterDrag, 'moving without a button held does not pan');

  const readout = root.byClass('xys-readout')[0];
  assert.match(readout.textContent, /^E [\d,]+\.\d\d {2}N [\d,]+\.\d\d$/);
  const [e] = model.toWorld([view.viewBox.x, 0]);
  assert.ok(e > 400000 && e < 410000);
  stage.dispatch('pointerleave');
  assert.equal(readout.textContent, '');
});

test('a right-button press does not start a pan', () => {
  const { view, root } = setup();
  const stage = root.byClass('xys-stage')[0];
  stage.clientWidth = 600;
  stage.clientHeight = 400;
  const before = { ...view.viewBox };
  stage.dispatch('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  stage.dispatch('pointermove', { clientX: 200, clientY: 100 });
  assert.deepEqual(view.viewBox, before);
});

test('compact layout: the layers panel is a pop-over behind the layers button', () => {
  const { view, root } = setup({ height: 300 });
  assert.ok(!root.classList.contains('xys-expanded'));
  assert.equal(view.layers.hidden, true);
  view.buttons.layers.click();
  assert.equal(view.layers.hidden, false);
  assert.equal(view.buttons.layers.getAttribute('aria-pressed'), 'true');
  view.buttons.layers.click();
  assert.equal(view.layers.hidden, true);
});

test('expanded layout (≥ 400 px): the layers panel is always shown; resizing switches layouts', () => {
  const { view, root } = setup({ height: EXPANDED_VIEW_MIN_HEIGHT });
  assert.ok(root.classList.contains('xys-expanded'));
  assert.equal(view.layers.hidden, false);
  root.clientHeight = 250;
  view.applyViewMode();
  assert.ok(!root.classList.contains('xys-expanded'));
  assert.equal(view.layers.hidden, true);
});

test('the layers panel lists the boundary and every feature under its group', () => {
  const { view } = setup({ fixture: BUILT_STRATA, raw: loadFixture('wa-strata-config.json').xySection });
  const text = view.layers.allText;
  assert.match(text, /^Boundary Lot 1 on Plan DP 413673 Solids /);
  assert.equal(view.layerInputs.items.size, 9);
  assert.ok(text.includes('Principal Unit 1 - upper'));
});

test('several kinds in one group get their own sub-headings and select-alls', () => {
  const config = { rules: [
    { source: 'solids', kind: 'upper', group: 'units', kindLabel: 'Upper units', geometry: 'solid', match: { property: 'properties.floors', values: [2] } },
    { source: 'solids', kind: 'lower', group: 'units', geometry: 'solid' },
  ] };
  const { view } = setup({ config });
  assert.equal(view.layerInputs.groups.length, 1);
  assert.equal(view.layerInputs.kinds.length, 2);
  assert.match(view.layers.allText, /Units .*Upper units .*Lower /);
});

test('the caption gives the level height, CRS, grid and bearing rotation', () => {
  const { root, tabs } = setup({ fixture: BUILT_STRATA });
  const caption = root.byClass('xys-caption-text')[0];
  assert.equal(caption.textContent,
    'Level 1: section at Z = 22.384 m (epsg:5711) · epsg:7850, easting/northing in metres · grid 10 m · bearing rotation -0.54° not applied');
  tabs[1].click();
  assert.match(caption.textContent, /^Level 2: section at Z = 26.090 m/);
});

test('download hands the host a standalone SVG of the active floor, named after the document and floor', () => {
  const { view, calls, tabs } = setup({ fixture: BUILT_STRATA, raw: { levelLabels: { 2: 'First floor' } } });
  tabs[1].click();
  view.buttons.download.click();
  assert.equal(calls.download.length, 1);
  assert.equal(calls.download[0].name, 'SP83687-First-floor.svg');
  assert.match(calls.download[0].svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width=/);
  assert.match(calls.download[0].svg, /First floor: section at Z = 26.090 m/);
});

test('the fullscreen button calls the host action and reflects its state', () => {
  const { view, calls } = setup();
  view.buttons.fullscreen.click();
  assert.equal(calls.fullscreen, 1);
  view.applyViewMode();
  assert.equal(view.buttons.fullscreen.getAttribute('aria-pressed'), 'true');
  assert.equal(view.buttons.fullscreen.getAttribute('aria-label'), 'Exit fullscreen');
});

test('destroy removes every listener the view added', () => {
  const { view, root } = setup();
  const targets = [root.byClass('xys-stage')[0], root.byClass('xys-tabs')[0], ...root.byClass('xys-tab'), ...Object.values(view.buttons)];
  assert.ok(targets.some(t => t.totalListenerCount > 0));
  view.destroy();
  targets.forEach(t => assert.equal(t.totalListenerCount, 0));
  view.layerInputs.items.forEach(input => assert.equal(input.totalListenerCount, 0));
});

test('humanizeSlug and fileSlug', () => {
  assert.equal(humanizeSlug('former-tenure_parcel'), 'Former tenure parcel');
  assert.equal(fileSlug('SP 83687 / Level 1: <x>'), 'SP-83687-Level-1-x');
  assert.equal(fileSlug('///'), 'section');
});
