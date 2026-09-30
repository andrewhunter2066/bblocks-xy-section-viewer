// Pure view maths for the section SVGs: grid spacing, fitting, zooming and panning an SVG
// viewBox ({ x, y, w, h }, in the drawing's local metres — see xy-scene.js for the local frame).
// The SVGs use preserveAspectRatio="xMidYMid meet", which every conversion here assumes.

const NICE_MULTIPLES = [1, 2, 5, 10];

// A 1/2/5 × 10ⁿ spacing giving about `targetLines` grid lines across `extent`.
export function niceStep(extent, targetLines = 8) {
  if (!(extent > 0) || !(targetLines > 0)) return 1;
  const raw = extent / targetLines;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return NICE_MULTIPLES.find(m => m * magnitude >= raw) * magnitude;
}

// The viewBox framing a local-metre bounds ({ minX, minY, maxX, maxY }) plus `padding` metres.
export function fitViewBox(bounds, padding = 0) {
  const w = Math.max(bounds.maxX - bounds.minX, 1e-6) + 2 * padding;
  const h = Math.max(bounds.maxY - bounds.minY, 1e-6) + 2 * padding;
  return { x: bounds.minX - padding, y: bounds.minY - padding, w, h };
}

// The rendered scale (metres per pixel) and the offsets of the drawing inside a pxW × pxH element.
function meet(viewBox, pxW, pxH) {
  const scale = Math.max(viewBox.w / pxW, viewBox.h / pxH);
  return { scale, offsetX: (pxW - viewBox.w / scale) / 2, offsetY: (pxH - viewBox.h / scale) / 2 };
}

// The viewBox point under pixel (px, py) of a pxW × pxH element.
export function pixelToView(viewBox, px, py, pxW, pxH) {
  const { scale, offsetX, offsetY } = meet(viewBox, pxW, pxH);
  return [viewBox.x + (px - offsetX) * scale, viewBox.y + (py - offsetY) * scale];
}

// Zooms by `factor` (> 1 zooms in) keeping the viewBox point `focus` fixed on screen. The
// resulting width is clamped to [minW, maxW].
export function zoomViewBox(viewBox, factor, focus = [viewBox.x + viewBox.w / 2, viewBox.y + viewBox.h / 2], { minW = 0, maxW = Infinity } = {}) {
  const w = Math.min(Math.max(viewBox.w / factor, minW), maxW);
  const applied = viewBox.w / w;
  const h = viewBox.h / applied;
  const [fx, fy] = focus;
  return { x: fx - (fx - viewBox.x) / applied, y: fy - (fy - viewBox.y) / applied, w, h };
}

// Pans by a drag of (dxPx, dyPx) pixels, so the drawing follows the pointer.
export function panViewBox(viewBox, dxPx, dyPx, pxW, pxH) {
  const { scale } = meet(viewBox, pxW, pxH);
  return { ...viewBox, x: viewBox.x - dxPx * scale, y: viewBox.y - dyPx * scale };
}

export const viewBoxAttribute = ({ x, y, w, h }) => [x, y, w, h].map(v => +v.toFixed(4)).join(' ');
