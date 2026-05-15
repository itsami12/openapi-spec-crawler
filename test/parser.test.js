const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSpec } = require('../src/spec-parser');

test('parses OpenAPI 3 YAML', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'openapi-v1.yaml'), 'utf8');
  const parsed = parseSpec(content, 'fixture');

  assert.equal(parsed.title, 'Demo Payments API');
  assert.equal(parsed.oasVersion, '3.0.1');
  assert.equal(parsed.version, '1.0.0');
  assert.equal(parsed.pathsCount, 2);
  assert.deepEqual(parsed.tags, ['payments', 'payments']);
  assert.deepEqual(parsed.servers, ['https://api.example.com/v1']);
});

test('parses Swagger 2 JSON', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'swagger-v2.json'), 'utf8');
  const parsed = parseSpec(content, 'fixture');

  assert.equal(parsed.title, 'Legacy Inventory API');
  assert.equal(parsed.oasVersion, '2.0');
  assert.equal(parsed.version, '2.4.0');
  assert.equal(parsed.pathsCount, 1);
  assert.deepEqual(parsed.servers, ['https://inventory.example.com/api']);
});
