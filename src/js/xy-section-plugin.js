import { mimeTypeMatches } from './utils/mime-type-match.js';
import { hasProjected3DPoints, isTopoFeatureMultiCollection } from './utils/detect-topo.js';
import { buildLevels } from './utils/levels.js';
import { loadConfig } from './utils/load-config.js';
import { buildXYDefaultConfig } from './utils/xy-default-config.js';
import { buildSectionModel } from './xy-scene.js';
import { SectionView } from './ui/section-view.js';
import { injectPluginCss } from './ui/inject-css.js';

const SUPPORTED_TYPES = ['application/geo+json', 'application/json', 'application/ld+json'];
const LOG_PREFIX = 'XYSectionPlugin:';

// Renders topo-feature (https://github.com/ogcincubator/topo-feature) topology documents as
// horizontal (XY) sections, one tab per floor level, reading each point feature's projected
// `place` coordinates. Sibling of the Three.js TopoFeaturePlugin and the Cesium
// TopoFeatureCesiumPlugin, and driven by the same rule engine: built-in rules, optionally replaced
// by a per-block config (utils/load-config.js) that also carries the `xySection` options. One
// instance per matched example/transform-output, so all state here is scoped to one candidate set.
//
// A document matches if it is a topo-feature document, at least one point has a numeric 3D
// `place`, and at least one floor level with a section height is found (see utils/levels.js).
// matches() is synchronous, so it uses the built-in level options; a per-block config cannot
// widen what matches.
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
    this._el = null; // element currently rendered into; null once destroyed
    this._root = null; // this plugin's own child of _el (.xys-root)
    this._view = null;
    this._model = null;
    this._resizeObserver = null;
    this._fullscreenHandler = null;
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
        if (!buildLevels(data).length) return false;
        this._data = data;
        return true;
      } catch {
        return false;
      }
    });
    this._candidate = candidate ?? null;
    return this._candidate;
  }

  // Seam for tests; otherwise the real fetch() of the block's config resource.
  _loadConfig() {
    return loadConfig(this._context, buildXYDefaultConfig());
  }

  render(el) {
    if (this._el) this.destroy(this._el);
    this._el = el;
    // The host sizes el; only add positioning so the absolutely placed root fills it.
    el.style.position = 'relative';
    // Loading is async, so its failures never reach the host's render() error handling —
    // surface them in the tab ourselves.
    return this._mount(el).catch(e => {
      console.error(`${LOG_PREFIX} failed to render`, e);
      if (this._el === el) this._showError(el, `Failed to render the XY section view (${e.message}).`);
    });
  }

  async _mount(el) {
    if (!this._pickCandidate()) return;
    injectPluginCss(el.ownerDocument);
    const loaded = await this._loadConfig();
    if (this._el !== el) return; // destroyed (or re-rendered) while loading
    loaded.warnings.forEach(w => console.warn(`${LOG_PREFIX} ${w}`));

    const doc = el.ownerDocument;
    const root = doc.createElement('div');
    root.className = 'xys-root';
    el.appendChild(root);
    this._root = root;

    const model = buildSectionModel(this._data, loaded);
    this._model = model;
    if (!model.levels.length) {
      const message = doc.createElement('div');
      message.className = 'xys-message';
      message.textContent = 'No floor levels with a section height were found using this block\'s configuration.';
      root.appendChild(message);
      return;
    }

    this._view = new SectionView(root, {
      model,
      xySection: loaded.xySection,
      actions: {
        toggleFullscreen: () => this._toggleFullscreen(),
        isFullscreen: () => this._isFullscreen(),
        download: (fileName, svgText) => this._download(fileName, svgText),
      },
    });
    this._watchLayout(root);
  }

  _isFullscreen() {
    return !!this._root && this._root.ownerDocument.fullscreenElement === this._root;
  }

  _toggleFullscreen() {
    const doc = this._root?.ownerDocument;
    if (this._isFullscreen()) doc?.exitFullscreen?.();
    else this._root?.requestFullscreen?.();
  }

  // Saves `svgText` as a file through a temporary object-URL link.
  _download(fileName, svgText) {
    const doc = this._root?.ownerDocument;
    const url = globalThis.URL?.createObjectURL?.(new Blob([svgText], { type: 'image/svg+xml' }));
    if (!doc || !url) return;
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // Compact vs expanded layout follows the root's size (the host's own expand dialog resizes it
  // just like fullscreen does); fullscreen changes also update the fullscreen button.
  _watchLayout(root) {
    const update = () => {
      if (this._root === root) this._view?.applyViewMode();
    };
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(update);
      this._resizeObserver.observe(root);
    }
    this._fullscreenHandler = update;
    root.ownerDocument.addEventListener('fullscreenchange', update);
  }

  _showError(el, message) {
    this.destroy(el);
    const doc = el.ownerDocument;
    const banner = doc.createElement('div');
    banner.className = 'xys-error';
    banner.setAttribute('role', 'alert');
    const messageEl = doc.createElement('div');
    messageEl.textContent = message;
    const hintEl = doc.createElement('div');
    hintEl.className = 'xys-error-hint';
    hintEl.textContent = 'See the browser console for details.';
    banner.append(messageEl, hintEl);
    el.appendChild(banner);
  }

  // Safe to call at any point: before render(), mid-load, after a failure, or twice.
  destroy(el) {
    this._el = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    const doc = this._root?.ownerDocument ?? el?.ownerDocument;
    if (this._fullscreenHandler) doc?.removeEventListener('fullscreenchange', this._fullscreenHandler);
    this._fullscreenHandler = null;
    if (this._isFullscreen()) doc?.exitFullscreen?.();
    this._view?.destroy();
    this._view = null;
    this._model = null;
    this._root?.remove();
    this._root = null;
    el?.replaceChildren?.();
  }
}
