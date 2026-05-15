async function searchGithubCode({ token, query, perPage = 10, page = 1, fetchImpl = fetch }) {
  const url = new URL('https://api.github.com/search/code');
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'openapi-spec-crawler',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function resolveRawGithubUrl(item, token, fetchImpl = fetch) {
  if (!item?.repository?.full_name || !item?.path) {
    throw new Error('Invalid GitHub search item');
  }

  const repoInfo = await fetchRepositoryInfo(item.repository.full_name, token, fetchImpl);
  const branch = repoInfo.default_branch || 'main';
  return `https://raw.githubusercontent.com/${item.repository.full_name}/${branch}/${item.path}`;
}

async function fetchRepositoryInfo(fullName, token, fetchImpl = fetch) {
  const url = `https://api.github.com/repos/${fullName}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'openapi-spec-crawler',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(url, { headers });

  if (!response.ok) {
    throw new Error(`Repository lookup failed for ${fullName}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

module.exports = {
  searchGithubCode,
  resolveRawGithubUrl,
};
