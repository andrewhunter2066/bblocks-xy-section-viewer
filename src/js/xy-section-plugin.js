import { mimeTypeMatches } from './utils/mime-type-match.js';
import { hasProjected3DPoints, isTopoFeatureMultiCollection } from './utils/detect-topo.js';
import { buildLevels } from './utils/levels.js';

const SUPPORTED_TYPES = ['application/geo+json', 'application/json', 'application/ld+json'];

// Renders topo-feature (https://github.com/ogcincubator/topo-feature) topology documents as
// horizontal (XY) sections, one tab per floor level, reading each point feature's projected
// `place` coordinates. Sibling of the Three.js TopoFeaturePlugin and the Cesium
// TopoFeatureCesiumPlugin, and driven by the same rule engine.
//
// A document matches if it is a topo-feature document, at least one point has a numeric 3D
// `place`, and at least one floor level with a section height is found (see utils/levels.js).
// matches() is synchronous, so it uses the built-in level options; a per-block config cannot
// widen what matches.
//
// Stage 2: render() only lists the levels found; sections are drawn from Stage 5.
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
    this._candidate = undefined; // undefined = not yet picked, null = nothing usable
    this._data = null; // the picked candidate's parsed document
    this._levels = []; // [{ level, z, solids }] for the picked document
  }

  matches() {
    return !!this._pickCandidate();
  }

  _pickCandidate() {
    if (this._candidate !== undefined) return this._candidate;
    const candidate = this.candidates.find(c => {
      if (!c?.type || !c.content) return false;
      if (!SUPPORTED_TYPES.some(t => mimeTypeMatches(t, c.type))) return false;
      try {
        const data = JSON.parse(c.content);
        if (!isTopoFeatureMultiCollection(data) || !hasProjected3DPoints(data)) return false;
        const levels = buildLevels(data);
        if (!levels.length) return false;
        this._data = data;
        this._levels = levels;
        return true;
      } catch {
        return false;
      }
    });
    this._candidate = candidate ?? null;
    return this._candidate;
  }

  /** @param {HTMLElement} el */
  render(el) {
    el.textContent = '';
    if (!this._pickCandidate()) return;
    const list = el.ownerDocument.createElement('ul');
    this._levels.forEach(({ level, z, solids }) => {
      const item = el.ownerDocument.createElement('li');
      item.textContent = `Level ${level}: Z = ${z.toFixed(3)} m, ${solids.length} solid(s)`;
      list.append(item);
    });
    el.append(list);
  }

  /** @param {HTMLElement} el */
  destroy(el) {
    el.textContent = '';
  }
}
