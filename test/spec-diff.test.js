const test = require('node:test');
const assert = require('node:assert/strict');
const { diffPaths } = require('../src/spec-diff');

test('computes added and removed paths', () => {
  const previousSpec = { paths: { '/a': {}, '/b': {} } };
  const currentSpec = { paths: { '/b': {}, '/c': {} } };
  const diff = diffPaths(previousSpec, currentSpec);

  assert.deepEqual(diff.added, ['/c']);
  assert.deepEqual(diff.removed, ['/a']);
  assert.equal(diff.addedCount, 1);
  assert.equal(diff.removedCount, 1);
});
