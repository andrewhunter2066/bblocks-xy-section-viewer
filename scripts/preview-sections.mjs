#!/usr/bin/env node
// Writes a bare SVG of every floor level's section to dist/section-<name>-L<level>.svg, straight
// from the geometry modules — a quick visual check of the slicer before the plugin UI and
// harness exist. Not part of the plugin; dist/ is gitignored.
//
// Usage: node scripts/preview-sections.mjs [topo-feature.json ...]
// (defaults to both harness fixtures; in WSL use node.exe)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { buildLevels } from '../src/js/utils/levels.js';
import { buildMaps } from '../src/js/utils/topology.js';
import { sectionContainer } from '../src/js/utils/section.js';

const MARGIN = 2; // metres around the drawing
const files = process.argv.slice(2);
if (!files.length) {
  files.push('harness/fixtures/built-strata-example-1.json', 'harness/fixtures/4-unit-up-down-with-parcel.json');
}

mkdirSync('dist', { recursive: true });
for (const file of files) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const maps = buildMaps(doc);
  const name = basename(file, '.json');
  for (const level of buildLevels(doc)) {
    const shapes = level.solids.map(solid => ({
      name: solid.properties?.name ?? solid.id,
      ...sectionContainer(solid, maps, level.z),
    }));
    const points = shapes.flatMap(s => [...s.loops, ...s.polylines].flat());
    if (!points.length) continue;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const x0 = Math.min(...xs) - MARGIN;
    const y1 = Math.max(...ys) + MARGIN;
    const width = Math.max(...xs) + MARGIN - x0;
    const height = y1 - (Math.min(...ys) - MARGIN);
    // SVG y runs down; northing runs up.
    const xy = ([x, y]) => `${(x - x0).toFixed(3)} ${(y1 - y).toFixed(3)}`;
    const body = shapes.map((shape, i) => {
      const d = [
        ...shape.loops.map(loop => `M${loop.map(xy).join('L')}Z`),
        ...shape.polylines.map(line => `M${line.map(xy).join('L')}`),
      ].join('');
      return `<path d="${d}" fill-rule="evenodd" fill="hsl(${(i * 67) % 360} 60% 60% / .5)" stroke="black" stroke-width="0.05"><title>${shape.name}</title></path>`;
    }).join('\n');
    const out = `dist/section-${name}-L${level.level}.svg`;
    writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(3)} ${height.toFixed(3)}" width="800">\n${body}\n</svg>\n`);
    const summary = shapes.map(s => `${s.name}: ${s.loops.length} loop(s)${s.polylines.length ? `, ${s.polylines.length} open` : ''}`);
    console.log(`${out}  Z = ${level.z.toFixed(3)} m\n  ${summary.join('\n  ')}`);
  }
}
