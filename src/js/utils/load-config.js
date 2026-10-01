// Loads the effective config for one render: the rule config (built-in defaults merged with a
// per-block override, via the copied config.js) plus the XY section options (xy-options.js).
//
// A block declares its config as a bblock.json `resources` entry, delivered via context.bblock.
// This plugin's own role is preferred; failing that, a config declared for the Three.js
// TopoFeaturePlugin is used, so a block already configured for that viewer gets the same rules
// in its sections (that config simply has no `xySection` key). Every failure path — no bblock, no
// resource, a failed fetch, invalid JSON — falls back to the defaults and never throws.
//
// Adapted from bblocks-cesium-viewer's src/js/utils/load-config.js.
import { mergeConfig, normalizeConfig, parseConfig } from './config.js';
import { VIEWER_CONFIG_RESOURCE_ROLE as TOPO_VIEWER_CONFIG_ROLE } from './resolve-config.js';
import { resolveXYOptions } from './xy-options.js';

export const XY_VIEWER_CONFIG_ROLE = 'https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config';
export { TOPO_VIEWER_CONFIG_ROLE };

export function findConfigResource(bblock) {
  const resources = Array.isArray(bblock?.resources) ? bblock.resources : [];
  return resources.find(r => r?.role === XY_VIEWER_CONFIG_ROLE && r.ref)
    ?? resources.find(r => r?.role === TOPO_VIEWER_CONFIG_ROLE && r.ref)
    ?? null;
}

async function fetchConfigJson(ref, fetchImpl) {
  try {
    const response = await fetchImpl(ref);
    if (!response.ok) return { json: null, warning: `config ${ref} returned HTTP ${response.status}` };
    return { json: JSON.parse(await response.text()), warning: null };
  } catch (e) {
    return { json: null, warning: `config ${ref} could not be loaded (${e.message})` };
  }
}

// Returns { config, xySection, warnings, ref }: `config` the merged rule config, `xySection` the
// effective XY options, `ref` the config resource used (null for the defaults).
export async function loadConfig(context, defaultConfig, fetchImpl = globalThis.fetch) {
  const resource = findConfigResource(context?.bblock);
  if (!resource) {
    const { options, warnings } = resolveXYOptions(undefined);
    return { config: normalizeConfig(defaultConfig), xySection: options, warnings, ref: null };
  }

  const { json, warning } = await fetchConfigJson(resource.ref, fetchImpl);
  const isObject = json != null && typeof json === 'object' && !Array.isArray(json);
  const warnings = warning ? [warning] : [];
  if (json != null && !isObject) warnings.push(`config ${resource.ref} is not a JSON object; using the defaults`);

  const { options, warnings: xyWarnings } = resolveXYOptions(isObject ? json.xySection : undefined);
  return {
    config: isObject ? mergeConfig(defaultConfig, parseConfig(json)) : normalizeConfig(defaultConfig),
    xySection: options,
    warnings: [...warnings, ...xyWarnings],
    ref: resource.ref,
  };
}
