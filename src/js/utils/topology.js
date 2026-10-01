// Resolves a topo-feature document's topology references (points → edges → rings → faces →
// shells → solids, plus Ring- and Polygon-topology parcels) into plain coordinate structures:
// polygons ({ outer, holes }), each vertex [x, y, z] in the document's projected `place`
// coordinates (z null for a 2D place). Nothing is sectioned or drawn here.
//
// The traversal (directed references, nested shells, open shells, Polygon parcels as an unordered
// bag of edges) is adapted from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b
// src/utils/topo-geometry.js, by way of bblocks-cesium-viewer's topo-geometry.js. Differences:
// coordinates come only from each point's `place` (never `geometry`), and a Ring-topology feature
// may reference rings rather than edges (a parcel whose boundary is a shared ring).

import { collectionFeatures, placeCoords } from './detect-topo.js';

const REVERSED_ORIENTATION = '-';
const FACE_TOPOLOGY_TYPE = 'Face';
const SHELL_TOPOLOGY_TYPE = 'Shell';
const SUBTENDED_ANGLE_FEATURE_TYPE = 'SubtendedAngle';
const MAX_SHELL_NESTING_DEPTH = 16;

export function getFeatures(featureCollections = []) {
  return (Array.isArray(featureCollections) ? featureCollections : []).flatMap(collectionFeatures);
}

// Subtended-angle edge collections describe survey angles, not topology.
function edgeFeatureCollections(edgeCollections = []) {
  return (Array.isArray(edgeCollections) ? edgeCollections : [])
    .filter(fc => fc?.featureType !== SUBTENDED_ANGLE_FEATURE_TYPE);
}

function mapFeaturesById(featureCollections, getValue = f => f) {
  const map = new Map();
  getFeatures(featureCollections).forEach(f => {
    if (f?.id == null) return;
    const value = getValue(f);
    if (value != null) map.set(f.id, value);
  });
  return map;
}

// pointMap holds only points with a usable `place`. Anything referencing a point missing from it
// (e.g. a `geometry`-only point) is skipped downstream.
export function buildMaps(data) {
  return {
    pointMap: mapFeaturesById(data?.points, f => placeCoords(f.place)),
    edgeMap: mapFeaturesById(edgeFeatureCollections(data?.edges), f => {
      const refs = f.topology?.references;
      return Array.isArray(refs) && refs.length === 2 ? refs : null;
    }),
    ringMap: mapFeaturesById(data?.rings),
    faceMap: mapFeaturesById(data?.faces),
    shellMap: mapFeaturesById(data?.shells),
  };
}

export function directedReferences(feature) {
  const refs = feature?.topology?.directed_references;
  return Array.isArray(refs) ? refs : [];
}

// ─── Rings and faces ────────────────────────────────────────────────────────────

// A ring's vertices in order: each directed edge contributes its start point ('+') or its end
// point ('-'), so the ring closes implicitly. Null if any edge or point is unresolvable.
export function ringCoords(ring, maps) {
  const coords = [];
  for (const member of directedReferences(ring)) {
    const pts = maps.edgeMap.get(member.ref);
    const coord = pts && maps.pointMap.get(pts[member.orientation === REVERSED_ORIENTATION ? 1 : 0]);
    if (!coord) return null;
    coords.push(coord);
  }
  return coords.length >= 3 ? coords : null;
}

// A Face's first ring is its outer boundary; any further rings are holes. A '-' orientation on a
// ring reference reverses that ring's vertex order.
export function facePolygon(face, maps) {
  const rings = directedReferences(face).map(ref => {
    const coords = ringCoords(maps.ringMap.get(ref?.ref), maps);
    return coords && ref.orientation === REVERSED_ORIENTATION ? coords.reverse() : coords;
  });
  const [outer, ...holes] = rings;
  if (!outer) return null;
  return { outer, holes: holes.filter(Boolean) };
}

// A Ring-topology feature either lists edges itself (an ordinary ring) or lists rings (a parcel
// whose boundary is a ring shared with the rest of the topology, as in the WA built-strata
// examples) — in which case it resolves like a face: first ring outer, the rest holes.
export function ringFeaturePolygon(feature, maps) {
  const refs = directedReferences(feature);
  if (refs.length && refs.every(ref => maps.ringMap.has(ref?.ref) && !maps.edgeMap.has(ref.ref))) {
    return facePolygon(feature, maps);
  }
  const outer = ringCoords(feature, maps);
  return outer ? { outer, holes: [] } : null;
}

// ─── Solids and shells ──────────────────────────────────────────────────────────

// Faces and shells share one ID space, so a directed_reference carries no hint of its target's
// kind. Faces are looked up first; `topology.type` guards an ID present in both maps.
function resolveBoundaryReference(ref, maps) {
  const face = maps.faceMap.get(ref);
  if (face && face.topology?.type !== SHELL_TOPOLOGY_TYPE) return { kind: FACE_TOPOLOGY_TYPE, feature: face };
  const shell = maps.shellMap.get(ref);
  if (shell) return { kind: SHELL_TOPOLOGY_TYPE, feature: shell };
  return null;
}

// Flattens a solid or shell boundary into its leaf faces, descending through nested shells. The
// cycle guard is per path; the starting container counts as visited.
export function flattenToFaces(container, maps, visitedShellIds = new Set([container?.id]), depth = 0) {
  if (depth > MAX_SHELL_NESTING_DEPTH) return [];
  return directedReferences(container).flatMap(ref => {
    const resolved = resolveBoundaryReference(ref?.ref, maps);
    if (!resolved) return [];
    if (resolved.kind === FACE_TOPOLOGY_TYPE) return [resolved.feature];
    if (visitedShellIds.has(ref.ref)) return [];
    return flattenToFaces(resolved.feature, maps, new Set(visitedShellIds).add(ref.ref), depth + 1);
  });
}

// Every face polygon bounding a solid or shell.
export function containerPolygons(container, maps) {
  return flattenToFaces(container, maps).map(face => facePolygon(face, maps)).filter(Boolean);
}

// Every shell that bounds a solid, directly or through a nested shell.
function collectSolidShellIds(solids, maps) {
  const ids = new Set();
  const visit = (container, depth) => {
    if (depth > MAX_SHELL_NESTING_DEPTH) return;
    directedReferences(container).forEach(ref => {
      const resolved = resolveBoundaryReference(ref?.ref, maps);
      if (resolved?.kind !== SHELL_TOPOLOGY_TYPE || ids.has(ref.ref)) return;
      ids.add(ref.ref);
      visit(resolved.feature, depth + 1);
    });
  };
  solids.forEach(solid => visit(solid, 0));
  return ids;
}

// Shells no solid uses as part of its boundary (the rule engine's derived `surfaces` source).
export function getOpenShells(data, maps) {
  const solidShellIds = collectSolidShellIds(getFeatures(data?.solids), maps);
  return getFeatures(data?.shells).filter(shell => !solidShellIds.has(shell.id));
}

// ─── Polygon-topology parcels ───────────────────────────────────────────────────
//
// A cadastral "Polygon" parcel lists its boundary as `topology.references`: an unordered bag of
// edge ids per ring, with no orientation. The edges are walked as an adjacency graph to recover
// an ordered ring.

function resolvePolygonRing(edgeRefs, maps) {
  const adjacency = new Map();
  let startPointId = null;
  const addNeighbor = (pointId, neighborId) => {
    if (!adjacency.has(pointId)) adjacency.set(pointId, new Set());
    adjacency.get(pointId).add(neighborId);
  };
  edgeRefs.forEach(edgeRef => {
    const pts = maps.edgeMap.get(edgeRef);
    if (!pts || !maps.pointMap.has(pts[0]) || !maps.pointMap.has(pts[1])) return;
    if (startPointId == null) startPointId = pts[0];
    addNeighbor(pts[0], pts[1]);
    addNeighbor(pts[1], pts[0]);
  });
  if (startPointId == null) return [];

  const ids = [startPointId];
  const visited = new Set(ids);
  let previousId = null;
  let currentId = startPointId;
  for (let step = 0; step < adjacency.size + 1; step++) {
    const neighbors = [...(adjacency.get(currentId) ?? [])];
    const nextId = neighbors.find(id => id !== previousId) ?? neighbors[0];
    if (nextId == null || (nextId === startPointId && ids.length > 2)) break;
    if (visited.has(nextId)) break;
    ids.push(nextId);
    visited.add(nextId);
    previousId = currentId;
    currentId = nextId;
  }
  return ids.map(id => maps.pointMap.get(id));
}

// Accepts both the flat legacy shape (["e1", "e2", …], one outer boundary) and the GeoJSON
// Polygon shape ([["e1", …], ["hole-e1", …]]).
function polygonRingEdgeRefs(feature) {
  const references = feature?.topology?.references;
  if (!Array.isArray(references) || !references.length) return [];
  return Array.isArray(references[0]) ? references : [references];
}

export function polygonFeaturePolygon(feature, maps) {
  const rings = polygonRingEdgeRefs(feature)
    .map(edgeRefs => resolvePolygonRing(edgeRefs, maps))
    .filter(coords => coords.length >= 3);
  if (!rings.length) return null;
  const [outer, ...holes] = rings;
  return { outer, holes };
}

// ─── Heights ────────────────────────────────────────────────────────────────────

// Every known Z of a solid's (or shell's) boundary vertices; 2D vertices are skipped.
export function containerZValues(container, maps) {
  return containerPolygons(container, maps)
    .flatMap(p => [p.outer, ...p.holes].flat())
    .map(([, , z]) => z)
    .filter(z => z != null);
}
