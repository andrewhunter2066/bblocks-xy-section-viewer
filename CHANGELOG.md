# Changelog

## 0.1.0 — 2026-09-30

First version, developed on `feature/xy-viewer` from the OGC building-block template, adapting waTestData's Python/OpenCascade `section_topology.py` into a bblocks-viewer view plugin.

### Plugin (`XYSectionPlugin`)

- **Detection**: matches a topo-feature document with at least one numeric 3D `place` point and at least one floor level; GeoJSON (WGS84) `geometry` element is never read.
- **Topology** from `place` coordinates only: directed references, faces with holes, nested and open shells, `Ring` parcels referencing rings or edges, `Polygon` parcels as unordered edges.
- **Levels** from `properties.floors` (configurable); each cut at the mid-height of the solids on that level alone, or a configured height.
  Solids named by `occupationFeatures` (walls, slabs, ceilings) are excluded by default.
- **Sectioning** without a geometry kernel: planar-face/plane intersection with even-odd pairing and a half-open rule for on-plane vertices, chained into loops.
  Checked against the fixtures' own recorded volumes.
- **Boundary parcel** chosen by an ordered, configurable list, including following `topology.relationships` (e.g. a strata scheme's containing primary parcel).
- **View**: one tab per floor (WAI-ARIA tabs), each floor's SVG built on first open; zoom, pan, fit, lower-floor context (off by default), labels, layers panel with group/kind/feature toggles, SVG download, fullscreen, easting/northing readout; compact and expanded layouts; a fixed 8-hue palette in which no two features on a floor share a colour.
- **Per-block configuration** through `bblock.json` `resources` (role `https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config`, falling back to the Three.js plugin's role), with XY options under `xySection`.
  Never throws; invalid input falls back with console warnings.
- **Rule engine** copied from bblocks-viewer-topo-feature-plugin@`d94018b` (`refactor/parameterised-viewer`) with provenance headers.

### Register

- `identifier-prefix: ogc.bbr.xysection.`; declares its own view plugin.
- `xySectionViewerConfig` — JSON Schema for the configuration, with examples and pass/fail tests.
- Demo blocks `xySectionViewerDemo/builtStrata` (strata plan SP83687, WA configuration) and `xySectionViewerDemo/fourUnit` (4-unit survey, styled rules).
- Template blocks `myFeature` and `mySchema` removed.

### Development

- Dev harness (`npm run dev`) with fixture, file, URL and config pickers, Three.js-role fallback, tab size and bookmarkable state.
- `npm run local-register` to test the local build in the real viewer (`./build.sh`, `./view.sh`).
- 251 unit tests (`npm test`), including tests that keep the schema and code in step.
- CI (`ci.yml`) and publishing of `dist/` to the `dist` branch for jsDelivr (`publish-dist.yml`).

### Found in the real viewer

- bblocks-viewer does not preview, or pass to view plugins, examples over 1 MiB; the built-strata fixture is re-indented (content unchanged) to fit, and a test keeps demo examples under the limit.
- The host page's `letter-spacing` leaked into SVG labels; the plugin now resets text spacing.
