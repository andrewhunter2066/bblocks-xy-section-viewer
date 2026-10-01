// Picks the one boundary parcel every section is drawn inside, from the ordered
// `xySection.boundary` entries (see xy-options.js): the first entry that yields an outline wins,
// and within an entry, the first matching feature (in document order) that has one.
//
// An entry names a `source` collection and optionally a `match` (compared like a rule's match —
// literal, CURIE or full URI, via the copied curie.js). With `follow: { role }`, a matched
// feature is not drawn itself: its `topology.relationships` entry with that role is followed to
// the feature its `href` names (in `follow.source`, default the same collection), and that
// feature's outline is used. This is how the WA demo configs say "the strata-scheme parcel's
// containing primary parcel" without the plugin knowing any WA vocabulary.
//
// Outlines come from the feature's topology type: Polygon (unordered edges), Ring (edges, or a
// ring of rings) or Face. Anything else — an AggregateSolid, a ParcelAggregate — has no outline.

import { getPath } from './rules.js';
import { valuesMatch } from './curie.js';
import { facePolygon, getFeatures, polygonFeaturePolygon, ringFeaturePolygon } from './topology.js';

const OUTLINE_BY_TOPOLOGY_TYPE = {
  Polygon: polygonFeaturePolygon,
  Ring: ringFeaturePolygon,
  Face: facePolygon,
};

// The outline ({ outer, holes }, vertices [x, y, z|null]) of a feature, or null.
export function featureOutline(feature, maps) {
  const outline = OUTLINE_BY_TOPOLOGY_TYPE[feature?.topology?.type];
  return outline ? outline(feature, maps) : null;
}

function relationshipTargets(feature, role, context) {
  const relationships = feature?.topology?.relationships;
  return (Array.isArray(relationships) ? relationships : [])
    .filter(rel => typeof rel?.href === 'string' && valuesMatch(rel.role, [role], context))
    .map(rel => rel.href);
}

// Returns { feature, polygon, entryIndex } — `feature` being the one whose outline is drawn — or
// null when no entry yields an outline.
export function resolveBoundary(data, entries, maps, context = data?.['@context'] || {}) {
  const list = Array.isArray(entries) ? entries : [];
  for (let entryIndex = 0; entryIndex < list.length; entryIndex++) {
    const entry = list[entryIndex];
    const matched = getFeatures(data?.[entry.source]).filter(feature =>
      !entry.match || valuesMatch(getPath(feature, entry.match.property), entry.match.values || [], context));
    const candidates = entry.follow
      ? matched.flatMap(feature => {
        const targets = new Map(getFeatures(data?.[entry.follow.source]).map(f => [f.id, f]));
        return relationshipTargets(feature, entry.follow.role, context).map(id => targets.get(id)).filter(Boolean);
      })
      : matched;
    for (const feature of candidates) {
      const polygon = featureOutline(feature, maps);
      if (polygon) return { feature, polygon, entryIndex };
    }
  }
  return null;
}
