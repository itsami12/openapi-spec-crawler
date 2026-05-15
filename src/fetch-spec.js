const { sha256 } = require('./hash');

async function fetchSpec(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const headers = new Headers(options.headers || {});

  if (options.etag) {
    headers.set('If-None-Match', options.etag);
  }

  if (options.lastModified) {
    headers.set('If-Modified-Since', options.lastModified);
  }

  const response = await fetchImpl(url, { headers });

  if (response.status === 304) {
    return {
      notModified: true,
      status: 304,
    };
  }

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();

  return {
    notModified: false,
    status: response.status,
    content,
    contentHash: sha256(content),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
}

module.exports = { fetchSpec };
