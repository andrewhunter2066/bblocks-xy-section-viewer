Demonstrates the **XY Section** view of a topo-feature document. Open the example below and choose
its **XY Section** tab: there is one tab per floor — *Ground floor* and *First floor* — each showing
that floor cut at its mid-height, inside the dashed outline of the original lot.

The block's `resources` attach an [XY Section view configuration](bblocks://ogc.bbr.xysection.xySectionViewerConfig)
(`viewer-config.json`):

- **Level names** for floors 1 and 2.
- **Boundary**: the strata scheme's *containing primary parcel* (followed through its
  `topology.relationships`), else a former-tenure parcel, else any parcel with an outline. Here the
  first choice resolves, to Lot 1 on Plan DP 413673.
- **Exclusions**: the walls, slabs and ceiling that the document's `occupationFeatures` describe
  are not sectioned (also the default), leaving the principal units and courtyards.

The upper units are drawn with the voids above their courtyards as holes. Use the toolbar's
*lower floors* toggle on the First floor tab to see the ground floor faded beneath it.

The document is strata plan SP83687 from the WA 3D cadastral survey data model profile
(`3d-csdm-profile-wa`, `proposals/development/built-strata/examples/example-1.json`). Each point
carries both projected `place` coordinates (`epsg:7850`, heights on `epsg:5711`) and a WGS84
`geometry`; the XY Section view uses only `place`.
