const SUPPORTED_TYPES = ['application/geo+json', 'application/json', 'application/ld+json'];

// Renders topo-feature (https://github.com/ogcincubator/topo-feature) topology documents as
// horizontal (XY) sections, one tab per floor level, reading each point feature's projected
// `place` coordinates. Sibling of the Three.js TopoFeaturePlugin and the Cesium
// TopoFeatureCesiumPlugin, and driven by the same rule engine.
//
// Stage 0 scaffold: never matches, so the host offers no tab until detection lands (Stage 2).
//
// @implements {import('@ogc/bblocks-viewer-plugin-types').ViewPluginClass}
export default class XYSectionPlugin {
  static supportedTypes = SUPPORTED_TYPES;
  static viewName = 'XY Section';
  static icon = 'mdi-floor-plan';

  /**
   * @param {import('@ogc/bblocks-viewer-plugin-types').ViewPluginCandidate[]} candidates
   * @param {import('@ogc/bblocks-viewer-plugin-types').ViewPluginContext} [context]
   */
  constructor(candidates, context = {}) {
    this.candidates = candidates ?? [];
    this._context = context ?? {};
  }

  matches() {
    return false;
  }

  /** @param {HTMLElement} el */
  render(el) {
    el.textContent = '';
  }

  /** @param {HTMLElement} el */
  destroy(el) {
    el.textContent = '';
  }
}
