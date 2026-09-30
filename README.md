# bblocks-xy-section-viewer

An OGC Building Blocks register (`_sources/`) **and** a [bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer) **view plugin** (`src/`) that draws [topo-feature](https://github.com/ogcincubator/topo-feature) topology documents as horizontal sections, plan views, one per floor level.

The plugin, `XYSectionPlugin`, adds an **XY Section** tab to any example or transform output that is a topo-feature document with projected 3D `place` coordinates and floor levels.
Inside it is one tab per floor, each showing the solids cut at that floor's height, drawn from `place` exactly as surveyed (no coordinate transformation, no geoid), inside a chosen boundary parcel.
It is the plan view sibling of the Three.js [`TopoFeaturePlugin`](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin) and the [Cesium globe view](https://github.com/ogcincubator/bblocks-cesium-viewer), shares their rule configuration, and is added to other registers the same way.

Why things are the way they are, coordinates, sectioning, levels, colours, the verified viewer behaviour, is in [`docs/design.md`](docs/design.md).

## What the view shows

- **One tab per floor.** Levels come from each solid's `properties.floors` (configurable).
  Each floor is cut at the mid-height of the solids listed on it alone (or a configured height).
  A solid listed on several floors (a stairwell) appears on each.
- **Sections** of every solid (and open shell) that match the rules are displayed, along with their holes (voids); walls, slabs, and ceilings described by `occupationFeatures` are left out by default.
- **A boundary parcel**, dashed, displayed with every floor, is chosen by an ordered/prioritised list (e.g. strata scheme's containing parcel, else former tenure, else any lot).
- **Controls**: zoom, pan, fit, lower floors (faded, off by default), labels, a layers panel with per-group and per-feature toggles, SVG download, fullscreen; the caption gives the section height and datum, the CRS, grid spacing and the easting/northing under the pointer.
- Compact layout in the viewer's ~300 px tab; expanded, with the layers panel docked, in the viewer's full-screen dialog or the plugin's own fullscreen.

## Adding the plugin to a register

1. Declare it in the register's `bblocks-config.yaml`:

   ```yaml
   viewer:
     view-plugins:
       - url: https://cdn.jsdelivr.net/gh/andrewhunter2066/bblocks-xy-section-viewer@dist/index.js
         export: XYSectionPlugin
         weight: 50   # optional; higher sorts earlier among plugin tabs
   ```

   (The URL becomes `…/gh/ogcincubator/bblocks-xy-section-viewer@dist/index.js` once the repository moves to `ogcincubator`.)

2. Make sure the examples qualify.
   A document gets the tab only if it is a topo-feature document (`points`/`edges`/`rings`/`faces`/`shells`/`solids` collections), at least one point has a numeric 3D `place` element, and at least one solid has a floor level.
   The GeoJSON (WGS84) `geometry` element is never read.

3. **Keep each example under 1 MiB.** bblocks-viewer neither previews nor hands to view plugins an example snippet over 1,048,576 bytes; it offers a download instead, and no tab appears.
   Compact indentation usually suffices.

4. Optionally, configure the view per block with a `resources` entry in `bblock.json`:

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

   The configuration's JSON Schema, with a table of every option, is this register's **XY section viewer configuration** block (`_sources/xySectionViewerConfig/`); the two demo blocks (`_sources/xySectionViewerDemo/`) are complete examples.
   A block that already has a `topo-feature` topology view configuration gets the same rules here without duplication.
   An invalid or unreachable configuration never breaks the view: it falls back to the defaults with a console warning.

## Development

Requires Node.js 22 or later and, for the register, Docker.
(On Windows with WSL: the repository lives on `C:`, and `npm` in WSL may be the Windows shim — then use `node.exe` for direct `node` commands, and run `./build.sh`/`./view.sh` in an interactive terminal.)

```bash
npm install
npm test                # unit tests (Node's built-in runner)
npm run typecheck
npm run dev             # the harness, with live reload -> http://localhost:5173/harness/
npm run build           # -> dist/ (deploy the whole directory)
```

### The harness

`npm run dev` opens `harness/`, which drives the real plugin from `src/js/` the way the viewer does.
Pick a **fixture** (the two real surveys and a no-match case), a local **file** or a **URL**; attach a **sample config** (the register's demo configs and config examples), a config **file** or a config **URL**, delivered as a `context.bblock.resources` entry, like a register would.
*As Three.js config* checks the role fallback; *Tab size* mimics the viewer's 300 px tab.
The starting state can be bookmarked: `?fixture=<file>&config=<key>|none&tabsize=1&topo=1` (keys: `wa-strata`, `styled-rules`, `level-options`, `everything`).
`harness.plugin` in the console is the live instance.

### In the real viewer (nothing pushed, no register install)

```bash
npm run build           # the plugin -> dist/
./build.sh              # the register -> build-local/ (Docker; interactive terminal)
npm run local-register  # point build-local/register.json at the local dist/ (after every ./build.sh)
./view.sh               # bblocks-viewer at http://localhost:9090 (Ctrl+C to stop)
```

`view.sh` serves the repository under `/register/`, so the local plugin loads same-origin from `http://localhost:9090/register/dist/index.js`.
Open a demo block → **Examples** → **XY SECTION**.
Keep the browser console open: errors from the plugin's asynchronous work only appear there (and as a message in the tab).

`node scripts/preview-sections.mjs [file.json …]` writes bare SVGs of every floor straight from the geometry modules to `dist/`, for a quick look without a browser session.

### Layout

| Path | What |
|---|---|
| `src/js/xy-section-plugin.js` | The plugin class (`matches`, `render`, `destroy`); `src/js/index.js` exports it |
| `src/js/xy-scene.js`, `src/js/svg-render.js` | The drawing model and SVG rendering (no DOM) |
| `src/js/ui/`, `src/css/` | The tabbed view, toolbar, layers panel; its stylesheet |
| `src/js/utils/` | Topology, levels, sectioning, boundary, options, config loading; the rule engine copied from the Three.js plugin (`rules.js`, `curie.js`, `config.js`, `resolve-config.js`, `default-config.js`, `mime-type-match.js`, with provenance headers; must port upstream fixes by hand) |
| `harness/` | Dev harness and real-data fixtures (see `harness/fixtures/README.md`) |
| `_sources/` | The register: the configuration schema block and two demo blocks |
| `scripts/` | `use-local-plugin.mjs` (`npm run local-register`), the test loader for `?raw` CSS imports, `preview-sections.mjs` |
| `docs/` | Design notes and the handover checklist |

## Publishing

`.github/workflows/ci.yml` runs the tests, typecheck and build on every push and PR; `pr-check.yml` validates the building blocks on PRs.
On every push to `master`, `publish-dist.yml` builds the plugin and force-pushes `dist/` to the orphan `dist` branch, which jsDelivr serves at the URL above (`dist/` is never committed to `master`), and `process-bblocks.yml` builds and publishes the register.
See [`docs/handover.md`](docs/handover.md) for what to check after the first publish and after the move to `ogcincubator`.
