# OpenAPI Spec Crawler

This project is a compact implementation of the APIMatic screening task: discover OpenAPI specs, parse them, version them, and persist a catalog in JSON.

## What it does

- Uses GitHub Code Search as a discovery source.
- Supports OpenAPI 2.x and 3.x JSON/YAML documents.
- Stores catalog entries in `catalog.json` with immutable history.
- Computes content hashes and path diffs to detect updates.
- Supports conditional requests with `ETag` and `Last-Modified`.
- Includes a local demo run and a test suite.

## Project layout

- `src/github-search.js` discovers candidate specs with the GitHub Code Search API.
- `src/spec-parser.js` normalizes OpenAPI 2/3 documents.
- `src/catalog-store.js` manages the versioned JSON catalog.
- `src/crawler.js` coordinates discovery, fetch, parse, and persistence.
- `src/update.js` runs an incremental refresh cycle.
- `src/cli.js` exposes `crawl`, `update`, and `demo` commands.
- `test/` contains unit tests for parsing, diffing, and catalog versioning.

## Setup

```bash
npm install
```

## Run

Run a crawl with GitHub search:

```bash
npm run crawl -- --token <github_token> --query "filename:openapi.yaml" --limit 5 --catalog catalog.json
```

Run the local demo using bundled fixtures:

```bash
npm run demo
```

Run tests:

```bash
npm test
```

## Design decisions

- The catalog stores a full history array per spec so updates are auditable.
- Content hash is used alongside semantic version fields because spec version strings are not always enough to detect changes.
- GitHub discovery is intentionally limited to small batches so the crawler can be run safely during screening.
- The implementation favors clarity and maintainability over aggressive crawling heuristics.

## Output shape

Each catalog entry includes:

- `id`
- `source_url`
- `title`
- `oas_version`
- `latest_version`
- `paths_count`
- `fetched_at`
- `status`
- `etag`
- `last_modified`
- `history`
