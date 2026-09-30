// Renders one level of a section model (xy-scene.js) as SVG markup — a pure function, so the view
// simply re-renders a floor when a toggle changes, and the same markup is what "Download SVG"
// saves. Every string taken from the document (labels, names) is XML-escaped; colours pass
// through safeColor().
//
// Layers, bottom to top: grid, lower levels (context, faded outlines), flat outlines (outline-mode
// rules, e.g. parcels), this level's sections, the boundary parcel, labels.

import { labelAnchor, safeColor } from './xy-scene.js';
import { fitViewBox, niceStep, viewBoxAttribute } from './utils/view-box.js';

export const INK = Object.freeze({
  surface: '#fcfcfb',
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
});
const DEFAULT_FILL_OPACITY = 0.45;
const CONTEXT_OPACITY = 0.4;
const DASH = '6 4';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

const num = v => +v.toFixed(3);
const pathData = (loops, polylines = []) => [
  ...loops.map(loop => `M${loop.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`),
  ...polylines.map(line => `M${line.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}`),
].join('');

const clampOpacity = value => (Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : null);

// The grid spacing in metres for the `grid` option (true = automatic), or null for no grid.
export function gridStep(model, grid) {
  if (grid === false) return null;
  if (Number.isFinite(grid) && grid > 0) return grid;
  return niceStep(Math.max(model.bounds.maxX, model.bounds.maxY));
}

// How far the grid reaches beyond the drawing, in drawing extents and (as a cap) in grid lines.
// A short, wide tab shows far more than the drawing's width, and the view can zoom out 4×.
const GRID_REACH_EXTENTS = 10;
const GRID_REACH_MAX_LINES = 200;

function gridMarkup(model, step) {
  // Lines on whole multiples of `step` in world coordinates, over the drawing and well beyond it,
  // so neither a wide view nor panning runs off the grid.
  const { maxX, maxY } = model.bounds;
  const span = Math.min(Math.max(maxX, maxY, step) * GRID_REACH_EXTENTS, step * GRID_REACH_MAX_LINES);
  const [originE, originN] = model.origin;
  const lines = [];
  const firstE = Math.ceil((originE - span) / step) * step;
  for (let e = firstE; e <= originE + maxX + span; e += step) {
    const x = num(e - originE);
    lines.push(`M${x} ${num(-span)}V${num(maxY + span)}`);
  }
  const firstN = Math.floor((originN + span) / step) * step;
  for (let n = firstN; n >= originN - maxY - span; n -= step) {
    const y = num(originN - n);
    lines.push(`M${num(-span)} ${y}H${num(maxX + span)}`);
  }
  return `<path class="xys-grid" d="${lines.join('')}" fill="none" stroke="${INK.grid}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
}

function recordMarkup(record, shape) {
  const style = record.style ?? {};
  const stroke = safeColor(style.lineColor) ?? record.color;
  const dash = style.lineStyle === 'dashed' ? ` stroke-dasharray="${DASH}"` : '';
  const fillOpacity = clampOpacity(style.opacity) ?? (record.mode === 'outline' ? 0 : DEFAULT_FILL_OPACITY);
  const fill = fillOpacity > 0 && shape.loops.length ? `fill="${record.color}" fill-opacity="${fillOpacity}"` : 'fill="none"';
  const parts = [];
  if (shape.loops.length) {
    parts.push(`<path d="${pathData(shape.loops)}" fill-rule="evenodd" ${fill} stroke="${stroke}" stroke-width="1.5"${dash} vector-effect="non-scaling-stroke"/>`);
  }
  if (shape.polylines.length) {
    parts.push(`<path d="${pathData([], shape.polylines)}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash} vector-effect="non-scaling-stroke"/>`);
  }
  return `<g class="xys-record" data-key="${record.key}"><title>${escapeXml(record.label)}</title>${parts.join('')}</g>`;
}

/**
 * @param {object} model  from buildSectionModel()
 * @param {number} level  the level to draw
 * @param {object} [options]
 * @param {(key: string) => boolean} [options.isVisible]  per-record visibility (default: record.visible)
 * @param {boolean} [options.showContext]  draw lower levels faded
 * @param {boolean} [options.showLabels]
 * @param {boolean} [options.showBoundary]
 * @param {boolean|number} [options.grid]  see gridStep()
 * @param {number} [options.padding]  metres around the drawing for the default viewBox
 * @param {{x,y,w,h}} [options.viewBox]  defaults to the whole drawing plus padding
 * @param {boolean} [options.standalone]  a self-contained file: size, background, title/description
 * @returns {string}
 */
export function renderSectionSvg(model, level, options = {}) {
  const {
    isVisible = key => model.records.find(r => r.key === key)?.visible ?? true,
    showContext = false,
    showLabels = true,
    showBoundary = true,
    grid = true,
    padding = 2,
    standalone = false,
  } = options;
  const entry = model.levels.find(l => l.level === level);
  const viewBox = options.viewBox ?? fitViewBox(model.bounds, padding);
  const title = entry ? `${entry.label}: section at Z = ${entry.z.toFixed(3)} m` : `Level ${level}`;
  const recordsByKey = new Map(model.records.map(r => [r.key, r]));
  const shapes = entry ? model.shapesAt(level) : new Map();
  const visibleShapes = kind => [...shapes.entries()]
    .filter(([key]) => recordsByKey.get(key)?.mode === kind && isVisible(key))
    .map(([key, shape]) => [recordsByKey.get(key), shape]);

  const layers = [];
  const step = gridStep(model, grid);
  if (step) layers.push(gridMarkup(model, step));

  if (showContext && entry) {
    const context = model.contextLevels(level).flatMap(lower => [...model.shapesAt(lower.level).entries()]
      .filter(([key]) => recordsByKey.get(key)?.mode === 'section' && isVisible(key))
      .map(([key, shape]) => `<path data-level="${lower.level}" d="${pathData(shape.loops, shape.polylines)}" fill="none" stroke="${recordsByKey.get(key).color}" stroke-width="1" stroke-opacity="${CONTEXT_OPACITY}" vector-effect="non-scaling-stroke"><title>${escapeXml(`${recordsByKey.get(key).label} (${lower.label})`)}</title></path>`));
    layers.push(`<g class="xys-context">${context.join('')}</g>`);
  }

  layers.push(`<g class="xys-outlines">${visibleShapes('outline').map(([r, s]) => recordMarkup(r, s)).join('')}</g>`);
  const sections = visibleShapes('section');
  layers.push(`<g class="xys-sections">${sections.map(([r, s]) => recordMarkup(r, s)).join('')}</g>`);

  if (showBoundary && model.boundary) {
    layers.push(`<g class="xys-boundary"><title>${escapeXml(`Boundary: ${model.boundary.label}`)}</title><path d="${pathData(model.boundary.loops)}" fill="none" fill-rule="evenodd" stroke="${INK.secondary}" stroke-width="2" stroke-dasharray="8 4" vector-effect="non-scaling-stroke"/></g>`);
  }

  if (showLabels) {
    const size = num(Math.max(Math.max(model.bounds.maxX, model.bounds.maxY) / 70, 0.2));
    const labels = sections.map(([record, shape]) => {
      const anchor = labelAnchor(shape.loops);
      if (!anchor) return '';
      return `<text x="${num(anchor[0])}" y="${num(anchor[1])}" data-key="${record.key}">${escapeXml(record.label)}</text>`;
    });
    // Explicit letter/word spacing: a host page's own letter-spacing (a screen length) is inherited
    // by SVG text otherwise, and at label sizes of a metre or so it pulls the letters far apart.
    layers.push(`<g class="xys-labels" font-family="system-ui, sans-serif" font-size="${size}" letter-spacing="0" word-spacing="0" text-anchor="middle" dominant-baseline="central" fill="${INK.primary}" stroke="${INK.surface}" stroke-width="${num(size / 5)}" paint-order="stroke" pointer-events="none">${labels.join('')}</g>`);
  }

  const head = standalone
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${num(Math.min(1600, viewBox.w * 20))}" height="${num(Math.min(1600, viewBox.w * 20) * viewBox.h / viewBox.w)}"`
    : '<svg xmlns="http://www.w3.org/2000/svg" class="xys-svg" width="100%" height="100%"';
  const description = standalone ? describe(model, entry) : '';
  const background = standalone
    ? `<rect x="${num(viewBox.x)}" y="${num(viewBox.y)}" width="${num(viewBox.w)}" height="${num(viewBox.h)}" fill="${INK.surface}"/>`
    : '';
  return `${head} viewBox="${viewBoxAttribute(viewBox)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title)}">`
    + `<title>${escapeXml(title)}</title>${description}${background}${layers.join('')}</svg>`;
}

// A standalone file's <desc>: what the drawing is and how to read its coordinates.
function describe(model, entry) {
  const { name, horizontalCRS, verticalCRS, bearingRotation } = model.meta;
  const [e, n] = model.origin;
  const lines = [
    name && `Document: ${name}`,
    entry && `${entry.label}: horizontal section at Z = ${entry.z.toFixed(3)} m${verticalCRS ? ` (${verticalCRS})` : ''}`,
    horizontalCRS && `Horizontal CRS: ${horizontalCRS}`,
    `Drawing units are metres; drawing point (x, y) is easting ${num(e)} + x, northing ${num(n)} − y. Grid north is up.`,
    bearingRotation != null && `Bearing rotation ${bearingRotation}° (not applied).`,
  ].filter(Boolean);
  return `<desc>${escapeXml(lines.join('\n'))}</desc>`;
}
