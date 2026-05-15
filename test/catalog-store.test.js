const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogEntry, upsertCatalogEntry } = require('../src/catalog-store');

function makeParsedSpec(version, pathsCount = 1) {
  return {
    title: 'Spec',
    description: '',
    oasVersion: '3.0.1',
    version,
    servers: ['https://api.example.com'],
    pathsCount,
    tags: [],
    document: { openapi: '3.0.1', info: { version }, paths: { '/a': {} } },
  };
}

test('creates history when a spec changes', () => {
  const catalog = [];
  const first = createCatalogEntry({
    id: 'demo',
    sourceUrl: 'https://example.com/spec.yaml',
    parsedSpec: makeParsedSpec('1.0.0'),
    contentHash: 'hash-a',
    fetchedAt: '2026-05-15T00:00:00.000Z',
  });

  let outcome = upsertCatalogEntry(catalog, first);
  assert.equal(outcome.action, 'new');
  assert.equal(catalog.length, 1);

  const next = createCatalogEntry({
    id: 'demo',
    sourceUrl: 'https://example.com/spec.yaml',
    parsedSpec: makeParsedSpec('1.1.0', 2),
    contentHash: 'hash-b',
    fetchedAt: '2026-05-15T01:00:00.000Z',
    previousEntry: catalog[0],
    previousHash: 'hash-a',
    diff: { added: ['/b'], removed: [] },
  });

  outcome = upsertCatalogEntry(catalog, next);
  assert.equal(outcome.action, 'updated');
  assert.equal(catalog[0].latest_version, '1.1.0');
  assert.equal(catalog[0].history.length, 1);
  assert.equal(catalog[0].history[0].version, '1.0.0');
});
