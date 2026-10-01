# XY section viewer for topo-feature documents

An **XY Section** view for topo-feature topology documents in the Building Blocks viewer — one horizontal section (plan view) per floor level — the JSON Schema for its per-block configuration, and demo blocks that use it.


The `XYSectionPlugin` is a [bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer) view plugin.
It adds an **XY Section** tab to any example or transform output that is a [topo-feature](https://github.com/ogcincubator/topo-feature) document whose points carry projected `place` coordinates and whose solids carry floor levels.
Inside the tab there is one tab per floor, each showing the solids cut at that floor's height, drawn from `place` exactly as surveyed (no coordinate transformation), inside a chosen boundary parcel.
Which features are drawn and how is set by rules shared with the Three.js topology view ([bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin)) and the [Cesium globe view](https://github.com/ogcincubator/bblocks-cesium-viewer), optionally configured per block; see the *XY section viewer configuration* block.
This register declares the plugin itself, so the demo blocks' examples open in the XY Section tab here.
Source, harness and instructions for adding the plugin to another register: [bblocks-xy-section-viewer](https://github.com/andrewhunter2066/bblocks-xy-section-viewer).


## Building Blocks

### `ogc.bbr.xysection.xySectionViewerConfig` — XY section viewer configuration

**Type:** schema

Per-block configuration for the bblocks-viewer XY Section view of topo-feature documents: which features are drawn and how (rules shared with the Three.js and globe views), plus floor levels, section heights, the boundary parcel and excluded solids.

### `ogc.bbr.xysection.xySectionViewerDemo.builtStrata` — XY Section demo: built strata

**Type:** schema

A Western Australian built-strata survey (strata plan SP83687) as a topo-feature document — two floors of units and courtyards with walls, slabs and ceiling as occupation features — shown as one plan section per floor with WA level names and the former-tenure lot as the boundary.

### `ogc.bbr.xysection.xySectionViewerDemo.fourUnit` — XY Section demo: four units with a stairwell

**Type:** schema

A small test survey — four units on two floors with a stairwell spanning both, inside a lot parcel — shown as one plan section per floor, with rules that single out the stairwell and draw the lot as an outline.

