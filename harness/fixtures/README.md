# Harness fixtures

Real topo-feature documents, copied unchanged (the plugin reads each point's projected `place`;
their WGS84 `geometry` is never used). Both are also used by the unit tests
(`src/js/test-support/fixtures.js`).

| File | Source | Notes |
|---|---|---|
| `built-strata-example-1.json` | `3d-csdm-profile-wa` `proposals/development/built-strata/examples/example-1.json` @ `319a965` | Strata plan SP83687: 18 solids on floors 1–2, 9 of them `occupationFeatures` geometry (walls, slabs, ceiling), 9 faces with holes; parcels: former-tenure `Ring` lot, strata-scheme `ParcelAggregate`, two `AggregateSolid` strata lots. `horizontalCRS` `epsg:7850`, `verticalCRS` `epsg:5711`. |
| `4-unit-up-down-with-parcel.json` | `waTestData` `data/output/4-unit-up-down-with-parcel.json` @ `1bfe46a` | 5 solids on floors 1–2 (the stairwell spans both); one `Polygon` lot parcel whose 19 boundary points have a 2D `place`. |

Expected section heights (mid-height of the non-excluded solids on each level alone), computed
independently of the plugin:

| File | Level 1 | Level 2 |
|---|---|---|
| `built-strata-example-1.json` | 22.3838795 m | 26.08983 m |
| `4-unit-up-down-with-parcel.json` | 21.5 m | 24.5 m |
