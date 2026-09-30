// The section view, in plain DOM: a tab component with one tab per floor level (WAI-ARIA tabs
// pattern: role=tablist/tab/tabpanel, arrow/Home/End keys, automatic activation), whose panels
// each hold that floor's SVG — built the first time its tab is opened. Around it: a toolbar (zoom
// in/out, fit, lower-floor context, labels, layers, download, fullscreen), a layers panel with
// the boundary and every feature grouped by rule group and kind (select-all per group and kind,
// one checkbox per feature, features not on the current floor dimmed), and a caption with the
// level's section height, CRS and the coordinates under the pointer.
//
// Layout follows the space the host gives the view, not which control got it there: at
// EXPANDED_VIEW_MIN_HEIGHT or taller (the host's expanded dialog, or fullscreen) the layers panel
// is docked beside the drawing; in the compact ~300px tab it is a pop-over behind the layers
// button. Mirrors the Cesium and Three.js plugins.
//
// All floors share one view (pan/zoom), so switching floors keeps the same area in view.

import { ICONS } from './icons.js';
import { gridStep, renderSectionSvg } from '../svg-render.js';
import { fitViewBox, panViewBox, pixelToView, viewBoxAttribute, zoomViewBox } from '../utils/view-box.js';

export const EXPANDED_VIEW_MIN_HEIGHT = 400;
const ZOOM_STEP = 1.5;
const WHEEL_ZOOM_BASE = 1.0015; // per wheel deltaY pixel
const MAX_ZOOM_OUT = 4; // times the fitted width
const MIN_VIEW_WIDTH = 0.5; // metres

const GROUP_LABELS = { solid: 'Solids', surface: 'Surfaces', parcel: 'Parcels', face: 'Faces', ring: 'Rings' };

// "former-tenure-parcel" -> "Former tenure parcel"
export function humanizeSlug(slug) {
  const words = String(slug).replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(slug);
}

// A file-name-safe version of `text`.
export function fileSlug(text) {
  return String(text).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'section';
}

const formatMetres = value => value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let instanceCounter = 0;

/**
 * @param {HTMLElement} root  the plugin's own wrapper (.xys-root)
 * @param {object} options
 * @param {object} options.model  from buildSectionModel()
 * @param {object} options.xySection  the effective XY options (showContext, padding, grid, …)
 * @param {object} options.actions  toggleFullscreen(), isFullscreen(), download(fileName, svgText)
 */
export class SectionView {
  constructor(root, { model, xySection, actions }) {
    this.root = root;
    this.doc = root.ownerDocument;
    this.model = model;
    this.options = xySection;
    this.actions = actions;
    this.uid = `xys${++instanceCounter}`;
    this.active = 0;
    this.visible = new Map(model.records.map(r => [r.key, r.visible]));
    this.showContext = !!xySection.showContext;
    this.showLabels = true;
    this.showBoundary = true;
    this.fitted = fitViewBox(model.bounds, xySection.padding);
    this.viewBox = { ...this.fitted };
    this.rendered = new Set(); // panel indexes whose SVG is current
    this.layersOpen = false;
    this.drag = null;
    this.listeners = [];
    this._build();
    this.activate(0);
    this.applyViewMode();
  }

  // ─── Building ─────────────────────────────────────────────────────────────────

  _el(tag, className, text) {
    const el = this.doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  _on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push([target, type, handler, options]);
  }

  _button(key, label, icon, onClick, pressed) {
    const button = this._el('button', 'xys-button');
    button.type = 'button';
    button.dataset.key = key;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon;
    if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
    this._on(button, 'click', onClick);
    this.buttons[key] = button;
    return button;
  }

  _build() {
    const { model } = this;
    this.buttons = {};

    this.tablist = this._el('div', 'xys-tabs');
    this.tablist.setAttribute('role', 'tablist');
    this.tablist.setAttribute('aria-label', 'Floor levels');
    this._on(this.tablist, 'keydown', e => this._onTabKey(e));

    this.body = this._el('div', 'xys-body');
    this.stage = this._el('div', 'xys-stage');
    this.tabs = [];
    this.panels = [];
    model.levels.forEach((level, index) => {
      const tab = this._el('button', 'xys-tab', level.label);
      tab.type = 'button';
      tab.id = `${this.uid}-tab-${index}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `${this.uid}-panel-${index}`);
      tab.title = `${level.label}: section at Z = ${level.z.toFixed(3)} m`;
      this._on(tab, 'click', () => this.activate(index));
      this.tablist.appendChild(tab);
      this.tabs.push(tab);

      const panel = this._el('div', 'xys-panel');
      panel.id = `${this.uid}-panel-${index}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.hidden = true;
      this.stage.appendChild(panel);
      this.panels.push(panel);
    });
    const north = this._el('div', 'xys-north');
    north.innerHTML = `${ICONS.north}<span>N</span>`;
    north.title = 'Grid north';
    this.stage.appendChild(north);

    const toolbar = this._el('div', 'xys-toolbar');
    toolbar.append(
      this._button('zoomIn', 'Zoom in', ICONS.zoomIn, () => this.zoom(ZOOM_STEP)),
      this._button('zoomOut', 'Zoom out', ICONS.zoomOut, () => this.zoom(1 / ZOOM_STEP)),
      this._button('fit', 'Fit drawing', ICONS.fit, () => this.fit()),
      this._button('context', 'Show lower floors', ICONS.context, () => this.setShowContext(!this.showContext), this.showContext),
      this._button('labels', 'Show labels', ICONS.labels, () => this.setShowLabels(!this.showLabels), this.showLabels),
      this._button('layers', 'Layers', ICONS.layers, () => this.setLayersOpen(!this.layersOpen), false),
      this._button('download', 'Download this floor as SVG', ICONS.download, () => this.download()),
      this._button('fullscreen', 'Fullscreen', ICONS.fullscreen, () => this.actions.toggleFullscreen?.(), false),
    );

    this.layers = this._el('div', 'xys-layers');
    this.layers.id = `${this.uid}-layers`;
    this.layers.setAttribute('aria-label', 'Layers');
    this.buttons.layers.setAttribute('aria-controls', this.layers.id);
    this._buildLayers();

    this.body.append(this.stage, toolbar, this.layers);

    this.caption = this._el('div', 'xys-caption');
    this.captionText = this._el('span', 'xys-caption-text');
    this.readout = this._el('span', 'xys-readout');
    this.readout.setAttribute('aria-live', 'off');
    this.caption.append(this.captionText, this.readout);

    this.root.append(this.tablist, this.body, this.caption);

    this._on(this.stage, 'wheel', e => this._onWheel(e), { passive: false });
    this._on(this.stage, 'pointerdown', e => this._onPointerDown(e));
    this._on(this.stage, 'pointermove', e => this._onPointerMove(e));
    this._on(this.stage, 'pointerup', e => this._onPointerUp(e));
    this._on(this.stage, 'pointercancel', e => this._onPointerUp(e));
    this._on(this.stage, 'pointerleave', () => { this.readout.textContent = ''; });
    this._on(this.stage, 'dblclick', () => this.fit());
  }

  _checkbox(checked, onChange, label) {
    const input = this._el('input');
    input.type = 'checkbox';
    input.checked = checked;
    if (label) input.setAttribute('aria-label', label);
    this._on(input, 'change', () => onChange(input.checked));
    return input;
  }

  _row(className, input, swatch, text) {
    const row = this._el('label', `xys-row ${className}`.trim());
    row.append(input, swatch, this._el('span', 'xys-row-label', text));
    return row;
  }

  _buildLayers() {
    const { model } = this;
    this.layerInputs = { groups: [], kinds: [], items: new Map() };
    this.layerRows = new Map();

    if (model.boundary) {
      this.layers.appendChild(this._el('h3', null, 'Boundary'));
      const swatch = this._el('span', 'xys-swatch xys-swatch-boundary');
      const input = this._checkbox(this.showBoundary, checked => this.setShowBoundary(checked));
      this.boundaryInput = input;
      this.layers.appendChild(this._row('', input, swatch, model.boundary.label));
    }

    const groups = [...new Set(model.records.map(r => r.group))];
    groups.forEach(group => {
      const records = model.records.filter(r => r.group === group);
      const groupInput = this._checkbox(false, checked => this.setVisible(records, checked), `All ${GROUP_LABELS[group] ?? humanizeSlug(group)}`);
      const heading = this._el('h3');
      const headingRow = this._el('label', 'xys-row');
      headingRow.append(groupInput, this._el('span', null, GROUP_LABELS[group] ?? humanizeSlug(group)));
      heading.appendChild(headingRow);
      this.layers.appendChild(heading);
      this.layerInputs.groups.push({ input: groupInput, records });

      const kinds = [...new Set(records.map(r => r.kind))];
      kinds.forEach(kind => {
        const kindRecords = records.filter(r => r.kind === kind);
        if (kinds.length > 1) {
          const kindLabel = kindRecords[0].kindLabel ?? humanizeSlug(kind);
          const kindInput = this._checkbox(false, checked => this.setVisible(kindRecords, checked), `All ${kindLabel}`);
          const sub = this._el('h4');
          const subRow = this._el('label', 'xys-row');
          subRow.append(kindInput, this._el('span', null, kindLabel));
          sub.appendChild(subRow);
          this.layers.appendChild(sub);
          this.layerInputs.kinds.push({ input: kindInput, records: kindRecords });
        }
        kindRecords.forEach(record => {
          const input = this._checkbox(this.visible.get(record.key), checked => this.setVisible([record], checked));
          const swatch = this._el('span', 'xys-swatch');
          const tint = /^#[0-9a-f]{6}$/i.test(record.color) ? `${record.color}40` : 'transparent';
          swatch.style.cssText = `color: ${record.color}; background: ${tint}`;
          const row = this._row('xys-item', input, swatch, record.label);
          row.dataset.key = record.key;
          this.layers.appendChild(row);
          this.layerInputs.items.set(record.key, input);
          this.layerRows.set(record.key, row);
        });
      });
    });
    this._syncLayers();
  }

  // Checkbox states from `visible`; select-alls show checked / indeterminate; rows for features
  // not on the active floor are dimmed.
  _syncLayers() {
    this.layerInputs.items.forEach((input, key) => { input.checked = this.visible.get(key); });
    [...this.layerInputs.groups, ...this.layerInputs.kinds].forEach(({ input, records }) => {
      const shown = records.filter(r => this.visible.get(r.key)).length;
      input.checked = shown === records.length;
      input.indeterminate = shown > 0 && shown < records.length;
    });
    if (this.boundaryInput) this.boundaryInput.checked = this.showBoundary;
    const level = this.model.levels[this.active]?.level;
    const present = level === undefined ? new Map() : this.model.shapesAt(level);
    this.layerRows.forEach((row, key) => {
      const absent = !present.has(key);
      row.classList?.toggle('xys-absent', absent);
      row.title = absent ? 'Not on this floor' : '';
    });
  }

  // ─── Tabs and panels ──────────────────────────────────────────────────────────

  activate(index, { focus = false } = {}) {
    if (index < 0 || index >= this.tabs.length) return;
    this.active = index;
    this.tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      this.panels[i].hidden = !selected;
    });
    if (focus) this.tabs[index].focus();
    this._renderActive();
    this._applyViewBox(); // a panel built earlier may still hold an older view
    this._syncLayers();
    this._updateCaption();
  }

  _onTabKey(event) {
    const last = this.tabs.length - 1;
    const next = {
      ArrowRight: this.active === last ? 0 : this.active + 1,
      ArrowLeft: this.active === 0 ? last : this.active - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.activate(next, { focus: true });
  }

  _svgOptions() {
    return {
      isVisible: key => this.visible.get(key),
      showContext: this.showContext,
      showLabels: this.showLabels,
      showBoundary: this.showBoundary,
      grid: this.options.grid,
      padding: this.options.padding,
    };
  }

  // Builds the active panel's SVG if it is not current. Other panels stay as they are (or empty,
  // if never opened) until activated.
  _renderActive() {
    const index = this.active;
    if (this.rendered.has(index) || !this.panels[index]) return;
    const level = this.model.levels[index].level;
    this.panels[index].innerHTML = renderSectionSvg(this.model, level, { ...this._svgOptions(), viewBox: this.viewBox });
    this.rendered.add(index);
    this._applyViewBox();
  }

  // Something drawn changed: every built panel is stale; redraw the active one now.
  _invalidate() {
    this.rendered.clear();
    this._renderActive();
  }

  _svg(index = this.active) {
    return this.panels[index]?.firstElementChild ?? null;
  }

  _applyViewBox() {
    this._svg()?.setAttribute('viewBox', viewBoxAttribute(this.viewBox));
  }

  // ─── Toggles ──────────────────────────────────────────────────────────────────

  setVisible(records, visible) {
    records.forEach(r => this.visible.set(r.key, visible));
    this._invalidate();
    this._syncLayers();
  }

  setShowContext(shown) {
    this.showContext = shown;
    this.buttons.context.setAttribute('aria-pressed', String(shown));
    this._invalidate();
  }

  setShowLabels(shown) {
    this.showLabels = shown;
    this.buttons.labels.setAttribute('aria-pressed', String(shown));
    this._invalidate();
  }

  setShowBoundary(shown) {
    this.showBoundary = shown;
    this._invalidate();
    this._syncLayers();
  }

  setLayersOpen(open) {
    this.layersOpen = open;
    this.applyViewMode();
  }

  // ─── View (pan/zoom) ──────────────────────────────────────────────────────────

  _stageSize() {
    const rect = this.stage.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
    const width = rect.width || this.stage.clientWidth || 0;
    const height = rect.height || this.stage.clientHeight || 0;
    return { left: rect.left ?? 0, top: rect.top ?? 0, width, height };
  }

  // Other built panels pick the new view up when activated.
  _setViewBox(viewBox) {
    this.viewBox = viewBox;
    this._applyViewBox();
  }

  zoom(factor, focus) {
    this._setViewBox(zoomViewBox(this.viewBox, factor, focus, { minW: MIN_VIEW_WIDTH, maxW: this.fitted.w * MAX_ZOOM_OUT }));
  }

  fit() {
    this._setViewBox({ ...this.fitted });
  }

  _pointerView(event) {
    const { left, top, width, height } = this._stageSize();
    if (!width || !height) return null;
    return pixelToView(this.viewBox, event.clientX - left, event.clientY - top, width, height);
  }

  _onWheel(event) {
    event.preventDefault();
    const focus = this._pointerView(event) ?? undefined;
    this.zoom(WHEEL_ZOOM_BASE ** -event.deltaY, focus);
  }

  _onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this.drag = { x: event.clientX, y: event.clientY, viewBox: this.viewBox, id: event.pointerId };
    this.stage.setPointerCapture?.(event.pointerId);
    this.stage.classList?.add('xys-dragging');
  }

  _onPointerMove(event) {
    const point = this._pointerView(event);
    if (point) {
      const [e, n] = this.model.toWorld(point);
      this.readout.textContent = `E ${formatMetres(e)}  N ${formatMetres(n)}`;
    }
    if (!this.drag) return;
    const { width, height } = this._stageSize();
    if (!width || !height) return;
    this._setViewBox(panViewBox(this.drag.viewBox, event.clientX - this.drag.x, event.clientY - this.drag.y, width, height));
  }

  _onPointerUp(event) {
    if (!this.drag) return;
    this.stage.releasePointerCapture?.(event.pointerId);
    this.stage.classList?.remove('xys-dragging');
    this.drag = null;
  }

  // ─── Caption, download, layout ────────────────────────────────────────────────

  _updateCaption() {
    const level = this.model.levels[this.active];
    const { horizontalCRS, verticalCRS, bearingRotation } = this.model.meta;
    const step = gridStep(this.model, this.options.grid);
    const parts = [
      level && `${level.label}: section at Z = ${level.z.toFixed(3)} m${verticalCRS ? ` (${verticalCRS})` : ''}`,
      `${horizontalCRS ? `${horizontalCRS}, ` : ''}easting/northing in metres`,
      step && `grid ${step} m`,
      bearingRotation != null && `bearing rotation ${bearingRotation}° not applied`,
    ].filter(Boolean);
    this.captionText.textContent = parts.join(' · ');
  }

  download() {
    const level = this.model.levels[this.active];
    if (!level) return;
    const svg = renderSectionSvg(this.model, level.level, { ...this._svgOptions(), standalone: true });
    const name = fileSlug(`${this.model.meta.name || 'section'}-${level.label}`);
    this.actions.download?.(`${name}.svg`, svg);
  }

  isExpanded() {
    return (this.root.clientHeight ?? 0) >= EXPANDED_VIEW_MIN_HEIGHT;
  }

  // Compact vs expanded layout, from the root's current size; also refreshes the fullscreen button.
  applyViewMode() {
    const expanded = this.isExpanded();
    this.root.classList?.toggle('xys-expanded', expanded);
    this.layers.hidden = !expanded && !this.layersOpen;
    this.buttons.layers.setAttribute('aria-pressed', String(!expanded && this.layersOpen));
    this.buttons.layers.setAttribute('aria-expanded', String(expanded || this.layersOpen));
    const fullscreen = !!this.actions.isFullscreen?.();
    this.buttons.fullscreen.setAttribute('aria-pressed', String(fullscreen));
    this.buttons.fullscreen.innerHTML = fullscreen ? ICONS.fullscreenExit : ICONS.fullscreen;
    const label = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
    this.buttons.fullscreen.setAttribute('aria-label', label);
    this.buttons.fullscreen.title = label;
  }

  destroy() {
    this.listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    this.listeners = [];
    this.drag = null;
  }
}
