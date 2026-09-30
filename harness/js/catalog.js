// What the harness offers: bundled fixtures and sample per-block configs. Paths are relative to
// harness/index.html (the page fetch()es them). Plain data, so src/js/harness-catalog.test.js can
// check every entry exists and behaves as its label says. See fixtures/README.md for sources.
//
// A fixture's `config` is applied automatically when it is selected; `matches` is what the plugin
// is expected to answer.

export const WA_STRATA_CONFIG = 'fixtures/wa-strata-config.json';
export const STYLED_RULES_CONFIG = 'fixtures/styled-rules-config.json';

export const FIXTURES = [
  {
    label: 'Built strata SP83687 (2 floors, WA config)',
    file: 'fixtures/built-strata-example-1.json',
    config: WA_STRATA_CONFIG,
    matches: true,
  },
  {
    label: '4 units up/down with parcel (2 floors, stairwell on both)',
    file: 'fixtures/4-unit-up-down-with-parcel.json',
    config: null,
    matches: true,
  },
  {
    label: 'Geometry-only box (no match expected)',
    file: 'fixtures/geometry-only-box.json',
    config: null,
    matches: false,
  },
];

export const SAMPLE_CONFIGS = [
  { label: 'WA strata: level names, scheme → former tenure → lot boundary', file: WA_STRATA_CONFIG },
  { label: 'Styled rules: dashed stairwell, lot outlines, context on, 5 m grid, no boundary', file: STYLED_RULES_CONFIG },
];
