// Loads the real-data harness fixtures (see harness/fixtures/README.md) for unit tests.
import { readFileSync } from 'node:fs';

export function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../../../harness/fixtures/${name}`, import.meta.url), 'utf8'));
}

export const BUILT_STRATA = 'built-strata-example-1.json';
export const FOUR_UNIT = '4-unit-up-down-with-parcel.json';
