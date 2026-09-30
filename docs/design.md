# Design notes

This repository is both an OGC Building Blocks register (`_sources/`) and the home of a
[bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer) **view plugin** (`src/`) that
renders [topo-feature](https://github.com/ogcincubator/topo-feature) topology documents as
horizontal (XY) sections, one per floor level, in a tabbed SVG/HTML view. It is a sibling of the
Three.js `TopoFeaturePlugin` in
[bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin)
and of [bblocks-cesium-viewer](https://github.com/ogcincubator/bblocks-cesium-viewer), and is added
to other registers the same way. This page records why things are the way they are; the
[README](../README.md) covers how to use and develop them.

The plugin replaces the Python/OpenCascade `section_topology.py` from waTestData. That module is
treated as a specification, not a reference implementation: it predates the current topo-feature
encoding (faces referencing rings through `topology.rings` rather than
`topology.directed_references`).

## Decisions

### Coordinates

Each point feature's `place` — projected horizontal coordinates (CRS named by the document's
`horizontalCRS`) and a height on the datum named by `verticalCRS` — is used as-is. There is no
proj4 and no geoid model, and WGS84 `geometry` is never read. Higher-order features (edges, rings,
faces, shells, solids, parcels — all `geometry: null`) are assembled from the points they
reference, faces through `topology.directed_references`. `bearingRotation` is displayed, not
applied.

A document matches — gets an **XY Section** tab — only if it is a topo-feature document, at least
one point carries a numeric 3D `place`, and at least one floor level with a section height is
found. `matches()` is synchronous and runs before any per-block configuration is fetched, so it
always uses the built-in level options: a block's `levelProperty` or `exclude` changes what is
drawn, not whether the tab appears.

Topology is resolved in `src/js/utils/topology.js` (adapted from the Three.js plugin by way of
the Cesium plugin). A point with no usable `place` is left out, and anything referencing it is
skipped. A 2D `place` (as on the 4-unit fixture's parcel points) gives a vertex with no Z — fine
for an outline, ignored for heights. Besides edge rings, a `Ring`-topology feature may reference
rings (the built-strata former-tenure parcel does), and then resolves like a face. `Polygon`
parcels list an unordered bag of edges per ring, which is walked into order. `AggregateSolid`
parcels have no outline of their own and resolve to nothing.

### Floor levels and section heights

`src/js/utils/levels.js`. Levels come from `properties.floors` on solids (path configurable,
array or single number); a solid listed on several floors appears on each. Each level is cut at
the mid-height of the Z range of the solids listed on that level alone — the rule from
`section_topology.py` — or at a configured per-level height. A level with neither (only
multi-floor solids, no override) is left out.

Solids referenced by `occupationFeatures[].properties.geometryRef` (walls, slabs, ceilings) are
excluded from sections, from the level list and from the height calculation, via the default
`exclude` entry `{ source: "occupationFeatures", property: "properties.geometryRef" }`. On the
built-strata fixture this removes 9 of 18 solids and moves level 2 from 26.015 m to 26.090 m.

### Sectioning

`src/js/utils/section.js` replaces the Python module's OpenCascade solid building and
`BRepAlgoAPI_Section`; there is no geometry kernel. Every face is planar, so a solid's section is
the union of its faces' sections. A face (outer ring plus holes) meets the plane Z = z along one
straight line — direction normal × ẑ, the normal by Newell's method — and the parts of that line
inside the face are found by sorting the ring crossings along it and pairing them even-odd, which
handles holes (windows, courtyard voids) with no special case. The segments of all a solid's
faces are then chained into closed loops, dropping vertices where coplanar faces meet, and any
leftover open polylines. The sections are drawn from the loops with `fill-rule="evenodd"`, so a
loop inside another is a hole.

- **On-plane vertices**: a half-open rule (z ≥ plane counts as above). A ring crossing the plane at
  a vertex counts it once; a ring only touching it yields nothing; a plane exactly at a floor/ceiling
  boundary cuts the solid below it, not the one above.
- **Shared edges**: an edge's crossing is interpolated from its endpoints in a canonical order, so
  the two faces either side of it produce bit-identical points; chaining still merges endpoints
  within 1 µm.
- **Skipped**: a face with any 2D vertex, and a warped (non-planar) face whose overall normal is
  vertical — its crossings cannot be ordered along a line.
- **Checked against the data**: every non-excluded solid in both fixtures closes into loops at its
  level's height, with no open polylines. For the prism-shaped solids, section area × height matches
  the fixture's own recorded `volume` to within 0.03% (1% for one courtyard with a sloping floor). The
  4-unit stairwell's two floor sections × 3 m sum to its volume. Walls in the 4-unit fixture lean
  by up to 1 mm, so section corners can sit 0.5 mm from the floor corners.

### Rule engine

Which features are drawn, and how, is decided by the Three.js plugin's rule engine, **copied**
rather than depended on — that plugin is not published as a package, and this view must be able to
ship on its own schedule. `rules.js`, `curie.js`, `config.js`, `resolve-config.js` and
`default-config.js` (with their tests) and `mime-type-match.js` were copied from
bblocks-viewer-topo-feature-plugin (branch `refactor/parameterised-viewer`, commit `d94018b`) into
`src/js/utils/`, unchanged apart from a two-line provenance header. Later upstream fixes are
ported by hand. XY-specific behaviour (role lookup, `xySection` options, how each rule `geometry`
maps to a 2D section) lives in this plugin's own modules, so the copies stay unchanged.

### Per-block configuration

A block configures its XY Section view through the same `bblock.json` `resources` mechanism as
the Three.js and Cesium plugins, delivered to the plugin as `context.bblock.resources`, under the
role `https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config`
(`src/js/utils/load-config.js`, adapted from the Cesium plugin's). A block that only has a
Three.js view configuration (that plugin's role) gets the same rules in its sections, so existing
configurations need no duplication; an XY-specific resource wins when both exist.

The rule configuration (`rules`, `defaults`, `kindOrder`) is unchanged; a rule's `elevation` is
ignored. XY-only options live under a top-level `xySection` key, which the copied rule parser
ignores (`src/js/utils/xy-options.js`):

| Option | Default | Meaning |
|---|---|---|
| `levelProperty` | `"properties.floors"` | Dot-path on each solid giving its level number(s) |
| `levelLabels` | `{}` | Tab label per level, e.g. `{ "1": "Ground floor" }`; otherwise `Level <n>` |
| `sectionZ` | `{}` | Section height per level, overriding the mid-height rule |
| `showContext` | `false` | Whether lower levels start out drawn, faded, under each section |
| `padding` | `2` | Metres of margin around the drawing |
| `grid` | `true` | `true` (automatic spacing), `false`, or a spacing in metres |
| `boundary` | `[{ "source": "parcels" }]` | Ordered boundary-parcel choices (below); `[]` for none |
| `exclude` | occupation features | Solids never sectioned (`{ source, property }` entries); `[]` for none |

Nothing in a configuration can break the view: an unreachable or invalid file, or an invalid
option, falls back to the defaults with a console warning, one invalid entry at a time where the
option is a list or map. An explicit empty `boundary` or `exclude` list means "none"; a list whose entries are all invalid falls back to the default instead.

Without a block configuration the built-in rules (`src/js/utils/xy-default-config.js`) section
solids and open shells ("surfaces") and draw no parcels, since the boundary parcel is drawn
separately. No built-in rule fixes a colour, so each feature gets its own palette colour, as in
`section_topology.py`. The JSON Schema for the whole configuration is the `xySectionViewerConfig`
building block.

### Parcel boundary

Every section is drawn inside one boundary parcel, chosen by `src/js/utils/boundary.js` from the
ordered `xySection.boundary` entries: the first entry that yields an outline wins, and within an
entry the first matching feature in document order. An entry names a `source` collection and
optionally a `match` (compared like a rule's: literal, CURIE or full URI). With
`follow: { "role": … }`, the matched feature is not drawn itself: its `topology.relationships`
entry with that role is followed to the feature its `href` names. Outlines come from the
feature's topology type — `Polygon`, `Ring` or `Face`; an `AggregateSolid` or `ParcelAggregate`
has none.

The built-in default is the first parcel with an outline. The WA configuration
(`harness/fixtures/wa-strata-config.json`, and the demo blocks) prefers the strata-scheme
parcel's `containingPrimaryParcel`, then a `former-tenure` parcel, then any parcel with an
outline. On the built-strata fixture the first entry resolves (to the former-tenure lot, via the
scheme); on the 4-unit fixture only the third does (its `created` lot `Polygon`). A strata-scheme
parcel has no outline of its own: it aggregates the strata lots (`AggregateSolid`).

### User interface

Plain DOM, CSS and SVG (`src/js/ui/`, `src/css/`), with no host framework: a plugin runs outside
the viewer's component tree. The CSS is bundled into `dist/index.js` through a static `?raw`
import; the Node test runner resolves those through `scripts/test-raw-loader.mjs` (copied from the
Cesium plugin). The code is layered so almost all of it is testable without a DOM:

- `src/js/xy-scene.js` — the model: levels, one record per feature the rules claim, the boundary,
  colours, and each level's sections, computed the first time that level is asked for and cached.
- `src/js/svg-render.js` — one level as SVG markup, a pure function. The view re-renders a floor
  when a toggle changes; "Download SVG" saves the same markup as a standalone file.
- `src/js/ui/section-view.js` — the DOM: tabs, toolbar, layers panel, caption, pan/zoom.

**How rules map to the drawing.** A rule's `geometry` `solid`, `open-shell` or `face` is sectioned
at each level's height (a face gives lines); `polygon` or `ring` is drawn flat, as an outline, on
every level; anything else is ignored. A section feature no level's height cuts is left out
altogether. A rule with no `label` of its own gets the built-in label chain (appellation,
description, name) instead of the rule engine's bare-id fallback.

**Tabs.** The host gives the plugin one tab ("XY Section"); inside it is a tab component with one
tab per floor, following the WAI-ARIA tabs pattern (`role="tablist"`/`tab`/`tabpanel`, arrow keys
wrap, Home/End, automatic activation). A floor's SVG is built the first time its tab is opened.
All floors share one pan/zoom view, so switching floors keeps the same area in view.

**Drawing.** Coordinates are converted to a local frame in metres (x east from the drawing's west
edge, y south from its north edge) to keep SVG numbers small. Grid north is up; the grid falls on
whole multiples of its spacing in easting/northing. Layers, bottom to top: grid, lower floors
(context: every lower level, outlines only at 40% opacity), flat outlines, this floor's sections
(`fill-rule="evenodd"`, so holes show), the dashed boundary parcel, labels. Lower floors start
hidden (`showContext: false`) and the toolbar toggles them. Strokes use
`vector-effect="non-scaling-stroke"`, so line widths stay constant while zooming; labels are
sized in drawing units (1/70 of the drawing) and scale with it — readable once zoomed in on a
large lot.

**Colour.** The dataviz skill's validated 8-hue categorical palette, in its fixed order. Colour
follows the feature: each takes the first slot not used by an earlier feature sharing any floor
with it, so no two features on one floor share a colour (up to 8), and a feature spanning floors
(the 4-unit stairwell) keeps its colour on each. A rule's own `style.color` wins; colours from a
config are checked against a safe pattern before they reach SVG attributes. Identity never rests
on colour alone: every feature has a tooltip, a legend row and (by default) a label. The drawing
has its own light surface, like a plan sheet, whatever the host's theme.

**Controls.** Toolbar: zoom in/out, fit (also double-click), lower floors, labels, layers,
download, fullscreen. Wheel zooms about the pointer; dragging pans; the caption shows the level's
section height and datum, the horizontal CRS, grid spacing, the (unapplied) bearing rotation, and
the easting/northing under the pointer. The layers panel lists the boundary, then every feature
by rule group (and kind, when a group has several) with select-all checkboxes; features not on
the current floor are dimmed. As in the Cesium and Three.js plugins, layout follows the space the
host gives the view: at 400 px or taller (the host's expand dialog, or fullscreen) the layers
panel is docked beside the drawing; in the compact ~300 px tab it is a pop-over behind the layers
button, and the toolbar wraps into two columns.

**Robustness.** Every string from the document is XML-escaped before it reaches markup. Config
loading is async, so render failures are caught and shown in the tab (with details in the
console) rather than thrown; `destroy()` is safe at any point, including while the config is
still loading.

### The register

_To be written (Stage 7)._ Declares its own plugin under `viewer.view-plugins`; demo blocks carry
topo-feature examples so the XY Section tab appears in this register.

## Verified integration behaviour

_To be confirmed in Stage 8._
