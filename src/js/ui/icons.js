// Inline SVG icons (no mdi/Vuetify: the plugin runs outside the host's component tree). Sized by
// CSS and coloured via currentColor. layers/fullscreen*/labels match the Cesium plugin's icons.
const svg = (body, attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${attrs}>${body}</svg>`;

export const ICONS = {
  zoomIn: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.35-4.35"/><path d="M11 8v6M8 11h6"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.35-4.35"/><path d="M8 11h6"/>'),
  fit: svg('<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
  // Two floor outlines: the lower one dashed (faded context), the current one solid on top.
  context: svg('<rect x="3" y="9" width="12" height="12" rx="1" stroke-dasharray="2.5 2.5"/><rect x="9" y="3" width="12" height="12" rx="1"/>'),
  labels: svg('<path d="M3 7V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2"/><path d="M12 4v16"/><path d="M9 20h6"/>'),
  layers: svg('<path d="M12 3 2 8l10 5 10-5Z"/><path d="m2 13 10 5 10-5"/>'),
  download: svg('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  fullscreen: svg('<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/>'),
  fullscreenExit: svg('<path d="M4 9V5a2 2 0 0 1 2-2h4"/><path d="M20 9V5a2 2 0 0 0-2-2h-4"/><path d="M4 15v4a2 2 0 0 0 2 2h4"/><path d="M20 15v4a2 2 0 0 1-2 2h-4"/>'),
  north: svg('<path d="M12 3 7 20l5-4 5 4Z" fill="currentColor"/>', 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"'),
};
