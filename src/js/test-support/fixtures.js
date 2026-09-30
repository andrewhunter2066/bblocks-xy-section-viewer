// Loads the real-data harness fixtures (see harness/fixtures/README.md) for unit tests.
import { readFileSync } from 'node:fs';

export function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../../../harness/fixtures/${name}`, import.meta.url), 'utf8'));
}

// A demo block's viewer config (_sources/xySectionViewerDemo/<block>/viewer-config.json) — the
// single copy of each sample config, shared by the register, the harness and the tests.
export function loadDemoConfig(block) {
  return JSON.parse(readFileSync(new URL(`../../../_sources/xySectionViewerDemo/${block}/viewer-config.json`, import.meta.url), 'utf8'));
}

export const BUILT_STRATA = 'built-strata-example-1.json';
export const FOUR_UNIT = '4-unit-up-down-with-parcel.json';
