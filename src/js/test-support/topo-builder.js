// Builds small hand-made topo-feature documents for unit tests: axis-aligned box solids with
// their full point → edge → ring → face → shell → solid chain, in FeatureCollection wrappers.
// Each point's `place` holds the projected coordinates the plugin reads; its `geometry` holds a
// deliberately different (WGS84-looking) position, so a test fails if `geometry` is ever read.

const collection = features => [{ type: 'FeatureCollection', features }];

// One box: 8 points, 6 faces (each with its own ring of 4 edges), 1 shell, 1 solid.
export function box({ id, min, max, properties = {} }) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const corner = (x, y, z) => `${id}-p${x === x0 ? 0 : 1}${y === y0 ? 0 : 1}${z === z0 ? 0 : 1}`;
  const points = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
    points.push({
      id: corner(x, y, z),
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [115 + x * 1e-5, -32 + y * 1e-5, z - 30] },
      place: { type: 'Point', coordinates: [x, y, z] },
    });
  }
  const quads = {
    bottom: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
    top: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    south: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    east: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    north: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
    west: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
  };
  const edges = [];
  const rings = [];
  const faces = [];
  Object.entries(quads).forEach(([name, quad]) => {
    const ringId = `${id}-ring-${name}`;
    const members = quad.map((a, i) => {
      const b = quad[(i + 1) % quad.length];
      const edgeId = `${id}-edge-${name}-${i}`;
      edges.push({ id: edgeId, type: 'Feature', geometry: null, topology: { type: 'Edge', references: [corner(...a), corner(...b)] } });
      return { ref: edgeId, orientation: '+' };
    });
    rings.push({ id: ringId, type: 'Feature', geometry: null, topology: { type: 'Ring', directed_references: members } });
    faces.push({ id: `${id}-face-${name}`, type: 'Feature', geometry: null, topology: { type: 'Face', directed_references: [{ ref: ringId, orientation: '+' }] } });
  });
  const shell = {
    id: `${id}-shell`, type: 'Feature', geometry: null,
    topology: { type: 'Shell', directed_references: faces.map(f => ({ ref: f.id, orientation: '+' })) },
  };
  const solid = {
    id, type: 'Feature', geometry: null,
    topology: { type: 'Solid', directed_references: [{ ref: shell.id, orientation: '+' }] },
    properties,
  };
  return { points, edges, rings, faces, shells: [shell], solids: [solid] };
}

// Merges box() parts (and any extra top-level members) into one document.
export function topoDocument(parts, extra = {}) {
  const keys = ['points', 'edges', 'rings', 'faces', 'shells', 'solids'];
  const doc = { type: 'FeatureCollection' };
  keys.forEach(key => { doc[key] = collection(parts.flatMap(part => part[key] ?? [])); });
  return { ...doc, ...extra };
}
