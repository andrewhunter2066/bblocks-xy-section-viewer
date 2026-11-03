# bblocks-xy-section-viewer

A bblocks-viewer view plugin, `XYSectionPlugin` (`src/`), that draws topo-feature topology documents as plan views, one tab per floor, cut at each floor's height inside a chosen boundary parcel.
The repository is also an OGC Building Blocks register (`_sources/`): the plugin's configuration schema block and two demo blocks.
It is the plan-view sibling of the Three.js `TopoFeaturePlugin` (`bblocks-viewer-topo-feature-plugin`) and shares its rule configuration.

## Commands

- Environment: Node.js 22 or later (CI uses 24); `npm ci` installs from `package-lock.json`.
  Node 18 cannot run the tests: `node --test` expands the `src/js/**/*.test.js` pattern itself only from Node 21 (it fails with "Could not find …").
  The register build needs Docker.
- Test: `npm test` (251 passed on Node 24, 2026-11-03).
- Typecheck: `npm run typecheck` (`tsc --noEmit`; clean, 2026-11-03).
- Lint: none configured (no ESLint or Prettier); the typecheck is the static check.
- Build: `npm run build` writes `dist/index.js` (ignored by Git; 54.7 kB, 2026-11-03).
- Dev harness: `npm run dev`, then http://localhost:5173/harness/.
- In the real viewer (not run during onboarding): `npm run build`, `./build.sh` (register to `build-local/`, Docker, interactive), `npm run local-register`, `./view.sh` (http://localhost:9090).

## Boundaries

- Owns: the plugin, the XY section viewer configuration block (`_sources/xySectionViewerConfig/`) and the demo blocks (`_sources/xySectionViewerDemo/`); nothing canonical for other repositories.
- Copies, pinned and with provenance; refresh by copying again, never by editing in place:
  - The rule engine, `src/js/utils/{rules,curie,config,resolve-config,default-config,mime-type-match}.js` and their tests, from `bblocks-viewer-topo-feature-plugin` at `d94018b`; port upstream fixes by hand and keep each file's header.
  - `harness/fixtures/built-strata-example-1.json` from `3d-csdm-profile-wa` (`example-1.json` at `1e10472`, re-indented to stay under 1 MiB); the profile is the canonical source, so change the example there and copy it again.
  - `harness/fixtures/4-unit-up-down-with-parcel.json` from the private `waTestData`, published here with permission.
- Branches: default `master`.
  Every push to `master` publishes: `publish-dist.yml` force-pushes the build to the orphan `dist` branch (served by jsDelivr) and `process-bblocks.yml` regenerates and publishes the register in `build/`.
  Never commit to `dist`, or `dist/` to `master`; do not edit `build/` by hand.
- Visibility: public; nothing from private repositories beyond the permitted fixture.

## Rules for this repository

- Read `docs/design.md` before changing behaviour: it records why coordinates come from each point's projected `place` as surveyed (no reprojection, no geoid; WGS84 `geometry` is never read), how floors and section heights are chosen, sectioning, the boundary parcel, the per-block configuration and the verified viewer behaviour.
- Keep each demo example under 1 MiB: bblocks-viewer neither previews nor hands to plugins a larger example (`src/js/block-schema.test.js` checks).
- The configuration role URI uses `ogcincubator` and must not change, even before the repository moves there.
- `docs/handover.md` lists what remains: the first-publish checks, the move to `ogcincubator` and upkeep.

## Related repositories

Direct dependencies (all by copy): `bblocks-viewer-topo-feature-plugin`, `3d-csdm-profile-wa`, `waTestData`; parts of `src/js/` were adapted from the archived `bblocks-cesium-viewer`.
Direct consumers: none in the map.
Full map: `edge-development-hub/setup/repos.yaml`.
