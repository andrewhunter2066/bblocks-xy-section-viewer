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

_To be written (Stage 4)._ `resources[]` role
`https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config`, falling back to
the Three.js plugin's role. XY-only options live under a top-level `xySection` key (`levelProperty`,
`levelLabels`, `sectionZ`, `showContext`, `padding`, `grid`, `boundary`, `exclude`). The JSON
Schema is the `xySectionViewerConfig` building block.

### Parcel boundary

_To be written (Stage 4)._ Every section shows one boundary parcel, chosen by the ordered
`xySection.boundary` match list (first parcel with an outline wins). Built-in default: the first
`Polygon`/`Ring` parcel. The WA demo configurations prefer the strata-scheme parcel's
`containingPrimaryParcel`, then a `former-tenure` parcel, then any lot outline. `AggregateSolid`
parcels are not drawn.

### User interface

_To be written (Stage 5)._ Plain DOM and SVG. One host tab containing an ARIA tab component: one
tab per floor, each panel holding that floor's section (built on first open). Lower floors are
hidden initially and can be toggled on as faded context.

### The register

_To be written (Stage 7)._ Declares its own plugin under `viewer.view-plugins`; demo blocks carry
topo-feature examples so the XY Section tab appears in this register.

## Verified integration behaviour

_To be confirmed in Stage 8._
