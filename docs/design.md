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
one point carries a numeric 3D `place`, and at least one floor level is found.

### Floor levels and section heights

_To be written (Stage 2)._ Levels come from `properties.floors` on solids (path configurable);
a solid listed on several floors appears on each. Each level is cut at the mid-height of the
solids exclusively on that level (overridable per level). Solids referenced by
`occupationFeatures[].properties.geometryRef` are excluded from sections, from the level list and
from the height calculation (configurable via `xySection.exclude`).

### Sectioning

_To be written (Stage 3)._ All faces are planar, so cutting a solid at Z reduces to intersecting
each face polygon with the plane and chaining the segments into loops — no geometry kernel.

### Rule engine

_To be written (Stage 1)._ Copied, not depended on, from bblocks-viewer-topo-feature-plugin
(branch `refactor/parameterised-viewer`, commit `d94018b`), with provenance headers.

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
