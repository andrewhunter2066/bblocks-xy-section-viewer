// The XY-section-specific part of a per-block viewer config: the optional top-level `xySection`
// object, alongside the rule engine's `rules`/`defaults`/`kindOrder` (which config.js parses,
// ignoring this key). Like config.js, parsing never throws: an invalid value is dropped with a
// warning and its default used instead.
//
//   "xySection": {
//     "levelProperty": "properties.floors",   // dot-path on each solid: level number(s)
//     "levelLabels": { "1": "Ground" },       // tab label per level (default "Level <n>")
//     "sectionZ": { "2": 25.1 },              // section height per level (default: mid-height)
//     "showContext": false,                   // lower levels drawn faded, initially
//     "padding": 2,                           // metres around the drawing
//     "grid": true,                           // true (automatic spacing), false, or spacing in metres
//     "boundary": [                           // first entry yielding an outline wins
//       { "source": "parcels",
//         "match": { "property": "properties.parcelPurpose", "values": ["wa-parcel-purpose:strata-scheme"] },
//         "follow": { "role": "containingPrimaryParcel" } }
//     ],
//     "exclude": [                            // solids never sectioned
//       { "source": "occupationFeatures", "property": "properties.geometryRef" }
//     ]
//   }

import { DEFAULT_LEVEL_OPTIONS } from './levels.js';

export const DEFAULT_BOUNDARY = Object.freeze([Object.freeze({ source: 'parcels' })]);

export const DEFAULT_XY_OPTIONS = Object.freeze({
  levelProperty: DEFAULT_LEVEL_OPTIONS.levelProperty,
  levelLabels: Object.freeze({}),
  sectionZ: DEFAULT_LEVEL_OPTIONS.sectionZ,
  showContext: false,
  padding: 2,
  grid: true,
  boundary: DEFAULT_BOUNDARY,
  exclude: DEFAULT_LEVEL_OPTIONS.exclude,
});

const KNOWN_KEYS = Object.keys(DEFAULT_XY_OPTIONS);

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
const isLevelKey = key => key.trim() !== '' && Number.isFinite(Number(key));

function parseLevelProperty(value, warnings) {
  if (value === undefined) return DEFAULT_XY_OPTIONS.levelProperty;
  if (isNonEmptyString(value)) return value;
  warnings.push('xySection.levelProperty must be a non-empty dot-path string; using "properties.floors"');
  return DEFAULT_XY_OPTIONS.levelProperty;
}

// A { "<level>": value } map; entries whose key is not a number or whose value fails `valid` are
// dropped one by one, so one bad entry does not discard the rest.
function parseLevelMap(name, value, valid, expected, warnings) {
  if (value === undefined) return {};
  if (!isObject(value)) {
    warnings.push(`xySection.${name} must be an object keyed by level number; ignoring it`);
    return {};
  }
  const result = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (isLevelKey(key) && valid(entry)) {
      result[String(Number(key))] = entry;
    } else {
      warnings.push(`xySection.${name}["${key}"] must be keyed by a level number with ${expected}; ignoring it`);
    }
  });
  return result;
}

function parseBoolean(name, value, fallback, warnings) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  warnings.push(`xySection.${name} must be true or false; using ${fallback}`);
  return fallback;
}

function parsePadding(value, warnings) {
  if (value === undefined) return DEFAULT_XY_OPTIONS.padding;
  if (Number.isFinite(value) && value >= 0) return value;
  warnings.push(`xySection.padding must be a number of metres ≥ 0; using ${DEFAULT_XY_OPTIONS.padding}`);
  return DEFAULT_XY_OPTIONS.padding;
}

function parseGrid(value, warnings) {
  if (value === undefined) return DEFAULT_XY_OPTIONS.grid;
  if (typeof value === 'boolean' || (Number.isFinite(value) && value > 0)) return value;
  warnings.push('xySection.grid must be true, false or a spacing in metres > 0; using automatic spacing');
  return DEFAULT_XY_OPTIONS.grid;
}

function validMatch(match) {
  return isObject(match) && isNonEmptyString(match.property) && Array.isArray(match.values);
}

function parseBoundaryEntry(entry, index, warnings) {
  const where = `xySection.boundary[${index}]`;
  if (!isObject(entry)) {
    warnings.push(`${where} must be an object; ignoring it`);
    return null;
  }
  const result = { source: 'parcels' };
  if (entry.source !== undefined) {
    if (!isNonEmptyString(entry.source)) {
      warnings.push(`${where}.source must be a non-empty string; ignoring the entry`);
      return null;
    }
    result.source = entry.source;
  }
  if (entry.match !== undefined) {
    if (!validMatch(entry.match)) {
      warnings.push(`${where}.match needs a "property" dot-path and a "values" array; ignoring the entry`);
      return null;
    }
    result.match = { property: entry.match.property, values: entry.match.values };
  }
  if (entry.follow !== undefined) {
    if (!isObject(entry.follow) || !isNonEmptyString(entry.follow.role)
      || (entry.follow.source !== undefined && !isNonEmptyString(entry.follow.source))) {
      warnings.push(`${where}.follow needs a "role" string (and optionally a "source"); ignoring the entry`);
      return null;
    }
    result.follow = { role: entry.follow.role, source: entry.follow.source ?? result.source };
  }
  return result;
}

function parseBoundary(value, warnings) {
  if (value === undefined) return DEFAULT_XY_OPTIONS.boundary;
  if (!Array.isArray(value)) {
    warnings.push('xySection.boundary must be an array; using the first parcel with an outline');
    return DEFAULT_XY_OPTIONS.boundary;
  }
  // An explicit empty list means "no boundary"; a list whose entries are all invalid does not.
  const entries = value.map((entry, i) => parseBoundaryEntry(entry, i, warnings)).filter(Boolean);
  if (value.length && !entries.length) {
    warnings.push('xySection.boundary has no valid entries; using the first parcel with an outline');
    return DEFAULT_XY_OPTIONS.boundary;
  }
  return entries;
}

function parseExclude(value, warnings) {
  if (value === undefined) return DEFAULT_XY_OPTIONS.exclude;
  if (!Array.isArray(value)) {
    warnings.push('xySection.exclude must be an array; using the default (occupationFeatures)');
    return DEFAULT_XY_OPTIONS.exclude;
  }
  // An explicit empty list means "exclude nothing"; a list whose entries are all invalid does not.
  const entries = value.filter((entry, i) => {
    if (isObject(entry) && isNonEmptyString(entry.source) && isNonEmptyString(entry.property)) return true;
    warnings.push(`xySection.exclude[${i}] needs "source" and "property" strings; ignoring it`);
    return false;
  }).map(({ source, property }) => ({ source, property }));
  if (value.length && !entries.length) {
    warnings.push('xySection.exclude has no valid entries; using the default (occupationFeatures)');
    return DEFAULT_XY_OPTIONS.exclude;
  }
  return entries;
}

// Parses the raw `xySection` value. Returns the effective options plus human-readable warnings
// for anything that was dropped.
export function resolveXYOptions(raw) {
  const warnings = [];
  if (raw !== undefined && !isObject(raw)) {
    warnings.push('xySection must be an object; using the defaults');
    return { options: { ...DEFAULT_XY_OPTIONS }, warnings };
  }
  const source = raw ?? {};
  Object.keys(source).filter(key => !KNOWN_KEYS.includes(key)).forEach(key => {
    warnings.push(`xySection.${key} is not a known option; ignoring it`);
  });
  const options = {
    levelProperty: parseLevelProperty(source.levelProperty, warnings),
    levelLabels: parseLevelMap('levelLabels', source.levelLabels, isNonEmptyString, 'a non-empty string', warnings),
    sectionZ: parseLevelMap('sectionZ', source.sectionZ, Number.isFinite, 'a height in metres', warnings),
    showContext: parseBoolean('showContext', source.showContext, DEFAULT_XY_OPTIONS.showContext, warnings),
    padding: parsePadding(source.padding, warnings),
    grid: parseGrid(source.grid, warnings),
    boundary: parseBoundary(source.boundary, warnings),
    exclude: parseExclude(source.exclude, warnings),
  };
  return { options, warnings };
}

// The tab label for a level: its configured label, else "Level <n>".
export function levelLabel(level, options = DEFAULT_XY_OPTIONS) {
  return options.levelLabels?.[String(level)] ?? `Level ${level}`;
}
