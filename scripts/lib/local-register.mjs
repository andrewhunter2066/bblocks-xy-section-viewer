// Points a register.json's view-plugin entry for this plugin at another URL (the local build),
// leaving every other plugin alone. Pure, so it is unit-tested (src/js/local-register.test.js);
// scripts/use-local-plugin.mjs does the file reading and writing.
//
// Adapted from bblocks-cesium-viewer's scripts/use-local-plugin.mjs.

export const EXPORT_NAME = 'XYSectionPlugin';
export const DEFAULT_LOCAL_URL = 'http://localhost:9090/register/dist/index.js';

const exportsOf = entry => [entry?.export].flat().filter(Boolean);

// An entry is this plugin's if it names the XYSectionPlugin export or loads a published copy of
// this repository (any owner, any ref: …/bblocks-xy-section-viewer@<ref>/index.js).
export function isThisPlugin(entry) {
  return exportsOf(entry).includes(EXPORT_NAME)
    || /\/bblocks-xy-section-viewer@[^/]+\/index\.js$/.test(entry?.url ?? '');
}

// Returns { register, action }: a copy of `register` whose entries for this plugin load from
// `pluginUrl` ('redirected'), or with one added if there was none ('added').
export function useLocalPlugin(register, pluginUrl = DEFAULT_LOCAL_URL) {
  const result = structuredClone(register ?? {});
  result.viewer ??= {};
  result.viewer.viewPlugins ??= [];
  const existing = result.viewer.viewPlugins.filter(isThisPlugin);
  if (existing.length) {
    existing.forEach(entry => { entry.url = pluginUrl; });
    return { register: result, action: 'redirected' };
  }
  result.viewer.viewPlugins.push({ url: pluginUrl, export: EXPORT_NAME });
  return { register: result, action: 'added' };
}
