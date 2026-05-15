const YAML = require('yaml');

function parseSpec(content, sourceUrl = '') {
  const trimmed = content.trim();
  const document = trimmed.startsWith('{') ? JSON.parse(trimmed) : YAML.parse(trimmed);

  const isSwagger = Boolean(document.swagger);
  const isOpenApi = Boolean(document.openapi);

  if (!isSwagger && !isOpenApi) {
    throw new Error(`Unsupported document: ${sourceUrl || 'unknown source'}`);
  }

  const info = document.info || {};
  const paths = document.paths || {};
  const tags = collectTags(document);

  const servers = isOpenApi
    ? (Array.isArray(document.servers) ? document.servers.map((server) => server.url).filter(Boolean) : [])
    : buildSwaggerServers(document);

  return {
    title: info.title || 'Untitled API',
    description: info.description || '',
    oasVersion: document.openapi || document.swagger,
    version: info.version || '',
    servers,
    pathsCount: Object.keys(paths).length,
    tags,
    document,
  };
}

function collectTags(document) {
  const tags = [];

  if (Array.isArray(document.tags)) {
    for (const tag of document.tags) {
      const name = typeof tag === 'string' ? tag : tag.name;
      if (name) {
        tags.push(name);
      }
    }
  }

  const paths = document.paths || {};
  for (const pathItem of Object.values(paths)) {
    for (const operation of Object.values(pathItem || {})) {
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        continue;
      }

      if (Array.isArray(operation.tags)) {
        for (const tag of operation.tags) {
          if (tag) {
            tags.push(tag);
          }
        }
      }
    }
  }

  return tags;
}

function buildSwaggerServers(document) {
  const scheme = Array.isArray(document.schemes) && document.schemes.length > 0 ? document.schemes[0] : 'https';
  const host = document.host || '';
  const basePath = document.basePath || '';

  if (!host) {
    return [];
  }

  return [`${scheme}://${host}${basePath}`];
}

module.exports = { parseSpec };
