// Keeps the xySectionViewerConfig building block's JSON Schema and the plugin's config handling in
// step: the block's examples and tests validate (or fail) as named, every config the schema accepts
// loads without warnings, every `xySection` value the schema rejects the plugin also drops (with a
// warning), and the schema's names match what the code implements. Adapted from
// bblocks-cesium-viewer's src/js/block-schema.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';
import { parseConfig } from './utils/config.js';
import { DEFAULT_XY_OPTIONS, resolveXYOptions } from './utils/xy-options.js';
import { OUTLINED_GEOMETRIES, SECTIONED_GEOMETRIES } from './xy-scene.js';
import { XY_VIEWER_CONFIG_ROLE, findConfigResource } from './utils/load-config.js';

const repo = new URL('../../', import.meta.url);
const blockDir = new URL('_sources/xySectionViewerConfig/', repo);
const demoDir = new URL('_sources/xySectionViewerDemo/', repo);
const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const readYaml = url => parseYaml(readFileSync(url, 'utf8'));

const schema = readYaml(new URL('schema.yaml', blockDir));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const errorsOf = config => (validate(config) ? [] : validate.errors.map(e => `${e.instancePath} ${e.message}`));

const examples = readYaml(new URL('examples.yaml', blockDir)).examples
  .flatMap(example => example.snippets.map(snippet => ({ title: example.title, url: new URL(snippet.ref, blockDir) })));

test('the block has examples, all referenced by file', () => {
  assert.equal(examples.length, 4);
});

for (const { title, url } of examples) {
  test(`example "${title}" is valid and loads without warnings`, () => {
    const config = readJson(url);
    assert.deepEqual(errorsOf(config), []);
    assert.deepEqual(resolveXYOptions(config.xySection).warnings, []);
    assert.equal(parseConfig(config).rules.length, config.rules?.length ?? 0, 'every rule survives parsing');
  });
}

const testsDir = new URL('tests/', blockDir);
const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.json'));
for (const name of testFiles) {
  const shouldFail = name.endsWith('-fail.json');
  test(`test resource ${name} ${shouldFail ? 'is rejected' : 'is valid'}`, () => {
    const errors = errorsOf(readJson(new URL(name, testsDir)));
    if (shouldFail) assert.ok(errors.length > 0, 'expected a validation error');
    else assert.deepEqual(errors, []);
  });
}

test('every xySection value the schema rejects is also dropped by the plugin, with a warning', () => {
  const xyFailures = testFiles.filter(name => name.endsWith('-fail.json'))
    .map(name => [name, readJson(new URL(name, testsDir))])
    .filter(([, config]) => config.xySection);
  assert.ok(xyFailures.length >= 8);
  for (const [name, config] of xyFailures) {
    assert.ok(resolveXYOptions(config.xySection).warnings.length >= 1, name);
  }
});

test('every valid test resource loads without xySection warnings', () => {
  testFiles.filter(name => !name.endsWith('-fail.json')).forEach(name => {
    assert.deepEqual(resolveXYOptions(readJson(new URL(name, testsDir)).xySection).warnings, [], name);
  });
});

test('the schema\'s geometry names are exactly the ones the view draws', () => {
  assert.deepEqual(
    [...schema.$defs.rule.properties.geometry.enum].sort(),
    [...SECTIONED_GEOMETRIES, ...OUTLINED_GEOMETRIES].sort(),
  );
});

test('the schema\'s xySection members are exactly the plugin\'s options', () => {
  assert.deepEqual(Object.keys(schema.$defs.xySectionOptions.properties).sort(), Object.keys(DEFAULT_XY_OPTIONS).sort());
});

test('the demo blocks declare their config under the plugin\'s role, and it validates', () => {
  const blocks = readdirSync(demoDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  assert.deepEqual(blocks.sort(), ['builtStrata', 'fourUnit']);
  for (const block of blocks) {
    const dir = new URL(`${block}/`, demoDir);
    const resource = findConfigResource(readJson(new URL('bblock.json', dir)));
    assert.equal(resource?.role, XY_VIEWER_CONFIG_ROLE, block);
    assert.equal(resource.ref, 'viewer-config.json', block);
    assert.deepEqual(errorsOf(readJson(new URL(resource.ref, dir))), [], block);
  }
});

test('each demo block\'s example is a harness fixture that validates against the block\'s schema', () => {
  for (const block of ['builtStrata', 'fourUnit']) {
    const dir = new URL(`${block}/`, demoDir);
    const demoSchema = readYaml(new URL('schema.yaml', dir));
    const check = new Ajv2020().compile(demoSchema);
    const refs = readYaml(new URL('examples.yaml', dir)).examples.flatMap(e => e.snippets.map(s => s.ref));
    assert.equal(refs.length, 1, block);
    assert.match(refs[0], /^\.\.\/\.\.\/\.\.\/harness\/fixtures\//, block);
    assert.ok(check(readJson(new URL(refs[0], dir))), `${block}: ${JSON.stringify(check.errors)}`);
  }
});

// bblocks-viewer neither fetches nor previews an example snippet over 1 MiB (it offers a
// download instead), so no view plugin — this one included — ever sees it.
const VIEWER_PREVIEW_LIMIT_BYTES = 1024 * 1024;

test('each demo block\'s example is small enough for the viewer to hand to view plugins', () => {
  for (const block of ['builtStrata', 'fourUnit']) {
    const dir = new URL(`${block}/`, demoDir);
    for (const example of readYaml(new URL('examples.yaml', dir)).examples) {
      for (const { ref } of example.snippets) {
        const size = statSync(new URL(ref, dir)).size;
        assert.ok(size < VIEWER_PREVIEW_LIMIT_BYTES, `${block}: ${ref} is ${size} bytes`);
      }
    }
  }
});

test('the register declares this plugin as its own view plugin, with the right export', () => {
  const config = readYaml(new URL('bblocks-config.yaml', repo));
  assert.equal(config['identifier-prefix'], 'ogc.bbr.xysection.');
  const [plugin] = config.viewer['view-plugins'];
  assert.equal(plugin.export, 'XYSectionPlugin');
  assert.match(plugin.url, /\/bblocks-xy-section-viewer@dist\/index\.js$/);
});

test('bblocks:// links in the blocks\' descriptions name blocks that exist', () => {
  const ids = ['xySectionViewerConfig', 'xySectionViewerDemo.builtStrata', 'xySectionViewerDemo.fourUnit']
    .map(id => `ogc.bbr.xysection.${id}`);
  const texts = [
    new URL('description.md', blockDir), new URL('examples.yaml', blockDir),
    new URL('builtStrata/description.md', demoDir), new URL('fourUnit/description.md', demoDir),
    new URL('builtStrata/bblock.json', demoDir), new URL('fourUnit/bblock.json', demoDir),
  ].map(url => readFileSync(url, 'utf8'));
  const links = texts.flatMap(text => [...text.matchAll(/bblocks:\/\/([\w.]+)/g)].map(m => m[1]));
  assert.ok(links.length >= 6);
  links.forEach(link => assert.ok(ids.includes(link), link));
});
