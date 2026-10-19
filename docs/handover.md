# Handover checklist

What remains after `feature/xy-viewer` is developed, in order.
Tick items off in the PR or move them to GitHub issues.

## Merge and first publish

- [ ] PR `feature/xy-viewer` **to** `master` reviewed and merged; CI green (`ci.yml`, `pr-check.yml`).
- [ ] After the merge, `process-bblocks.yml` has regenerated `build/` for this register.
      `master` already carries a `build/` from the template's first CI run (`mySchema`/`myFeature` output); confirm none of it survives, and remove it by hand if it does.
- [ ] `publish-dist.yml` has run and the `dist` branch exists; `https://cdn.jsdelivr.net/gh/andrewhunter2066/bblocks-xy-section-viewer@dist/index.js` loads (JavaScript, ~55 kB).
- [ ] GitHub Pages is enabled for the register; the published viewer shows the **XY SECTION** tab on both demo blocks' examples.
- [ ] The demo blocks' configurations load in the **published** register: their `resources[].ref` becomes `<base-url>/_sources/xySectionViewerDemo/<block>/viewer-config.json`.
      Verified locally (`view.sh` serves the whole repository); confirm the published site serves `_sources/` at that URL (the floor tabs read *Ground floor*/*First floor* and *Lower*/*Upper* when it does, *Level 1*/*Level 2* when it does not).
      This is the one integration point not yet proven.
- [ ] Secret scanning and push protection enabled on the repository (nothing secret is used, but the Cesium sibling has them; keep the repositories consistent).

## Move to `ogcincubator`

- [ ] Transfer the repository to `ogcincubator/bblocks-xy-section-viewer`.
- [ ] Update `andrewhunter2066` **to** `ogcincubator` in: `bblocks-config.yaml` (view-plugin URL and the description's source link), `README.md`, `_sources/xySectionViewerConfig/bblock.json` (links), `.github/workflows/publish-dist.yml` (comment).
      The config role URI already uses `ogcincubator` and must not change.
      `scripts/lib/local-register.mjs` matches any owner.
- [ ] Re-run `publish-dist.yml` so the `dist` branch exists at the new location; check the new jsDelivr URL.

## Upkeep

- [ ] Open an issue: port later upstream fixes to the copied rule engine by hand (bblocks-viewer-topo-feature-plugin, from `d94018b` on `refactor/parameterised-viewer`; `src/js/utils/{rules,curie,config,resolve-config,default-config,mime-type-match}.js` and their tests).
      Each file's header names its origin.
- [ ] Tell other registers how to add the plugin (README "Adding the plugin to a register"), including the 1 MiB example limit, and agree a `weight` relative to the Three.js and Globe tabs.
- [x] Fixture permissions: `built-strata-example-1.json` comes from the public `surroundaustralia/3d-csdm-profile-wa` (strata plan SP83687); `4-unit-up-down-with-parcel.json` comes from the private `waTestData` and is published with permission.

## Known limitations (candidate issues)

- Labels of small, adjacent features can overlap; the labels toggle, tooltips and legend remain.
  Possible fix: hide a label that does not fit its shape.
- Only planar faces are sectioned; sloped faces work, but a warped (non-planar) face whose overall normal is vertical is skipped.
- Thin slabs never meet a floor's mid-height section plane (the same as `section_topology.py`); they are excluded by default anyway, as occupation features.
- `bearingRotation` is shown, not applied: the plan is drawn grid-north up.
- `AggregateSolid` / `ParcelAggregate` parcels have no outline of their own and are never drawn; a boundary reaches their outline only through `follow`.
- `matches()` uses the built-in level options, so a block's `levelProperty` or `exclude` changes what is drawn but not whether the tab appears.
- The drawing always uses a light "plan sheet" surface, whatever the host theme.
