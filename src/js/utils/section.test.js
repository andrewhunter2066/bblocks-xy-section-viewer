import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chainSegments, evenOddArea, loopArea, removeCollinear, sectionContainer, sectionPolygon, sectionPolygons,
} from './section.js';
import { buildMaps, containerPolygons, containerZValues, getFeatures } from './topology.js';
import { buildLevels } from './levels.js';
import { box, topoDocument } from '../test-support/topo-builder.js';
import { BUILT_STRATA, FOUR_UNIT, loadFixture } from '../test-support/fixtures.js';

const key = ([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`;
const pointSet = points => new Set(points.map(key));
// Same corners, each within `tolerance` (the fixtures record coordinates to the millimetre).
const sameCorners = (actual, expected, tolerance, message) => {
  assert.equal(actual.length, expected.length, message);
  expected.forEach(([x, y]) => {
    assert.ok(actual.some(([ax, ay]) => Math.hypot(ax - x, ay - y) <= tolerance), `${message}: no corner near ${x},${y}`);
  });
};
const byName = (doc, name) => getFeatures(doc.solids).find(s => s.properties.name === name);
const height = (solid, maps) => {
  const zs = containerZValues(solid, maps);
  return Math.max(...zs) - Math.min(...zs);
};

// ─── One face ───────────────────────────────────────────────────────────────────

const wall = { outer: [[0, 0, 0], [10, 0, 0], [10, 0, 3], [0, 0, 3]], holes: [] };

test('a vertical face crossing the plane gives one segment along its width', () => {
  const segments = sectionPolygon(wall, 1.5);
  assert.equal(segments.length, 1);
  assert.deepEqual(pointSet(segments[0]), pointSet([[0, 0], [10, 0]]));
});

test('a face wholly above or below the plane gives nothing', () => {
  assert.deepEqual(sectionPolygon(wall, 5), []);
  assert.deepEqual(sectionPolygon(wall, -1), []);
});

test('a horizontal face gives nothing, even when it lies in the plane', () => {
  const floor = { outer: [[0, 0, 2], [5, 0, 2], [5, 5, 2], [0, 5, 2]], holes: [] };
  assert.deepEqual(sectionPolygon(floor, 2), []);
  assert.deepEqual(sectionPolygon(floor, 1), []);
});

test('a warped (non-planar) face whose overall normal is vertical is skipped rather than mis-paired', () => {
  const saddle = { outer: [[0, 0, 0], [1, 0, 1], [1, 1, 0], [0, 1, 1]], holes: [] };
  assert.deepEqual(sectionPolygon(saddle, 0.5), []);
});

test('half-open rule: a plane through a face\'s top edge cuts it, through its bottom edge does not', () => {
  assert.equal(sectionPolygon(wall, 3).length, 1);
  assert.deepEqual(sectionPolygon(wall, 0), []);
});

test('a face touching the plane only at one vertex gives nothing; crossing at a vertex gives one segment', () => {
  const apexDown = { outer: [[0, 0, 1], [4, 0, 1], [2, 0, 0]], holes: [] };
  assert.deepEqual(sectionPolygon(apexDown, 0), []);
  const apexUp = { outer: [[0, 0, 0], [4, 0, 0], [2, 0, 2]], holes: [] };
  assert.deepEqual(sectionPolygon(apexUp, 2), []);
  const diamond = { outer: [[2, 0, 0], [4, 0, 2], [2, 0, 4], [0, 0, 2]], holes: [] };
  const segments = sectionPolygon(diamond, 2);
  assert.equal(segments.length, 1);
  assert.deepEqual(pointSet(segments[0]), pointSet([[0, 0], [4, 0]]));
});

test('a face with a hole (a window) is cut into two segments at window height', () => {
  const withWindow = { ...wall, holes: [[[3, 0, 1], [3, 0, 2], [7, 0, 2], [7, 0, 1]]] };
  const segments = sectionPolygon(withWindow, 1.5);
  assert.equal(segments.length, 2);
  assert.deepEqual(pointSet(segments.flat()), pointSet([[0, 0], [3, 0], [7, 0], [10, 0]]));
  assert.equal(sectionPolygon(withWindow, 0.5).length, 1);
});

test('a sloped face is cut at the interpolated position', () => {
  const ramp = { outer: [[0, 0, 0], [0, 4, 0], [4, 4, 4], [4, 0, 4]], holes: [] };
  const [segment] = sectionPolygon(ramp, 1);
  assert.deepEqual(pointSet(segment), pointSet([[1, 0], [1, 4]]));
});

test('a face with any 2D vertex (no height) is skipped', () => {
  assert.deepEqual(sectionPolygon({ outer: [[0, 0, 0], [1, 0, null], [1, 0, 3]], holes: [] }, 1), []);
  assert.deepEqual(sectionPolygon(null, 1), []);
});

// ─── Chaining ───────────────────────────────────────────────────────────────────

test('chainSegments joins shuffled, reversed segments into one closed loop', () => {
  const { loops, polylines } = chainSegments([
    [[4, 0], [4, 3]], [[0, 0], [4, 0]], [[0, 3], [0, 0]], [[0, 3], [4, 3]],
  ]);
  assert.equal(loops.length, 1);
  assert.deepEqual(polylines, []);
  assert.deepEqual(pointSet(loops[0]), pointSet([[0, 0], [4, 0], [4, 3], [0, 3]]));
  assert.equal(Math.abs(loopArea(loops[0])), 12);
});

test('chainSegments leaves an unclosed chain as one polyline, in order', () => {
  const { loops, polylines } = chainSegments([[[1, 0], [2, 1]], [[0, 0], [1, 0]]]);
  assert.deepEqual(loops, []);
  assert.deepEqual(polylines, [[[0, 0], [1, 0], [2, 1]]]);
});

test('chainSegments merges collinear pieces of a split wall into one side', () => {
  const { loops } = chainSegments([
    [[0, 0], [2, 0]], [[2, 0], [4, 0]], [[4, 0], [4, 3]], [[4, 3], [0, 3]], [[0, 3], [0, 0]],
  ]);
  assert.equal(loops[0].length, 4);
});

test('chainSegments joins endpoints that differ only by floating-point noise', () => {
  const { loops } = chainSegments([
    [[0, 0], [1, 0]], [[1 + 1e-9, 0], [1, 1]], [[1, 1], [0, 0]],
  ]);
  assert.equal(loops.length, 1);
});

test('removeCollinear keeps the ends of an open polyline', () => {
  assert.deepEqual(removeCollinear([[0, 0], [1, 0], [2, 0]], false), [[0, 0], [2, 0]]);
  assert.deepEqual(removeCollinear([[0, 0], [1, 0], [2, 0], [2, 2]], true).length, 3);
});

test('sectionPolygons drops a segment produced twice by coincident faces', () => {
  const reversed = { outer: [...wall.outer].reverse(), holes: [] };
  assert.equal(sectionPolygons([wall, reversed], 1.5).length, 1);
});

test('evenOddArea subtracts a loop nested inside another', () => {
  const outer = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const hole = [[4, 4], [6, 4], [6, 6], [4, 6]];
  assert.equal(evenOddArea([outer, hole]), 96);
  assert.equal(evenOddArea([hole, outer]), 96);
});

// ─── Whole solids ───────────────────────────────────────────────────────────────

test('a box solid cut at mid-height gives its rectangular footprint', () => {
  const doc = topoDocument([box({ id: 'b', min: [0, 0, 0], max: [10, 4, 3] })]);
  const { loops, polylines } = sectionContainer(getFeatures(doc.solids)[0], buildMaps(doc), 1.5);
  assert.equal(loops.length, 1);
  assert.deepEqual(polylines, []);
  assert.deepEqual(pointSet(loops[0]), pointSet([[0, 0], [10, 0], [10, 4], [0, 4]]));
  assert.equal(Math.abs(loopArea(loops[0])), 40);
});

test('a box solid above or below the plane gives nothing', () => {
  const doc = topoDocument([box({ id: 'b', min: [0, 0, 0], max: [10, 4, 3] })]);
  const result = sectionContainer(getFeatures(doc.solids)[0], buildMaps(doc), 7);
  assert.deepEqual(result, { loops: [], polylines: [] });
});

// ─── Real data ──────────────────────────────────────────────────────────────────
//
// Two checks independent of the slicer: (1) a vertical-walled prism's section has exactly the
// corners of its floor face; (2) section area × solid height reproduces the `volume` recorded in
// the fixture itself.

// Walls in the fixture lean by up to 1 mm, so a mid-height corner can sit 0.5 mm off the floor's.
test('4-unit: each unit\'s section has the corners of its floor face, to the millimetre', () => {
  const doc = loadFixture(FOUR_UNIT);
  const maps = buildMaps(doc);
  const levels = buildLevels(doc);
  for (const [level, name] of [[1, 'Lower East'], [1, 'Lower West'], [2, 'Upper East'], [2, 'Upper West']]) {
    const solid = byName(doc, name);
    const z = levels.find(l => l.level === level).z;
    const polygons = containerPolygons(solid, maps);
    const floorZ = Math.min(...containerZValues(solid, maps));
    const floor = polygons.find(p => p.outer.every(v => v[2] === floorZ));
    const { loops, polylines } = sectionContainer(solid, maps, z);
    assert.equal(loops.length, 1, name);
    assert.deepEqual(polylines, [], name);
    sameCorners(loops[0], floor.outer, 1e-3, name);
  }
});

test('4-unit: section area × height matches each unit\'s recorded volume', () => {
  const doc = loadFixture(FOUR_UNIT);
  const maps = buildMaps(doc);
  for (const level of buildLevels(doc)) {
    for (const solid of level.solids.filter(s => s.properties.name !== 'Stairwell')) {
      const area = evenOddArea(sectionContainer(solid, maps, level.z).loops);
      const ratio = (area * height(solid, maps)) / solid.properties.volume;
      assert.ok(Math.abs(ratio - 1) < 1e-3, `${solid.properties.name}: ${ratio}`);
    }
  }
});

test('4-unit: the stepped stairwell\'s two floor sections × 3 m sum to its volume', () => {
  const doc = loadFixture(FOUR_UNIT);
  const maps = buildMaps(doc);
  const stairwell = byName(doc, 'Stairwell');
  const areas = buildLevels(doc).map(l => evenOddArea(sectionContainer(stairwell, maps, l.z).loops));
  assert.ok(areas[0] > areas[1]);
  const ratio = ((areas[0] + areas[1]) * 3) / stairwell.properties.volume;
  assert.ok(Math.abs(ratio - 1) < 1e-3, String(ratio));
});

test('built-strata: every section solid closes into loops, with volumes matching within 1%', () => {
  const doc = loadFixture(BUILT_STRATA);
  const maps = buildMaps(doc);
  for (const level of buildLevels(doc)) {
    for (const solid of level.solids) {
      const { loops, polylines } = sectionContainer(solid, maps, level.z);
      assert.ok(loops.length >= 1, solid.properties.name);
      assert.deepEqual(polylines, [], solid.properties.name);
      const ratio = (evenOddArea(loops) * height(solid, maps)) / solid.properties.volume;
      assert.ok(Math.abs(ratio - 1) < 0.01, `${solid.properties.name}: ${ratio}`);
    }
  }
});

test('built-strata: an upper unit\'s section is an outline with its courtyard as a hole', () => {
  const doc = loadFixture(BUILT_STRATA);
  const maps = buildMaps(doc);
  const solid = byName(doc, 'Principal Unit 1 - upper');
  const z = buildLevels(doc).find(l => l.level === 2).z;
  const { loops } = sectionContainer(solid, maps, z);
  assert.deepEqual(loops.map(l => l.length).sort(), [4, 6]);
  const outer = Math.abs(loopArea(loops.find(l => l.length === 6)));
  const hole = Math.abs(loopArea(loops.find(l => l.length === 4)));
  assert.ok(Math.abs(evenOddArea(loops) - (outer - hole)) < 1e-9);
  const ratio = (evenOddArea(loops) * height(solid, maps)) / solid.properties.volume;
  assert.ok(Math.abs(ratio - 1) < 1e-4, String(ratio));
});
