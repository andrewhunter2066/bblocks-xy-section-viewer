The **XY Section** view (`XYSectionPlugin`) draws [topo-feature](https://github.com/ogcincubator/topo-feature)
documents as horizontal sections — plan views — one per floor level, in a tab of the Building
Blocks viewer. Each point is placed by its projected `place` coordinates (the document's
`horizontalCRS`; heights on its `verticalCRS`), and edges, rings, faces, shells, solids and parcels
are assembled from their topology references. No coordinates are transformed. This block is the
JSON Schema for the optional per-block configuration that tunes that view.

The view appears for a document that is a topo-feature document, has at least one point with a 3D
`place`, and has at least one floor level (by default from each solid's `properties.floors`).

## Attaching a configuration to a block

Add a `resources` entry to the block's `bblock.json`, next to its examples:

```json
"resources": [
  {
    "role": "https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config",
    "ref": "viewer-config.json",
    "format": "application/json",
    "title": "XY Section view configuration"
  }
]
```

A block that already has a configuration for the Three.js topology view (role
`https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config`) gets the
same rules in its sections; an XY-specific resource takes precedence when both are present. See the
[demo blocks](bblocks://ogc.bbr.xysection.xySectionViewerDemo.builtStrata) for complete examples.

## Rules

`rules` is an ordered list, shared with the Three.js and globe views. For each feature in a rule's
`source` collection (`solids`, `parcels`, `faces`, `rings`, …, or the derived `surfaces` — shells
that no solid uses) the first rule whose `match` applies decides how it is drawn:

| Member | Meaning |
|---|---|
| `kind`, `group`, `kindLabel` | How the feature is listed in the view's layers panel. Rules sharing a `group` appear under one heading, with a sub-list per `kind`. |
| `geometry` | `solid`, `open-shell` and `face` are cut at each floor's height; `polygon` (a Polygon-topology parcel) and `ring` are drawn flat, as outlines, on every floor. |
| `match` | `{ "property": "properties.x", "values": [...] }`. String values may be literals, CURIEs (expanded against the document's own `@context`) or full URIs; numbers compare as numbers. |
| `label` | Property paths to take the feature's label from, with a `fallback`. Omitted: appellation, description, then name. |
| `style` | `color` and `opacity` of the fill; `lineColor` and `lineStyle` (`solid` / `dashed`) of the outline. Without `color`, each feature gets its own colour from a fixed palette, never shared by two features on one floor. |
| `initiallyVisible` | `false` hides the feature until it is ticked in the layers panel. |
| `elevation` | Used by the 3D and globe views; ignored here. |

A feature no rule claims is not drawn. A non-empty `rules` list replaces the view's built-in rules
(solids and open shells sectioned; parcels only as the boundary).

## Section options (`xySection`)

| Member | Default | Meaning |
|---|---|---|
| `levelProperty` | `"properties.floors"` | Path on each solid to its level number(s). |
| `levelLabels` | `Level <n>` | Tab label per level, e.g. `{ "1": "Ground floor" }`. |
| `sectionZ` | mid-height | Section height per level, in metres on the vertical datum. By default, the mid-height of the solids listed on that level alone. |
| `showContext` | `false` | Draw lower floors, faded, under each section from the start (there is also a toolbar toggle). |
| `padding` | `2` | Metres of margin around the drawing. |
| `grid` | `true` | `true` (automatic spacing), `false`, or a spacing in metres. |
| `boundary` | first parcel with an outline | Ordered choices for the one boundary parcel drawn on every floor: `{ "source", "match", "follow": { "role" } }`. `[]` draws none. |
| `exclude` | `occupationFeatures` geometry | Solids never sectioned: `{ "source", "property" }` naming the solid ids to leave out. `[]` excludes nothing. |

Nothing in a configuration can break the view: an unreachable or invalid file, or an invalid
option, falls back to the defaults with a warning in the browser console.
