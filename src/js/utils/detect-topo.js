// Detects a topo-feature (https://github.com/ogcincubator/topo-feature) topology document that
// can be drawn as XY sections. isTopoFeatureMultiCollection() and collectionFeatures() are adapted
// from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/detect-topo.js; the
// projected-point check is this plugin's own.
const TOPO_KEYS = ['points', 'edges', 'rings', 'faces', 'shells', 'solids'];

// A TOPO_KEYS array entry is either a nested FeatureCollection wrapper (`{ features: [...] }`) or
// a bare Feature — both conventions occur in real topo-feature registers.
function isCollectionEntry(item) {
  return Array.isArray(item?.features) || item?.type === 'Feature';
}

export function collectionFeatures(item) {
  return Array.isArray(item?.features) ? item.features : [item];
}

export function isTopoFeatureMultiCollection(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return TOPO_KEYS.some(k => Array.isArray(data[k]) && data[k].some(isCollectionEntry));
}

// The projected coordinates of a point's `place` as [x, y, z], with z null for a 2D place, or
// null if `place` has no finite x/y. WGS84 `geometry` is never read (see docs/design.md).
export function placeCoords(place) {
  const coords = place?.coordinates;
  if (!Array.isArray(coords)) return null;
  const [x, y, z] = coords;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y, Number.isFinite(z) ? z : null];
}

export function hasProjected3DPoints(data) {
  if (!Array.isArray(data?.points)) return false;
  return data.points.some(entry => collectionFeatures(entry).some(f => placeCoords(f?.place)?.[2] != null));
}
