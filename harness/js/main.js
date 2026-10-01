// Dev harness (npm run dev) driving the real XYSectionPlugin class, imported straight from src/js/
// (Vite reloads the page when it changes), against a bundled fixture, an uploaded file or an
// arbitrary URL — mimicking what the bblocks-viewer host does: construct with candidates +
// context, check matches(), render(el), destroy(el) before the next document.
//
// Adapted from bblocks-cesium-viewer's harness/js/main.js, without its ion-token box (this view
// loads no tiles). A config is handed to the plugin the way a register would: as a
// context.bblock.resources entry whose `ref` the plugin fetch()es — a blob: URL for a picked file.
import { XYSectionPlugin } from '../../src/js/index.js';
import { TOPO_VIEWER_CONFIG_ROLE, XY_VIEWER_CONFIG_ROLE } from '../../src/js/utils/load-config.js';
import { FIXTURES, SAMPLE_CONFIGS } from './catalog.js';

const $ = id => document.getElementById(id);
const fixtureSelect = $('fixtureSelect');
const fileInput = $('fileInput');
const urlInput = $('urlInput');
const sampleConfigSelect = $('sampleConfigSelect');
const configFileInput = $('configFileInput');
const configUrlInput = $('configUrlInput');
const topoRole = $('topoRole');
const statusEl = $('status');
const host = $('host');

let plugin = null;
// For poking at the live view from DevTools, e.g. harness.plugin._model.records
window.harness = { get plugin() { return plugin; } };
let currentDocument = null; // { content, label, mimeType }
let configRef = null; // URL (real or blob:) of the config the plugin fetch()es, as a register would serve it
let configLabel = 'none';
let configBlobUrl = null; // a picked config file's blob: URL, revoked when replaced

for (const { label, file } of FIXTURES) fixtureSelect.add(new Option(label, file));
sampleConfigSelect.add(new Option('(none — built-in defaults)', ''));
for (const { label, file } of SAMPLE_CONFIGS) sampleConfigSelect.add(new Option(label, file));

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

// Stands in for the host's context: context.bblock carries the config as a `resources` entry, as
// a bblock.json would declare it. The plugin needs an absolute URL, as a register provides.
function buildContext() {
  if (!configRef) return { bblock: null };
  const ref = new URL(configRef, location.href).href;
  const role = topoRole.checked ? TOPO_VIEWER_CONFIG_ROLE : XY_VIEWER_CONFIG_ROLE;
  return { bblock: { resources: [{ role, ref, format: 'application/json' }] } };
}

function detectMimeType(name) {
  return name.endsWith('.geojson') ? 'application/geo+json' : 'application/json';
}

function renderCurrentDocument() {
  if (plugin) {
    plugin.destroy(host);
    plugin = null;
  }
  host.replaceChildren();
  if (!currentDocument) return;

  const { content, label, mimeType } = currentDocument;
  const candidates = [{ type: mimeType, content, url: null, label }];
  const instance = new XYSectionPlugin(candidates, buildContext());

  if (!instance.matches()) {
    statusEl.textContent = `${label}: no match (needs a topo-feature document with 3D place coordinates and floor levels)`;
    return;
  }

  plugin = instance;
  const role = configRef && topoRole.checked ? ' (as Three.js config)' : '';
  statusEl.textContent = `${label} — config: ${configLabel}${role}`;
  try {
    // Errors from the plugin's own async work surface in the tab/console, as in the real viewer.
    plugin.render(host);
  } catch (e) {
    statusEl.textContent = `${label}: render() threw — ${e.message}`;
    console.error(e);
  }
}

// A short name for a config path: its key in the sample list, else its last two path segments.
function configName(path) {
  if (!path) return 'none';
  return SAMPLE_CONFIGS.find(c => c.file === path)?.key ?? path.split('/').slice(-2).join('/');
}

function setDocument(content, label, mimeType = 'application/json') {
  currentDocument = { content, label, mimeType };
  renderCurrentDocument();
}

function setConfig(ref, label) {
  if (configBlobUrl && configBlobUrl !== ref) URL.revokeObjectURL(configBlobUrl);
  configBlobUrl = ref?.startsWith('blob:') ? ref : null;
  configRef = ref;
  configLabel = ref ? label : 'none';
  configFileInput.value = '';
  configUrlInput.value = '';
  sampleConfigSelect.value = SAMPLE_CONFIGS.some(c => c.file === ref) ? ref : '';
}

async function loadDocumentUrl(url, label, config = null) {
  statusEl.textContent = `Loading ${label}…`;
  try {
    const content = await fetchText(url);
    setConfig(config, configName(config));
    setDocument(content, label, detectMimeType(url));
  } catch (e) {
    statusEl.textContent = `Failed to load ${label}: ${e.message}`;
    console.error(e);
  }
}

// `config`: undefined = the fixture's own config, null = none, or a config path.
async function loadFixture(file, config) {
  const fixture = FIXTURES.find(f => f.file === file);
  fixtureSelect.value = file;
  await loadDocumentUrl(fixture.file, fixture.file.split('/').pop(), config === undefined ? fixture.config : config);
}

fixtureSelect.addEventListener('change', () => loadFixture(fixtureSelect.value));

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  setConfig(null);
  setDocument(await file.text(), file.name, detectMimeType(file.name));
});

$('urlLoad').addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadDocumentUrl(url, url);
});

sampleConfigSelect.addEventListener('change', () => {
  const file = sampleConfigSelect.value;
  setConfig(file || null, configName(file));
  renderCurrentDocument();
});

configFileInput.addEventListener('change', () => {
  const file = configFileInput.files[0];
  if (!file) return;
  // A blob: URL is fetch()-able exactly like a register's absolute resource URL.
  setConfig(URL.createObjectURL(file), file.name);
  renderCurrentDocument();
});

$('configUrlLoad').addEventListener('click', () => {
  const url = configUrlInput.value.trim();
  if (!url) return;
  setConfig(url, url);
  renderCurrentDocument();
});

$('configClear').addEventListener('click', () => {
  setConfig(null);
  renderCurrentDocument();
});

topoRole.addEventListener('change', renderCurrentDocument);

$('tabSize').addEventListener('change', e => {
  host.classList.toggle('tab-size', e.target.checked);
});

// The starting state can come from the page URL, for bookmarkable checks:
//   ?fixture=<fixture file name>&config=<sample config key | none>&tabsize=1&topo=1
function initialState() {
  const params = new URLSearchParams(location.search);
  const fixture = FIXTURES.find(f => f.file.split('/').pop() === params.get('fixture'))?.file ?? FIXTURES[0].file;
  const configParam = params.get('config');
  const config = configParam === null ? undefined : (SAMPLE_CONFIGS.find(c => c.key === configParam)?.file ?? null);
  topoRole.checked = params.get('topo') === '1';
  if (params.get('tabsize') === '1') {
    $('tabSize').checked = true;
    host.classList.add('tab-size');
  }
  return { fixture, config };
}

const { fixture: initialFixture, config: initialConfig } = initialState();
loadFixture(initialFixture, initialConfig);
