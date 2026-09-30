// Floor levels and the height each one is sectioned at.
//
// Levels come from a property on each solid (by default `properties.floors`, an array of level
// numbers; a solid listed on several levels appears in each). A level is cut at the mid-height of
// the solids listed on that level alone — the rule from waTestData's section_topology.py —
// unless a per-level height is configured. Solids named by an `exclude` entry (by default, the
// geometry of every `occupationFeatures` item: walls, slabs, ceilings) take no part in any of
// this and are never sectioned.

import { getPath } from './rules.js';
import { buildMaps, containerZValues, getFeatures } from './topology.js';

export const DEFAULT_LEVEL_OPTIONS = Object.freeze({
  levelProperty: 'properties.floors',
  // Each entry: every feature in `data[source]` excludes the solid(s) whose id is the value
  // (a string or an array of strings) at `property`.
  exclude: Object.freeze([
    Object.freeze({ source: 'occupationFeatures', property: 'properties.geometryRef' }),
  ]),
  // { "<level>": z } overrides the computed section height for that level.
  sectionZ: Object.freeze({}),
});

function options(overrides) {
  return { ...DEFAULT_LEVEL_OPTIONS, ...overrides };
}

// Ids of the features the `exclude` entries name.
export function excludedIds(data, exclude = DEFAULT_LEVEL_OPTIONS.exclude) {
  const ids = new Set();
  (Array.isArray(exclude) ? exclude : []).forEach(entry => {
    if (typeof entry?.source !== 'string' || typeof entry?.property !== 'string') return;
    getFeatures(data?.[entry.source]).forEach(feature => {
      [getPath(feature, entry.property)].flat().forEach(id => {
        if (typeof id === 'string' && id) ids.add(id);
      });
    });
  });
  return ids;
}

// The solids that take part in sections: every solid not excluded.
export function sectionSolids(data, levelOptions) {
  const opts = options(levelOptions);
  const excluded = excludedIds(data, opts.exclude);
  return getFeatures(data?.solids).filter(solid => solid?.id == null || !excluded.has(solid.id));
}

// The finite level numbers a solid is listed on (a single number is accepted as well as an array).
export function solidLevels(solid, levelProperty = DEFAULT_LEVEL_OPTIONS.levelProperty) {
  const value = getPath(solid, levelProperty);
  return [...new Set([value].flat().filter(Number.isFinite))];
}

function midHeight(zValues) {
  if (!zValues.length) return null;
  let min = Infinity;
  let max = -Infinity;
  zValues.forEach(z => {
    if (z < min) min = z;
    if (z > max) max = z;
  });
  return (min + max) / 2;
}

// Every level with a section height, ascending: [{ level, z, solids }], where `solids` are the
// section solids listed on that level (including ones listed on several levels). A level with no
// configured height and no solid on it alone has no height and is left out, as is a level whose
// solids are all excluded.
export function buildLevels(data, levelOptions, maps = buildMaps(data)) {
  const opts = options(levelOptions);
  const solids = sectionSolids(data, opts);
  const byLevel = new Map();
  solids.forEach(solid => {
    const levels = solidLevels(solid, opts.levelProperty);
    levels.forEach(level => {
      if (!byLevel.has(level)) byLevel.set(level, { solids: [], exclusiveZ: [] });
      const entry = byLevel.get(level);
      entry.solids.push(solid);
      if (levels.length === 1) entry.exclusiveZ.push(...containerZValues(solid, maps));
    });
  });

  const sectionZ = opts.sectionZ && typeof opts.sectionZ === 'object' ? opts.sectionZ : {};
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, entry]) => {
      const configured = sectionZ[String(level)];
      const z = Number.isFinite(configured) ? configured : midHeight(entry.exclusiveZ);
      return { level, z, solids: entry.solids };
    })
    .filter(entry => entry.z != null);
}
