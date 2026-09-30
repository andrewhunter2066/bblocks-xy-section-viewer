// Everything the section view draws, as plain data (no DOM): the levels, one record per
// classified feature, the boundary parcel, colours, and each level's sections — computed on
// first request and cached, so a floor's geometry is only sectioned when its tab is opened.
//
// Coordinates are converted to a local frame in metres: x = easting − minE, y = maxN − northing
// (SVG y runs down, northing up), with (minE, maxN) the top-left of the whole drawing. Keeping
// numbers small avoids the float precision loss some SVG renderers show at 6-7 digit eastings.
//
// Which features appear, and how, follows the rule engine (rules.js): a rule's `geometry`
// `solid`/`open-shell`/`face` is sectioned at each level's height; `polygon`/`ring` is drawn flat,
// as an outline, on every level. Any other geometry is ignored. Features named by
// `xySection.exclude` are left out whichever rule claims them.

import { classifyFeatures, resolveLabel } from './utils/rules.js';
import { buildMaps, containerPolygons, facePolygon, getOpenShells } from './utils/topology.js';
import { buildLevels, excludedIds } from './utils/levels.js';
import { chainSegments, loopArea, sectionPolygons } from './utils/section.js';
import { featureOutline, resolveBoundary } from './utils/boundary.js';
import { levelLabel } from './utils/xy-options.js';
import { XY_DEFAULT_LABEL } from './utils/xy-default-config.js';

// Categorical palette, in fixed order (the dataviz skill's validated reference order).
export const PALETTE = Object.freeze(['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']);

export const SECTIONED_GEOMETRIES = new Set(['solid', 'open-shell', 'face']);
export const OUTLINED_GEOMETRIES = new Set(['polygon', 'ring']);

// A CSS colour safe to put in an SVG attribute: #hex, a named colour, or rgb()/hsl() notation.
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\))$/i;
export function safeColor(value) {
  return typeof value === 'string' && SAFE_COLOR.test(value.trim()) ? value.trim() : null;
}

function zRange(polygons) {
  let min = Infinity;
  let max = -Infinity;
  polygons.forEach(p => [p.outer, ...p.holes].forEach(ring => ring.forEach(([, , z]) => {
    if (z == null) return;
    if (z < min) min = z;
    if (z > max) max = z;
  })));
  return min <= max ? { min, max } : null;
}

// Greedy colouring in record order: each record takes the first palette slot not already used by
// an earlier record that appears on any of the same levels, so colour follows the feature across
// floors and no two features on one floor share a colour while there are ≤ 8 of them. A rule's own
// `style.color` wins. Beyond 8 features on one floor, slots repeat (labels and the legend still
// tell them apart).
function assignColors(records) {
  const slotOf = new Map();
  records.forEach(record => {
    const fixed = safeColor(record.style?.color);
    if (fixed) {
      record.color = fixed;
      return;
    }
    const taken = new Set(records
      .filter(other => slotOf.has(other.key) && other.levels.some(l => record.levels.includes(l)))
      .map(other => slotOf.get(other.key)));
    let slot = 0;
    while (taken.has(slot) && slot < PALETTE.length) slot++;
    if (slot === PALETTE.length) slot = slotOf.size % PALETTE.length;
    slotOf.set(record.key, slot);
    record.color = PALETTE[slot];
  });
}

function loopCentroid(loop) {
  const area = loopArea(loop);
  if (Math.abs(area) < 1e-12) {
    const n = loop.length;
    return [loop.reduce((s, p) => s + p[0], 0) / n, loop.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  loop.forEach(([x1, y1], i) => {
    const [x2, y2] = loop[(i + 1) % loop.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  });
  return [cx / (6 * area), cy / (6 * area)];
}

// Where a record's label goes: the centroid of its largest loop.
export function labelAnchor(loops) {
  if (!loops.length) return null;
  const largest = loops.reduce((best, loop) => (Math.abs(loopArea(loop)) > Math.abs(loopArea(best)) ? loop : best));
  return loopCentroid(largest);
}

/**
 * @param {object} data  the topo-feature document
 * @param {{ config: object, xySection: object }} loaded  the effective rule config and XY options
 *   (see utils/load-config.js)
 */
export function buildSectionModel(data, { config, xySection }) {
  const maps = buildMaps(data);
  const levelOptions = { levelProperty: xySection.levelProperty, exclude: xySection.exclude, sectionZ: xySection.sectionZ };
  const levels = buildLevels(data, levelOptions, maps).map(({ level, z }) => ({ level, z, label: levelLabel(level, xySection) }));

  const excluded = excludedIds(data, xySection.exclude);
  // A rule with no `label` of its own gets the built-in label chain rather than the rule engine's
  // bare-id fallback, so a block config need not restate it to get readable names.
  const rules = (config?.rules ?? []).map(rule => (rule?.label ? rule : { ...rule, label: XY_DEFAULT_LABEL }));
  const descriptors = classifyFeatures({ ...data, surfaces: getOpenShells(data, maps) }, { ...config, rules });
  const records = [];
  descriptors.forEach(descriptor => {
    const { feature, geometry } = descriptor;
    if (feature?.id != null && excluded.has(feature.id)) return;
    let mode;
    let polygons = [];
    let outline = null;
    if (SECTIONED_GEOMETRIES.has(geometry)) {
      mode = 'section';
      polygons = geometry === 'face' ? [facePolygon(feature, maps)].filter(Boolean) : containerPolygons(feature, maps);
      if (!polygons.length) return;
    } else if (OUTLINED_GEOMETRIES.has(geometry)) {
      mode = 'outline';
      outline = featureOutline(feature, maps);
      if (!outline) return;
    } else {
      return;
    }
    const range = mode === 'section' ? zRange(polygons) : null;
    // Levels the record can appear on: outlines on all; sections where the level's height falls
    // within the feature's own height range. A section feature no level cuts is never drawn, so it
    // is left out (it would only sit dimmed in the legend and widen the drawing's bounds).
    const onLevels = levels.filter(l => mode === 'outline' || (range && l.z >= range.min && l.z <= range.max)).map(l => l.level);
    if (!onLevels.length) return;
    records.push({
      key: `r${records.length}`,
      id: feature?.id ?? null,
      source: descriptor.source,
      kind: descriptor.kind,
      group: descriptor.group,
      kindLabel: descriptor.kindLabel,
      label: descriptor.label,
      style: descriptor.style ?? {},
      visible: descriptor.initiallyVisible !== false,
      mode,
      polygons,
      outline,
      levels: onLevels,
    });
  });
  assignColors(records);

  const boundaryResult = resolveBoundary(data, xySection.boundary, maps);

  // World bounds of everything that can be drawn.
  const worldPoints = [
    ...records.flatMap(r => (r.mode === 'section' ? r.polygons : [r.outline]).flatMap(p => [p.outer, ...p.holes].flat())),
    ...(boundaryResult ? [boundaryResult.polygon.outer, ...boundaryResult.polygon.holes].flat() : []),
  ];
  const xs = worldPoints.map(p => p[0]);
  const ys = worldPoints.map(p => p[1]);
  const world = worldPoints.length
    ? { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
    : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const origin = [world.minX, world.maxY];
  const toLocal = ([x, y]) => [x - origin[0], origin[1] - y];
  const toWorld = ([x, y]) => [x + origin[0], origin[1] - y];
  const bounds = { minX: 0, minY: 0, maxX: world.maxX - world.minX, maxY: world.maxY - world.minY };

  const outlineLoops = polygon => [polygon.outer, ...polygon.holes].map(ring => ring.map(toLocal));
  records.filter(r => r.mode === 'outline').forEach(r => { r.outlineLoops = outlineLoops(r.outline); });
  const boundary = boundaryResult && {
    id: boundaryResult.feature.id ?? null,
    label: resolveLabel(boundaryResult.feature, XY_DEFAULT_LABEL),
    loops: outlineLoops(boundaryResult.polygon),
  };

  const cache = new Map();
  // { key → { loops, polylines } } in local coordinates, for every record with anything on
  // `level` (outline records always). Cached per level.
  function shapesAt(level) {
    if (cache.has(level)) return cache.get(level);
    const entry = levels.find(l => l.level === level);
    const shapes = new Map();
    if (entry) {
      records.forEach(record => {
        if (record.mode === 'outline') {
          shapes.set(record.key, { loops: record.outlineLoops, polylines: [] });
          return;
        }
        if (!record.levels.includes(level)) return;
        const { loops, polylines } = chainSegments(sectionPolygons(record.polygons, entry.z));
        if (loops.length || polylines.length) {
          shapes.set(record.key, { loops: loops.map(l => l.map(toLocal)), polylines: polylines.map(l => l.map(toLocal)) });
        }
      });
    }
    cache.set(level, shapes);
    return shapes;
  }

  return {
    meta: {
      name: data?.name ?? data?.id ?? '',
      horizontalCRS: typeof data?.horizontalCRS === 'string' ? data.horizontalCRS : null,
      verticalCRS: typeof data?.verticalCRS === 'string' ? data.verticalCRS : null,
      bearingRotation: Number.isFinite(data?.bearingRotation) ? data.bearingRotation : null,
    },
    levels,
    records,
    boundary,
    bounds,
    origin,
    toLocal,
    toWorld,
    shapesAt,
    // Levels drawn faded under `level` when context is on: every lower level.
    contextLevels: level => levels.filter(l => l.level < level),
  };
}
