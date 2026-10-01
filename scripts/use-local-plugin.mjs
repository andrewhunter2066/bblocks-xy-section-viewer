#!/usr/bin/env node
// Points a locally built register (build-local/register.json, written by ./build.sh) at the local
// plugin build instead of the published jsDelivr copy, for testing in the real viewer (./view.sh).
//
// view.sh's bblocks-viewer container serves this whole repository under /register/, so after
// `npm run build` the plugin is reachable same-origin at
// http://localhost:9090/register/dist/index.js — no separate server or CORS setup needed.
//
// Usage: npm run local-register [-- <plugin-url>]
// Re-run after every ./build.sh (the postprocessor rewrites register.json from
// bblocks-config.yaml each time).
//
// Adapted from bblocks-cesium-viewer's scripts/use-local-plugin.mjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_LOCAL_URL, EXPORT_NAME, useLocalPlugin } from './lib/local-register.mjs';

const registerFile = new URL('../build-local/register.json', import.meta.url);
const pluginUrl = process.argv[2] ?? DEFAULT_LOCAL_URL;

let register;
try {
  register = JSON.parse(readFileSync(registerFile, 'utf8'));
} catch (e) {
  console.error(`use-local-plugin: cannot read build-local/register.json (${e.message}). Run ./build.sh first.`);
  process.exit(1);
}

if (pluginUrl === DEFAULT_LOCAL_URL && !existsSync(new URL('../dist/index.js', import.meta.url))) {
  console.warn('use-local-plugin: dist/index.js does not exist yet — run `npm run build` before ./view.sh.');
}

const { register: updated, action } = useLocalPlugin(register, pluginUrl);
writeFileSync(registerFile, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`use-local-plugin: ${action} ${EXPORT_NAME} -> ${pluginUrl}`);
