# Harness fixtures

Real topo-feature documents, with their content unchanged (the plugin reads each point's projected
`place`; their WGS84 `geometry` is never used). `built-strata-example-1.json` is re-indented with
one space instead of two — 898 KB instead of 1.1 MB — because bblocks-viewer does not preview, or
hand to view plugins, an example over 1 MiB; its parsed content is identical to the source file.
`block-schema.test.js` keeps both demo examples under that limit. Both are also used by the unit tests
(`src/js/test-support/fixtures.js`).

| File | Source | Notes |
|---|---|---|
| `built-strata-example-1.json` | `3d-csdm-profile-wa` `proposals/development/built-strata/examples/example-1.json` @ `319a965` | Strata plan SP83687: 18 solids on floors 1–2, 9 of them `occupationFeatures` geometry (walls, slabs, ceiling), 9 faces with holes; parcels: former-tenure `Ring` lot, strata-scheme `ParcelAggregate`, two `AggregateSolid` strata lots. `horizontalCRS` `epsg:7850`, `verticalCRS` `epsg:5711`. |
| `4-unit-up-down-with-parcel.json` | `waTestData` `data/output/4-unit-up-down-with-parcel.json` @ `1bfe46a` | 5 solids on floors 1–2 (the stairwell spans both); one `Polygon` lot parcel whose 19 boundary points have a 2D `place`. |

Hand-made fixture:

- `geometry-only-box.json` — one box solid on floor 1 whose points carry only WGS84 `geometry`,
  no projected `place`: the harness's **no-match** case. Generated with
  `src/js/test-support/topo-builder.js`.

`built-strata-example-1.json` and `4-unit-up-down-with-parcel.json` are also the examples of the
register's demo blocks (`_sources/xySectionViewerDemo/builtStrata` and `…/fourUnit`), by `ref`.

The sample viewer configurations live in the register, not here: each demo block's
`viewer-config.json` (WA strata for the built-strata fixture; styled rules for the 4-unit fixture)
and the `xySectionViewerConfig` block's examples. The harness offers them all and applies a
fixture's demo config automatically; the lists are in `harness/js/catalog.js`, and
`src/js/harness-catalog.test.js` checks each listed file exists, matches (or not) as listed, and
each config loads without warnings.

Expected section heights (mid-height of the non-excluded solids on each level alone), computed
independently of the plugin:

| File | Level 1 | Level 2 |
|---|---|---|
| `built-strata-example-1.json` | 22.3838795 m | 26.08983 m |
| `4-unit-up-down-with-parcel.json` | 21.5 m | 24.5 m |
