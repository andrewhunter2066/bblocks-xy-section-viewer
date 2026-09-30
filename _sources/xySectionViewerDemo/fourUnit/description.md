Demonstrates the **XY Section** view with rules as well as options. Open the example below and
choose its **XY Section** tab: one tab per floor, *Lower* and *Upper*.

The block's `resources` attach an [XY Section view configuration](bblocks://ogc.bbr.xysection.xySectionViewerConfig)
(`viewer-config.json`) that:

- lists the **stairwell**, which spans both floors, as its own kind — dashed, in a fixed colour —
  and every other solid as a unit;
- draws the **lot parcel** flat as an outline on every floor, initially hidden (tick it in the
  layers panel);
- shows **lower floors** faded from the start, uses a **5 m grid**, and draws **no boundary**.

The document is the `4-unit-up-down-with-parcel.json` test output from `waTestData`. Its lot
boundary points have 2D `place` coordinates, which is enough for an outline.
