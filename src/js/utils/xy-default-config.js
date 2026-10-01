// The plugin's built-in rule config for XY sections, used when a block declares none.
//
// Unlike the Three.js/Cesium default (the copied default-config.js), parcels are not drawn by
// rule here: every section already shows the one boundary parcel chosen by `xySection.boundary`
// (boundary.js), and drawing every parcel again on every floor would stack their outlines. A
// block can still add parcel rules of its own. Faces/rings have no fallback tier either: a
// document with no solids has no levels and never matches (levels.js).
//
// No rule sets a `color`, so the renderer gives each feature its own colour from a palette (as
// section_topology.py did); a block's rule `style.color` fixes one colour for a whole kind.

export const XY_DEFAULT_LABEL = Object.freeze({
  properties: Object.freeze([
    'properties.appellation.label', 'properties.appellation', 'properties.description', 'properties.name',
  ]),
  fallback: 'id',
});

// Section fill opacity; outlines are always drawn solid.
export const XY_DEFAULT_OPACITY = Object.freeze({ solid: 0.45, surface: 1 });

export function buildXYDefaultConfig() {
  return {
    rules: [
      { source: 'solids', kind: 'solid', geometry: 'solid', label: XY_DEFAULT_LABEL, style: { opacity: XY_DEFAULT_OPACITY.solid } },
      { source: 'surfaces', kind: 'surface', geometry: 'open-shell', label: XY_DEFAULT_LABEL, style: { opacity: XY_DEFAULT_OPACITY.surface } },
    ],
  };
}
