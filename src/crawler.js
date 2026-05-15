const path = require('node:path');
const fs = require('node:fs/promises');
const { createLogger } = require('./logger');
const { loadCatalog, saveCatalog, createCatalogEntry, upsertCatalogEntry } = require('./catalog-store');
const { parseSpec } = require('./spec-parser');
const { fetchSpec } = require('./fetch-spec');
const { searchGithubCode, resolveRawGithubUrl } = require('./github-search');
const { diffPaths } = require('./spec-diff');
const { sha256 } = require('./hash');

function makeSourceId(sourceUrl) {
  return `source:${sourceUrl}`;
}

async function crawl({
  catalogPath = path.resolve(process.cwd(), 'catalog.json'),
  token,
  queries = ['filename:openapi.yaml OR filename:openapi.json OR filename:swagger.yaml OR filename:swagger.json'],
  seeds = [],
  limit = 5,
  logger = createLogger(),
  fetchImpl = fetch,
} = {}) {
  const catalog = await loadCatalog(catalogPath);
  const discoveredSources = [];

  for (const seed of seeds) {
    discoveredSources.push({
      id: seed.id || makeSourceId(seed.url),
      sourceUrl: seed.url,
      label: seed.label || seed.url,
      type: seed.type || 'local',
    });
  }

  if (queries.length > 0 && discoveredSources.length < limit) {
    for (const query of queries) {
      const items = await searchGithubCode({ token, query, perPage: Math.min(10, limit - discoveredSources.length), fetchImpl });

      for (const item of items) {
        if (discoveredSources.length >= limit) {
          break;
        }

        const sourceUrl = await resolveRawGithubUrl(item, token, fetchImpl);
        discoveredSources.push({
          id: `github:${item.repository.full_name}/${item.path}`,
          sourceUrl,
          label: `${item.repository.full_name}/${item.path}`,
          type: 'github',
        });
      }

      if (discoveredSources.length >= limit) {
        break;
      }
    }
  }

  const summary = { new: 0, updated: 0, unchanged: 0, failed: 0 };
  const results = [];

  for (const source of discoveredSources.slice(0, limit)) {
    try {
      const fetched = await fetchSource(source, { fetchImpl });
      if (fetched.notModified && source.previousEntry) {
        summary.unchanged += 1;
        results.push({ id: source.id, action: 'unchanged' });
        continue;
      }

      const parsedSpec = parseSpec(fetched.content, source.sourceUrl);
      const previousEntry = catalog.find((entry) => entry.id === source.id);
      const previousHash = previousEntry?.content_hash || null;
      const diff = previousEntry ? diffPaths(previousEntry.spec_snapshot || {}, parsedSpec.document) : null;
      const nextEntry = createCatalogEntry({
        id: source.id,
        sourceUrl: source.sourceUrl,
        parsedSpec,
        contentHash: fetched.contentHash,
        fetchedAt: new Date().toISOString(),
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        previousEntry,
        previousHash,
        diff,
      });

      nextEntry.spec_snapshot = parsedSpec.document;
      const outcome = upsertCatalogEntry(catalog, nextEntry);
      summary[outcome.action] += 1;
      results.push({ id: source.id, action: outcome.action, title: parsedSpec.title });

      logger.info('spec processed', {
        id: source.id,
        action: outcome.action,
        title: parsedSpec.title,
        oasVersion: parsedSpec.oasVersion,
      });
    } catch (error) {
      summary.failed += 1;
      results.push({ id: source.id, action: 'failed', error: error.message });
      logger.error('spec processing failed', { id: source.id, error: error.message });
    }
  }

  await saveCatalog(catalogPath, catalog);

  return {
    catalogPath,
    summary,
    results,
    catalog,
  };
}

async function fetchSource(source, { fetchImpl = fetch } = {}) {
  if (source.type === 'local') {
    const content = await fs.readFile(source.sourceUrl, 'utf8');
    return {
      notModified: false,
      content,
      contentHash: sha256(content),
      etag: null,
      lastModified: null,
    };
  }

  return fetchSpec(source.sourceUrl, {
    fetchImpl,
    etag: source.etag,
    lastModified: source.lastModified,
  });
}

module.exports = { crawl };
