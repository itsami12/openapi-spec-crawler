const fs = require('node:fs/promises');
const path = require('node:path');

async function loadCatalog(catalogPath) {
  try {
    const raw = await fs.readFile(catalogPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function saveCatalog(catalogPath, catalog) {
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

function createCatalogEntry({ id, sourceUrl, parsedSpec, contentHash, fetchedAt, etag, lastModified, previousEntry, previousHash, diff }) {
  const baseHistory = Array.isArray(previousEntry?.history) ? previousEntry.history.map((item) => ({ ...item })) : [];
  const history = [...baseHistory];

  if (previousEntry) {
    history.push({
      version: previousEntry.latest_version,
      hash: previousHash,
      fetched_at: previousEntry.fetched_at,
      paths_count: previousEntry.paths_count,
      diff: diff || null,
    });
  }

  return {
    id,
    source_url: sourceUrl,
    title: parsedSpec.title,
    description: parsedSpec.description,
    oas_version: parsedSpec.oasVersion,
    latest_version: parsedSpec.version,
    paths_count: parsedSpec.pathsCount,
    servers: parsedSpec.servers,
    tags: parsedSpec.tags,
    fetched_at: fetchedAt,
    status: 'active',
    etag: etag || null,
    last_modified: lastModified || null,
    content_hash: contentHash,
    history,
  };
}

function upsertCatalogEntry(catalog, nextEntry) {
  const index = catalog.findIndex((entry) => entry.id === nextEntry.id);

  if (index === -1) {
    catalog.push(nextEntry);
    return { catalog, action: 'new' };
  }

  const existing = catalog[index];
  const changed = existing.content_hash !== nextEntry.content_hash || existing.latest_version !== nextEntry.latest_version;

  if (!changed) {
    catalog[index] = {
      ...existing,
      fetched_at: nextEntry.fetched_at,
      etag: nextEntry.etag,
      last_modified: nextEntry.last_modified,
      status: 'active',
    };
    return { catalog, action: 'unchanged' };
  }

  catalog[index] = {
    ...nextEntry,
    history: nextEntry.history,
  };

  return { catalog, action: 'updated' };
}

module.exports = {
  loadCatalog,
  saveCatalog,
  createCatalogEntry,
  upsertCatalogEntry,
};
