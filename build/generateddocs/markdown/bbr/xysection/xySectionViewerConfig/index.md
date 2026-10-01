
# XY section viewer configuration (Schema)

`ogc.bbr.xysection.xySectionViewerConfig` *v0.1*

Per-block configuration for the bblocks-viewer XY Section view of topo-feature documents: which features are drawn and how (rules shared with the Three.js and globe views), plus floor levels, section heights, the boundary parcel and excluded solids.

[*Status*](http://www.opengis.net/def/status): Under development

## Description

The **XY Section** view (`XYSectionPlugin`) draws [topo-feature](https://github.com/ogcincubator/topo-feature) documents as horizontal sections — plan views — one per floor level, in a tab of the Building Blocks viewer.
Each point is placed by its projected `place` coordinates (the document's `horizontalCRS`; heights on its `verticalCRS`), and edges, rings, faces, shells, solids and parcels are assembled from their topology references.
No coordinates are transformed.
This block is the JSON Schema for the optional per-block configuration that tunes that view.

The view appears for a document that is a topo-feature document, has at least one point with a 3D `place`, and has at least one floor level (by default from each solid's `properties.floors`).

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

A block that already has a configuration for the Three.js topology view (role `https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config`) gets the same rules in its sections; an XY-specific resource takes precedence when both are present.
See the [demo blocks](bblocks://ogc.bbr.xysection.xySectionViewerDemo.builtStrata) for complete examples.

## Rules

`rules` is an ordered list, shared with the Three.js and globe views.
For each feature in a rule's `source` collection (`solids`, `parcels`, `faces`, `rings`, …, or the derived `surfaces` — shells that no solid uses) the first rule whose `match` applies decides how it is drawn:

| Member | Meaning |
|---|---|
| `kind`, `group`, `kindLabel` | How the feature is listed in the view's layers panel. Rules sharing a `group` appear under one heading, with a sub-list per `kind`. |
| `geometry` | `solid`, `open-shell` and `face` are cut at each floor's height; `polygon` (a Polygon-topology parcel) and `ring` are drawn flat, as outlines, on every floor. |
| `match` | `{ "property": "properties.x", "values": [...] }`. String values may be literals, CURIEs (expanded against the document's own `@context`) or full URIs; numbers compare as numbers. |
| `label` | Property paths to take the feature's label from, with a `fallback`. Omitted: appellation, description, then name. |
| `style` | `color` and `opacity` of the fill; `lineColor` and `lineStyle` (`solid` / `dashed`) of the outline. Without `color`, each feature gets its own colour from a fixed palette, never shared by two features on one floor. |
| `initiallyVisible` | `false` hides the feature until it is ticked in the layers panel. |
| `elevation` | Used by the 3D and globe views; ignored here. |

A feature no rule claims is not drawn.
A non-empty `rules` list replaces the view's built-in rules (solids and open shells sectioned; parcels only as the boundary).

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

Nothing in a configuration can break the view: an unreachable or invalid file, or an invalid option, falls back to the defaults with a warning in the browser console.

## Examples

### WA built strata
Western Australian level names, and the WA boundary order: the strata scheme's containing primary parcel, else a former-tenure parcel, else any parcel with an outline.
Walls, slabs and ceilings (the geometry of `occupationFeatures`) are excluded, as by default.
The built-in rules still apply.
This is the configuration of the [built strata demo block](bblocks://ogc.bbr.xysection.xySectionViewerDemo.builtStrata).

#### json
```json
{
  "xySection": {
    "levelLabels": { "1": "Ground floor", "2": "First floor" },
    "boundary": [
      {
        "source": "parcels",
        "match": { "property": "properties.parcelPurpose", "values": ["wa-parcel-purpose:strata-scheme"] },
        "follow": { "role": "containingPrimaryParcel" }
      },
      {
        "source": "parcels",
        "match": { "property": "properties.parcelState", "values": ["wa-parcel-state:former-tenure"] }
      },
      { "source": "parcels" }
    ],
    "exclude": [
      { "source": "occupationFeatures", "property": "properties.geometryRef" }
    ]
  }
}

```


### Styled rules
Rules as well as options: the stairwell as its own dashed kind with a fixed colour, other solids as units, and lot parcels drawn flat as outlines on every floor, initially hidden.
Floors are labelled Lower and Upper, lower floors show from the start, the grid is 5 m and no boundary is drawn.
This is the configuration of the [four units demo block](bblocks://ogc.bbr.xysection.xySectionViewerDemo.fourUnit).

#### json
```json
{
  "rules": [
    {
      "source": "solids",
      "kind": "multi-storey",
      "group": "solids",
      "kindLabel": "Multi-storey",
      "geometry": "solid",
      "match": { "property": "properties.name", "values": ["Stairwell"] },
      "style": { "color": "#4a3aa7", "opacity": 0.25, "lineStyle": "dashed" }
    },
    {
      "source": "solids",
      "kind": "unit",
      "group": "solids",
      "kindLabel": "Units",
      "geometry": "solid"
    },
    {
      "source": "parcels",
      "kind": "lot",
      "kindLabel": "Lots",
      "geometry": "polygon",
      "initiallyVisible": false,
      "style": { "color": "#898781", "opacity": 0.08 }
    }
  ],
  "xySection": {
    "levelLabels": { "1": "Lower", "2": "Upper" },
    "showContext": true,
    "grid": 5,
    "padding": 4,
    "boundary": []
  }
}

```


### Level options
Options only, so the built-in rules still apply: named levels, a fixed section height for level 1 instead of its mid-height, lower floors shown from the start, and a 2 m grid.

#### json
```json
{
  "xySection": {
    "levelProperty": "properties.floors",
    "levelLabels": { "1": "Ground", "2": "First" },
    "sectionZ": { "1": 21.2 },
    "showContext": true,
    "grid": 2
  }
}

```


### Every solid, no boundary
Section every solid — including the walls, slabs and ceilings that `occupationFeatures` describe, which are excluded by default — and draw no boundary parcel.

#### json
```json
{
  "xySection": {
    "exclude": [],
    "boundary": []
  }
}

```

## Schema

```yaml
$schema: https://json-schema.org/draft/2020-12/schema
title: XY section viewer configuration
description: 'Per-block configuration for the XYSectionPlugin, the bblocks-viewer
  "XY Section" view of topo-feature documents (one horizontal section per floor level).

  A block declares it as a `resources` entry in its `bblock.json` with the role `https://github.com/ogcincubator/bblocks-xy-section-viewer/role/viewer-config`.


  `rules`, `defaults` and `kindOrder` are the rule-engine configuration shared with
  the Three.js TopoFeaturePlugin and the Cesium globe view, so a configuration written
  for either validates here; `xySection` holds the section-only options.

  Every member is optional: an omitted `rules` keeps the plugin''s built-in rules
  (solids and open shells sectioned, no parcels).

  '
type: object
additionalProperties: false
properties:
  rules:
    description: 'Ordered rules.

      For each feature, the first rule whose `source` is the collection it came from
      and whose `match` (if any) applies decides how it is drawn; a feature no rule
      claims is not drawn.

      A non-empty list replaces the built-in rules entirely.

      '
    type: array
    items:
      $ref: '#/$defs/rule'
  defaults:
    description: Defaults merged under every rule; `style` is merged key by key.
    type: object
    additionalProperties: false
    properties:
      style:
        $ref: '#/$defs/style'
      elevation:
        $ref: '#/$defs/elevation'
  kindOrder:
    description: Preferred order of kinds, for viewers that list them.
    type: array
    items:
      type: string
  xySection:
    $ref: '#/$defs/xySectionOptions'
$defs:
  rule:
    type: object
    additionalProperties: false
    required:
    - source
    - kind
    - geometry
    properties:
      source:
        description: 'Top-level collection of the document to classify, e.g. `solids`,
          `parcels`, `faces`, `rings`, or the derived `surfaces` (shells no solid
          uses).

          '
        type: string
        minLength: 1
      kind:
        description: Identifier grouping this rule's features, e.g. `unit`.
        type: string
        minLength: 1
      group:
        description: Groups several kinds under one heading and select-all. Defaults
          to `kind`.
        type: string
        minLength: 1
      kindLabel:
        description: Human-readable name for this kind, e.g. `Principal units`.
        type: string
      geometry:
        description: 'How the feature''s topology is turned into a shape.

          `solid`, `open-shell` and `face` are sectioned at each floor''s height;
          `polygon` (a Polygon-topology parcel) and `ring` are drawn flat, as outlines,
          on every floor.

          '
        enum:
        - solid
        - open-shell
        - polygon
        - face
        - ring
      match:
        $ref: '#/$defs/match'
      label:
        description: 'Where a feature''s label comes from: the first of `properties`
          (dot-separated paths) that resolves to a non-empty value or to an object
          with a string `label`, else `fallback` (default `id`).

          Omitted, the view uses appellation, description, then name.

          '
        type: object
        additionalProperties: false
        properties:
          properties:
            type: array
            items:
              type: string
          fallback:
            type: string
      style:
        $ref: '#/$defs/style'
      initiallyVisible:
        description: Whether the feature is shown when the view opens. Default true.
        type: boolean
      elevation:
        $ref: '#/$defs/elevation'
  match:
    description: 'Restricts to features whose property value (or any value, for an
      array) equals one of `values`.

      String values may be literals, CURIEs expanded against the document''s own `@context`,
      or full URIs; both sides are expanded before comparing.

      Numbers and booleans compare as themselves (e.g. `properties.floors` values).

      '
    type: object
    additionalProperties: false
    required:
    - property
    - values
    properties:
      property:
        description: Dot-separated path into the feature, e.g. `properties.parcelState`.
        type: string
        minLength: 1
      values:
        type: array
        minItems: 1
        items:
          type:
          - string
          - number
          - boolean
  style:
    type: object
    additionalProperties: false
    properties:
      color:
        description: 'Fill and outline colour: `#hex`, a CSS colour name, or `rgb()`/`hsl()`
          notation.

          Default: each feature its own colour from a fixed palette.

          '
        type: string
      opacity:
        description: Fill opacity, 0 (transparent) to 1 (opaque). Default 0.45 for
          sections.
        type: number
        minimum: 0
        maximum: 1
      lineColor:
        description: Outline colour, as for `color`. Default the fill colour.
        type: string
      lineStyle:
        enum:
        - solid
        - dashed
  elevation:
    description: 'Used by the 3D and globe views; ignored by the XY Section view,
      which always sections at each floor''s height.

      Accepted so that shared configurations validate.

      '
    oneOf:
    - enum:
      - preserve
      - flatten
    - type: object
      additionalProperties: false
      required:
      - flattenTo
      properties:
        flattenTo:
          type: number
  levelKey:
    description: A level number, as an object key, e.g. `"1"` or `"-1"`.
    type: string
    pattern: ^-?[0-9]+(\.[0-9]+)?$
  xySectionOptions:
    description: Section-only options. Every member is optional.
    type: object
    additionalProperties: false
    properties:
      levelProperty:
        description: "Dot-separated path on each solid giving the floor level number(s)
          it is on \u2014 a number or an array of numbers.\nDefault `properties.floors`.\n"
        type: string
        minLength: 1
      levelLabels:
        description: 'Tab label per level, e.g. `{ "1": "Ground floor" }`. Default
          `Level <n>`.'
        type: object
        propertyNames:
          $ref: '#/$defs/levelKey'
        additionalProperties:
          type: string
          minLength: 1
      sectionZ:
        description: 'Section height in metres per level, on the document''s vertical
          datum.

          Default: the mid-height of the solids listed on that level alone.

          '
        type: object
        propertyNames:
          $ref: '#/$defs/levelKey'
        additionalProperties:
          type: number
      showContext:
        description: Whether lower floors are drawn, faded, under each section when
          the view opens. Default false.
        type: boolean
      padding:
        description: Metres of margin around the drawing. Default 2.
        type: number
        minimum: 0
      grid:
        description: '`true` (default, automatic spacing), `false` (no grid), or a
          spacing in metres.'
        oneOf:
        - type: boolean
        - type: number
          exclusiveMinimum: 0
      boundary:
        description: 'Ordered choices for the one boundary parcel drawn on every floor;
          the first entry that yields an outline wins.

          Default `[{ "source": "parcels" }]` (the first parcel with an outline);
          `[]` draws no boundary.

          '
        type: array
        items:
          $ref: '#/$defs/boundaryEntry'
      exclude:
        description: 'Solids never sectioned: every feature of `source` excludes the
          solid(s) whose id is the value at `property`.

          Default: the geometry of every `occupationFeatures` item (walls, slabs,
          ceilings); `[]` excludes nothing.

          '
        type: array
        items:
          type: object
          additionalProperties: false
          required:
          - source
          - property
          properties:
            source:
              type: string
              minLength: 1
            property:
              type: string
              minLength: 1
  boundaryEntry:
    type: object
    additionalProperties: false
    properties:
      source:
        description: Collection to choose from. Default `parcels`.
        type: string
        minLength: 1
      match:
        $ref: '#/$defs/match'
      follow:
        description: 'Instead of drawing the matched feature, follow its `topology.relationships`
          entry with this `role` to the feature its `href` names (in `source`, default
          the same collection), e.g. from a strata scheme to its containing primary
          parcel.

          '
        type: object
        additionalProperties: false
        required:
        - role
        properties:
          role:
            type: string
            minLength: 1
          source:
            type: string
            minLength: 1

```

Links to the schema:

* YAML version: [schema.yaml](https://raw.githubusercontent.com/andrewhunter2066/bblocks-xy-section-viewer/undefined/build/annotated/bbr/xysection/xySectionViewerConfig/schema.json)
* JSON version: [schema.json](https://raw.githubusercontent.com/andrewhunter2066/bblocks-xy-section-viewer/undefined/build/annotated/bbr/xysection/xySectionViewerConfig/schema.yaml)


# For developers

The source code for this Building Block can be found in the following repository:

* URL: [https://github.com/andrewhunter2066/bblocks-xy-section-viewer](https://github.com/andrewhunter2066/bblocks-xy-section-viewer)
* Path: `_sources/xySectionViewerConfig`

