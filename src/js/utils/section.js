// Cuts topology at a horizontal plane Z = z, in place of section_topology.py's OpenCascade
// BRepAlgoAPI_Section. Every face is planar, so a solid's section is just the union of its faces'
// sections: each face polygon (outer ring + holes) meets the plane along one straight line, and
// the parts of that line inside the face are found by sorting the ring crossings along it and
// pairing them even-odd. The segments of all a solid's faces are then chained into closed loops
// (the section outline, holes included) and any leftover open polylines.
//
// Vertices exactly on the plane follow a half-open rule — a vertex with z >= plane counts as
// above — so a ring crossing the plane at a vertex is counted once, a ring only touching it
// yields a zero-length segment (dropped), and a face lying in the plane yields nothing.

import { containerPolygons } from './topology.js';

// Tolerance (metres) for treating two points as the same, and a segment as zero-length.
export const DEFAULT_TOLERANCE = 1e-6;
// A face whose normal is within this of vertical is horizontal. A flat one never crosses the plane
// (all its vertices share one Z); a warped one that does cannot have its crossings ordered along a
// line, so it is skipped rather than paired wrongly.
const HORIZONTAL_NORMAL_Z = 1 - 1e-9;

// Newell's method: a robust normal for any planar (possibly non-convex) polygon ring.
function ringNormal(ring) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1, z1] = ring[i];
    const [x2, y2, z2] = ring[(i + 1) % ring.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  const length = Math.hypot(nx, ny, nz);
  return length ? [nx / length, ny / length, nz / length] : null;
}

// Where edge a–b crosses the plane, or null. The two endpoints are put in a canonical order
// before interpolating, so the faces either side of a shared edge compute bit-identical points.
function edgeCrossing(a, b, z) {
  if ((a[2] >= z) === (b[2] >= z)) return null;
  const [p, q] = a[2] < b[2] ? [a, b] : [b, a];
  const t = (z - p[2]) / (q[2] - p[2]);
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}

function ringHasHeights(ring) {
  return ring.every(v => v[2] != null);
}

// The section of one planar face polygon ({ outer, holes }, vertices [x, y, z]) at `z`:
// a list of 2D segments [[x, y], [x, y]].
export function sectionPolygon(polygon, z, tolerance = DEFAULT_TOLERANCE) {
  const rings = [polygon?.outer, ...(polygon?.holes ?? [])].filter(r => Array.isArray(r) && r.length >= 3);
  if (!rings.length || !rings.every(ringHasHeights)) return [];
  const normal = ringNormal(rings[0]);
  if (!normal || Math.abs(normal[2]) >= HORIZONTAL_NORMAL_Z) return [];

  // The face plane meets Z = z along a line with direction normal × ẑ.
  const direction = [normal[1], -normal[0]];
  const crossings = [];
  rings.forEach(ring => {
    ring.forEach((a, i) => {
      const point = edgeCrossing(a, ring[(i + 1) % ring.length], z);
      if (point) crossings.push(point);
    });
  });
  crossings.sort((p, q) => (p[0] * direction[0] + p[1] * direction[1]) - (q[0] * direction[0] + q[1] * direction[1]));

  const segments = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const [a, b] = [crossings[i], crossings[i + 1]];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > tolerance) segments.push([a, b]);
  }
  return segments;
}

const pointKey = (point, tolerance) => `${Math.round(point[0] / tolerance)},${Math.round(point[1] / tolerance)}`;

// The section segments of many face polygons, with duplicates (the same segment from two
// coincident faces) removed.
export function sectionPolygons(polygons, z, tolerance = DEFAULT_TOLERANCE) {
  const seen = new Set();
  return polygons.flatMap(polygon => sectionPolygon(polygon, z, tolerance)).filter(([a, b]) => {
    const key = [pointKey(a, tolerance), pointKey(b, tolerance)].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Removes vertices that lie on the straight line between their neighbours (where two coplanar
// wall faces meet), so a loop has one vertex per real corner.
export function removeCollinear(points, closed, tolerance = DEFAULT_TOLERANCE) {
  if (points.length < 3) return points;
  const onLine = (prev, point, next) => {
    const length = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
    if (!length) return true;
    const cross = (next[0] - prev[0]) * (point[1] - prev[1]) - (next[1] - prev[1]) * (point[0] - prev[0]);
    return Math.abs(cross) / length <= tolerance;
  };
  let result = points;
  let changed = true;
  while (changed && result.length >= 3) {
    changed = false;
    const kept = [];
    const n = result.length;
    for (let i = 0; i < n; i++) {
      const isEnd = !closed && (i === 0 || i === n - 1);
      const prev = result[(i - 1 + n) % n];
      const next = result[(i + 1) % n];
      if (!isEnd && onLine(prev, result[i], next)) {
        changed = true;
        continue;
      }
      kept.push(result[i]);
    }
    result = kept;
  }
  return result;
}

// Chains segments that share endpoints into { loops, polylines }: loops are closed rings (first
// point not repeated at the end), polylines are open chains. Where more than two segments meet at
// a point the walk takes any unused one, so every segment ends up in exactly one chain.
export function chainSegments(segments, tolerance = DEFAULT_TOLERANCE) {
  const byKey = new Map();
  const ends = segments.map(([a, b]) => [pointKey(a, tolerance), pointKey(b, tolerance)]);
  ends.forEach(([ka, kb], index) => {
    [ka, kb].forEach(key => {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(index);
    });
  });
  const used = new Array(segments.length).fill(false);

  // Extends a chain from `key`, appending the far point of each unused segment met.
  const walk = (key, points) => {
    let current = key;
    for (;;) {
      const next = (byKey.get(current) ?? []).find(index => !used[index]);
      if (next === undefined) return current;
      used[next] = true;
      const [ka, kb] = ends[next];
      const forward = ka === current;
      points.push(segments[next][forward ? 1 : 0]);
      current = forward ? kb : ka;
    }
  };

  const loops = [];
  const polylines = [];
  segments.forEach((segment, index) => {
    if (used[index]) return;
    used[index] = true;
    const [startKey, endKey] = ends[index];
    const forwardPoints = [segment[1]];
    const lastKey = walk(endKey, forwardPoints);
    if (lastKey === startKey) {
      forwardPoints.pop(); // the closing point repeats the start
      loops.push(removeCollinear([segment[0], ...forwardPoints], true, tolerance));
      return;
    }
    const backwardPoints = [];
    walk(startKey, backwardPoints);
    polylines.push(removeCollinear([...backwardPoints.reverse(), segment[0], ...forwardPoints], false, tolerance));
  });
  return { loops: loops.filter(loop => loop.length >= 3), polylines };
}

// The section of a solid or shell (anything flattenToFaces() accepts) at `z`: { loops, polylines }.
export function sectionContainer(container, maps, z, tolerance = DEFAULT_TOLERANCE) {
  return chainSegments(sectionPolygons(containerPolygons(container, maps), z, tolerance), tolerance);
}

// Signed area of a 2D loop (positive counter-clockwise).
export function loopArea(loop) {
  let twice = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i];
    const [x2, y2] = loop[(i + 1) % loop.length];
    twice += x1 * y2 - x2 * y1;
  }
  return twice / 2;
}

// Area enclosed by a set of loops under the even-odd rule (a loop inside an odd number of other
// loops is a hole) — what an SVG `fill-rule="evenodd"` path of the loops would fill.
export function evenOddArea(loops) {
  const inside = (point, loop) => {
    let result = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const [xi, yi] = loop[i];
      const [xj, yj] = loop[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
        result = !result;
      }
    }
    return result;
  };
  return loops.reduce((total, loop, index) => {
    const depth = loops.filter((other, j) => j !== index && inside(loop[0], other)).length;
    const area = Math.abs(loopArea(loop));
    return total + (depth % 2 ? -area : area);
  }, 0);
}
